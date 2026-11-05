import type { EngineInterface, Register, Timer, ToolCallInput, ToolCallResult } from 'claude-code'

import { parsePytest, pytestService, relativeTo } from './pytest'
import { buildSnapshot, resolvePath } from './snapshot'
import { readEdits, readSnapshot, readTests, recordEdit, recordTest, writeSnapshot } from './state'
import { drawPane, statusLine } from './view'

const PANE = 'services-pane'
const TITLE = 'Services'
const REFRESH_MS = 2000
const OBSERVED = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash'])

const AGE_TICK_MS = 60_000
/** A pending refresh older than this was refused or lost: schedule a new one. */
const PENDING_LOST_MS = 3 * REFRESH_MS

let pendingSince: number | null = null
let ticker: Timer | null = null
let buildSeq = 0

async function refresh($: EngineInterface): Promise<void> {
  const mine = ++buildSeq
  try {
    const snap = await buildSnapshot($, await $.session.cwd())
    // A build that started later owns the state; this older one drops its result.
    if (mine !== buildSeq) return
    await writeSnapshot($, snap)
    $.ui.status(statusLine(snap, await readTests($), await readEdits($)))
  } catch (err) {
    $.ui.log(`services-pane: refresh failed: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
  }
}

/**
 * At most one refresh per REFRESH_MS: the first call in a window schedules it, the rest ride along.
 * A timer that never fired (refused by a hook) is replaced once it is PENDING_LOST_MS old.
 */
async function scheduleRefresh($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  if (pendingSince !== null && now - pendingSince < PENDING_LOST_MS) return
  const since = now
  pendingSince = since
  $.clock.after(REFRESH_MS, () => {
    if (pendingSince === since) pendingSince = null
    void refresh($)
  })
}

/** Redraws the pane once a minute while it is open, so test ages move while idle. */
function startTicker($: EngineInterface): void {
  if (ticker === null) ticker = $.clock.every(AGE_TICK_MS, () => $.ui.invalidate('ui.render'))
}

function stopTicker(): void {
  ticker?.cancel()
  ticker = null
}

/** The service a path (absolute, or relative to the repo) falls in, or null. */
const serviceOf = (path: string, roots: string[], services: string[]): string | null => {
  const rel = relativeTo(path, roots)
  if (rel === null) return null
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
  const cwd = await $.session.cwd()
  const roots = [resolvePath(cwd, snap.checkout), cwd]
  if (e.tool === 'Bash') {
    const service = pytestService(e.command, '', services, roots)
    const run = service === null ? null : parsePytest(outputOf(ran), now)
    if (service !== null && run !== null) await recordTest($, service, run)
    return
  }
  const path = e.tool === 'NotebookEdit' ? e.notebook_path : e.tool === 'Edit' || e.tool === 'Write' ? e.file_path : null
  if (path === null) return
  const service = serviceOf(path, roots, services)
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
      stopTicker()
      await $.ui.close({ id: PANE })
      return { text: 'Services pane closed.' }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    startTicker($)
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
    await scheduleRefresh($)
    return ran
  }).catch(($, e, next) => next(e))

  // The person's close mark or key closes the pane too: stop the age ticker with it.
  on('ui.close', { id: PANE }, ($, e, next) => {
    stopTicker()
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => drawPane($, e, () => refresh($)))
}
