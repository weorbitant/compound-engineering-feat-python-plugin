import type { DependsOn, PlanInfo, PlanTask } from '../types/index'

const indentOf = (line: string): number => line.length - line.trimStart().length

const unquote = (s: string): string => {
  const t = s.trim()
  const q = t[0]
  return t.length >= 2 && (q === '"' || q === "'") && t[t.length - 1] === q ? t.slice(1, -1) : t
}

/** Parses the `services:` block; returns null on any shape it does not know. */
const parseServices = (block: string[]): Record<string, DependsOn[]> | null => {
  const lines = block.filter(l => l.trim() !== '')
  const out: Record<string, DependsOn[]> = {}
  let i = 0
  while (i < lines.length) {
    const head = /^(\s+)([^\s:#-][^:]*):\s*$/.exec(lines[i])
    if (!head) return null
    const name = head[2].trim()
    const base = head[1].length
    const deps: DependsOn[] = []
    out[name] = deps
    i++
    let sawDepends = false
    while (i < lines.length && indentOf(lines[i]) > base) {
      const dl = /^\s+depends_on:\s*(\[\s*\])?\s*$/.exec(lines[i])
      if (!dl || sawDepends) return null
      sawDepends = true
      const depBase = indentOf(lines[i])
      i++
      if (dl[1]) continue
      let cur: DependsOn | null = null
      while (i < lines.length && indentOf(lines[i]) > depBase) {
        const item = /^\s+-\s+service:\s*(\S.*)$/.exec(lines[i])
        const reason = /^\s+reason:\s*(\S.*)$/.exec(lines[i])
        if (item) {
          cur = { service: unquote(item[1]) }
          deps.push(cur)
        } else if (reason && cur) {
          cur.reason = unquote(reason[1])
        } else return null
        i++
      }
    }
  }
  return out
}

const parseFrontmatter = (lines: string[]): Pick<PlanInfo, 'status' | 'services'> => {
  const result: Pick<PlanInfo, 'status' | 'services'> = { status: null, services: null }
  if (lines[0]?.trim() !== '---') return result
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  const fm = end === -1 ? lines.slice(1) : lines.slice(1, end)
  for (let i = 0; i < fm.length; i++) {
    const line = fm[i]
    const status = /^status:\s*(\S+)\s*$/.exec(line)
    if (status) {
      const v = unquote(status[1])
      if (v === 'active' || v === 'completed') result.status = v
    } else if (/^services:\s*(\{\s*\})?\s*$/.test(line)) {
      if (/\{/.test(line)) {
        result.services = {}
        continue
      }
      let j = i + 1
      while (j < fm.length && (fm[j].trim() === '' || indentOf(fm[j]) > 0)) j++
      result.services = parseServices(fm.slice(i + 1, j))
      i = j - 1
    }
  }
  return result
}

const parseTasks = (lines: string[]): PlanTask[] => {
  const tasks: PlanTask[] = []
  let cur: PlanTask | null = null
  let inFiles = false
  for (const line of lines) {
    const head = /^###\s+Task\s+(\d+):\s*(.+?)\s*$/.exec(line)
    if (head) {
      cur = { n: Number(head[1]), title: head[2], files: [] }
      tasks.push(cur)
      inFiles = false
      continue
    }
    if (!cur) continue
    if (/^\*\*Files:\*\*/.test(line)) {
      inFiles = true
      continue
    }
    if (!inFiles) continue
    const file = /^\s*-\s+(?:Create|Modify|Test):\s*(.*)$/.exec(line)
    if (file) {
      for (const m of file[1].matchAll(/`([^`]+)`/g)) {
        cur.files.push(m[1].replace(/:\d+(?:-\d+)?$/, ''))
      }
    } else if (line.trim() !== '') inFiles = false
  }
  return tasks
}

export const parsePlan = (markdown: string): PlanInfo => {
  const lines = markdown.split(/\r?\n/)
  return { ...parseFrontmatter(lines), tasks: parseTasks(lines) }
}

const basename = (p: string): string => p.slice(p.lastIndexOf('/') + 1)
const datePrefix = (p: string): string => /^(\d{4}-\d{2}-\d{2})-/.exec(basename(p))?.[1] ?? ''

/** The current root plan: the latest dated plan that declares `services:`; mtime breaks ties. */
export const pickCurrentPlan = (
  candidates: { path: string; mtimeMs: number; info: PlanInfo }[],
): string | null => {
  const usable = candidates.filter(c => c.info.services !== null)
  if (usable.length === 0) return null
  usable.sort((a, b) => {
    const da = datePrefix(a.path)
    const db = datePrefix(b.path)
    return da === db ? b.mtimeMs - a.mtimeMs : da < db ? 1 : -1
  })
  return usable[0].path
}

export const servicePlanPath = (service: string, rootPlanPath: string): string =>
  `${service}/docs/superpowers/plans/${basename(rootPlanPath)}`
