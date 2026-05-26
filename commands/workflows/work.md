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

If the `superpowers:executing-plans` skill is not available, halt and instruct the user:

> "This command requires the `superpowers` plugin. Install it with:
> `/plugin marketplace add anthropics/claude-plugins-official`
> `/plugin install superpowers@claude-plugins-official`"

## Step 1: Load Project Workflow Skills

Read `compound-engineering.local.md`. If `workflow_skills.work` is set, load each listed skill now (e.g., `django-patterns`, `pytest-patterns`).

## Step 2: Microservice Focus + Execution Order

Invoke the `microservice-focus` skill. It will:

- Parse `--services` from `$ARGUMENTS` if present.
- Otherwise discover services via `Glob("*/pyproject.toml")` and prompt the user via `AskUserQuestion` if multiple services exist.
- Return the list of focused services + a `<focus_context>` block.

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
Options: [Confirm] [Force parallel] [Force sequential] [Adjust order]
```

**If the user picks `[Force parallel]`:** within each wave, invoke `superpowers:dispatching-parallel-agents` to run that wave's services concurrently (do NOT invoke the deleted `orchestrating-swarms` skill). Waves still run sequentially with respect to each other — only within a wave is parallelized.

**In single-service mode** (no `services:` frontmatter in the plan AND no `--services` argument), skip the wavefront/cycle/execution-order logic above — there's nothing to order. Step 3 passes no execution order parameter to superpowers; it runs as a single-service invocation.

## Step 3: Delegate plan execution to superpowers

Invoke the `superpowers:executing-plans` skill (or `superpowers:subagent-driven-development` if the plan header recommends it). Pass:

- The plan path from `<input_document>`.
- The `<focus_context>` block.
- The execution order from Step 2 (so the skill processes tasks in the right wave order in multi-service mode).
- The test command to use per service:
  - Single-service: `poetry run pytest` (or whatever the project's CLAUDE.md specifies)
  - Multi-service: `cd {service} && poetry run pytest` for each service

The superpowers skill handles the task loop, per-task commits, and incremental progress. **Instruct the skill to NOT invoke `superpowers:finishing-a-development-branch` at the end** — this wrapper owns the finishing flow (Steps 4 and 5) because it adds Python-specific value (quality gate before commit, Post-Deploy Monitoring section in PR). Control returns to this wrapper after the task loop completes (or escalates).

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

1. **Create commit via the `commit` skill.** It analyzes, groups, and commits all changes with conventional + gitmoji format. Never skip pre-commit hooks with `--no-verify`.

2. **Capture screenshots for UI changes** — for any design changes, new views, or UI modifications:
   - Start dev server (Django: `python manage.py runserver`; FastAPI: `uvicorn main:app --reload`).
   - Use the `agent-browser` skill to capture before/after screenshots.
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
