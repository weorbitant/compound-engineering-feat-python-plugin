import { expect, test } from 'claude-code/testing'
import { groupByTopFolder, outOfScope, parseNumstat, parseWorktrees } from '../hooks/git'

test('parseNumstat reads counts and treats binary as 0/0', async () => {
  expect(parseNumstat('3\t1\torders/app.py\n-\t-\tlogo.png\n')).toEqual([
    { path: 'orders/app.py', added: 3, removed: 1, isNew: false },
    { path: 'logo.png', added: 0, removed: 0, isNew: false },
  ])
})

test('parseNumstat returns [] for empty output', async () => {
  expect(parseNumstat('')).toEqual([])
})

test('groupByTopFolder groups by first segment, root files under empty key', async () => {
  const g = groupByTopFolder([
    { path: 'orders/app.py', added: 1, removed: 0, isNew: false },
    { path: 'README.md', added: 1, removed: 0, isNew: false },
  ])
  expect(g.orders.map(c => c.path)).toEqual(['orders/app.py'])
  expect(g[''].map(c => c.path)).toEqual(['README.md'])
})

test('parseWorktrees returns worktree paths', async () => {
  const out = 'worktree /r\nHEAD abc\nbranch refs/heads/main\n\nworktree /r/.wt/feat\nHEAD def\n'
  expect(parseWorktrees(out)).toEqual(['/r', '/r/.wt/feat'])
})

test('outOfScope is true only for a service missing from a non-null plan', async () => {
  const svcs = ['orders', 'payments']
  expect(outOfScope('docs', svcs, ['orders'])).toBe(false)
  expect(outOfScope('payments', svcs, ['orders'])).toBe(true)
  expect(outOfScope('payments', svcs, null)).toBe(false)
  expect(outOfScope('orders', svcs, ['orders'])).toBe(false)
})
