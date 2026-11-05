import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

import type { ServiceRow, Snapshot, TestRun } from '../types/index'
import { isStale } from './pytest'
import { pinPlan, readEdits, readSelected, readSnapshot, readTests, select } from './state'

const MAX_CHANGED_FILES = 20

const basename = (p: string): string => p.slice(p.lastIndexOf('/') + 1)
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

const changesLabel = (row: ServiceRow): string | null => {
  if (row.changes === null) return 'git unavailable'
  if (row.changes.length === 0) return null
  const added = row.changes.reduce((sum, c) => sum + c.added, 0)
  const removed = row.changes.reduce((sum, c) => sum + c.removed, 0)
  return `+${added} −${removed}  ${plural(row.changes.length, 'file')}`
}

/** `just now` under a minute, then `N min ago`, then `N h ago` from an hour. */
export const ageLabel = (at: number, now: number): string => {
  const minutes = Math.floor(Math.max(0, now - at) / 60_000)
  if (minutes < 1) return 'just now'
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago`
}

/** When files in the service last changed, by an edit Claude made or any other means (mtime). */
const changedAt = (row: ServiceRow, edits: Record<string, number>): number | undefined => {
  const times = [Object.hasOwn(edits, row.name) ? edits[row.name] : null, row.lastChangeAt].filter(
    (t): t is number => t !== null,
  )
  return times.length === 0 ? undefined : Math.max(...times)
}

const testsLabel = (run: TestRun | undefined, lastChangeAt: number | undefined, now: number): string | null =>
  run === undefined
    ? null
    : `tests ${run.passed ? '✓' : '✗'}${isStale(run, lastChangeAt) ? ' (stale)' : ''} · ${ageLabel(run.at, now)}`

/** True when Start work applies: a per-service plan, nothing to wait on, not done. */
export const canStart = (row: ServiceRow): boolean => row.planPath !== null && row.waitingOn.length === 0 && !row.isDone

/** True when every service the plan names is done. */
export const canShip = (snap: Snapshot): boolean => {
  const planned = snap.services.filter(r => r.inPlan)
  return snap.rootPlan !== null && planned.length > 0 && planned.every(r => r.isDone)
}

/** The status line, e.g. `3 services · orders 1/4 · tests ✗ payments`; undefined without a root plan. */
export const statusLine = (
  snap: Snapshot | null,
  tests: Record<string, TestRun>,
  edits: Record<string, number>,
): string | undefined => {
  if (snap === null || snap.rootPlan === null) return undefined
  const planned = snap.services.filter(r => r.inPlan)
  const parts = [plural(planned.length, 'service')]
  if (canShip(snap)) parts.push('ready to ship')
  else {
    const active = planned.filter(canStart).map(r => `${r.name} ${r.done}/${r.total}`)
    if (active.length > 0) parts.push(active.join(', '))
  }
  const failing = snap.services
    .filter(r => Object.hasOwn(tests, r.name) && !tests[r.name].passed)
    .map(r => (isStale(tests[r.name], changedAt(r, edits)) ? `${r.name} (stale)` : r.name))
  if (failing.length > 0) parts.push(`tests ✗ ${failing.join(', ')}`)
  return parts.join(' · ')
}

const rowText = (
  row: ServiceRow,
  width: number,
  isSelected: boolean,
  tests: Record<string, TestRun>,
  edits: Record<string, number>,
  now: number,
): string => {
  const mark = isSelected ? '▶' : row.isDone ? '●' : '○'
  const parts = [`${mark} ${row.name.padEnd(width)}`]
  if (row.inPlan) parts.push(row.planPath === null ? 'no plan' : `plan ${row.done}/${row.total}${row.isDone ? ' ✓' : ''}`)
  const changes = changesLabel(row)
  if (changes !== null) parts.push(changes)
  if (row.outOfScope) parts.push('⚠ not in plan')
  if (row.waitingOn.length > 0) parts.push(`waiting on ${row.waitingOn.join(', ')}`)
  const test = testsLabel(
    Object.hasOwn(tests, row.name) ? tests[row.name] : undefined,
    changedAt(row, edits),
    now,
  )
  if (test !== null) parts.push(test)
  if (row.todos > 0) parts.push(plural(row.todos, 'todo'))
  return parts.join('  ')
}

/** Asks Claude in the person's words. */
function submit($: EngineInterface, text: string) {
  return $.prompt.submit({ text, asUser: true })
}

/** Runs `/workflows:work <args>` as if typed, under the name it is registered by; a plugin may not submit a slash line as a prompt. */
function work($: EngineInterface, command: string, args: string) {
  return $.command.run({ command, args })
}

/** Runs a press's action; a failure becomes a short toast instead of an unhandled rejection. */
async function attempt($: EngineInterface, label: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action()
  } catch (err) {
    $.ui.toast(`services-pane: ${label} failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Draws the Services pane from the stored snapshot; `refresh` rebuilds it (after Switch plan). */
export async function drawPane($: EngineInterface, e: RenderInput<'Pane'>, refresh: () => Promise<void>) {
  const { Box, Text, Button } = $.ui.resolve(e)
  const snap = await readSnapshot($)
  if (snap === null) return <Text dimColor>Loading services…</Text>
  if (snap.services.length === 0) return <Text>No services found (single-service repo).</Text>

  const selected = await readSelected($)
  const tests = await readTests($)
  const edits = await readEdits($)
  // Redrawn on every refresh and, while the pane is open, once a minute (register.tsx).
  const now = await $.clock.now()
  const width = Math.max(...snap.services.map(r => r.name.length))
  const current = snap.services.find(r => r.name === selected) ?? null

  const rowButton = (row: ServiceRow) => (
    <Button key={row.name} plain onPress={() => select($, row.name)}>
      {rowText(row, width, row.name === selected, tests, edits, now)}
    </Button>
  )

  const sections: RenderElement[] = []
  if (snap.rootPlan === null) sections.push(...snap.services.map(rowButton))
  else {
    let wave: number | null = null
    for (const row of snap.services.filter(r => r.inPlan)) {
      if (row.wave !== wave) {
        wave = row.wave
        sections.push(<Text bold>{`Wave ${wave ?? '?'}`}</Text>)
      }
      sections.push(rowButton(row))
    }
    const others = snap.services.filter(r => !r.inPlan)
    if (others.length > 0) sections.push(<Text bold>Not in plan</Text>, ...others.map(rowButton))
  }

  const details: RenderElement[] = []
  if (current !== null) {
    details.push(<Text> </Text>, <Text bold>{`${current.name} › tasks`}</Text>)
    if (current.planPath === null) details.push(<Text dimColor>  no per-service plan</Text>)
    for (const task of current.tasks) {
      details.push(<Text>{`  ${current.doneTasks.includes(task.n) ? '✓' : '·'} ${task.title}`}</Text>)
      for (const file of task.files) details.push(<Text dimColor>{`      ${file}`}</Text>)
    }
    if (current.changes !== null && current.changes.length > 0) {
      details.push(<Text bold>{`${current.name} › changes`}</Text>)
      for (const c of current.changes.slice(0, MAX_CHANGED_FILES)) {
        details.push(<Text>{`  ${c.isNew ? 'new  ' : `+${c.added} −${c.removed}`}  ${c.path}`}</Text>)
      }
      if (current.changes.length > MAX_CHANGED_FILES) {
        details.push(<Text dimColor>{`  … ${current.changes.length - MAX_CHANGED_FILES} more`}</Text>)
      }
    }
    const run = Object.hasOwn(tests, current.name) ? tests[current.name] : undefined
    if (run !== undefined) {
      details.push(<Text>{`${testsLabel(run, changedAt(current, edits), now)} · ${run.summary}`}</Text>)
    }
  }

  const actions: RenderElement[] = []
  const workCommand = snap.workCommand
  if (workCommand !== null && current !== null && current.planPath !== null && canStart(current)) {
    const planPath = current.planPath
    const name = current.name
    actions.push(
      <Button
        key="start"
        variant="primary"
        label="Start work"
        onPress={() => attempt($, 'Start work', () => work($, workCommand, `${planPath} --services ${name} --no-ship`))}
      />,
    )
  }
  if (workCommand !== null && canShip(snap) && snap.rootPlan !== null) {
    const rootPlan = snap.rootPlan
    actions.push(
      <Button key="ship" variant="primary" label="Ship" onPress={() => attempt($, 'Ship', () => work($, workCommand, rootPlan))} />,
    )
  }
  if (current !== null && current.planPath !== null) {
    const planPath = current.planPath
    actions.push(<Button key="open" label="Open plan" onPress={() => attempt($, 'Open plan', () => submit($, `Show me ${planPath}`))} />)
  }
  if (current !== null) {
    const name = current.name
    actions.push(
      <Button
        key="diff"
        label="Show diff"
        onPress={() => attempt($, 'Show diff', () => submit($, `Summarize the changes in ${name}/ on this branch.`))}
      />,
    )
  }
  if (snap.plans.length > 1) {
    const plans = snap.plans
    const next = plans[(plans.indexOf(snap.rootPlan ?? '') + 1) % plans.length]
    actions.push(
      <Button
        key="switch"
        label="Switch plan"
        onPress={() =>
          attempt($, 'Switch plan', async () => {
            await pinPlan($, next)
            await refresh()
          })
        }
      />,
    )
  }

  return (
    <Box flexDirection="column">
      <Text dimColor>{`branch: ${snap.branch ?? 'unknown'} · watching ${snap.checkout}`}</Text>
      <Text dimColor>{snap.rootPlan === null ? 'plan: none with services:' : `plan: ${basename(snap.rootPlan)}`}</Text>
      {sections}
      {details}
      {actions.length > 0 && (
        <Box flexDirection="row" gap={1}>
          {actions}
        </Box>
      )}
    </Box>
  )
}
