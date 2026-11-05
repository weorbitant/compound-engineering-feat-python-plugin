# Services Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a separate `services-pane` mod in this repo that shows each monorepo service's planned vs actual changes, run order, progress, test status, scope and todos, with per-service Start work and a final Ship. Also make the `/workflows:*` changes it relies on.

**Architecture:** Pure parsing modules (plan markdown, ledger, git output, pytest output, waves) are plain TypeScript with no `$` and are unit-tested. One `snapshot.ts` gathers inputs through `$.fs` / `$.process` and builds a `Snapshot`. `register.tsx` keeps it in `$.state` atoms, refreshes after tool calls, and draws the pane. The main plugin gets four markdown-only workflow changes.

**Tech Stack:** Claude Code mod API (early access, build 2.1.318; the authority is `.claude-plugin/types/claude-code/index.d.ts` once loaded, or `/tmp/claude-1000/bundled-skills/2.1.318/705fccc1f5ebffa20a8989c5331c10d8/plugin-authoring/types/claude-code.d.ts`), TypeScript/TSX, `claude-code/testing`, `claude plugin validate|test`.

**Spec:** `docs/superpowers/specs/2026-11-05-services-pane-design.md`

## Global Constraints

- Mod folder `mods/services-pane/`; manifest name `services-pane`, version `0.1.0`; `"types": "./types/index.d.ts"`; `hooks/hooks.json` = `{ "modules": ["./register.tsx"] }`.
- Pane id `services-pane`, title `Services`; slash command `/services` (toggle).
- No Node, DOM or npm imports. Only `$` (`$.fs`, `$.process`, `$.prompt`, `$.ui`, `$.command`, `$.clock`) and `claude-code` exports.
- Read-only git only: `rev-parse`, `merge-base`, `diff --numstat`, `ls-files --others --exclude-standard`, `worktree list --porcelain`. The mod never runs tests, never commits, never edits files.
- Refresh after a tool call completes (never before it runs). Coalesce refreshes to at most one per 2 s.
- The main plugin must not reference or depend on the mod.
- Repo release rules (`CLAUDE.md`): bump `.claude-plugin/plugin.json`, CHANGELOG, README. `./scripts/validate.sh` must pass.
- State atoms carry a `shape` tag (e.g. `'snapshot-1'`) so older stored values are declined after a reload.

## Review Focus

1. **No plan with `services:` exists:** the pane still lists services with actual changes, shows no waves and offers no Start/Ship. (Task 6 test)
2. **Not a git repo, or no `origin/HEAD`/`main`/`master`:** actual changes show `git unavailable` per row instead of crashing the render. (Task 4 + Task 6 tests)
3. **Plan names a service that has no folder or no per-service plan file:** the row shows `no plan`, and Start work is absent. (Task 2 + Task 6 tests)
4. **Dependency cycle in `services:`:** cycle members are treated as independent (wave 1), as `work.md` does, and nothing loops. (Task 3 test)
5. **Single-service repo (no `*/pyproject.toml`):** the pane says `No services found (single-service repo).` (Task 6 test)

---

### Task 1: Workflow changes in the main plugin

**Files:**
- Modify: `commands/workflows/plan.md` (Step 4)
- Modify: `commands/workflows/work.md` (frontmatter `argument-hint`, Step 2, Step 3, Step 4/5 boundary, Step 5.4)

**Interfaces:**
- Produces (contract the mod reads):
  - Root plan frontmatter: `services:` map + `status: active|completed`.
  - Per-service plan frontmatter: `status: active|completed`, and **no** `services:` key.
  - CLI: `/workflows:work <plan> [--no-ship]`. A root plan whose per-service plans are all `status: completed` runs ship-only.

- [ ] **Step 1: Edit `plan.md` Step 4.** Root plan frontmatter gets `status: active` next to `services:`. Each per-service plan gets frontmatter with only `status: active`. Add one sentence: "Do not copy the `services:` section into per-service plans: a per-service run must not pick up the whole dependency graph."
- [ ] **Step 2: Edit `work.md`.**
  - `argument-hint` adds `[--no-ship]`.
  - New Step 2 rule: when the input plan is a root plan (has `services:`) and every listed `{service}/docs/superpowers/plans/<same filename>` has `status: completed`, skip Steps 2–3 (ship-only) and go to Step 4.
  - Step 4 end: "If `--no-ship` was passed, stop here and report; do not run Step 5."
  - Step 5.4 becomes: set `status: completed` on the input plan **and** on every per-service plan whose tasks this run completed.
- [ ] **Step 3: Verify.** Run `./scripts/validate.sh` → `Validation passed: 25 agents, 17 commands, 21 skills.` Run `grep -n "no-ship\|ship-only\|status: completed" commands/workflows/work.md` → at least 3 hits. Run `grep -n "Do not copy the \`services:\`" commands/workflows/plan.md` → 1 hit.
- [ ] **Step 4: Commit** `feat(workflows): --no-ship, ship-only root runs, per-service plan status`.

### Task 2: Mod scaffold + plan parsing

**Files:**
- Create: `mods/services-pane/.claude-plugin/plugin.json`, `mods/services-pane/hooks/hooks.json`
- Create: `mods/services-pane/types/index.d.ts`
- Create: `mods/services-pane/hooks/plan.ts`
- Create: `mods/services-pane/hooks/register.tsx` (stub: `export const register: Register = () => {}`)
- Test: `mods/services-pane/tests/plan.test.ts`

**Interfaces:**
- Produces in `types/index.d.ts` (exported, then declared under `interface PluginState { 'services-pane': { snapshot: Shaped<Snapshot | null>; selected: Shaped<string | null>; pinnedPlan: Shaped<string | null>; tests: Shaped<Record<string, TestRun>>; edits: Shaped<Record<string, number>> } }`):
  - `type DependsOn = { service: string; reason?: string }`
  - `type PlanTask = { n: number; title: string; files: string[] }`
  - `type PlanInfo = { status: 'active' | 'completed' | null; services: Record<string, DependsOn[]> | null; tasks: PlanTask[] }`
  - `type FileChange = { path: string; added: number; removed: number; isNew: boolean }`
  - `type TestRun = { passed: boolean; summary: string; at: number }`
  - `type ServiceRow = { name: string; inPlan: boolean; planPath: string | null; wave: number | null; waitingOn: string[]; tasks: PlanTask[]; done: number; total: number; isDone: boolean; changes: FileChange[] | null; outOfScope: boolean; todos: number }` (`changes: null` = git unavailable)
  - `type Snapshot = { checkout: string; branch: string | null; rootPlan: string | null; plans: string[]; services: ServiceRow[]; refreshedAt: number }`
- Produces in `hooks/plan.ts`:
  - `parsePlan(markdown: string): PlanInfo`
  - `pickCurrentPlan(candidates: { path: string; mtimeMs: number; info: PlanInfo }[]): string | null`
  - `servicePlanPath(service: string, rootPlanPath: string): string`, giving `${service}/docs/superpowers/plans/${basename(rootPlanPath)}`

- [ ] **Step 1: Write failing tests** in `tests/plan.test.ts`:
  - `parsePlan` on frontmatter `services:\n  orders:\n    depends_on: []\n  payments:\n    depends_on:\n      - service: orders\n        reason: "calls orders"\nstatus: active` gives `services = { orders: [], payments: [{ service: 'orders', reason: 'calls orders' }] }` and `status = 'active'`.
  - Body `### Task 1: Add REFUNDED\n**Files:**\n- Create: \`orders/a.py\`\n- Modify: \`orders/b.py:10-20\`\n- Test: \`orders/tests/t.py\`\n### Task 2: Refund endpoint` gives `tasks = [{ n: 1, title: 'Add REFUNDED', files: ['orders/a.py', 'orders/b.py', 'orders/tests/t.py'] }, { n: 2, title: 'Refund endpoint', files: [] }]` (the line range is stripped).
  - No frontmatter gives `{ status: null, services: null, tasks: [] }`. Malformed YAML under `services:` gives `services: null`, not a throw.
  - `pickCurrentPlan` ignores candidates with `services: null`, prefers the later `YYYY-MM-DD-` filename prefix, and breaks ties on `mtimeMs`. An empty list gives `null`.
  - `servicePlanPath('orders', 'docs/superpowers/plans/2026-11-05-refunds.md')` gives `'orders/docs/superpowers/plans/2026-11-05-refunds.md'`.
- [ ] **Step 2: Run** `claude plugin test mods/services-pane` → the plan tests FAIL (not defined).
- [ ] **Step 3: Implement** `plan.ts` and the scaffold files. YAML is hand-parsed for exactly the shapes above (indent-based). No library.
- [ ] **Step 4: Run** `claude plugin test mods/services-pane` → PASS. Run `claude plugin validate mods/services-pane` → no errors.
- [ ] **Step 5: Commit** `feat(services-pane): scaffold mod and plan parser`.

### Task 3: Ledger progress and waves

**Files:**
- Create: `mods/services-pane/hooks/ledger.ts`, `mods/services-pane/hooks/waves.ts`
- Test: `mods/services-pane/tests/ledger.test.ts`, `mods/services-pane/tests/waves.test.ts`

**Interfaces:**
- Consumes: `DependsOn`, `PlanInfo` (Task 2).
- Produces:
  - `completedTasks(progressMd: string): Set<number>`: numbers N from lines matching `^Task (\d+): complete\b`.
  - `matchWorkspace(markers: { dir: string; planPath: string }[], plan: string): string | null`: the workspace dir whose `plan-path` marker equals `plan` (repo-relative, trimmed).
  - `computeWaves(services: Record<string, DependsOn[]>): Record<string, number>`: wave 1 for no deps. Cycle members and deps on unknown services count as wave 1.
  - `waitingOn(service: string, services: Record<string, DependsOn[]>, isDone: (s: string) => boolean): string[]`

- [ ] **Step 1: Write failing tests:**
  - `completedTasks('# plan: x.md\nTask 1: complete (commits a1..b2, review clean)\nTask 3: complete (commits c..d, tests: pytest → 3 passed)\nTask 2: started')` gives `{1, 3}`.
  - `matchWorkspace([{ dir: 'a', planPath: 'orders/docs/superpowers/plans/p.md' }, { dir: 'b', planPath: 'payments/docs/superpowers/plans/p.md\n' }], 'payments/docs/superpowers/plans/p.md')` gives `'b'`.
  - `computeWaves({ 'lib-common': [], orders: [{ service: 'lib-common' }], payments: [{ service: 'orders' }] })` gives `{ 'lib-common': 1, orders: 2, payments: 3 }`.
  - Cycle `{ a: [{ service: 'b' }], b: [{ service: 'a' }], c: [] }` gives all `1`, and the call returns (no hang).
  - `waitingOn('payments', …, s => s === 'lib-common')` gives `['orders']`.
- [ ] **Step 2: Run** `claude plugin test mods/services-pane` → new tests FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(services-pane): ledger progress and wave computation`.

### Task 4: Git changes and watched checkout

**Files:**
- Create: `mods/services-pane/hooks/git.ts`
- Test: `mods/services-pane/tests/git.test.ts`

**Interfaces:**
- Consumes: `FileChange` (Task 2).
- Produces:
  - `parseNumstat(out: string): FileChange[]`: `added\tremoved\tpath`. Binary `-\t-` counts as 0/0.
  - `groupByTopFolder(changes: FileChange[]): Record<string, FileChange[]>`: root-level files go under `''`.
  - `parseWorktrees(porcelain: string): string[]`: the `worktree <path>` lines.
  - `outOfScope(folder: string, services: string[], planServices: string[] | null): boolean`: true only when `folder` is a service, `planServices` is non-null, and the folder isn't in it.

- [ ] **Step 1: Write failing tests:**
  - `parseNumstat('3\t1\torders/app.py\n-\t-\tlogo.png\n')` gives `[{ path: 'orders/app.py', added: 3, removed: 1, isNew: false }, { path: 'logo.png', added: 0, removed: 0, isNew: false }]`.
  - `groupByTopFolder` sends `orders/app.py` → `orders` and `README.md` → `''`.
  - `parseWorktrees('worktree /r\nHEAD abc\nbranch refs/heads/main\n\nworktree /r/.wt/feat\nHEAD def\n')` gives `['/r', '/r/.wt/feat']`.
  - `outOfScope('docs', ['orders','payments'], ['orders'])` is `false` (not a service). `outOfScope('payments', ['orders','payments'], ['orders'])` is `true`. `outOfScope('payments', …, null)` is `false`.
  - `parseNumstat('')` gives `[]`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `git.ts`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(services-pane): git numstat, worktree and scope helpers`.

### Task 5: Observed test status

**Files:**
- Create: `mods/services-pane/hooks/pytest.ts`
- Test: `mods/services-pane/tests/pytest.test.ts`

**Interfaces:**
- Consumes: `TestRun` (Task 2).
- Produces:
  - `pytestService(command: string, cwdRel: string, services: string[]): string | null`: null unless `command` contains the word `pytest`. Service = first `cd <dir>` target's top folder if it's a service, else `cwdRel`'s top folder if that's a service.
  - `parsePytest(output: string, at: number): TestRun | null`: uses the last line matching `=+ (.+) in [\d.]+s` or `(\d+ (passed|failed|error)[^\n]*)`. `passed` = summary contains `passed` and neither `failed` nor `error`. Null when no summary line exists.
  - `isStale(run: TestRun, lastEditAt: number | undefined): boolean`, giving `lastEditAt !== undefined && lastEditAt > run.at`.

- [ ] **Step 1: Write failing tests:**
  - `pytestService('cd orders && poetry run pytest -q', '', ['orders','payments'])` gives `'orders'`. `pytestService('ls', '', …)` gives `null`. `pytestService('poetry run pytest', 'payments', …)` gives `'payments'`.
  - `parsePytest('...\n===== 3 passed in 0.18s =====', 5)` gives `{ passed: true, summary: '3 passed', at: 5 }`. `'1 failed, 2 passed in 0.2s'` gives `passed: false`. `'no tests ran'` gives `null`.
  - `isStale({ passed: true, summary: '', at: 10 }, 11)` is `true`; with `undefined` it is `false`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `pytest.ts`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(services-pane): observe pytest runs per service`.

### Task 6: Snapshot, pane, actions, status line

**Files:**
- Create: `mods/services-pane/hooks/snapshot.ts`, `mods/services-pane/hooks/view.tsx`
- Modify: `mods/services-pane/hooks/register.tsx`
- Test: `mods/services-pane/tests/pane.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2–5.
- Produces:
  - `buildSnapshot($: EngineInterface, cwd: string): Promise<Snapshot>` in `snapshot.ts`. Steps:
    1. Services = top-level dirs of `cwd` containing `pyproject.toml`.
    2. Current plan = `pinnedPlan` if still present, else `pickCurrentPlan` over `docs/superpowers/plans/*.md`. `plans` lists every root plan with `services:`, newest first.
    3. Watched checkout = the worktree (from `git worktree list --porcelain`) whose `.superpowers/sdd/*/plan-path` matches the root plan or a per-service plan, else `cwd`.
    4. In that checkout: base = first of `git merge-base HEAD origin/HEAD`, `…main`, `…master` that exits 0. Changes = `git diff --numstat <base>` + untracked (`isNew: true`, 0/0). Any git failure leaves `changes: null`.
    5. Per service: plan info, progress (ledger via `matchWorkspace` when present, else `status: completed` → total, else 0), `isDone = status === 'completed'`, waves, `waitingOn`, scope, todos = count of `todos/*-pending-*.md` whose text contains `${name}/`.
  - `register.tsx`:
    - `session.start`: register `/services`, then refresh.
    - `command.run {command:'services'}`: toggle the pane via `$.ui.open` / close.
    - `tool.call`: after `await next(e)`, for `Edit|Write|NotebookEdit` record `edits[service] = Date.now()`. For `Bash`, record `tests[service]` from `pytestService` + `parsePytest`. Then schedule a refresh (coalesced, 2 s).
    - `ui.render {component:'Pane', requestId:'services-pane'}`: draw via `view.tsx`.
    - `$.ui.status(...)` after each refresh, e.g. `3 services · orders 1/4 · tests ✗ payments`; `undefined` when there is no root plan.
  - Actions (Buttons): see the steps below.

- [ ] **Step 1: Write failing tests** in `pane.test.tsx` (pattern: the bundled `examples/pane.test.tsx`; stand in for `$.fs` / `$.process` with hooks on their events, seeding the `examples/monorepo` layout with a root plan `docs/superpowers/plans/2026-11-05-refunds.md` that has `services:` lib-common→[], orders→[lib-common], payments→[orders], with `lib-common`'s per-service plan `status: completed`):
  - Rows render in wave order. `lib-common` shows `3/3 ✓`; `payments` shows `waiting on orders`.
  - Pressing `orders` then **Start work** submits exactly `/workflows:work orders/docs/superpowers/plans/2026-11-05-refunds.md --services orders --no-ship` (assert via a `prompt.submit` hook).
  - `payments` has no Start work button (it's waiting). **Ship** is absent until all three per-service plans are `status: completed`, then submits `/workflows:work docs/superpowers/plans/2026-11-05-refunds.md`.
  - With two root plans, **Switch plan** sets `pinnedPlan` to the next entry of `snapshot.plans`, and the rows re-render for that plan. With one or zero plans the button is absent.
  - **Open plan** submits `Show me orders/docs/superpowers/plans/2026-11-05-refunds.md`. **Show diff** submits `Summarize the changes in orders/ on this branch.`
  - A changed file under a service not in `services:` shows `⚠`.
  - A Bash `cd orders && poetry run pytest` with output `1 failed, 2 passed in 0.2s` shows `tests ✗` on `orders`. After a later Edit to `orders/x.py`, it shows `tests ✗ (stale)`.
  - Review Focus 1: no plan files → rows render with changes, no `Wave` headers, no Start/Ship.
  - Review Focus 2: every `git` call exits 128 → each row shows `git unavailable`.
  - Review Focus 3: plan lists `refunds-svc` with no folder → row `refunds-svc  no plan`, no Start work.
  - Review Focus 5: no `*/pyproject.toml` → text `No services found (single-service repo).`
- [ ] **Step 2: Run** `claude plugin test mods/services-pane` → FAIL.
- [ ] **Step 3: Implement** `snapshot.ts`, `view.tsx`, `register.tsx`. Header line: `branch: <branch> · watching <checkout relative to cwd or '.'>`. Start work never adds `--method`: the pane cannot know the plan-time choice, so `/workflows:work` asks as usual (consistent with the spec's "when known").
- [ ] **Step 4: Run** `claude plugin test mods/services-pane` → all PASS. Run `claude plugin validate mods/services-pane` → no errors. Run `tsc -p mods/services-pane` (once the engine has laid types) → no errors.
- [ ] **Step 5: Commit** `feat(services-pane): live pane with per-service actions and status line`.

### Task 7: Packaging, docs, release

**Files:**
- Modify: `.claude-plugin/marketplace.json` (add a second entry), `.claude-plugin/plugin.json` (4.2.0 → 4.3.0), `CHANGELOG.md`, `README.md`, `scripts/validate.sh`
- Create: `mods/services-pane/README.md`

**Interfaces:**
- Consumes: Task 1 workflow contract; mod from Tasks 2–6.

- [ ] **Step 1: marketplace.json:** add `{ "name": "services-pane", "source": "./mods/services-pane", "description": "Live pane of monorepo services: planned vs actual changes, waves, progress, tests; start work per service.", "version": "0.1.0", "author": { "name": "BaronVonSario" } }`. Set the main entry's version to `4.3.0`.
- [ ] **Step 2: validate.sh:** add a check that each `mods/*/.claude-plugin/plugin.json` parses as JSON and has `name` and `version`, and that `mods/*/hooks/hooks.json` names an existing module. When `claude` is on PATH, also run `claude plugin validate` per mod (skip silently otherwise, since CI has no `claude`).
- [ ] **Step 3: Docs:**
  - `mods/services-pane/README.md`: install with `/plugin install services-pane@py-micro-superpowers`, `/services`, what each column means, early-access note.
  - Root README: a "Services pane (optional)" section, plus the `--no-ship` flag in the `/workflows:work` row.
  - CHANGELOG `[4.3.0]`: Added (services-pane mod, `--no-ship`, ship-only run, per-service plan status); Changed (per-service plans no longer copy `services:`).
- [ ] **Step 4: Verify.** `./scripts/validate.sh` → passes (component counts unchanged: 25/17/21). `claude plugin test mods/services-pane` → PASS. Run `./scripts/sandbox.sh --install` and load with `--plugin-dir <repo>/mods/services-pane --plugin-dir <repo>`; `/services` opens the pane and lists `lib-common`, `orders`, `payments`.
- [ ] **Step 5: Commit** `feat: v4.3.0 — services-pane mod`.
