export type DependsOn = { service: string; reason?: string }
export type PlanTask = { n: number; title: string; files: string[] }
export type PlanInfo = {
  status: 'active' | 'completed' | null
  services: Record<string, DependsOn[]> | null
  tasks: PlanTask[]
}
export type FileChange = { path: string; added: number; removed: number; isNew: boolean }
export type TestRun = { passed: boolean; summary: string; at: number }
export type ServiceRow = {
  name: string
  inPlan: boolean
  planPath: string | null
  wave: number | null
  waitingOn: string[]
  tasks: PlanTask[]
  done: number
  /** Task numbers the ledger marks complete (all tasks once the plan is completed). */
  doneTasks: number[]
  total: number
  isDone: boolean
  /** null = git unavailable */
  changes: FileChange[] | null
  outOfScope: boolean
  /** Newest mtime among the service's changed files; null when none or unknown. */
  lastChangeAt: number | null
  todos: number
}
export type Snapshot = {
  checkout: string
  branch: string | null
  rootPlan: string | null
  plans: string[]
  /** The name `/workflows:work` is registered under, or null when it is not available. */
  workCommand: string | null
  services: ServiceRow[]
  refreshedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'services-pane': {
      snapshot: Shaped<Snapshot | null>
      selected: Shaped<string | null>
      pinnedPlan: Shaped<string | null>
      tests: Shaped<Record<string, TestRun>>
      edits: Shaped<Record<string, number>>
    }
  }
}
