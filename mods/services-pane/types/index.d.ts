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
  total: number
  isDone: boolean
  /** null = git unavailable */
  changes: FileChange[] | null
  outOfScope: boolean
  todos: number
}
export type Snapshot = {
  checkout: string
  branch: string | null
  rootPlan: string | null
  plans: string[]
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
