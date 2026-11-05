import { expect, test } from 'claude-code/testing'
import { completedTasks, matchWorkspace } from '../hooks/ledger'

test('completedTasks collects only complete lines', async () => {
  const md =
    '# plan: x.md\nTask 1: complete (commits a1..b2, review clean)\nTask 3: complete (commits c..d, tests: pytest → 3 passed)\nTask 2: started'
  expect(completedTasks(md)).toEqual(new Set([1, 3]))
})

test('matchWorkspace matches trimmed plan-path markers', async () => {
  const markers = [
    { dir: 'a', planPath: 'orders/docs/superpowers/plans/p.md' },
    { dir: 'b', planPath: 'payments/docs/superpowers/plans/p.md\n' },
  ]
  expect(matchWorkspace(markers, 'payments/docs/superpowers/plans/p.md')).toBe('b')
  expect(matchWorkspace(markers, 'nope.md')).toBeNull()
})
