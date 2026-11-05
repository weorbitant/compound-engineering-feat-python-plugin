import type { EngineInterface } from 'claude-code'

import type { DependsOn, FileChange, PlanInfo, ServiceRow, Snapshot } from '../types/index'
import { groupByTopFolder, outOfScope, parseNumstat, parseWorktrees } from './git'
import { completedTasks, matchWorkspace } from './ledger'
import { parsePlan, rankPlans, servicePlanPath } from './plan'
import { readPinnedPlan } from './state'
import { computeWaves, waitingOn } from './waves'

const PLANS_DIR = 'docs/superpowers/plans'
const SDD_DIR = '.superpowers/sdd'

async function readText($: EngineInterface, path: string): Promise<string | null> {
  try {
    return await $.fs.read(path)
  } catch {
    return null
  }
}

async function list($: EngineInterface, path: string) {
  try {
    return await $.fs.list(path)
  } catch {
    return []
  }
}

/** Runs a read-only git command; null on a non-zero exit or when git cannot run. */
async function git($: EngineInterface, cwd: string, ...args: string[]): Promise<string | null> {
  try {
    const r = await $.process.run(['git', ...args], { cwd })
    return r.exitCode === 0 ? r.stdout : null
  } catch {
    return null
  }
}

async function discoverServices($: EngineInterface, cwd: string): Promise<string[]> {
  const found: string[] = []
  for (const entry of await list($, cwd)) {
    if (entry.kind !== 'dir' || entry.name.startsWith('.')) continue
    try {
      if (await $.fs.exists(`${cwd}/${entry.name}/pyproject.toml`)) found.push(entry.name)
    } catch {
      // unreadable folder: not a service
    }
  }
  return found.sort()
}

async function readRootPlans($: EngineInterface, cwd: string) {
  const out: { path: string; mtimeMs: number; info: PlanInfo }[] = []
  for (const entry of await list($, `${cwd}/${PLANS_DIR}`)) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.md')) continue
    const path = `${PLANS_DIR}/${entry.name}`
    const text = await readText($, `${cwd}/${path}`)
    if (text !== null) out.push({ path, mtimeMs: entry.mtimeMs, info: parsePlan(text) })
  }
  return out
}

/** Every `.superpowers/sdd/<dir>/plan-path` marker under `root`. */
async function readMarkers($: EngineInterface, root: string) {
  const markers: { dir: string; planPath: string }[] = []
  for (const entry of await list($, `${root}/${SDD_DIR}`)) {
    if (entry.kind !== 'dir') continue
    const planPath = await readText($, `${root}/${SDD_DIR}/${entry.name}/plan-path`)
    if (planPath !== null) markers.push({ dir: entry.name, planPath: planPath.trim() })
  }
  return markers
}

/** The worktree whose ledger names one of `plans`, else `cwd`. */
async function watchedCheckout($: EngineInterface, cwd: string, plans: string[]): Promise<string> {
  if (plans.length === 0) return cwd
  const porcelain = await git($, cwd, 'worktree', 'list', '--porcelain')
  const worktrees = porcelain === null ? [cwd] : parseWorktrees(porcelain)
  for (const wt of worktrees) {
    const markers = await readMarkers($, wt)
    if (markers.some(m => plans.includes(m.planPath))) return wt
  }
  return cwd
}

/** Committed-since-base plus uncommitted and untracked changes; null when git cannot say. */
async function actualChanges($: EngineInterface, checkout: string): Promise<FileChange[] | null> {
  let base: string | null = null
  for (const ref of ['origin/HEAD', 'main', 'master']) {
    base = (await git($, checkout, 'merge-base', 'HEAD', ref))?.trim() || null
    if (base !== null) break
  }
  if (base === null) return null
  const diff = await git($, checkout, 'diff', '--numstat', '--no-renames', base)
  const untracked = await git($, checkout, 'ls-files', '--others', '--exclude-standard')
  if (diff === null || untracked === null) return null
  const fresh = untracked
    .split('\n')
    .filter(p => p.trim() !== '')
    .map(path => ({ path, added: 0, removed: 0, isNew: true }))
  return [...parseNumstat(diff), ...fresh]
}

async function countTodos($: EngineInterface, checkout: string): Promise<string[]> {
  const texts: string[] = []
  for (const entry of await list($, `${checkout}/todos`)) {
    if (entry.kind !== 'file' || !/-pending-.*\.md$/.test(entry.name)) continue
    const text = await readText($, `${checkout}/todos/${entry.name}`)
    if (text !== null) texts.push(text)
  }
  return texts
}

/** Relative path from `from` to `to`, both absolute; `.` when equal. */
export const relativePath = (from: string, to: string): string => {
  const a = from.split('/').filter(Boolean)
  const b = to.split('/').filter(Boolean)
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const parts = [...a.slice(i).map(() => '..'), ...b.slice(i)]
  return parts.length === 0 ? '.' : parts.join('/')
}

/** `rel` (as `relativePath` wrote it) resolved against the absolute `base`. */
export const resolvePath = (base: string, rel: string): string => {
  const parts = base.split('/').filter(Boolean)
  for (const seg of rel.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.' && seg !== '') parts.push(seg)
  }
  return `/${parts.join('/')}`
}

export async function buildSnapshot($: EngineInterface, cwd: string): Promise<Snapshot> {
  const discovered = await discoverServices($, cwd)
  const candidates = await readRootPlans($, cwd)
  const plans = rankPlans(candidates)
  const pinned = await readPinnedPlan($)
  const rootPlan = pinned !== null && plans.includes(pinned) ? pinned : (plans[0] ?? null)
  const planServices: Record<string, DependsOn[]> | null =
    rootPlan === null ? null : (candidates.find(c => c.path === rootPlan)?.info.services ?? null)
  const planNames = planServices === null ? [] : Object.keys(planServices)

  const watchedPlans = rootPlan === null ? [] : [rootPlan, ...planNames.map(s => servicePlanPath(s, rootPlan))]
  const checkout = await watchedCheckout($, cwd, watchedPlans)
  const branch = (await git($, checkout, 'rev-parse', '--abbrev-ref', 'HEAD'))?.trim() || null
  const changes = discovered.length === 0 ? null : await actualChanges($, checkout)
  const groups = changes === null ? null : groupByTopFolder(changes)
  const markers = await readMarkers($, checkout)
  const todoTexts = await countTodos($, checkout)
  const waves = planServices === null ? {} : computeWaves(planServices)

  const rowFor = async (name: string): Promise<ServiceRow> => {
    const inPlan = planNames.includes(name)
    let planPath: string | null = null
    let info: PlanInfo | null = null
    if (inPlan && rootPlan !== null) {
      const path = servicePlanPath(name, rootPlan)
      const text = (await readText($, `${checkout}/${path}`)) ?? (await readText($, `${cwd}/${path}`))
      if (text !== null) {
        planPath = path
        info = parsePlan(text)
      }
    }
    const tasks = info?.tasks ?? []
    const isDone = info?.status === 'completed'
    const workspace = planPath === null ? null : matchWorkspace(markers, planPath)
    const ledger = workspace === null ? null : await readText($, `${checkout}/${SDD_DIR}/${workspace}/progress.md`)
    const numbers = tasks.map(t => t.n)
    const logged = ledger === null ? null : completedTasks(ledger)
    const doneTasks = logged !== null ? numbers.filter(n => logged.has(n)) : isDone ? numbers : []
    return {
      name,
      inPlan,
      planPath,
      wave: inPlan && Object.hasOwn(waves, name) ? waves[name] : null,
      waitingOn: [],
      tasks,
      done: doneTasks.length,
      doneTasks,
      total: tasks.length,
      isDone,
      changes: groups === null ? null : Object.hasOwn(groups, name) ? groups[name] : [],
      outOfScope:
        groups !== null && Object.hasOwn(groups, name) && outOfScope(name, discovered, planServices === null ? null : planNames),
      todos: todoTexts.filter(t => t.includes(`${name}/`)).length,
    }
  }

  const services: ServiceRow[] = []
  if (discovered.length > 0) {
    const planned = [...planNames].sort((a, b) => (waves[a] ?? 0) - (waves[b] ?? 0))
    for (const name of planned) services.push(await rowFor(name))
    for (const name of discovered) if (!planNames.includes(name)) services.push(await rowFor(name))
    if (planServices !== null) {
      const done = new Set(services.filter(r => r.isDone).map(r => r.name))
      for (const row of services) if (row.inPlan) row.waitingOn = waitingOn(row.name, planServices, s => done.has(s))
    }
  }

  return {
    checkout: relativePath(cwd, checkout),
    branch,
    rootPlan,
    plans,
    services,
    refreshedAt: await $.clock.now(),
  }
}
