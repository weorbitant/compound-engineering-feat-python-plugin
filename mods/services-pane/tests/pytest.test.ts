import { expect, test } from 'claude-code/testing'
import { isStale, parsePytest, pytestService } from '../hooks/pytest'

const services = ['orders', 'payments']

test('pytestService prefers the first cd target that is a service', async () => {
  expect(pytestService('cd orders && poetry run pytest -q', '', services)).toBe('orders')
  expect(pytestService('cd ./payments/app && python -m pytest', '', services)).toBe('payments')
})

test('pytestService falls back to the cwd top folder', async () => {
  expect(pytestService('poetry run pytest', 'payments', services)).toBe('payments')
  expect(pytestService('poetry run pytest', 'payments/app', services)).toBe('payments')
})

test('pytestService is null for non-pytest commands or unknown services', async () => {
  expect(pytestService('ls', '', services)).toBeNull()
  expect(pytestService('pip install pytest-cov', 'orders', services)).toBeNull()
  expect(pytestService('pytest', '', services)).toBeNull()
  expect(pytestService('pytest', 'docs', services)).toBeNull()
})

test('parsePytest reads the final summary line', async () => {
  expect(parsePytest('...\n===== 3 passed in 0.18s =====', 5)).toEqual({ passed: true, summary: '3 passed', at: 5 })
  expect(parsePytest('1 failed, 2 passed in 0.2s', 7)?.passed).toBe(false)
  expect(parsePytest('=== 1 failed, 2 passed in 0.2s ===\n', 7)?.summary).toBe('1 failed, 2 passed')
  expect(parsePytest('=== 2 passed, 1 error in 0.2s ===', 1)?.passed).toBe(false)
})

test('parsePytest treats xfailed and xpassed as passing', async () => {
  expect(parsePytest('3 passed, 1 xfailed in 0.2s', 1)?.passed).toBe(true)
  expect(parsePytest('2 passed, 1 xpassed in 0.1s', 1)?.passed).toBe(true)
  expect(parsePytest('1 failed, 2 passed, 1 xfailed in 0.1s', 1)?.passed).toBe(false)
})

test('parsePytest returns null without a summary', async () => {
  expect(parsePytest('no tests ran', 1)).toBeNull()
  expect(parsePytest('', 1)).toBeNull()
})

test('isStale compares last edit to the run time', async () => {
  expect(isStale({ passed: true, summary: '', at: 10 }, 11)).toBe(true)
  expect(isStale({ passed: true, summary: '', at: 10 }, 10)).toBe(false)
  expect(isStale({ passed: true, summary: '', at: 10 }, undefined)).toBe(false)
})
