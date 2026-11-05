import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Snapshot, TestRun } from '../types/index'

// The engine's scan lists state only from atoms written in the file that reads or
// writes them, so every state access goes through this file.
// Bump a tag when its value's shape changes: it declines what older code stored.
const snapshot = atom({ plugin: 'services-pane', key: 'snapshot' } as const, null, { shape: 'snapshot-1' })
const selected = atom({ plugin: 'services-pane', key: 'selected' } as const, null, { shape: 'selected-1' })
const pinnedPlan = atom({ plugin: 'services-pane', key: 'pinnedPlan' } as const, null, { shape: 'pinned-1' })
const tests = atom({ plugin: 'services-pane', key: 'tests' } as const, {}, { shape: 'tests-1' })
const edits = atom({ plugin: 'services-pane', key: 'edits' } as const, {}, { shape: 'edits-1' })

export async function readSnapshot($: EngineInterface): Promise<Snapshot | null> {
  return read($, snapshot)
}

export async function writeSnapshot($: EngineInterface, value: Snapshot): Promise<void> {
  await update($, snapshot, () => value)
}

export async function readSelected($: EngineInterface): Promise<string | null> {
  return read($, selected)
}

export async function select($: EngineInterface, service: string): Promise<void> {
  await update($, selected, () => service)
}

export async function readPinnedPlan($: EngineInterface): Promise<string | null> {
  return read($, pinnedPlan)
}

export async function pinPlan($: EngineInterface, plan: string): Promise<void> {
  await update($, pinnedPlan, () => plan)
}

export async function readTests($: EngineInterface): Promise<Record<string, TestRun>> {
  return read($, tests)
}

export async function recordTest($: EngineInterface, service: string, run: TestRun): Promise<void> {
  await update($, tests, runs => ({ ...runs, [service]: run }))
}

export async function readEdits($: EngineInterface): Promise<Record<string, number>> {
  return read($, edits)
}

export async function recordEdit($: EngineInterface, service: string, at: number): Promise<void> {
  await update($, edits, times => ({ ...times, [service]: at }))
}
