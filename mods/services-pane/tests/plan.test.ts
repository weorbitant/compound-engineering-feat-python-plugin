import { expect, test } from 'claude-code/testing'
import { parsePlan, pickCurrentPlan, servicePlanPath } from '../hooks/plan'

const info = (services: Record<string, never[]> | null) => ({ status: null, services, tasks: [] })

test('parsePlan reads services and status from frontmatter', async () => {
  const md = [
    '---',
    'services:',
    '  orders:',
    '    depends_on: []',
    '  payments:',
    '    depends_on:',
    '      - service: orders',
    '        reason: "calls orders"',
    'status: active',
    '---',
    '# Plan',
  ].join('\n')
  const p = parsePlan(md)
  expect(p.services).toEqual({ orders: [], payments: [{ service: 'orders', reason: 'calls orders' }] })
  expect(p.status).toBe('active')
})

test('parsePlan reads tasks and strips line ranges', async () => {
  const md = [
    '### Task 1: Add REFUNDED',
    '**Files:**',
    '- Create: `orders/a.py`',
    '- Modify: `orders/b.py:10-20`',
    '- Test: `orders/tests/t.py`',
    '### Task 2: Refund endpoint',
  ].join('\n')
  expect(parsePlan(md).tasks).toEqual([
    { n: 1, title: 'Add REFUNDED', files: ['orders/a.py', 'orders/b.py', 'orders/tests/t.py'] },
    { n: 2, title: 'Refund endpoint', files: [] },
  ])
})

test('parsePlan without frontmatter is empty; malformed services is null', async () => {
  expect(parsePlan('# just text')).toEqual({ status: null, services: null, tasks: [] })
  const bad = '---\nservices:\n  orders\n    : [oops\n  - x\nstatus: completed\n---\n'
  const p = parsePlan(bad)
  expect(p.services).toBe(null)
  expect(p.status).toBe('completed')
})

test('pickCurrentPlan prefers later date prefix, then mtime, ignoring null services', async () => {
  expect(pickCurrentPlan([])).toBe(null)
  expect(pickCurrentPlan([{ path: 'p/2026-11-06-x.md', mtimeMs: 1, info: info(null) }])).toBe(null)
  expect(
    pickCurrentPlan([
      { path: 'p/2026-11-05-a.md', mtimeMs: 900, info: info({}) },
      { path: 'p/2026-11-06-b.md', mtimeMs: 100, info: info({}) },
      { path: 'p/2026-11-07-c.md', mtimeMs: 999, info: info(null) },
    ]),
  ).toBe('p/2026-11-06-b.md')
  expect(
    pickCurrentPlan([
      { path: 'p/2026-11-05-a.md', mtimeMs: 100, info: info({}) },
      { path: 'p/2026-11-05-b.md', mtimeMs: 200, info: info({}) },
    ]),
  ).toBe('p/2026-11-05-b.md')
})

test('servicePlanPath nests the root plan basename under the service', async () => {
  expect(servicePlanPath('orders', 'docs/superpowers/plans/2026-11-05-refunds.md')).toBe(
    'orders/docs/superpowers/plans/2026-11-05-refunds.md',
  )
})
