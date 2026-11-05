import type { FileChange } from '../types/index'

/** Parses `git diff --numstat` output; binary files (`-\t-`) count as 0/0. */
export const parseNumstat = (out: string): FileChange[] => {
  const changes: FileChange[] = []
  for (const line of out.split('\n')) {
    if (line.trim() === '') continue
    const [added, removed, ...rest] = line.split('\t')
    const path = rest.join('\t')
    if (path === '') continue
    changes.push({ path, added: Number(added) || 0, removed: Number(removed) || 0, isNew: false })
  }
  return changes
}

/** Groups changes by first path segment; root-level files go under `''`. */
export const groupByTopFolder = (changes: FileChange[]): Record<string, FileChange[]> => {
  const groups: Record<string, FileChange[]> = {}
  for (const change of changes) {
    const slash = change.path.indexOf('/')
    const folder = slash === -1 ? '' : change.path.slice(0, slash)
    if (!Object.hasOwn(groups, folder)) groups[folder] = []
    groups[folder].push(change)
  }
  return groups
}

/** Returns the paths on the `worktree <path>` lines of `git worktree list --porcelain`. */
export const parseWorktrees = (porcelain: string): string[] =>
  porcelain
    .split('\n')
    .filter(l => l.startsWith('worktree '))
    .map(l => l.slice('worktree '.length).trim())

/** True only for a service folder that a known plan leaves out. */
export const outOfScope = (folder: string, services: string[], planServices: string[] | null): boolean =>
  planServices !== null && services.includes(folder) && !planServices.includes(folder)
