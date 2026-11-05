import { expect, test } from 'claude-code/testing'
import { computeWaves, waitingOn } from '../hooks/waves'

const chain = {
  'lib-common': [],
  orders: [{ service: 'lib-common' }],
  payments: [{ service: 'orders' }],
}

test('computeWaves layers a dependency chain', async () => {
  expect(computeWaves(chain)).toEqual({ 'lib-common': 1, orders: 2, payments: 3 })
})

test('computeWaves treats cycle members as wave 1 and returns', async () => {
  expect(computeWaves({ a: [{ service: 'b' }], b: [{ service: 'a' }], c: [] })).toEqual({ a: 1, b: 1, c: 1 })
})

test('computeWaves ignores unknown dependencies', async () => {
  expect(computeWaves({ a: [{ service: 'ghost' }] })).toEqual({ a: 1 })
})

test('waitingOn lists direct deps that are not done', async () => {
  expect(waitingOn('payments', chain, (s) => s === 'lib-common')).toEqual(['orders'])
})

test('waitingOn ignores cycle members, as computeWaves does', async () => {
  const cycle = { a: [{ service: 'b' }], b: [{ service: 'a' }] }
  expect(waitingOn('a', cycle, () => false)).toEqual([])
})

test('waitingOn ignores deps on unknown services', async () => {
  expect(waitingOn('a', { a: [{ service: 'ghost' }] }, () => false)).toEqual([])
})
