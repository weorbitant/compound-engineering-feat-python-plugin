---
title: Refactor compound-engineering-feat-python on top of superpowers (v3.0.0)
date: 2026-05-25
status: draft
---

# Refactor compound-engineering-feat-python on top of superpowers (v3.0.0)

## Goal

Refactor `compound-engineering-feat-python` (v2.5.2 → v3.0.0) so that the `superpowers` plugin is the foundation for all generic engineering workflow primitives (brainstorming, planning, execution, code review, git worktrees, parallel agents, skill writing). This plugin keeps and sharpens its unique value: Python/Django/FastAPI/pytest domain expertise + microservice orchestration.

## Why

The current plugin reimplements primitives that superpowers already provides (a `brainstorming` skill, a `git-worktree` skill, a `skill-creator` skill, an `orchestrating-swarms` skill, etc.). Maintaining two copies is wasted effort and drifts from upstream improvements. The `/workflows:compound` knowledge-capture pattern (`docs/solutions/`) has not paid off in practice and adds surface without returning value.

This refactor commits to a clean division of labor: superpowers owns the generic workflow primitives, this plugin owns Python value.

## Scope summary

| Surface | v2.5.2 | v3.0.0 |
|---|---|---|
| Dependency on `superpowers` | None | Required |
| Workflow commands | 5 | 4 (drop `/workflows:compound`) |
| Autonomous pipelines | `/lfg`, `/slfg` | Removed (deprecation shims kept for one major cycle) |
| Total active commands | 21 | 18 + 3 deprecation shims |
| Total skills | 26 | 21 (6 deleted, 1 new) |
| Total agents | 33 | 32 (drop `learnings-researcher`) |
| MCP servers | 1 | 1 (unchanged) |
| Microservice machinery | Inline in each command | Consolidated into `microservice-focus` skill |
| Artifact vocabulary | "brainstorm doc", `docs/brainstorms/` | "spec", `docs/superpowers/specs/` |
| `compound-engineering.local.md` `workflow_skills` keys | `brainstorm`, `plan`, `work`, `review`, `compound` | `brainstorm`, `plan`, `work`, `review` |
| Knowledge-capture pattern (`docs/solutions/`) | Active | Dropped entirely |
| Plugin name | `compound-engineering-feat-python` | unchanged |

## Architecture: thin-wrapper delegation

Each surviving workflow command becomes a thin orchestration script with one job: load Python context, run the microservice focus gate, then hand off to a superpowers skill. The wrappers do NOT re-implement brainstorming/planning/execution/review logic — that lives entirely in superpowers.

Standard wrapper anatomy (~30-40 lines instead of ~200-400):

```markdown
---
name: workflows:<step>
description: <Python-flavored description>
argument-hint: "[user input]"
---

# <Step name> (Python)

<input> #$ARGUMENTS </input>

## Prerequisites
If `superpowers:<skill>` is not available, halt and instruct the user to run
`/plugin install superpowers@claude-plugins-official`.

## Step 1: Project Workflow Skills
Read `compound-engineering.local.md`. If found, parse `workflow_skills.<step>` and
load each listed skill. These provide project-specific Python/Django/domain context.

## Step 2: Microservice Focus
Invoke the `microservice-focus` skill. It will:
- Discover services and prompt if needed (unless --services provided)
- Return the list of focused services + the <focus_context> block

## Step 3: Delegate to superpowers
Invoke the `superpowers:<skill>` skill. Pass:
- The user's <input> as the topic
- The <focus_context> block (so the superpowers skill propagates it to its own sub-agents)
- The loaded Python workflow_skills (already in conversation)

## Step 4: Python-specific output path overrides (multi-service only)
When the superpowers skill writes its artifact, override the path:
- Specs: {service}/docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
- Plans: {service}/docs/superpowers/plans/... + root overview file
```

In single-service mode, no path overrides — defer to superpowers defaults (`docs/superpowers/specs/`, `docs/superpowers/plans/`).

### The 4 wrapper mappings

| Wrapper command | Delegates to | Python-specific value added |
|---|---|---|
| `/workflows:brainstorm` | `superpowers:brainstorming` | Loads Python `workflow_skills` + microservice focus context; overrides spec output path in multi-service mode |
| `/workflows:plan` | `superpowers:writing-plans` | Same — plus documents the dependency-aware execution order via plan frontmatter `services:` key (a convention writing-plans doesn't know about) |
| `/workflows:work` | `superpowers:executing-plans` | **Keeps the Phase 3 Python quality gate** (full test suite + ruff + mypy + pre-commit) since superpowers:executing-plans is language-agnostic. Invokes Python review/lint agents during the test-fix loop. The least-thin wrapper (~80 lines vs ~30-40 for the others). |
| `/workflows:review` | `superpowers:requesting-code-review` | Loads Python review agents from `compound-engineering.local.md` (django-reviewer, fastapi-reviewer, pytest-reviewer, etc.) and passes them as input to the superpowers review orchestration |

`/workflows:review` does **NOT** spawn `learnings-researcher` (deleted) and does NOT read `docs/solutions/` (pattern dropped).

## New skill: `microservice-focus`

Consolidates the ~50 lines of "Focus Gate" logic currently duplicated across all 5 workflow commands.

Structure:
```
skills/microservice-focus/
├── SKILL.md                    # Main skill (loaded by wrapper commands)
└── references/
    ├── focus-gate.md           # Discovery + prompting protocol
    ├── focus-context-block.md  # <focus_context> template & propagation rules
    └── service-discovery.md    # Glob("*/pyproject.toml") + dependency cross-ref
```

SKILL.md frontmatter:
```yaml
---
name: microservice-focus
description: Use when a workflow command needs to detect multi-service monorepos, prompt for service scope, and propagate <focus_context> to sub-agents. Triggers on --services arg, focus_context in conversation, or multiple pyproject.toml at root.
---
```

Responsibilities (consolidated from current inline command logic):
1. Parse `--services` argument if present (skip prompt)
2. Discover services via `Glob("*/pyproject.toml")`
3. If multi-service and no `--services`: prompt user via `AskUserQuestion` for relevant services
4. Load each focused service's `prompt.md`/`README.md`, `pyproject.toml`, `src/` listing
5. Cross-reference internal dependencies
6. Build the standardized `<focus_context>` block for sub-agent propagation
7. Return service list + focus context for the caller to use

## Deletion list

### Commands deleted outright (none — see shims below)

The 3 dropped commands are NOT deleted; they become deprecation shims (see next section).

### Commands rewritten as deprecation shims (3 files)

The following keep their .md files but become non-functional one-paragraph migration messages. Removed entirely in v4.0.0.

```
commands/workflows/compound.md   # shim: "removed; no replacement, /workflows:compound's knowledge-capture pattern is dropped"
commands/lfg.md                  # shim: "removed; run /workflows:brainstorm → /workflows:plan → /workflows:work → /workflows:review manually"
commands/slfg.md                 # shim: "removed; use /superpowers:dispatching-parallel-agents within stages"
```

Each shim body is ~10 lines: title, one paragraph explaining the removal, the migration steps, and a CHANGELOG link.

### Skills deleted (6 directories)

```
skills/brainstorming/           # → superpowers:brainstorming
skills/git-worktree/            # → superpowers:using-git-worktrees
skills/skill-creator/           # → superpowers:writing-skills
skills/create-agent-skills/     # → superpowers:writing-skills
skills/orchestrating-swarms/    # → superpowers:dispatching-parallel-agents
skills/compound-docs/           # → none (its only consumer was /workflows:compound)
```

### Agents deleted (1 file)

```
agents/research/learnings-researcher.md   # read docs/solutions/, no longer needed
```

### Skills created (1 new directory)

```
skills/microservice-focus/
├── SKILL.md
└── references/
    ├── focus-gate.md
    ├── focus-context-block.md
    └── service-discovery.md
```

### Files rewritten (significant content changes)

```
commands/workflows/brainstorm.md    # thin wrapper, delegates to superpowers:brainstorming
commands/workflows/plan.md          # thin wrapper, delegates to superpowers:writing-plans
commands/workflows/work.md          # wrapper + Python quality gate, delegates to superpowers:executing-plans
commands/workflows/review.md        # wrapper, delegates to superpowers:requesting-code-review
.claude-plugin/plugin.json          # v3.0.0, updated counts, updated description
scripts/check-dependencies.sh       # add superpowers detection (see below)
README.md                           # see scope table below
CHANGELOG.md                        # v3.0.0 entry with breaking changes + migration guide
CLAUDE.md                           # see scope table below; also delete stale docs/solutions/ pointer
```

### Grep-sweep checks (must return zero hits before merge)

- `workflows:compound` (except in CHANGELOG and shim file)
- `/lfg\b`, `/slfg\b` (except in CHANGELOG and shim files)
- `learnings-researcher`
- `compound-docs`
- `docs/solutions` (except in CHANGELOG)
- `docs/brainstorms` (renamed to specs everywhere)
- `orchestrating-swarms`, `skill-creator` (as skill names), `create-agent-skills`
- Local skill references to `git-worktree` and `brainstorming` (distinguish from `superpowers:` versions, which are fine)

Audit `commands/heal-skill.md` for any reference to deleted surfaces.

## Config schema change: `compound-engineering.local.md`

```yaml
# v2.5.2
workflow_skills:
  brainstorm: [django-patterns, my-company-domain]
  plan: [django-patterns]
  work: [django-patterns, pytest-patterns]
  review: [django-patterns, pytest-patterns]
  compound: [django-patterns]      # ← removed

# v3.0.0
workflow_skills:
  brainstorm: [django-patterns, my-company-domain]
  plan: [django-patterns]
  work: [django-patterns, pytest-patterns]
  review: [django-patterns, pytest-patterns]
```

Behavior: if an existing user's config still has the `compound` key, the wrappers ignore it silently. No migration script needed.

`/setup` command and `setup` skill: update to stop offering the `compound` key when generating or updating `compound-engineering.local.md`.

## Dependency check: `scripts/check-dependencies.sh`

Add a soft check that warns when the superpowers plugin is not detected on disk. The script runs in the SessionStart hook and exits 0 either way (warning, not gate).

Detection: scan `~/.claude/plugins/` for a directory named `superpowers`.

```bash
# Check superpowers plugin (REQUIRED — provides workflow primitives)
if ! find ~/.claude/plugins -type d -name "superpowers" 2>/dev/null | grep -q .; then
  missing+=("superpowers")
fi
```

Warning entry:
```
- superpowers (REQUIRED — provides brainstorming, planning, execution, review primitives)
  Install: /plugin marketplace add anthropics/claude-plugins-official
           /plugin install superpowers@claude-plugins-official
```

Belt-and-suspenders: each wrapper command also opens with "If `superpowers:<skill>` is not available, halt and instruct the user to install superpowers." This gives the LLM a defined behavior when the skill genuinely isn't loaded at command time.

## README.md rewrite scope

| Section | Change |
|---|---|
| Header tagline | "33 agents, 21 commands, 26 skills" → "32 agents, 18 commands, 21 skills" + "built on top of `superpowers`" |
| What It Does | 5-step `brainstorm→plan→work→review→compound` diagram → 4-step (no compound). Add: "Built on Anthropic's `superpowers` plugin for workflow primitives." |
| Installation | Add a `superpowers` prerequisite step BEFORE the plugin install — explicit `/plugin install superpowers` instruction |
| Quick Start | Remove `/workflows:compound` and `/lfg` examples. Add note that brainstorm specs land at `docs/superpowers/specs/` |
| Core Workflow Commands table | Remove compound row. Mention "delegates to `superpowers:X`" where relevant |
| Utility Commands table | Remove `/lfg` and `/slfg` rows |
| Agents (33) → Agents (32) | Drop `learnings-researcher` row from Research table |
| Skills (26) → Skills (21) | Remove the 6 deleted skill rows. Add `microservice-focus` row. Note that workflow primitives now come from `superpowers` |
| How It Works → /workflows:work Pipeline | Keep — describes the Python-specific quality gate (unique value) |
| How It Works → Swarm Mode | Remove subsection (used /slfg) |
| How It Works → Knowledge Compounding | Remove subsection (solutions pattern dropped) |
| Microservice Support | Note that Focus Gate logic now lives in the `microservice-focus` skill |
| Doc Output table | Update paths to `{service}/docs/superpowers/specs/` etc. Remove solutions row |
| Version History | "Current version: 3.0.0" |
| Deprecated commands subsection | New subsection (small) listing the 3 shims and pointing to CHANGELOG migration |

## CLAUDE.md updates

| Section | Change |
|---|---|
| Versioning Requirements | Unchanged |
| Directory Structure | Update — no `compound-docs` skill, etc. |
| Command Naming Convention | Unchanged (still 4 workflow commands using `workflows:` prefix) |
| Skill Compliance Checklist | Unchanged |
| Microservice Mode | "Focus Context Propagation" subsection notes the protocol now lives in `microservice-focus` skill — commands invoke it rather than inlining it. Update output paths table to `docs/superpowers/specs/` etc. and remove solutions row |
| Workflow Skills Configuration | Remove `compound` from example YAML |
| Interaction Style | Unchanged |
| Documentation | **Delete** the stale `See docs/solutions/plugin-versioning-requirements.md ...` line (file does not exist; broken reference) |

## plugin.json changes

```json
{
  "name": "compound-engineering-feat-python",
  "version": "3.0.0",
  "description": "Python-specialized development tools with microservice support, built on superpowers. 32 agents, 18 commands, 21 skills, 1 MCP server."
}
```

Note: Claude Code plugins do not (at time of writing) have a formal dependency-declaration mechanism in plugin.json. The superpowers requirement is enforced socially via README + the `check-dependencies.sh` warning + per-command halt-if-missing guard.

## CHANGELOG entry (v3.0.0)

```markdown
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
  `/workflows:work` → `/workflows:review` (or `/superpowers:dispatching-parallel-agents`
  within stages for parallel work).
- Move any documents under `docs/brainstorms/` to `docs/superpowers/specs/` if you
  want them auto-discovered by `/workflows:plan` (path-only rename; no schema change).
- Remove the `compound:` line from your project's `compound-engineering.local.md`
  if present (harmless to leave, but cleaner to drop).
```

## Verification

A grep sweep + manual smoke test is enough at this size. No automated tests exist for the plugin today and adding a test framework is out of scope.

**Grep sweep (must return zero hits, modulo CHANGELOG and the 3 shim files):**
See the "Grep-sweep checks" subsection above.

**Manual smoke test:**
1. In a Python project: `/workflows:brainstorm "add request rate limiting"` → verify it loads `superpowers:brainstorming` + Python skills, asks discovery questions, ultimately writes a spec to `docs/superpowers/specs/`.
2. In the same project: `/workflows:plan docs/superpowers/specs/<file>.md` → verify it loads `superpowers:writing-plans` and produces a plan.
3. In a multi-service repo: invoke `/workflows:brainstorm` and verify the `microservice-focus` skill prompts for services and the resulting spec lands at `{service}/docs/superpowers/specs/`.
4. Invoke `/workflows:review` and verify it spawns the configured Python review agents without spawning `learnings-researcher`.
5. Invoke each shim (`/lfg`, `/slfg`, `/workflows:compound`) and verify each prints its migration message without doing anything else.
6. Run `bash scripts/check-dependencies.sh` with superpowers uninstalled and verify the warning fires.

**Pre-commit check:** the existing CLAUDE.md pre-commit checklist (version bump, CHANGELOG, README counts/tables) applies — do not merge without all three.

## Out of scope

- Plugin rename (chosen to keep `compound-engineering-feat-python`).
- Replacing the dropped knowledge-compounding pattern with anything new — fully dropped.
- Adding an automated test framework for the plugin itself.
- Migrating existing user `docs/solutions/` content anywhere — left in place but ignored.
- Migrating existing user `docs/brainstorms/` content to `docs/superpowers/specs/` — documented in migration notes, not automated.
- Changes to the 32 surviving agents (Python-domain reviewers/researchers) — they keep their current bodies.
- Changes to non-workflow utility commands (`/changelog`, `/triage`, `/deepen-plan`, `/feature-video`, etc.) other than removing references to deleted surfaces.
