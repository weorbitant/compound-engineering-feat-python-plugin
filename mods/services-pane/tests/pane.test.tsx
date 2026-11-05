import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const ROOT = '/repo'
const PLAN = 'docs/superpowers/plans/2026-11-05-refunds.md'
const OLDER = 'docs/superpowers/plans/2026-11-04-older.md'

const PANE = {
  plugin: 'services-pane',
  component: 'Pane',
  requestId: 'services-pane',
  props: {
    title: 'Services',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const rootPlan = (services: Record<string, string[]>): string =>
  [
    '---',
    'services:',
    ...Object.entries(services).flatMap(([name, deps]) =>
      deps.length === 0
        ? [`  ${name}:`, '    depends_on: []']
        : [`  ${name}:`, '    depends_on:', ...deps.map(d => `      - service: ${d}`)],
    ),
    'status: active',
    '---',
    '# Plan',
  ].join('\n')

const servicePlan = (service: string, status: 'active' | 'completed', tasks: number): string =>
  [
    '---',
    `status: ${status}`,
    '---',
    ...Array.from({ length: tasks }, (_, i) => [
      `### Task ${i + 1}: ${service} task ${i + 1}`,
      '**Files:**',
      `- Modify: \`${service}/f${i + 1}.py\``,
      '',
    ]).flat(),
  ].join('\n')

const REFUNDS = { 'lib-common': [], orders: ['lib-common'], payments: ['orders'] }

/** The examples/monorepo layout with the refunds plan; lib-common is done, orders has a ledger. */
const monorepo = (): Record<string, string> => ({
  'lib-common/pyproject.toml': '',
  'orders/pyproject.toml': '',
  'payments/pyproject.toml': '',
  'billing/pyproject.toml': '',
  'README.md': '# repo',
  [PLAN]: rootPlan(REFUNDS),
  [`lib-common/${PLAN}`]: servicePlan('lib-common', 'completed', 3),
  [`orders/${PLAN}`]: servicePlan('orders', 'active', 4),
  [`payments/${PLAN}`]: servicePlan('payments', 'active', 5),
  '.superpowers/sdd/2026-11-05-refunds-2/plan-path': `orders/${PLAN}\n`,
  '.superpowers/sdd/2026-11-05-refunds-2/progress.md': '# ledger\nTask 1: complete (abc123)\n',
  'todos/001-pending-p2-orders-refund.md': 'Fix orders/api.py refund rounding',
  'todos/002-complete-p2-orders-x.md': 'orders/ done already',
})

type Git = (argv: readonly string[], cwd: string) => { exitCode: number; stdout: string }

const NUMSTAT = ['3\t1\tlib-common/a.py', '10\t0\torders/b.py', '2\t2\tdocs/x.md', '1\t0\tbilling/c.py'].join('\n')

const okGit =
  (worktrees = `worktree ${ROOT}\nHEAD abc\nbranch refs/heads/feat/refunds\n`): Git =>
  argv => {
    const sub = argv.slice(1).join(' ')
    if (sub === 'worktree list --porcelain') return { exitCode: 0, stdout: worktrees }
    if (sub === 'rev-parse --abbrev-ref HEAD') return { exitCode: 0, stdout: 'feat/refunds\n' }
    if (sub === 'merge-base HEAD origin/HEAD') return { exitCode: 0, stdout: 'base123\n' }
    if (sub === 'diff --numstat --no-renames base123') return { exitCode: 0, stdout: NUMSTAT }
    if (sub === 'ls-files --others --exclude-standard') return { exitCode: 0, stdout: 'orders/new.py\n' }
    return { exitCode: 128, stdout: '' }
  }

const brokenGit: Git = () => ({ exitCode: 128, stdout: '' })

type World = { submitted: string[]; status: (string | undefined)[]; gitCalls: { argv: string; cwd: string }[] }

/** Stands in for the engine: a file tree under ROOT (relative keys), git, the prompt and the status line. */
const world = (on: On, files: Record<string, string>, git: Git = okGit(), root = ROOT): World => {
  const abs: Record<string, string> = {}
  for (const [k, v] of Object.entries(files)) abs[k.startsWith('/') ? k : `${root}/${k}`] = v
  const isDir = (p: string) => Object.keys(abs).some(k => k.startsWith(`${p}/`))
  const w: World = { submitted: [], status: [], gitCalls: [] }

  on('session.cwd', () => ({ value: root }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'services' } }))
  on('fs.read', (_, e) => (Object.hasOwn(abs, e.path) ? { value: abs[e.path] } : { deny: `ENOENT ${e.path}` }))
  on('fs.exists', (_, e) => ({ value: Object.hasOwn(abs, e.path) || isDir(e.path) }))
  on('fs.list', (_, e) => {
    if (!isDir(e.path)) return { deny: `ENOENT ${e.path}` }
    const seen = new Map<string, 'file' | 'dir'>()
    for (const k of Object.keys(abs)) {
      if (!k.startsWith(`${e.path}/`)) continue
      const rest = k.slice(e.path.length + 1)
      const slash = rest.indexOf('/')
      seen.set(slash === -1 ? rest : rest.slice(0, slash), slash === -1 ? 'file' : 'dir')
    }
    return {
      value: [...seen].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 1000, isLink: false })),
    }
  })
  on('process.run', (_, e) => {
    const cwd = e.init?.cwd ?? root
    w.gitCalls.push({ argv: e.argv.join(' '), cwd })
    const r = e.argv[0] === 'git' ? git(e.argv, cwd) : { exitCode: 127, stdout: '' }
    return { value: { ...r, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('prompt.submit', (_, e) => {
    w.submitted.push(e.text)
    return { text: e.text }
  })
  // A slash command reaches the engine as command.run, never as a prompt: record it as typed.
  on('command.run', { command: 'workflows:work' }, (_, e) => {
    w.submitted.push(`/${e.command} ${e.args}`)
    return { text: '' }
  })
  on('ui.status', (_, e) => {
    w.status.push(e.text)
    return { value: undefined }
  })
  on('tool.call', (_, e) =>
    e.tool === 'Bash'
      ? { result: { stdout: '===== 1 failed, 2 passed in 0.2s =====', stderr: '', interrupted: false } }
      : { result: {} },
  )
  return w
}

const rowKeys = async (ui: { findAll: (q: { type: string }) => Promise<{ key: string | undefined }[]> }) =>
  (await ui.findAll({ type: 'Button' })).map(b => b.key)

test('rows render in wave order with progress and waiting', async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  world(on, monorepo())
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const keys = await rowKeys(ui)
    expect(keys.slice(0, 4)).toEqual(['lib-common', 'orders', 'payments', 'billing'])
    expect((await ui.find({ key: 'lib-common' }))?.text).toContain('3/3 ✓')
    expect((await ui.find({ key: 'lib-common' }))?.text).toContain('+3 −1  1 file')
    expect((await ui.find({ key: 'orders' }))?.text).toContain('1/4')
    expect((await ui.find({ key: 'orders' }))?.text).toContain('+10 −0  2 files')
    expect((await ui.find({ key: 'orders' }))?.text).toContain('1 todo')
    expect((await ui.find({ key: 'payments' }))?.text).toContain('waiting on orders')
    expect(await ui.find({ type: 'Text', text: 'Wave 1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Wave 3' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /branch: feat\/refunds · watching \./ })).toBeDefined()
    await ui.unmount()
  }
})

test('a changed service outside the plan shows a warning', async ($, on) => {
  const clock = mock.clock(on)
  world(on, monorepo())
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'billing' }))?.text).toContain('⚠')
  expect((await ui.find({ key: 'orders' }))?.text).not.toContain('⚠')
  await ui.unmount()
})

test('Start work on a ready service submits the per-service run', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on, monorepo())
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'start' })).toBeUndefined()
  await ui.press({ key: 'orders' })
  expect(await ui.find({ type: 'Text', text: /orders › tasks/ })).toBeDefined()
  await ui.press({ key: 'start' })
  expect(w.submitted).toEqual([`/workflows:work orders/${PLAN} --services orders --no-ship`])
  await ui.unmount()
})

test('a waiting or done service has no Start work', async ($, on) => {
  const clock = mock.clock(on)
  world(on, monorepo())
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'payments' })
  expect(await ui.find({ key: 'start' })).toBeUndefined()
  expect(await ui.find({ key: 'open' })).toBeDefined()
  await ui.press({ key: 'lib-common' })
  expect(await ui.find({ key: 'start' })).toBeUndefined()
  await ui.unmount()
})

test('Ship appears once every per-service plan is completed', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on, {
    ...monorepo(),
    [`orders/${PLAN}`]: servicePlan('orders', 'completed', 4),
    [`payments/${PLAN}`]: servicePlan('payments', 'completed', 5),
  })
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'ship' })
  expect(w.submitted).toEqual([`/workflows:work ${PLAN}`])
  expect(w.status.at(-1)).toBe('3 services · ready to ship')
  await ui.unmount()
})

test('Ship is absent while a service is not done', async ($, on) => {
  const clock = mock.clock(on)
  world(on, monorepo())
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'ship' })).toBeUndefined()
  await ui.unmount()
})

test('Switch plan pins the next plan and the rows follow it', async ($, on) => {
  const clock = mock.clock(on)
  world(on, {
    ...monorepo(),
    [OLDER]: rootPlan({ billing: [] }),
    [`billing/${OLDER}`]: servicePlan('billing', 'active', 2),
  })
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /plan: 2026-11-05-refunds\.md/ })).toBeDefined()
  await ui.press({ key: 'switch' })
  expect(await ui.find({ type: 'Text', text: /plan: 2026-11-04-older\.md/ })).toBeDefined()
  expect((await rowKeys(ui))[0]).toBe('billing')
  expect((await ui.find({ key: 'billing' }))?.text).toContain('0/2')
  expect((await ui.find({ key: 'lib-common' }))?.text).toContain('⚠')
  await ui.press({ key: 'switch' })
  expect(await ui.find({ type: 'Text', text: /plan: 2026-11-05-refunds\.md/ })).toBeDefined()
  await ui.unmount()
})

test('Switch plan is absent with a single plan', async ($, on) => {
  const clock = mock.clock(on)
  world(on, monorepo())
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'switch' })).toBeUndefined()
  await ui.unmount()
})

test('Open plan and Show diff ask Claude about the selected service', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on, monorepo())
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'orders' })
  await ui.press({ key: 'open' })
  await ui.press({ key: 'diff' })
  expect(w.submitted).toEqual([`Show me orders/${PLAN}`, 'Summarize the changes in orders/ on this branch.'])
  await ui.unmount()
})

test('an observed pytest run shows on its service and goes stale after an edit', async ($, on) => {
  const clock = mock.clock(on, { now: 10_000 })
  const w = world(on, monorepo())
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()

  await $.tool.call({ tool: 'Bash', command: 'cd orders && poetry run pytest' })
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'orders' }))?.text).toContain('tests ✗')
  expect((await ui.find({ key: 'orders' }))?.text).not.toContain('stale')
  await ui.unmount()

  await clock.advance(2000)
  expect(w.status.at(-1)).toBe('3 services · orders 1/4 · tests ✗ orders')

  await clock.advance(1000)
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/orders/x.py`, old_string: 'a', new_string: 'b' })
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'orders' }))?.text).toContain('tests ✗ (stale)')
  await ui.unmount()
})

test('tool calls coalesce into one refresh per two seconds', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on, monorepo())
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const before = w.gitCalls.filter(c => c.argv.startsWith('git diff')).length
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/orders/x.py`, old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Write', file_path: `${ROOT}/orders/y.py`, content: 'x' })
  await clock.advance(1999)
  expect(w.gitCalls.filter(c => c.argv.startsWith('git diff')).length).toBe(before)
  await clock.advance(1)
  expect(w.gitCalls.filter(c => c.argv.startsWith('git diff')).length).toBe(before + 1)
})

test('the watched checkout is the worktree whose ledger names the plan', async ($, on) => {
  const clock = mock.clock(on)
  const wt = '/work/refunds'
  const w = world(
    on,
    {
      ...monorepo(),
      '.superpowers/sdd/2026-11-05-refunds-2/plan-path': 'docs/superpowers/plans/other.md\n',
      [`${wt}/.superpowers/sdd/2026-11-05-refunds/plan-path`]: `${PLAN}\n`,
    },
    okGit(`worktree ${ROOT}\nHEAD abc\n\nworktree ${wt}\nHEAD def\nbranch refs/heads/feat/refunds\n`),
  )
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /watching \.\.\/work\/refunds/ })).toBeDefined()
  expect(w.gitCalls.some(c => c.argv.startsWith('git diff') && c.cwd === wt)).toBe(true)
  await ui.unmount()
})

test('/services toggles the pane', async ($, on) => {
  const clock = mock.clock(on)
  world(on, monorepo())
  const open = new Set<string>()
  on('ui.open', (_, e) => {
    open.add(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    open.delete(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: [...open].map(id => ({ id, title: 'Services', isShown: true, isFocused: false, isPlaced: true })),
  }))
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.command.run({ command: 'services', args: '' })
  expect([...open]).toEqual(['services-pane'])
  await $.command.run({ command: 'services', args: '' })
  expect([...open]).toEqual([])
})

test('Review Focus 1: no plan lists services with changes and no waves or actions', async ($, on) => {
  const clock = mock.clock(on)
  const files = monorepo()
  for (const k of Object.keys(files)) if (k.includes('docs/superpowers/plans')) delete files[k]
  world(on, files)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'lib-common' }))?.text).toContain('+3 −1  1 file')
  expect(await ui.find({ type: 'Text', text: /^Wave/ })).toBeUndefined()
  await ui.press({ key: 'orders' })
  expect(await ui.find({ key: 'start' })).toBeUndefined()
  expect(await ui.find({ key: 'ship' })).toBeUndefined()
  await ui.unmount()
})

test('Review Focus 2: git failing shows git unavailable per row', async ($, on) => {
  const clock = mock.clock(on)
  world(on, monorepo(), brokenGit)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  for (const name of ['lib-common', 'orders', 'payments', 'billing']) {
    expect((await ui.find({ key: name }))?.text).toContain('git unavailable')
  }
  await ui.unmount()
})

test('Review Focus 3: a planned service with no folder shows no plan and no Start work', async ($, on) => {
  const clock = mock.clock(on)
  world(on, { ...monorepo(), [PLAN]: rootPlan({ ...REFUNDS, 'refunds-svc': [] }) })
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'refunds-svc' }))?.text).toMatch(/refunds-svc\s+no plan/)
  await ui.press({ key: 'refunds-svc' })
  expect(await ui.find({ key: 'start' })).toBeUndefined()
  await ui.unmount()
})

test('Review Focus 5: a single-service repo says so', async ($, on) => {
  const clock = mock.clock(on)
  world(on, { 'pyproject.toml': '', 'src/app.py': '' })
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No services found (single-service repo).' })).toBeDefined()
  await ui.unmount()
})
