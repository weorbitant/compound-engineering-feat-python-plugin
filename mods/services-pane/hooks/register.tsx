import type { EngineInterface, Register, Timer, ToolCallInput, ToolCallResult } from 'claude-code'

import { parsePytest, pytestService } from './pytest'
import { buildSnapshot, resolvePath } from './snapshot'
import { readSnapshot, readTests, recordEdit, recordTest, writeSnapshot } from './state'
import { drawPane, statusLine } from './view'

const PANE = 'services-pane'
const TITLE = 'Services'
const REFRESH_MS = 2000
const OBSERVED = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash'])

let pending: Timer | null = null

async function refresh($: EngineInterface): Promise<void> {
  try {
    const snap = await buildSnapshot($, await $.session.cwd())
    await writeSnapshot($, snap)
    $.ui.status(statusLine(snap, await readTests($)))
  } catch (err) {
    $.ui.log(`services-pane: refresh failed: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
  }
}

/** At most one refresh per REFRESH_MS: the first call in a window schedules it, the rest ride along. */
function scheduleRefresh($: EngineInterface): void {
  if (pending !== null) return
  pending = $.clock.after(REFRESH_MS, () => {
    pending = null
    void refresh($)
  })
}

/** The service a path (absolute, or relative to the repo) falls in, or null. */
const serviceOf = (path: string, roots: string[], services: string[]): string | null => {
  let rel = path
  for (const root of roots) {
    if (path.startsWith(`${root}/`)) {
      rel = path.slice(root.length + 1)
      break
    }
  }
  if (rel.startsWith('/')) return null
  const top = rel.replace(/^(\.\/)+/, '').split('/')[0] ?? ''
  return services.includes(top) ? top : null
}

/** What the call printed: core's model-facing text, else the Bash record's streams. */
const outputOf = (ran: ToolCallResult): string => {
  if (ran.deny !== undefined) return ''
  if (typeof ran.text === 'string') return ran.text
  const result: unknown = ran.result
  if (typeof result === 'string') return result
  if (typeof result === 'object' && result !== null) {
    const { stdout, stderr } = result as { stdout?: unknown; stderr?: unknown }
    return [stdout, stderr].filter((s): s is string => typeof s === 'string').join('\n')
  }
  return ''
}

async function observe($: EngineInterface, e: ToolCallInput, ran: ToolCallResult): Promise<void> {
  const snap = await readSnapshot($)
  if (snap === null) return
  const services = snap.services.map(r => r.name)
  const now = await $.clock.now()
  if (e.tool === 'Bash') {
    const service = pytestService(e.command, '', services)
    const run = service === null ? null : parsePytest(outputOf(ran), now)
    if (service !== null && run !== null) await recordTest($, service, run)
    return
  }
  const path = e.tool === 'NotebookEdit' ? e.notebook_path : e.tool === 'Edit' || e.tool === 'Write' ? e.file_path : null
  if (path === null) return
  const cwd = await $.session.cwd()
  const service = serviceOf(path, [resolvePath(cwd, snap.checkout), cwd], services)
  if (service !== null) await recordEdit($, service, now)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'services',
      description: 'Toggle the Services pane: monorepo services, waves, planned vs actual changes, tests',
    })
    void refresh($)
    return next(e)
  })

  on('command.run', { command: 'services' }, async $ => {
    if ((await $.ui.panes()).some(p => p.id === PANE)) {
      await $.ui.close({ id: PANE })
      return { text: 'Services pane closed.' }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    await refresh($)
    return { text: 'Services pane opened.' }
  })

  // Observe only after the tool ran; never delay or change the call itself.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (!OBSERVED.has(String(e.tool)) || ran.deny !== undefined) return ran
    try {
      await observe($, e, ran)
    } catch {
      // observing is best effort
    }
    scheduleRefresh($)
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => drawPane($, e, () => refresh($)))
}
