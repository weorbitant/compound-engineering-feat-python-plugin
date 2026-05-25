# Superpowers Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `compound-engineering-feat-python` to v3.0.0 by requiring the `superpowers` plugin as foundation, delegating generic workflow primitives to it, and keeping only Python/Django/FastAPI/microservice-specific value in this plugin.

**Architecture:** Each of the 4 surviving workflow commands becomes a thin wrapper that loads Python context, runs a consolidated `microservice-focus` skill, and delegates execution to a `superpowers:*` skill. Three dropped commands (`/workflows:compound`, `/lfg`, `/slfg`) become one-paragraph deprecation shims. Six duplicate skills and one obsolete agent are removed. Artifact paths shift from `docs/brainstorms/` to `docs/superpowers/specs/` to match superpowers vocabulary.

**Tech Stack:** Markdown skill/command authoring per Claude Code plugin spec, Bash for SessionStart dependency check, YAML for config/frontmatter.

**Reference:** See `docs/superpowers/specs/2026-05-25-superpowers-refactor-design.md` for the full design rationale.

---

## File Structure

### New files (4)
- `skills/microservice-focus/SKILL.md` — Skill entry, brief, links to references
- `skills/microservice-focus/references/focus-gate.md` — Service discovery + prompting protocol
- `skills/microservice-focus/references/focus-context-block.md` — `<focus_context>` template & propagation rules
- `skills/microservice-focus/references/service-discovery.md` — `Glob("*/pyproject.toml")` mechanics, dependency cross-reference algorithm

### Files rewritten as thin wrappers (4)
- `commands/workflows/brainstorm.md`
- `commands/workflows/plan.md`
- `commands/workflows/work.md` (preserves Python quality gate, Phase 4 PR template)
- `commands/workflows/review.md` (preserves agent roster + multi-service detection; drops `learnings-researcher` and `docs/solutions/`)

### Files rewritten as deprecation shims (3)
- `commands/workflows/compound.md`
- `commands/lfg.md`
- `commands/slfg.md`

### Files deleted (7)
- `skills/brainstorming/` (directory)
- `skills/git-worktree/` (directory)
- `skills/skill-creator/` (directory)
- `skills/create-agent-skills/` (directory)
- `skills/orchestrating-swarms/` (directory)
- `skills/compound-docs/` (directory)
- `agents/research/learnings-researcher.md` (file)

### Files updated (mechanical or medium scope)
- `.claude-plugin/plugin.json` — bump to 3.0.0, update description
- `scripts/check-dependencies.sh` — add superpowers detection
- `skills/setup/SKILL.md` — drop `compound` from generated `workflow_skills` keys
- `skills/setup/references/*.md` — same as above if referenced
- `skills/document-review/SKILL.md` — remove any reference to the deleted `brainstorming` skill if present
- `commands/heal-skill.md` — remove references to deleted skills
- `commands/resolve_todo_parallel.md` — remove references to deleted skills
- `commands/deepen-plan.md` — remove references to deleted skills/`docs/solutions/`
- `agents/research/best-practices-researcher.md` — remove reference to `learnings-researcher` / `docs/solutions/`
- `agents/research/git-history-analyzer.md` — same
- `agents/review/code-simplicity-reviewer.md` — same
- `CLAUDE.md` — remove stale `docs/solutions/plugin-versioning-requirements.md` reference, update output-paths table, drop `compound` from example YAML
- `CHANGELOG.md` — prepend v3.0.0 entry
- `README.md` — major rewrite per spec section 5

---

## Task 1: Create the `microservice-focus` skill

**Files:**
- Create: `skills/microservice-focus/SKILL.md`
- Create: `skills/microservice-focus/references/focus-gate.md`
- Create: `skills/microservice-focus/references/focus-context-block.md`
- Create: `skills/microservice-focus/references/service-discovery.md`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p skills/microservice-focus/references
```

- [ ] **Step 2: Write `skills/microservice-focus/SKILL.md`**

````markdown
---
name: microservice-focus
description: Use when a workflow command needs to detect multi-service monorepos, prompt for service scope, and propagate `<focus_context>` to sub-agents. Triggers when `--services` is passed, when focus context already exists in the conversation, or when multiple `pyproject.toml` files exist at the repo root.
---

# Microservice Focus

Consolidates the service-discovery and focus-context-propagation logic used by every Python workflow command in this plugin. Invoked once per command; returns the focused service list plus a `<focus_context>` block ready to inject into sub-agent prompts.

## When to invoke this skill

A workflow command should invoke this skill exactly once, near the top of its execution, before delegating to a `superpowers:*` skill.

## Inputs

The skill expects to find one of the following, in priority order:

1. A `--services service-a,service-b` argument parsed from the command's `$ARGUMENTS`.
2. An existing `<focus_context>` block in the conversation (set by a prior invocation).
3. Multiple `pyproject.toml` files at the repo root (multi-service repo).
4. None of the above → return single-service mode.

## What the skill does

1. **Parse `--services` if present.** Skip the interactive prompt and use those services as the focused set.
2. **Discover services on disk** when no explicit list was given. See [service-discovery.md](./references/service-discovery.md) for the exact glob and parsing rules.
3. **If multi-service and no explicit list:** use `AskUserQuestion` to prompt the user with the discovered services as multi-select options. See [focus-gate.md](./references/focus-gate.md) for the prompt format.
4. **Load each focused service's context:** `prompt.md` (preferred) or `README.md` (first 50 lines), `pyproject.toml`, and `src/` structure. Cross-reference internal dependencies to build the dependency map.
5. **Build the `<focus_context>` block.** See [focus-context-block.md](./references/focus-context-block.md) for the canonical template.
6. **Return** the service list + the `<focus_context>` block to the caller. The caller is responsible for injecting it into the prompts of any sub-agents or sub-skills it invokes.

## Output contract

The skill returns two pieces of information to the caller:

- `services`: a list like `["service-a", "service-b"]`, or an empty list in single-service mode.
- `focus_context`: a `<focus_context>...</focus_context>` block ready to splice into sub-agent prompts. Empty string in single-service mode.

## Single-service mode

If only one (or zero) `pyproject.toml` is found and no `--services` argument was passed, the skill returns immediately with an empty service list and an empty focus context. The caller proceeds without per-service path overrides.

## References

- [focus-gate.md](./references/focus-gate.md) — Discovery + interactive prompting protocol
- [focus-context-block.md](./references/focus-context-block.md) — `<focus_context>` template & propagation rules
- [service-discovery.md](./references/service-discovery.md) — Glob mechanics, dependency cross-reference algorithm
````

- [ ] **Step 3: Write `skills/microservice-focus/references/focus-gate.md`**

````markdown
# Focus Gate Protocol

This file documents the interactive prompting protocol when multiple services exist but the user has not specified `--services`.

## Step 1: Discovery

Run `Glob("*/pyproject.toml")` from the repo root. Each match represents a candidate service. Strip the trailing `/pyproject.toml` to get the service name (e.g., `service-a/pyproject.toml` → `service-a`).

If the glob returns 0 or 1 results, the repo is single-service. Return without prompting.

## Step 2: Prompt

If 2 or more services are discovered, use `AskUserQuestion` with `multiSelect: true`. Phrase the question to match the command context:

- `/workflows:brainstorm` → "Which services are relevant to this brainstorm?"
- `/workflows:plan` → "Which services are involved in this plan?"
- `/workflows:work` → "Which services does this work touch?"
- `/workflows:review` → "Which services should be reviewed?"

List discovered services as options. Each option's `label` is the service name; the `description` is a one-line summary read from `{service}/.claude/prompt.md` (first line) or `{service}/README.md` (first heading), or "Python service" as a fallback.

## Step 3: Validate the user's selection

If the user selects nothing or hits cancel, halt with: "No services selected. Re-invoke the command with `--services <list>` or pick services when prompted."

If the user selects a subset, treat those as the focused services and proceed.

## Step 4: Load per-service context

For each focused service, in parallel where possible:

1. Read `{service}/.claude/prompt.md` (preferred) — first 30 lines.
2. If not present, read `{service}/README.md` — first 50 lines.
3. Read `{service}/pyproject.toml` — extract `name`, Python version requirement, and the `dependencies`/`tool.poetry.dependencies` list.
4. Run `Glob("{service}/src/*/")` to enumerate top-level packages (apps, modules).

Cache these loads — the same focused service may be referenced multiple times in the focus-context block.

## Pipeline mode

If the command was invoked from an automated workflow (e.g., orchestrating script passes a flag, or a `disable-model-invocation` context is detected), **skip the interactive prompt entirely**. Default behavior in pipeline mode without `--services`: treat the repo as single-service.
````

- [ ] **Step 4: Write `skills/microservice-focus/references/focus-context-block.md`**

````markdown
# `<focus_context>` Block — Template and Propagation Rules

## Canonical template

```
<focus_context>
  services: <name-1> (./<name-1>), <name-2> (./<name-2>)

  <name-1>:
    description: [from prompt.md/README — what this service does]
    stack: [e.g., Django 5.0, Celery, PostgreSQL — derived from pyproject.toml]
    structure: [e.g., src/orders/, src/pricing/, src/shared/]

  <name-2>:
    description: [from prompt.md/README — what this service does]
    stack: [e.g., FastAPI, SQLAlchemy 2.0, Redis]
    structure: [e.g., src/payments/, src/webhooks/]

  dependencies:
    - <name-2> depends on <name-1> (event schema)
    - both depend on lib-common (shared DTOs)
</focus_context>
```

## Construction rules

1. **`services:` line** lists all focused services with their paths in the format `<name> (./<name>)`.
2. **Per-service block** for each focused service includes `description`, `stack`, and `structure`. Pull these from the per-service context loaded in [focus-gate.md](./focus-gate.md).
3. **`dependencies:` section** lists internal dependencies cross-referenced from `pyproject.toml` files. Format each as a single line stating "X depends on Y (reason)". See [service-discovery.md](./service-discovery.md) for cross-reference logic.
4. **Omit any section** for which there is no data. An empty repo description, empty stack, or no detected dependencies = omit the line.

## Propagation rules

The caller (a workflow command) **must inject the full `<focus_context>` block into the prompt of every sub-agent or sub-skill it invokes**. This includes:

- `superpowers:brainstorming` (via the wrapper's delegate step)
- `superpowers:writing-plans`
- `superpowers:executing-plans`
- `superpowers:requesting-code-review`
- Any Python review agent spawned by `/workflows:review`
- Any sub-task spawned by `Agent` or `Task` calls inside the command body

The block is inserted near the top of the sub-agent prompt, before any task description, so the sub-agent reads the constraint up front.

## Stack-aware behavior expectation

Sub-agents that read this block should:

- Apply Django patterns only in services whose stack lists Django.
- Apply FastAPI patterns only in services whose stack lists FastAPI.
- Respect each service's test/lint command (often visible in its `pyproject.toml` scripts or `CLAUDE.md`).
- Use the dependency map to choose execution order in multi-step operations.

The wrapper command is not responsible for enforcing these — sub-agents act on the block.
````

- [ ] **Step 5: Write `skills/microservice-focus/references/service-discovery.md`**

````markdown
# Service Discovery & Dependency Cross-Reference

## Discovering services

Single-line discovery:

```
Glob("*/pyproject.toml")
```

Each match represents one candidate service. Strip the suffix:

```
service-a/pyproject.toml  →  service-a
service-b/pyproject.toml  →  service-b
lib-common/pyproject.toml →  lib-common
```

If the glob returns 0 results: not a Python repo — return single-service mode.
If 1 result: single-service repo — return single-service mode.
If 2+ results: multi-service repo — proceed with focus gate.

## Reading service metadata

For each discovered service:

1. **Name and stack** — parse `{service}/pyproject.toml`. Extract:
   - Package name (from `[tool.poetry].name` or `[project].name`)
   - Python requirement (from `python` field)
   - Dependency list (from `[tool.poetry.dependencies]` or `[project].dependencies`)

   The stack summary in `<focus_context>` is derived from notable dependencies: `django`, `fastapi`, `celery`, `sqlalchemy`, `psycopg2`/`psycopg`, `redis`, `pydantic`, etc. Pick the 2-4 most architecturally significant ones.

2. **Description** — first usable text from `{service}/.claude/prompt.md` (first paragraph, max 200 chars) or `{service}/README.md` (first non-empty paragraph after the title, max 200 chars).

3. **Structure** — enumerate `{service}/src/*/` top-level dirs and list as comma-separated. Limit to ~5 entries; if more exist, suffix with `, ...`.

## Cross-referencing internal dependencies

To detect that service-b depends on service-a:

1. Build a list of all package names from the focused services (read from each `pyproject.toml`'s `name` field).
2. For each focused service, scan its `dependencies` list for entries that match another focused service's package name.
3. Record the dependency: "service-b depends on service-a".
4. Optionally infer the reason by reading the depending service's import statements or recent commits — leave blank if unknown.

## Detecting `lib-*` shared libraries

Any service whose name starts with `lib-` is treated as a library candidate. If multiple focused services depend on `lib-common` (or similar), surface that as a "both depend on lib-common" line in `dependencies:`.

## Edge cases

- **Service has no `src/`** — list the top-level Python packages instead, or omit `structure:`.
- **Service has no `pyproject.toml`** — skip; it should not have been discovered in the first place.
- **Circular dependency between focused services** — record both directions, do NOT halt; let the consumer skill decide how to handle it.
- **Service named identically to a top-level project module** — disambiguate by path, not by name.
````

- [ ] **Step 6: Verify the skill structure**

```bash
ls -la skills/microservice-focus/
ls -la skills/microservice-focus/references/
```

Expected output: directory exists, `SKILL.md` present, `references/` contains 3 `.md` files.

- [ ] **Step 7: Verify YAML frontmatter parses**

```bash
head -5 skills/microservice-focus/SKILL.md
```

Expected output: 5 lines starting with `---`, with `name:` and `description:` keys, ending with the second `---`.

- [ ] **Step 8: Commit**

```bash
git add skills/microservice-focus/
git commit -m "feat(skill): add microservice-focus skill

Consolidates service discovery, --services parsing, multi-service
prompting, and <focus_context> block construction into a single
skill. Workflow commands invoke this once instead of duplicating
~50 lines of focus gate logic each."
```

---

## Task 2: Rewrite `/workflows:brainstorm` as a thin wrapper

**Files:**
- Modify: `commands/workflows/brainstorm.md` (currently 189 lines → ~45 lines)

- [ ] **Step 1: Replace the entire file content**

Use the Write tool to overwrite `commands/workflows/brainstorm.md` with the following:

````markdown
---
name: workflows:brainstorm
description: Explore requirements and approaches before planning, with Python/microservice context loaded for downstream sub-agents
argument-hint: "[feature idea or problem to explore] [--services svc-a,svc-b]"
---

# Brainstorm (Python)

This command is a thin wrapper that loads Python-specific context, runs the microservice focus gate, then delegates the brainstorming process to the `superpowers:brainstorming` skill.

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

If the feature description above is empty, ask the user: "What would you like to explore? Please describe the feature, problem, or improvement you're thinking about." Do not proceed without one.

## Prerequisites

If the `superpowers:brainstorming` skill is not available, halt and instruct the user:

> "This command requires the `superpowers` plugin. Install it with:
> `/plugin marketplace add anthropics/claude-plugins-official`
> `/plugin install superpowers@claude-plugins-official`"

## Step 1: Load Project Workflow Skills

Read `compound-engineering.local.md` in the project root. If found, parse the YAML frontmatter for `workflow_skills.brainstorm`. If the key contains a non-empty list of skill names, load each listed skill now. These provide project-specific Python/Django/domain context.

If no config exists or no `workflow_skills` key is present, proceed without additional skills.

## Step 2: Microservice Focus

Invoke the `microservice-focus` skill. It will:

- Parse `--services` from `$ARGUMENTS` if present.
- Otherwise discover services via `Glob("*/pyproject.toml")` and prompt the user via `AskUserQuestion` if multiple services exist.
- Return the list of focused services + a `<focus_context>` block.

In single-service mode, the skill returns an empty service list and empty focus context. Skip Step 4.

## Step 3: Delegate to superpowers

Invoke the `superpowers:brainstorming` skill. Pass:

- The user's feature description from `<feature_description>` as the topic.
- The `<focus_context>` block returned from Step 2 (so the superpowers skill includes it in any sub-agent prompts it spawns).
- A note that any Python `workflow_skills` listed above are already loaded in the conversation as additional context.

The superpowers skill drives the rest of the conversation: clarifying questions, approach exploration, design presentation, spec writing.

## Step 4: Multi-service spec path override

`superpowers:brainstorming` writes its spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` by default.

If Step 2 returned a non-empty service list, write **one spec per focused service** at:

```
{service}/docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
```

Each per-service spec focuses on that service's role and decisions. Add a `## Services` section to each listing all focused services and their roles, so `/workflows:plan` can auto-detect scope on the next step.

Create the `{service}/docs/superpowers/specs/` directories with `mkdir -p` as needed before writing.

## Output

After the superpowers skill returns, summarize:

- Spec path(s) written.
- The focused services (if multi-service mode).
- Suggested next step: `/workflows:plan <spec-path>`.
````

- [ ] **Step 2: Verify the file was written**

```bash
wc -l commands/workflows/brainstorm.md
head -5 commands/workflows/brainstorm.md
```

Expected: ~45 lines (was 189). Frontmatter intact with `name: workflows:brainstorm`.

- [ ] **Step 3: Commit (deferred — bundle with other wrapper rewrites in Task 5's commit step)**

Do not commit yet. The 4 wrapper rewrites commit together to keep the diff coherent.

---

## Task 3: Rewrite `/workflows:plan` as a thin wrapper

**Files:**
- Modify: `commands/workflows/plan.md` (currently 681 lines → ~55 lines)

- [ ] **Step 1: Replace the entire file content**

````markdown
---
name: workflows:plan
description: Transform a spec into a Python-flavored implementation plan, delegating plan-writing to superpowers
argument-hint: "[spec path, feature description, or bug report] [--services svc-a,svc-b]"
---

# Plan (Python)

This command is a thin wrapper that loads Python-specific context, runs the microservice focus gate, then delegates plan writing to the `superpowers:writing-plans` skill.

## Input

<input> #$ARGUMENTS </input>

If the input is empty, ask the user: "What would you like to plan? Provide a spec path (typically under `docs/superpowers/specs/`) or a feature description." Do not proceed without one.

## Prerequisites

If the `superpowers:writing-plans` skill is not available, halt and instruct the user to install `superpowers` (same message format as `/workflows:brainstorm`).

## Step 1: Load Project Workflow Skills

Read `compound-engineering.local.md` in the project root. If `workflow_skills.plan` is set, load each listed skill now. They inform the plan with Python/Django/domain-specific patterns.

## Step 2: Microservice Focus

Invoke the `microservice-focus` skill. It returns focused services + `<focus_context>`.

If the input was a spec path, **also** check the spec for a `## Services` section. If present, merge those services into the focused list (the spec may have established scope during brainstorm).

## Step 3: Delegate to superpowers

Invoke the `superpowers:writing-plans` skill. Pass:

- The input (spec path or feature description) as the planning topic.
- The `<focus_context>` block from Step 2.
- A note that loaded Python `workflow_skills` are available in conversation.

The superpowers skill drives plan writing: file structure, task decomposition, bite-sized steps, self-review.

## Step 4: Multi-service plan output

`superpowers:writing-plans` writes a single plan to `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` by default.

If Step 2 returned a non-empty service list, **also** add the following to the plan's YAML frontmatter so `/workflows:work` can execute in dependency order:

```yaml
services:
  service-a:
    depends_on: []
  service-b:
    depends_on:
      - service: service-a
        reason: "<inferred from focus context or asked>"
```

Determine dependencies from the `<focus_context>` block's `dependencies:` section. Ask the user to confirm or adjust the graph before writing the final plan.

**For cross-service plans, write multiple files:**

1. **Root overview:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` — dependency graph, execution order, links to per-service plans, cross-cutting concerns.
2. **Per-service plans:** `{service}/docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` — service-specific tasks, acceptance criteria, file changes.

Use the same base filename across all locations for traceability. Create directories with `mkdir -p` as needed.

**For single-service work in a multi-service repo:** write only to `{service}/docs/superpowers/plans/...` (no root overview needed).

## Output

Confirm: "Plan written to `<path>`" (and per-service locations if applicable). Suggest next step: `/workflows:work <plan-path>`.
````

- [ ] **Step 2: Verify**

```bash
wc -l commands/workflows/plan.md
head -5 commands/workflows/plan.md
```

Expected: ~55 lines (was 681). Frontmatter intact.

- [ ] **Step 3: Do not commit yet** — bundled commit at Task 5.

---

## Task 4: Rewrite `/workflows:work` as a wrapper + Python quality gate

**Files:**
- Modify: `commands/workflows/work.md` (currently 585 lines → ~140 lines; longest wrapper because the Python quality gate is the unique value)

- [ ] **Step 1: Replace the entire file content**

````markdown
---
name: workflows:work
description: Execute a plan via superpowers, gated by a Python-specific quality bar (pytest + ruff + mypy + pre-commit), with multi-service execution ordering preserved
argument-hint: "[plan file path]"
---

# Work (Python)

This command is a wrapper around `superpowers:executing-plans`. It loads Python-specific context, runs the microservice focus gate, optionally honors per-service execution ordering, delegates plan execution, then enforces a Python quality gate before any PR is created.

## Input Document

<input_document> #$ARGUMENTS </input_document>

If empty, ask the user for a plan path (typically under `docs/superpowers/plans/` or `{service}/docs/superpowers/plans/`). Do not proceed without one.

## Prerequisites

If the `superpowers:executing-plans` skill is not available, halt and instruct the user to install `superpowers` (same message format as `/workflows:brainstorm`).

## Step 1: Load Project Workflow Skills

Read `compound-engineering.local.md`. If `workflow_skills.work` is set, load each listed skill now (e.g., `django-patterns`, `pytest-patterns`).

## Step 2: Microservice Focus + Execution Order

Invoke the `microservice-focus` skill. It returns the focused services + `<focus_context>`.

**If the plan's YAML frontmatter contains a `services:` section:**

1. Treat those as the focused services (override the prompt result).
2. Parse the dependency graph from the frontmatter.
3. Build a topological execution order (wavefront pattern):
   - Wave 1: services with `depends_on: []`
   - Wave 2: services depending only on Wave 1
   - etc.
4. Detect cycles: if found, report to user and treat services in the cycle as independent.
5. Show the execution plan and get user confirmation (skip in pipeline mode):

```
Execution plan:
  Wave 1 (no deps):
    service-a — Order management (Django 5.0, Celery)
    lib-common — Shared DTOs and schemas
  Wave 2 (after wave 1):
    service-b — Payment processing (FastAPI, SQLAlchemy) — depends on service-a

Default: sequential execution in topological order.
Options: [Confirm] [Force sequential] [Adjust order]
```

For parallel execution within a wave, use `superpowers:dispatching-parallel-agents` (do NOT invoke the deleted `orchestrating-swarms` skill).

## Step 3: Delegate plan execution to superpowers

Invoke the `superpowers:executing-plans` skill (or `superpowers:subagent-driven-development` if the plan header recommends it). Pass:

- The plan path from `<input_document>`.
- The `<focus_context>` block.
- The execution order from Step 2 (so the skill processes tasks in the right wave order in multi-service mode).
- The test command to use per service:
  - Single-service: `poetry run pytest` (or whatever the project's CLAUDE.md specifies)
  - Multi-service: `cd {service} && poetry run pytest` for each service

The superpowers skill handles the task loop, per-task commits, and incremental progress.

## Step 4: Python Quality Gate (MANDATORY — blocks Step 5)

Step 5 cannot start until all checks in this step pass. This is not advisory.

1. **Full Test-and-Fix Cycle** — loop until clean:

   ```
   LOOP:
     a. Run full test suite. Single-service: `poetry run pytest`. Multi-service: run each focused
        service's test command in sequence (or in parallel if the user opted in).
        → If tests fail: read failures, fix the code, re-run from (a). Do NOT proceed.
     b. Run linting via the python-lint agent (ruff + mypy).
        → If linting fails: fix issues, re-run from (a) — lint fixes can break tests.
     c. Run pre-commit hooks on all staged files (`pre-commit run --all-files` or
        `git stash && git stash pop` to trigger the install).
        → If hooks fail: fix issues, re-run from (a).
   ```

   Do not skip this cycle. Every fix can introduce new failures — always re-run from the top.

2. **Optional Reviewer Agents** — for risky or large changes, read `review_agents` from `compound-engineering.local.md`. If present, spawn each in parallel via `Task`. Present findings; address critical ones before proceeding.

3. **Final Validation Checklist** — all must be true:
   - [ ] All plan tasks marked completed (checkboxes in plan file)
   - [ ] Full test suite passes (not just the tests added)
   - [ ] Linting passes with zero warnings
   - [ ] Pre-commit hooks pass on all changed files
   - [ ] Code follows existing patterns
   - [ ] No console errors or warnings

   If any check fails: fix and re-run the full cycle. Do not proceed to Step 5.

4. **Operational Validation Plan** — REQUIRED before PR:

   Add a `## Post-Deploy Monitoring & Validation` section to the PR description for every change. Include:
   - Log queries/search terms
   - Metrics or dashboards to watch
   - Expected healthy signals
   - Failure signals + rollback/mitigation trigger
   - Validation window + owner

   If truly no production/runtime impact: include the section with `No additional operational monitoring required: <reason>`.

## Step 5: Ship It

Prerequisite: Step 4 quality gate passed. If not, return to Step 4.

1. **Create commit via the `commit` skill** (kept; not deleted in this refactor). It analyzes, groups, and commits all changes with conventional + gitmoji format. Never skip pre-commit hooks with `--no-verify`.

2. **Capture screenshots for UI changes** — for any design changes, new views, or UI modifications:
   - Start dev server (Django: `python manage.py runserver`; FastAPI: `uvicorn main:app --reload`).
   - Use the `agent-browser` skill (kept) to capture before/after screenshots.
   - Upload via the `agent-browser` skill's upload mechanism and include URLs in the PR description.

3. **Create Pull Request:**

```bash
git push -u origin <feature-branch-name>

gh pr create --title "<type>: <Description>" --body "$(cat <<'EOF'
## Summary
- What was built
- Why it was needed
- Key decisions made

## Testing
- Tests added/modified
- Manual testing performed

## Post-Deploy Monitoring & Validation
- **What to monitor/search**
  - Logs:
  - Metrics/Dashboards:
- **Validation checks (queries/commands)**
  - `command or query here`
- **Expected healthy behavior**
  - Expected signal(s)
- **Failure signal(s) / rollback trigger**
  - Trigger + immediate action
- **Validation window & owner**
  - Window:
  - Owner:
- **If no operational impact**
  - `No additional operational monitoring required: <reason>`

## Before / After Screenshots (UI changes only)
| Before | After |
|--------|-------|
| ![before](URL) | ![after](URL) |

---

[![Compound Engineered](https://img.shields.io/badge/Compound-Engineered-6366f1)](https://github.com/weorbitant/compound-engineering-feat-python-plugin) 🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

4. **Update plan status** — if the input plan has YAML frontmatter with a `status` field, update it from `active` → `completed`.

5. **Notify user** — summarize what shipped, link to PR, note any follow-ups.
````

- [ ] **Step 2: Verify**

```bash
wc -l commands/workflows/work.md
head -5 commands/workflows/work.md
grep -c "poetry run pytest" commands/workflows/work.md
grep -c "Post-Deploy Monitoring" commands/workflows/work.md
```

Expected: ~140 lines, frontmatter intact, "poetry run pytest" appears (Python test cmd preserved), "Post-Deploy Monitoring" appears (PR template preserved).

- [ ] **Step 3: Do not commit yet** — bundled commit at Task 5.

---

## Task 5: Rewrite `/workflows:review` as a thin wrapper

**Files:**
- Modify: `commands/workflows/review.md` (currently 514 lines → ~95 lines; preserves agent roster + multi-service detection; drops `learnings-researcher` + `docs/solutions/` references)

- [ ] **Step 1: Replace the entire file content**

````markdown
---
name: workflows:review
description: Multi-agent Python code review, delegating review orchestration to superpowers and supplying Python-specific reviewer agents from project config
argument-hint: "[PR number, GitHub URL, branch name, or empty for current branch]"
---

# Review (Python)

This command is a thin wrapper around `superpowers:requesting-code-review`. It loads the Python reviewer agent roster from `compound-engineering.local.md`, supplies them to the superpowers orchestration, and adds Python-specific conditional agents for migrations.

## Review Target

<review_target> #$ARGUMENTS </review_target>

If empty, default to the current branch's diff against the project default branch.

## Prerequisites

If the `superpowers:requesting-code-review` skill is not available, halt and instruct the user to install `superpowers` (same message format as `/workflows:brainstorm`).

## Step 1: Determine target & checkout

1. Determine the review target type:
   - Numeric → PR number; use `gh pr view --json` to fetch metadata.
   - GitHub URL → extract PR number, then as above.
   - File path ending in `.md` → document review; pass through to superpowers as a doc target.
   - Empty → current branch.
2. If the target is a PR and the current branch differs, switch via `gh pr checkout <num>` or use the `superpowers:using-git-worktrees` skill for an isolated worktree.

## Step 2: Microservice Detection

Auto-detect changed services from the diff:

```bash
git diff --name-only origin/<default-branch>...HEAD | cut -d'/' -f1 | sort -u
```

Cross-reference the top-level directories against discovered services (`Glob("*/pyproject.toml")`). The intersection is the list of changed services.

If multiple services are changed, invoke the `microservice-focus` skill to build a `<focus_context>` block scoped to those services. Per-service agent roster loading happens in Step 3.

## Step 3: Load Reviewer Roster

**Single-service or non-microservice mode:**
Read `compound-engineering.local.md` in the project root. Use `review_agents` from the YAML frontmatter.

**Multi-service mode:**
For each changed service, check `{service}/compound-engineering.local.md` first (allows per-service agent rosters — e.g., Django agents for one, FastAPI for another). Fall back to root-level `compound-engineering.local.md`.

If no settings file exists, invoke the `setup` skill (kept) to create one. Read the new file and continue.

## Step 4: Load Project Workflow Skills

From the same `compound-engineering.local.md`, parse `workflow_skills.review`. Load each listed skill now. They provide Python-specific context that helps interpret review findings.

## Step 5: Identify Conditional Agents

Some agents only run when the PR matches specific criteria:

**Migration agents** — run if the PR contains any of:
- `*/migrations/*.py` (Django migrations)
- `alembic/versions/*.py` (Alembic migrations)
- Files modifying ID/enum/mapping columns
- Data migration scripts or management commands
- Title/body mentioning: migration, backfill, data transformation, ID mapping

If matched, add to the agent roster:
- `data-migration-expert` — validates data migrations, swapped IDs, rollback safety
- `deployment-verification-agent` — Go/No-Go checklist with SQL verification queries

## Step 6: Protected Artifacts

When synthesizing findings, **discard any recommendations to delete or gitignore** files matching:

- `docs/plans/*.md`, `docs/superpowers/plans/*.md`
- `docs/superpowers/specs/*.md`
- `{service}/docs/plans/*.md`, `{service}/docs/superpowers/plans/*.md`
- `{service}/docs/superpowers/specs/*.md`

These are living pipeline artifacts. Do not create todos for their removal.

## Step 7: Delegate to superpowers

Invoke the `superpowers:requesting-code-review` skill. Pass:

- The review target (PR number, branch, or doc path).
- The full agent roster from Step 3 (so superpowers spawns each in parallel).
- The conditional migration agents from Step 5 (if applicable).
- The `<focus_context>` block from Step 2 (multi-service mode).
- The "protected artifacts" rule from Step 6 (so superpowers filters discardable findings).
- Always-on agents to include alongside the roster:
  - `agent-native-reviewer` — verifies new features are agent-accessible

Note: this command does **NOT** spawn `learnings-researcher` (deleted in v3.0.0) and does NOT read `docs/solutions/` (knowledge-compounding pattern dropped).

## Step 8: Synthesis & Todos

The superpowers skill handles parallel agent execution and findings collection. After it returns, use the `file-todos` skill (kept) to create one todo file per finding under `todos/`, using the standard naming `{issue_id}-pending-{priority}-{description}.md`.

If the user prefers an inline summary instead of todo files, surface findings in a categorized list (P1/P2/P3) without writing files.

## Step 9: Browser Test Offer (Optional)

After synthesis, offer browser testing via `AskUserQuestion`:

> "Want to run browser tests on the affected pages?"
> 1. Yes — run `/test-browser`
> 2. No — skip

If the user accepts, spawn a sub-agent to run `/test-browser` for the PR. The sub-agent uses the `agent-browser` skill (kept) to capture snapshots and check for console errors.

## Output

Summarize:
- PR/branch reviewed.
- Number of P1/P2/P3 findings.
- Path to todos/ (if file-todos was used).
- Next-step recommendation (e.g., "Address P1 findings before merging").
````

- [ ] **Step 2: Verify**

```bash
wc -l commands/workflows/review.md
head -5 commands/workflows/review.md
! grep -q "learnings-researcher" commands/workflows/review.md
! grep -q "docs/solutions" commands/workflows/review.md
```

Expected: ~95 lines, frontmatter intact, no references to `learnings-researcher` or `docs/solutions` remain.

- [ ] **Step 3: Commit all 4 wrapper rewrites together**

```bash
git add commands/workflows/brainstorm.md commands/workflows/plan.md commands/workflows/work.md commands/workflows/review.md
git commit -m "refactor(workflows): rewrite 4 wrappers to delegate to superpowers

- brainstorm → superpowers:brainstorming (loads Python skills + focus context)
- plan → superpowers:writing-plans (adds services: YAML for execution order)
- work → superpowers:executing-plans (keeps Python quality gate + PR template)
- review → superpowers:requesting-code-review (supplies Python agent roster,
  drops learnings-researcher and docs/solutions/ references)

Wrappers shrink from ~190-680 lines to ~45-140 lines each. All shared
microservice focus logic moves to the microservice-focus skill."
```

---

## Task 6: Convert `/workflows:compound`, `/lfg`, `/slfg` to deprecation shims

**Files:**
- Modify: `commands/workflows/compound.md`
- Modify: `commands/lfg.md`
- Modify: `commands/slfg.md`

- [ ] **Step 1: Replace `commands/workflows/compound.md`**

````markdown
---
name: workflows:compound
description: "(DEPRECATED v3.0.0 — removed in v4.0.0) Document a recently solved problem"
argument-hint: "[optional: brief context about the fix]"
---

# `/workflows:compound` — Removed in v3.0.0

This command was removed in v3.0.0 along with the knowledge-compounding (`docs/solutions/`) pattern. There is no direct replacement: `superpowers` does not have an analog for post-solve documentation capture.

If you want to capture a learning from a recent fix:

- Write a Markdown note in your project under whatever path your team uses for engineering notes.
- Or contribute the lesson back to a project-local skill via the `superpowers:writing-skills` skill.

See `CHANGELOG.md` v3.0.0 for the full rationale.

This shim will be removed entirely in v4.0.0.
````

- [ ] **Step 2: Replace `commands/lfg.md`**

````markdown
---
name: lfg
description: "(DEPRECATED v3.0.0 — removed in v4.0.0) Full autonomous pipeline"
argument-hint: "[feature description]"
---

# `/lfg` — Removed in v3.0.0

The `/lfg` autonomous pipeline was removed in v3.0.0. Users now orchestrate the stages directly, which keeps each step interruptible and reviewable.

Run the stages in sequence:

1. `/workflows:brainstorm "<your idea>"` — explore and write a spec.
2. `/workflows:plan <spec-path>` — turn the spec into an implementation plan.
3. `/workflows:work <plan-path>` — execute the plan with the Python quality gate.
4. `/workflows:review` — multi-agent review of the resulting PR.

Each stage now delegates to a `superpowers:*` skill underneath. See `CHANGELOG.md` v3.0.0 for the full rationale.

This shim will be removed entirely in v4.0.0.
````

- [ ] **Step 3: Replace `commands/slfg.md`**

````markdown
---
name: slfg
description: "(DEPRECATED v3.0.0 — removed in v4.0.0) Swarm-mode autonomous pipeline"
argument-hint: "[feature description]"
---

# `/slfg` — Removed in v3.0.0

The `/slfg` swarm pipeline was removed in v3.0.0 along with the `orchestrating-swarms` skill it depended on.

For parallel agent work, use the `superpowers:dispatching-parallel-agents` skill directly within any stage (most useful inside `/workflows:work` for independent tasks).

For the rest of the pipeline, see `/lfg`'s migration message:

1. `/workflows:brainstorm "<idea>"`
2. `/workflows:plan <spec>`
3. `/workflows:work <plan>` — invoke `superpowers:dispatching-parallel-agents` inside this for parallelism.
4. `/workflows:review`

See `CHANGELOG.md` v3.0.0 for the full rationale.

This shim will be removed entirely in v4.0.0.
````

- [ ] **Step 4: Verify all three shims are short**

```bash
wc -l commands/workflows/compound.md commands/lfg.md commands/slfg.md
```

Expected: each ~15-20 lines.

- [ ] **Step 5: Commit**

```bash
git add commands/workflows/compound.md commands/lfg.md commands/slfg.md
git commit -m "chore(deprecate): convert /workflows:compound, /lfg, /slfg to shims

These 3 commands were removed in v3.0.0. Shims print a migration
message when invoked and will be removed entirely in v4.0.0."
```

---

## Task 7: Delete 6 obsolete skills + 1 obsolete agent

**Files:**
- Delete: `skills/brainstorming/`
- Delete: `skills/git-worktree/`
- Delete: `skills/skill-creator/`
- Delete: `skills/create-agent-skills/`
- Delete: `skills/orchestrating-swarms/`
- Delete: `skills/compound-docs/`
- Delete: `agents/research/learnings-researcher.md`

- [ ] **Step 1: Verify each skill exists before deletion**

```bash
ls skills/brainstorming/ skills/git-worktree/ skills/skill-creator/ \
   skills/create-agent-skills/ skills/orchestrating-swarms/ skills/compound-docs/
ls agents/research/learnings-researcher.md
```

All paths should exist. If any are already missing, note it and skip that deletion.

- [ ] **Step 2: Delete the 6 skill directories**

```bash
git rm -r skills/brainstorming/ skills/git-worktree/ skills/skill-creator/ \
          skills/create-agent-skills/ skills/orchestrating-swarms/ skills/compound-docs/
```

- [ ] **Step 3: Delete the obsolete agent file**

```bash
git rm agents/research/learnings-researcher.md
```

- [ ] **Step 4: Verify deletions are staged**

```bash
git status --short | grep -E "^D" | wc -l
```

Expected: count corresponds to all the deleted files (multiple files per skill directory + 1 agent).

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor: delete 6 duplicate skills + learnings-researcher agent

Deleted skills (replaced by superpowers equivalents):
- brainstorming        → superpowers:brainstorming
- git-worktree         → superpowers:using-git-worktrees
- skill-creator        → superpowers:writing-skills
- create-agent-skills  → superpowers:writing-skills
- orchestrating-swarms → superpowers:dispatching-parallel-agents
- compound-docs        → none (consumer /workflows:compound also dropped)

Deleted agent:
- learnings-researcher → none (docs/solutions/ knowledge pattern dropped)"
```

---

## Task 8: Update `/setup` to drop `compound` from generated config

**Files:**
- Modify: `skills/setup/SKILL.md`
- Modify: any file under `skills/setup/references/` that mentions `compound` key in YAML examples

- [ ] **Step 1: Find references to `compound` in the setup skill**

```bash
grep -rn "compound" skills/setup/
```

- [ ] **Step 2: For each match, remove the line that adds `compound:` to the generated `workflow_skills` YAML**

The generated YAML for a fresh user should be (note: only 4 keys, no `compound`):

```yaml
workflow_skills:
  brainstorm: []
  plan: []
  work: []
  review: []
```

Update any inline example, instruction, or template that includes a `compound` line.

Edit each match with the `Edit` tool to remove just the `compound: ...` line. Do not remove surrounding context.

- [ ] **Step 3: Verify no `compound` references remain in the setup skill**

```bash
grep -rn "compound" skills/setup/
```

Expected: no matches, or only matches in unrelated contexts (e.g., the plugin name itself). Re-read each remaining match and decide individually.

- [ ] **Step 4: Commit**

```bash
git add skills/setup/
git commit -m "refactor(setup): drop 'compound' key from generated workflow_skills

/workflows:compound was removed in v3.0.0. /setup no longer offers
or writes a 'compound' key when generating compound-engineering.local.md.
Existing user configs with a 'compound' key are ignored silently."
```

---

## Task 9: Add `superpowers` detection to `scripts/check-dependencies.sh`

**Files:**
- Modify: `scripts/check-dependencies.sh`

- [ ] **Step 1: Read the current script to confirm structure**

The current script declares a `missing=()` array, populates it by checking `command -v <tool>`, and prints warnings at the bottom. We add a new check for `superpowers` (filesystem-based, not `command -v`) and a new warning branch.

- [ ] **Step 2: Add the superpowers detection block**

Insert this block after the `rclone` check (after line 13 of the current script):

```bash
# Check superpowers plugin (REQUIRED — provides workflow primitives)
if ! find ~/.claude/plugins -type d -name "superpowers" 2>/dev/null | grep -q .; then
  missing+=("superpowers")
fi
```

Use the `Edit` tool with `old_string` = the rclone check block, `new_string` = the rclone check block + the new superpowers block.

- [ ] **Step 3: Add the warning branch**

Insert this block after the `rclone` warning branch (after line 34):

```bash
if [[ " ${missing[*]} " =~ " superpowers " ]]; then
  warning="$warning
  - superpowers (REQUIRED — provides brainstorming, planning, execution, review primitives)
    Install: /plugin marketplace add anthropics/claude-plugins-official
             /plugin install superpowers@claude-plugins-official"
fi
```

Use the `Edit` tool with `old_string` = the rclone warning block, `new_string` = the rclone warning block + the new superpowers warning block.

- [ ] **Step 4: Test the script with superpowers installed (should be silent)**

```bash
bash scripts/check-dependencies.sh
```

Expected: no output (assuming superpowers is in `~/.claude/plugins/`).

- [ ] **Step 5: Test the script as if superpowers were missing (manually simulate)**

```bash
# Save the superpowers path aside (do NOT delete it)
SP=$(find ~/.claude/plugins -type d -name "superpowers" 2>/dev/null | head -1)
echo "Found at: $SP"
# Run with a fake HOME so find returns nothing
HOME=/tmp bash scripts/check-dependencies.sh
```

Expected: the warning message lists `superpowers (REQUIRED ...)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-dependencies.sh
git commit -m "feat(deps): warn at session start when superpowers plugin is missing

scripts/check-dependencies.sh now scans ~/.claude/plugins for a
superpowers directory and prints an install hint if absent.
Soft check (exit 0); the actual halt happens inside each wrapper
command when superpowers:<skill> is invoked."
```

---

## Task 10: Update `.claude-plugin/plugin.json`

**Files:**
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Bump version and update description**

Use the `Edit` tool to make these changes:

Change `"version": "2.5.2"` → `"version": "3.0.0"`.

Change the description from:
```
"description": "Python-specialized development tools with microservice support. 33 agents, 21 commands, 26 skills, 1 MCP server."
```

to:
```
"description": "Python-specialized development tools with microservice support, built on superpowers. 32 agents, 18 commands, 21 skills, 1 MCP server."
```

- [ ] **Step 2: Verify**

```bash
grep -E '"version"|"description"' .claude-plugin/plugin.json
```

Expected: version is `3.0.0`; description mentions `built on superpowers` and the new counts.

- [ ] **Step 3: Do not commit yet** — bundled with the documentation updates in Task 12.

---

## Task 11: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Delete the stale `docs/solutions/` reference line**

Use the `Edit` tool. Find:
```
See `docs/solutions/plugin-versioning-requirements.md` for detailed versioning workflow.
```

Replace with: (empty string — delete the entire line, including the surrounding "## Documentation" header if that whole section becomes empty)

Actually, check whether the `## Documentation` section has other lines. If it has more lines, just delete the one stale line. If that's the only line, delete the entire section header too.

- [ ] **Step 2: Remove the `compound` entry from the example YAML in the `Workflow Skills Configuration` section**

Find this block:
```yaml
workflow_skills:
  brainstorm: [django-patterns, holafly-domain]
  plan: [django-patterns]
  work: [django-patterns, pytest-patterns]
  review: [django-patterns, pytest-patterns]
  compound: [django-patterns]
```

Replace with:
```yaml
workflow_skills:
  brainstorm: [django-patterns, holafly-domain]
  plan: [django-patterns]
  work: [django-patterns, pytest-patterns]
  review: [django-patterns, pytest-patterns]
```

- [ ] **Step 3: Update the `Doc Output in Multi-Service Mode` table**

Find this section header and table:
```
### Doc Output in Multi-Service Mode

| Doc Type | Single Service | Cross-Service |
|----------|---------------|---------------|
| Brainstorms | Single doc mentioning affected services | `{service}/docs/brainstorms/...` per service |
| Plans | `{service}/docs/plans/...` | Root overview + per-service plan files |
| Solutions | `{service}/docs/solutions/...` | Root `docs/solutions/...` with service refs |
```

Replace with:
```
### Doc Output in Multi-Service Mode

| Doc Type | Single Service | Cross-Service |
|----------|---------------|---------------|
| Specs | `docs/superpowers/specs/...` | `{service}/docs/superpowers/specs/...` per service |
| Plans | `docs/superpowers/plans/...` (or `{service}/docs/superpowers/plans/...`) | Root overview at `docs/superpowers/plans/...` + per-service plan files |
```

(Solutions row removed; vocabulary changed from "brainstorm" to "spec"; paths updated to `docs/superpowers/...`.)

- [ ] **Step 4: Update the `Focus Context Propagation` subsection**

Find the example that describes the `<focus_context>` block being included by all sub-agents. Add a sentence at the end:

> "The full Focus Gate protocol and `<focus_context>` template now live in the `microservice-focus` skill. Workflow commands invoke that skill once instead of inlining the logic."

Also keep the existing example block — it's still accurate.

- [ ] **Step 5: Verify**

```bash
! grep -q "docs/solutions/plugin-versioning-requirements" CLAUDE.md
! grep -q "compound: \[" CLAUDE.md
! grep -q "docs/brainstorms" CLAUDE.md
grep -q "microservice-focus" CLAUDE.md
```

All four checks should pass.

- [ ] **Step 6: Do not commit yet** — bundled with Task 12.

---

## Task 12: Update `CHANGELOG.md` and `README.md`

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: Prepend the v3.0.0 entry to `CHANGELOG.md`**

Read the current top of `CHANGELOG.md` first to see the format. Then prepend (before the most recent existing version's `## [...]` heading):

````markdown
## [3.0.0] - 2026-05-25

### Changed
- Plugin now requires the `superpowers` plugin as a foundation. All generic workflow
  primitives (brainstorming, planning, execution, review, git worktrees, parallel
  agents, skill writing) are delegated to superpowers; this plugin focuses on
  Python/Django/FastAPI domain value and microservice orchestration.
- Workflow commands rewritten as thin wrappers that delegate to superpowers skills:
  `/workflows:brainstorm` → `superpowers:brainstorming`, `/workflows:plan` →
  `superpowers:writing-plans`, `/workflows:work` → `superpowers:executing-plans`
  (+ Python quality gate), `/workflows:review` → `superpowers:requesting-code-review`.
- Microservice Focus Gate logic extracted from each workflow command into a new
  `microservice-focus` skill.
- Brainstorm artifact paths changed from `docs/brainstorms/` to
  `docs/superpowers/specs/` (and `{service}/docs/superpowers/specs/` in multi-service
  mode), matching superpowers vocabulary ("spec" instead of "brainstorm doc").
- `scripts/check-dependencies.sh` now warns if the superpowers plugin is not detected.

### Removed
- `/workflows:compound` command (knowledge-capture pattern dropped). Deprecation shim
  remains for one major cycle.
- `/lfg` and `/slfg` autonomous pipelines (users orchestrate stages directly).
  Deprecation shims remain for one major cycle.
- 6 skills replaced by superpowers equivalents: `brainstorming`, `git-worktree`,
  `skill-creator`, `create-agent-skills`, `orchestrating-swarms`, and `compound-docs`
  (the last because its only consumer was `/workflows:compound`).
- `learnings-researcher` agent (read from the now-removed `docs/solutions/` pattern).
- Knowledge-compounding pattern (`docs/solutions/`) — historical files in user repos
  remain untouched but are no longer read or written by this plugin.
- `compound` key from `workflow_skills` in `compound-engineering.local.md` schema.
  Existing keys are silently ignored.

### Deprecated
- `/lfg`, `/slfg`, `/workflows:compound` exist as shims that print a migration message
  when invoked. They will be removed entirely in v4.0.0.

### Added
- `microservice-focus` skill consolidating service discovery, `--services` parsing,
  multi-service prompting via `AskUserQuestion`, and `<focus_context>` block construction.

### Migration
- Install superpowers: `/plugin install superpowers@claude-plugins-official`.
- Replace any `/lfg`, `/slfg`, or `/workflows:compound` invocations with the
  appropriate sequence of `/workflows:brainstorm` → `/workflows:plan` →
  `/workflows:work` → `/workflows:review` (or `superpowers:dispatching-parallel-agents`
  within stages for parallel work).
- Move any documents under `docs/brainstorms/` to `docs/superpowers/specs/` if you
  want them auto-discovered by `/workflows:plan` (path-only rename; no schema change).
- Remove the `compound:` line from your project's `compound-engineering.local.md`
  if present (harmless to leave, but cleaner to drop).

---
````

- [ ] **Step 2: Rewrite `README.md` per the design spec**

Read the current README first, then update each section:

**Header tagline (line 3):** change to: "A Claude Code plugin that supercharges Python development with 32 specialized agents, 18 commands, 21 skills, and an MCP server — built on Anthropic's `superpowers` plugin for workflow primitives. Specialized for Django, FastAPI, pytest, Pydantic, PostgreSQL, and PostGIS projects, with first-class support for multi-service monorepos."

**"What It Does" section:** replace the 5-step diagram with 4-step:
```
/workflows:brainstorm → /workflows:plan → /workflows:work → /workflows:review
```
Remove the "For the impatient: `/lfg` runs the entire pipeline autonomously" line.

**Installation section:** add this prerequisite block ABOVE the existing install commands:
```markdown
### Prerequisite: Install superpowers

This plugin requires the `superpowers` plugin (provides generic workflow primitives).

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official
```
```

**Quick Start section:** remove the `/workflows:compound` example line and the `/lfg add rate limiting to the payment API` line. Add a note after the example: "Brainstorm specs land at `docs/superpowers/specs/`; plans at `docs/superpowers/plans/`."

**Core Workflow Commands table:** remove the `/workflows:compound` row. Update each remaining row's description to mention delegation, e.g.:
- `/workflows:brainstorm` | Explore requirements before planning (delegates to `superpowers:brainstorming`)
- `/workflows:plan` | Generate implementation plans (delegates to `superpowers:writing-plans`)
- `/workflows:work` | Execute a plan with Python quality gates (delegates to `superpowers:executing-plans`)
- `/workflows:review` | Multi-agent Python code review (delegates to `superpowers:requesting-code-review`)

**Utility Commands table:** remove the `/lfg` and `/slfg` rows.

**Add a new "Deprecated commands (v3.0.0)" subsection** after the Utility Commands table:
```markdown
### Deprecated commands (v3.0.0)

These commands were removed in v3.0.0; they remain as shims that print a migration message and will be deleted in v4.0.0:

- `/workflows:compound` — knowledge-capture pattern dropped; no replacement.
- `/lfg`, `/slfg` — autonomous pipelines dropped; orchestrate stages directly.

See CHANGELOG.md v3.0.0 for migration details.
```

**Agents section header:** change "Agents (33)" → "Agents (32)". In the Research table, remove the `learnings-researcher` row.

**Skills section header:** change "Skills (26)" → "Skills (21)". Remove these rows: `brainstorming`, `git-worktree`, `skill-creator`, `create-agent-skills`, `orchestrating-swarms`, `compound-docs`. Add a new `microservice-focus` row under a fitting category (Architecture & Design or a new "Microservice Support" subsection). Add a note: "Workflow primitives (brainstorming, git worktrees, skill writing, parallel agents) now come from the `superpowers` plugin."

**"How It Works" → "Swarm Mode" subsection:** delete the entire subsection (used `/slfg`).

**"How It Works" → "Knowledge Compounding" subsection:** delete the entire subsection (solutions pattern dropped).

**"How It Works → The /workflows:work Pipeline" subsection:** keep — accurately describes the Python quality gate, which is still unique value.

**Microservice Support section:** add a sentence in the intro: "Focus Gate logic now lives in the `microservice-focus` skill, invoked once by each workflow command."

**Doc Output table:** update to:
```
| Doc Type | Single Service | Multi-Service |
|----------|---------------|---------------|
| Specs | `docs/superpowers/specs/` | `{service}/docs/superpowers/specs/` per service |
| Plans | `docs/superpowers/plans/` | Root overview + per-service plan files under `{service}/docs/superpowers/plans/` |
```
(Solutions row removed.)

**Version History:** change "Current version: 2.4.0" → "Current version: 3.0.0".

- [ ] **Step 3: Verify the README updates**

```bash
grep -c "32 specialized agents\|32 agents" README.md
grep -c "18 commands" README.md
grep -c "21 skills" README.md
! grep -q "/workflows:compound" README.md | head -1  # except in "Deprecated" section
! grep -q "docs/solutions" README.md
grep -q "docs/superpowers/specs" README.md
grep -q "microservice-focus" README.md
grep -q "built on" README.md
grep -q "Current version: 3.0.0" README.md
```

Adjust expectations: `/workflows:compound`, `/lfg`, `/slfg` should still appear in the Deprecated commands subsection — exclude that section with `grep -v` if needed.

- [ ] **Step 4: Commit plugin.json + CLAUDE.md + CHANGELOG.md + README.md together**

```bash
git add .claude-plugin/plugin.json CLAUDE.md CHANGELOG.md README.md
git commit -m "docs: bump to v3.0.0, document superpowers refactor

- plugin.json: 3.0.0 + new description (32 agents, 18 commands, 21 skills)
- CLAUDE.md: update Doc Output paths to docs/superpowers/, drop compound
  from workflow_skills YAML example, delete stale docs/solutions/ link
- CHANGELOG.md: full v3.0.0 entry with Changed/Removed/Deprecated/Added
  sections and a Migration block
- README.md: update header tagline + counts, add superpowers prerequisite
  in install, remove compound/lfg/slfg from core tables (add Deprecated
  subsection), drop Swarm Mode + Knowledge Compounding sections, update
  Doc Output table to spec/plan vocabulary"
```

---

## Task 13: Audit and clean stale references in other commands/skills/agents

**Files:**
- Audit: `commands/heal-skill.md`
- Audit: `commands/resolve_todo_parallel.md`
- Audit: `commands/deepen-plan.md`
- Audit: `skills/document-review/SKILL.md`
- Audit: `agents/research/best-practices-researcher.md`
- Audit: `agents/research/git-history-analyzer.md`
- Audit: `agents/review/code-simplicity-reviewer.md`

- [ ] **Step 1: Run the grep sweep against all stale surfaces**

```bash
# Should return ZERO hits in active code (CHANGELOG hits are OK)
grep -rn --include="*.md" "learnings-researcher" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
grep -rn --include="*.md" "compound-docs" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
grep -rn --include="*.md" "orchestrating-swarms" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
grep -rn --include="*.md" "docs/solutions" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
grep -rn --include="*.md" "docs/brainstorms" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
```

Each line returned represents a stale reference that needs fixing.

- [ ] **Step 2: For each hit, edit the offending file**

For each grep hit:

1. Read the file at the matched line.
2. Determine the nature of the reference:
   - Reference to the deleted **skill** by name (e.g., "Use the `orchestrating-swarms` skill") → remove the sentence or replace with the superpowers equivalent (e.g., "Use the `superpowers:dispatching-parallel-agents` skill").
   - Reference to the deleted **agent** (e.g., "Task learnings-researcher(...)") → remove the entire call. If the surrounding section becomes meaningless, remove the section.
   - Reference to the deleted **directory** (e.g., "search `docs/solutions/`") → remove the sentence or replace with project-appropriate guidance.

Use the `Edit` tool. Make surgical edits — do not rewrite whole files.

Specifically expected to need edits:

- **`commands/heal-skill.md`** — likely references the deleted `skill-creator` skill. Replace with `superpowers:writing-skills`.
- **`commands/resolve_todo_parallel.md`** — likely references `orchestrating-swarms`. Replace with `superpowers:dispatching-parallel-agents`.
- **`commands/deepen-plan.md`** — may reference `learnings-researcher` or `docs/solutions/`. Remove those.
- **`skills/document-review/SKILL.md`** — may reference the deleted `brainstorming` skill. Replace with `superpowers:brainstorming` if needed, or remove the reference.
- **`agents/research/best-practices-researcher.md`** — may reference `learnings-researcher` or `docs/solutions/`. Remove.
- **`agents/research/git-history-analyzer.md`** — same.
- **`agents/review/code-simplicity-reviewer.md`** — same.

- [ ] **Step 3: Re-run the grep sweep**

```bash
grep -rn --include="*.md" "learnings-researcher" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
grep -rn --include="*.md" "compound-docs" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
grep -rn --include="*.md" "orchestrating-swarms" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
grep -rn --include="*.md" "docs/solutions" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
grep -rn --include="*.md" "docs/brainstorms" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
```

Expected: each command returns no output.

- [ ] **Step 4: Run extended grep sweep for the rest of the deleted skills**

```bash
# These check for skill references by name. The local 'git-worktree' skill is deleted,
# so any reference like 'skill: git-worktree' or '`git-worktree` skill' is stale.
# References to 'superpowers:using-git-worktrees' are fine.
grep -rn --include="*.md" "skill: git-worktree\|\`git-worktree\` skill\|the git-worktree skill" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
grep -rn --include="*.md" "skill: skill-creator\|\`skill-creator\` skill\|the skill-creator skill" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
grep -rn --include="*.md" "skill: create-agent-skills\|\`create-agent-skills\` skill" . | grep -v CHANGELOG | grep -v "docs/superpowers/"
# 'brainstorming' is trickier because superpowers:brainstorming is fine. Look for local refs:
grep -rn --include="*.md" "skill: brainstorming\b\|\`brainstorming\` skill\|the brainstorming skill" . | grep -v CHANGELOG | grep -v "docs/superpowers/" | grep -v "superpowers:"
```

For each hit, repeat Step 2's fix-and-edit process.

- [ ] **Step 5: Verify `workflows:compound` references are scoped to the shim + CHANGELOG only**

```bash
grep -rln "workflows:compound" . | grep -v CHANGELOG | grep -v "commands/workflows/compound.md" | grep -v "docs/superpowers/"
```

Expected: no output. If the brainstorm/plan wrappers or other commands still mention `workflows:compound` as a next step, replace with appropriate text.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scrub stale references to deleted skills/agents/dirs

Updated commands and agents that still referenced learnings-researcher,
compound-docs, orchestrating-swarms, docs/solutions/, docs/brainstorms/,
or the deleted local skills (brainstorming, git-worktree, skill-creator,
create-agent-skills). Replacements use the superpowers:* equivalent
where one exists; otherwise the reference is removed."
```

---

## Task 14: Manual smoke test in a real Python project

**Files:** none modified — verification only.

This task cannot be performed inside the plugin repo itself; it requires a separate Python project (single-service and/or multi-service) where the plugin is installed.

- [ ] **Step 1: Set up the test environment**

In a separate Python project directory:

```bash
# Ensure superpowers is installed
/plugin install superpowers@claude-plugins-official

# Install this plugin (from local clone)
/plugin marketplace add /path/to/compound-engineering-feat-python-plugin
/plugin install compound-engineering-feat-python@compound-engineering-feat-python
```

- [ ] **Step 2: Smoke-test `/workflows:brainstorm` (single-service)**

```
/workflows:brainstorm "add request rate limiting to the API"
```

Expected:
- Command loads `superpowers:brainstorming` (no "skill not available" halt).
- Asks discovery questions in `superpowers:brainstorming`'s style.
- Writes a spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` (NOT `docs/brainstorms/`).

- [ ] **Step 3: Smoke-test `/workflows:plan` (single-service)**

```
/workflows:plan docs/superpowers/specs/<file-from-step-2>.md
```

Expected:
- Loads `superpowers:writing-plans`.
- Produces a plan at `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`.

- [ ] **Step 4: Smoke-test microservice mode**

In a multi-service test repo (or simulate by creating 2 dummy `pyproject.toml` files in subdirs):

```
/workflows:brainstorm "add cross-service event bus"
```

Expected:
- `microservice-focus` skill triggers.
- User is prompted to select services via `AskUserQuestion`.
- Per-service specs land at `{service}/docs/superpowers/specs/`.

- [ ] **Step 5: Smoke-test `/workflows:review` (no `learnings-researcher`)**

```
/workflows:review
```

Expected:
- Spawns configured Python review agents.
- Does NOT spawn `learnings-researcher` (verify in agent invocation list).
- Does NOT read `docs/solutions/`.

- [ ] **Step 6: Smoke-test deprecation shims**

```
/workflows:compound
/lfg
/slfg
```

Expected: each prints its migration message and exits. No real work performed.

- [ ] **Step 7: Smoke-test `check-dependencies.sh`**

Temporarily move the local superpowers install:

```bash
mv ~/.claude/plugins/<superpowers-path> /tmp/sp-backup
bash /path/to/plugin/scripts/check-dependencies.sh  # via SessionStart on a new session
# Expected: warning printed listing superpowers as REQUIRED
mv /tmp/sp-backup ~/.claude/plugins/<superpowers-path>
```

- [ ] **Step 8: Record findings**

If any smoke test fails, return to the relevant task above and fix. Re-test after the fix. Do not skip failures.

If everything passes, the refactor is shippable.

---

## Self-Review (run after writing the plan, before handoff)

**1. Spec coverage:**

Spec requirements → corresponding tasks:

| Spec section | Task(s) |
|---|---|
| Require superpowers, remove duplicates | Tasks 7 (delete skills), 9 (check), 10 (plugin.json), 12 (README install) |
| Drop /workflows:compound | Task 6 (shim) |
| Drop /lfg, /slfg | Task 6 (shims) |
| 4 thin workflow wrappers | Tasks 2-5 |
| Microservice machinery → skill | Task 1 |
| 6 skills deleted | Task 7 |
| 1 agent deleted (learnings-researcher) | Task 7 |
| New microservice-focus skill | Task 1 |
| Adopt superpowers vocabulary (specs) | Tasks 2, 3 (path overrides), 11 (CLAUDE.md), 12 (README) |
| Drop solutions pattern | Tasks 5 (review wrapper), 7 (agent), 11/12 (docs) |
| compound key removed from config schema | Tasks 8 (setup), 11 (CLAUDE.md example), 12 (CHANGELOG migration note) |
| Plugin name unchanged | (no task — by omission) |
| v3.0.0 bump | Task 10 |
| Deprecation shims for /lfg, /slfg, /workflows:compound | Task 6 |
| check-dependencies.sh superpowers detection | Task 9 |
| README rewrite per scope table | Task 12 |
| CLAUDE.md updates | Task 11 |
| CHANGELOG v3.0.0 entry | Task 12 |
| Grep sweep verification | Task 13 |
| Smoke test plan | Task 14 |

No gaps detected.

**2. Placeholder scan:**

The plan includes the full content of every new and rewritten file. There are no "TBD", "TODO", "implement later", or unspecified sections. Each step shows the exact change or full content. Verification commands include expected output.

**3. Type/name consistency:**

- `microservice-focus` skill name used consistently throughout (Task 1 SKILL.md frontmatter, Tasks 2-5 wrapper invocations, Task 11 CLAUDE.md, Task 12 README).
- `<focus_context>` block format identical between focus-context-block.md (Task 1) and the wrappers (Tasks 2-5).
- `docs/superpowers/specs/` and `docs/superpowers/plans/` paths used consistently across Tasks 2, 3, 11, 12, 13, 14.
- Wrapper delegate targets (`superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:executing-plans`, `superpowers:requesting-code-review`) match the spec's 4-wrapper mapping table.
- Version `3.0.0` consistent across plugin.json (Task 10), CHANGELOG (Task 12), README (Task 12).

No inconsistencies detected.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-25-superpowers-refactor-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan because tasks are largely independent (Task 1 is foundational; Tasks 2-5 share a commit at the end of Task 5; Tasks 6, 7, 8 are independent; Task 9, 10, 11, 12, 13 are largely independent; Task 14 is verification).

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
