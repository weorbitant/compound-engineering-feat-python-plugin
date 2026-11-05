import type { TestRun } from '../types/index'

const PYTEST_WORD = /(?<![\w-])pytest(?![\w-])/
const CD_TARGET = /(?<![\w-])cd\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/
const BANNER_SUMMARY = /=+ (.+) in [\d.]+s/
const PLAIN_SUMMARY = /(\d+ (?:passed|failed|error)[^\n]*)/

const topFolder = (path: string): string => path.replace(/^(\.\/)+/, '').split('/')[0] ?? ''

/** `path` relative to the first of `roots` it lies under; a relative path as is; null for an absolute path outside them. */
export const relativeTo = (path: string, roots: string[]): string | null => {
  for (const root of roots) {
    if (path === root) return ''
    if (path.startsWith(`${root}/`)) return path.slice(root.length + 1)
  }
  return path.startsWith('/') ? null : path
}

/** Service a pytest command ran in: first `cd` target's top folder (absolute targets under `roots`), else the cwd's. */
export const pytestService = (
  command: string,
  cwdRel: string,
  services: string[],
  roots: string[] = [],
): string | null => {
  if (!PYTEST_WORD.test(command)) return null
  const cd = CD_TARGET.exec(command)
  const target = cd ? (cd[1] ?? cd[2] ?? cd[3]) : undefined
  const rel = target === undefined ? null : relativeTo(target, roots)
  if (rel !== null) {
    const top = topFolder(rel)
    if (services.includes(top)) return top
  }
  const cwdTop = topFolder(cwdRel)
  return services.includes(cwdTop) ? cwdTop : null
}

/** Parses the last pytest summary line in `output`; null when there is none. */
export const parsePytest = (output: string, at: number): TestRun | null => {
  let summary: string | null = null
  for (const line of output.split('\n')) {
    const match = BANNER_SUMMARY.exec(line) ?? PLAIN_SUMMARY.exec(line)
    if (match) summary = match[1].trim()
  }
  if (summary === null) return null
  const passed = /\bpassed\b/.test(summary) && !/\bfailed\b/.test(summary) && !/\berrors?\b/.test(summary)
  return { passed, summary, at }
}

/** A run is stale when its service was edited after it ran. */
export const isStale = (run: TestRun, lastEditAt: number | undefined): boolean =>
  lastEditAt !== undefined && lastEditAt > run.at
