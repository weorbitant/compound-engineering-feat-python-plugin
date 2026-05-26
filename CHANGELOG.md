# Changelog

All notable changes to the compound-engineering-feat-python plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- `<focus_context>` block in `CLAUDE.md` normalized from `connections:` (single line)
  to `dependencies:` (list format), matching the workflow commands and the
  `microservice-focus` skill.

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
  remain untouched (and `/workflows:review` still protects them from accidental
  deletion) but are no longer read or written by this plugin.
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

## [2.5.2] - 2026-04-20

### Changed

- **17 subagents now preload relevant skills via `skills:` frontmatter** — Subagents don't inherit skills from the parent conversation ([docs](https://code.claude.com/docs/en/sub-agents)). Review, workflow, and design agents were flying blind when spawned via `Task()` — the `workflow_skills` config only loaded skills into the main command context, never into spawned reviewers. Mapping:
  - `django-reviewer`, `django-migration-reviewer` → `django-patterns`
  - `django-drf-reviewer` → `django-drf`
  - `django-celery-reviewer` → `django-async`
  - `fastapi-reviewer` → `fastapi-patterns`
  - `fastapi-sqlalchemy-reviewer` → `fastapi-sqlalchemy`
  - `postgresql-reviewer`, `schema-drift-detector` → `postgresql-patterns`
  - `postgis-reviewer` → `postgis-patterns`
  - `pytest-reviewer`, `bug-reproduction-validator` → `pytest-patterns`
  - `python-style-reviewer`, `python-lint` → `python-style`
  - `python-typing-reviewer` → `python-typing`
  - `design-implementation-reviewer`, `design-iterator`, `figma-design-sync` → `frontend-design`
- Deliberately skipped for 16 agents (architecture-strategist, security-sentinel, performance-oracle, research agents, etc.) — their scope spans multiple frameworks or is principle-based, so preloading any single pattern skill would bias focus.

### Summary

- 33 agents, 21 commands, 26 skills, 1 MCP server

---

## [2.5.1] - 2026-04-20

### Removed

- **`.cursor-plugin/` directory** — Stale config (last updated at 2.2.0 while the Claude plugin advanced to 2.5.0). Not referenced anywhere else in the repo.

### Summary

- 33 agents, 21 commands, 26 skills, 1 MCP server

---

## [2.5.0] - 2026-04-20

### Changed

- **Model tier assignments for all 26 skills** — Added `model:` frontmatter to every SKILL.md using a 3-tier strategy that mirrors the agent tiering from 2.4.0:
  - **Opus** (8 skills): `orchestrating-swarms`, `compound-docs`, `agent-native-architecture`, `create-agent-skills`, `brainstorming`, `document-review`, `skill-creator`, `frontend-design` — high-reasoning design, orchestration, and synthesis work
  - **Sonnet** (7 skills): `commit`, `setup`, `git-worktree`, `agent-browser`, `gemini-imagegen`, `resolve-pr-parallel`, `file-todos` — task execution requiring understanding
  - **Haiku** (11 skills): all `*-patterns` skills (`django-*`, `fastapi-*`, `postgresql-*`, `postgis-*`, `pytest-*`), `python-style`, `python-typing`, `rclone` — reference lookups and mechanical pattern matching
- **SKILL.md files optimized via progressive disclosure** — Total skill content reduced from 6,295 → 3,017 lines (52% reduction), with every SKILL.md now under 230 lines. Heavy reference material moved into `references/` subfolders per the [official skills spec](https://code.claude.com/docs/en/skills):
  - **`orchestrating-swarms`**: 1,715 → 91 lines. Split 16 H2 sections into 9 reference files (`architecture`, `spawning`, `teammate-operations`, `task-system`, `message-formats`, `patterns`, `workflows`, `backends`, `error-handling`).
  - **`compound-docs`**: 518 → 91 lines. Moved 7-step process detail and example scenario into `references/process.md` and `references/example.md`.
  - **`agent-native-architecture`**: 435 → 188 lines. Extracted core principles and anti-patterns into new reference files; SKILL.md now acts as a router.
  - **`commit`**: 295 → 162 lines. Emoji lookup tables moved to `references/emoji-table.md`.
  - **`setup`**: 296 → 103 lines. Stack detection rules and agent computation moved to `references/stack-detection.md`.
  - **`git-worktree`**: 302 → 86 lines. Commands, troubleshooting, and technical details moved to `references/commands.md`.
  - **`create-agent-skills`**: 275 → 139 lines. Detailed workflows already live in `workflows/`; SKILL.md now links to them plus reference material.
  - **`file-todos`**: 252 → 101 lines. Workflows and command cheat-sheet moved to `references/workflows.md`.
  - **`gemini-imagegen`**: 237 → 69 lines. Code examples consolidated into `references/examples.md`.

### Summary

- 33 agents, 21 commands, 26 skills, 1 MCP server

---

## [2.4.1] - 2026-04-10

### Fixed

- **`compound-docs` skill** — Solution docs now write to `{service}/docs/solutions/` when the fix applies to a single service, root `docs/solutions/` for cross-service or no-service-context. Previously the per-service path was commented out and always fell through to root.
- **`learnings-researcher` agent** — Search patterns updated to use `**/docs/solutions/**/*.md` globs, finding solutions in both root and per-service directories.

### Summary

- 33 agents, 21 commands, 26 skills, 1 MCP server

---

## [2.4.0] - 2026-04-08

### Changed

- **`/workflows:work` Phase 2 runs on Sonnet sub-agent** — Implementation/coding phase now spawns as a Sonnet sub-agent instead of running on the parent model. Opus orchestrates (Phase 1 planning, Phase 3 quality gate, Phase 4 shipping), Sonnet executes the code. All plan context, tasks, and conventions are passed into the sub-agent prompt.
- **3-tier model strategy for all 33 agents** — Replaced blanket `inherit` model with cost-optimized tier assignments:
  - **Opus** (7 agents): `architecture-strategist`, `spec-flow-analyzer`, `security-sentinel`, `deployment-verification-agent`, `data-integrity-guardian`, `data-migration-expert`, `performance-oracle` — high-stakes planning, security, and architectural decisions
  - **Sonnet** (22 agents): All domain reviewers (Django, FastAPI, DRF, Celery, PostgreSQL, PostGIS), research agents, design agents, `pr-comment-resolver`, `bug-reproduction-validator` — code review and analysis requiring understanding
  - **Haiku** (4 agents): `python-lint`, `learnings-researcher` (unchanged), plus `schema-drift-detector`, `python-style-reviewer` — mechanical pattern matching and style checks

### Summary

- 33 agents, 21 commands, 26 skills, 1 MCP server

---

## [2.3.1] - 2026-04-01

### Fixed

- **`/reproduce-bug` command** — Complete rewrite. All 7 Playwright MCP tool calls were non-functional since v2.25.0 (Playwright removal). Now uses `agent-browser` CLI. Replaced stale `rails-console-explorer` agent with actual research agents.
- **`schema-drift-detector` agent** — Complete rewrite. Was entirely Rails `schema.rb`-specific. Now detects Django migration drift and Alembic revision drift with Python-appropriate commands and examples.
- **`compound-docs` skill** — Rewrote `schema.yaml`, `yaml-schema.md`, and `resolution-template.md`. Replaced all Rails component enums (`rails_model`, `rails_controller`, `Sidekiq`, `Stimulus`, `Turbo`) with Python equivalents (`django_model`, `django_view`, `celery_task`, `pydantic_model`, etc.). Fixed backtick references to use proper markdown links. Updated example scenario from Rails `includes(:emails)` to Django `select_related`/`prefetch_related`.
- **`/generate_command`** — Replaced `bin/rails test` → `poetry run pytest`, `bundle exec standardrb` → `ruff check .`, `Playwright` → `agent-browser`.
- **`/test-browser`** — Replaced Rails file-to-route mapping with Python patterns (`views.py`, `urls.py`, `serializers.py`). Updated dev server examples to Django/FastAPI.
- **`/feature-video`** — Same route mapping and dev server fix as `/test-browser`.
- **`/workflows:work`** — Replaced `bin/dev` with Django/FastAPI dev server commands.
- **`/workflows:review`** — Removed stale "Playwright MCP or" reference.
- **`/triage`** — Replaced Rails concern example with Django view using `transaction.atomic()`.
- **`orchestrating-swarms` skill** — Replaced `.rb` file paths and `ActiveRecord` references with Python equivalents.
- **`file-todos` skill** — Replaced Rails model references and `.rb` file paths with Python equivalents.
- **`learnings-researcher` agent** — Updated component and root_cause enum values to match new Python schema.
- **`deployment-verification-agent`** — `rake data:backfill` → `python manage.py backfill_data`.
- **`security-sentinel`** — "Strong parameters" → "Request data validation and serializer field restrictions".
- **`figma-design-sync` agent** — "Playwright MCPs" → "agent-browser CLI".
- **README.md** — Complete rewrite with Quick Start, workflow explanation, microservice docs, and How It Works section.

### Summary

- 33 agents, 21 commands, 26 skills, 1 MCP server

---

## [2.3.0] - 2026-03-31

### Added

- **Extensible workflow skills** — New `workflow_skills` key in `compound-engineering.local.md` YAML frontmatter. Maps workflow command names to lists of additional skills loaded at the start of each workflow. Fully additive — project-specific skills load alongside each command's built-in skills.
- **`setup` skill** — New "Workflow Skills" configuration step. Auto-configures framework/database skills per workflow based on detected stack, or allows per-workflow customization.

### Removed

- **`focus` skill** — Deleted `skills/focus/SKILL.md`. Microservice context-loading logic remains inline in each workflow command's Focus Gate section. Use `--services` argument or let auto-detection handle multi-service repos.

### Changed

- **All 5 workflow commands** (`brainstorm`, `plan`, `review`, `work`, `compound`) — Each now reads `workflow_skills.<command>` from `compound-engineering.local.md` and loads listed skills before execution.
- **`/workflows:brainstorm`**, **`/workflows:plan`** — Removed references to deleted `focus` skill; inline focus gate steps are self-contained.

### Summary

- 33 agents, 21 commands, 26 skills, 1 MCP server

---

## [2.2.1] - 2026-03-30

### Fixed

- **`/workflows:brainstorm`** — Focus context now loads full service descriptions, tech stacks, internal dependencies, and structure instead of passing only service names and paths. Sub-agents receive rich context to make stack-aware decisions.
- **`/workflows:plan`** — Same rich focus context enrichment. Planning now accounts for each service's architecture when designing tasks and choosing implementation approaches.
- **`/workflows:work`** — Multi-service execution now loads full service context, shows service descriptions in execution plan, and enforces stack-aware execution per service.
- **`/workflows:work`** — Phase 2 incremental commits now require a mandatory test-and-fix loop: run tests → fix failures → commit → handle pre-commit hook failures → re-run tests → retry. Never commits with failing tests.
- **`/workflows:work`** — Phase 3 is now a mandatory Quality Gate that blocks Phase 4. Full test suite, linting, and pre-commit hooks must all pass before shipping. Includes a fix-and-rerun cycle.
- **`/workflows:work`** — Phase 4 now explicitly requires Phase 3 to have passed and includes guidance for handling pre-commit failures during final commit.

### Summary

- 33 agents, 21 commands, 27 skills, 1 MCP server

---

## [2.2.0] - 2026-03-27

### Added

- **`focus` skill** — Set working context to specific microservices/libraries in a monorepo. Discovers services by `pyproject.toml` presence, resolves short names, loads context (README, deps, structure), detects internal dependencies. Composable with holafly-platform conventions (`.claude/prompt.md`).
- **Microservice mode** for all workflow commands — Opt-in multi-service support activated by `/focus` + `services:` YAML in plan frontmatter. Without these, all workflows behave identically to single-service mode.

### Changed

- **`/workflows:brainstorm`** — Added focus gate, `--services` argument for pipeline mode, `<focus_context>` propagation to sub-agents. Brainstorm output includes `services:` section for plan detection.
- **`/workflows:plan`** — Added focus gate, multi-service brainstorm detection, `services:` YAML in plan frontmatter with dependency graph, per-service plan file output for cross-service features.
- **`/workflows:compound`** — Per-service solution routing. Writes to `{service}/docs/solutions/` or root for cross-service. Added `service:` field to solution YAML frontmatter.
- **`/workflows:work`** — Dependency-aware execution via `services:` YAML. Default sequential in topological order. Parallel opt-in with Task system orchestration. Pipeline mode auto-confirms execution order.
- **`/workflows:review`** — Auto-detects changed services from PR diff. Runs review agents per service independently with per-service `compound-engineering.local.md` support.
- **`CLAUDE.md`** — Added Microservice Mode section with `<focus_context>` block convention, pipeline mode docs, and doc output table.

### Summary

- 33 agents, 21 commands, 27 skills, 1 MCP server

---

## [2.1.2] - 2026-03-19

### Fixed

- **`workflows:plan` command** — Replaced Ruby code examples (`test.rb`, `user_service.rb`) with Python equivalents in plan templates. A Python-focused plugin should not contain Ruby examples.

### Summary

- 33 agents, 21 commands, 26 skills, 1 MCP server

---

## [2.1.1] - 2026-02-22

### Added

- **SessionStart dependency check hook** — On session start, checks if optional external tools (`agent-browser`, `rclone`) are installed and warns the user with install instructions if missing. Prevents confusion when browser automation or cloud upload features fail silently.

### Summary

- 33 agents, 21 commands, 26 skills, 1 MCP server

---

## [2.1.0] - 2026-02-20

### Added

- **`commit` skill** — Analyze uncommitted changes, group into logical units, and create conventional commits with gitmoji emojis. Supports amend detection, pre-commit hook handling, multi-group staging, and interactive confirmation. Adapted from holafly/claude-service-template.

### Removed

- **`kieran-python-reviewer` agent** — Redundant with `python-style-reviewer` (which covers the same concerns with more detail and structured output). Testability checks are covered by `pytest-reviewer`.

### Changed

- **`python-style` skill** — Added emoji prefix table to logging section with 10 common emojis mapped to usage patterns. Fixed all logger examples across SKILL.md and conventions.md to include emoji prefixes.

### Summary

- 33 agents, 21 commands, 26 skills, 1 MCP server

---

## [2.0.0] - 2026-02-20

### Breaking Changes

- **Full Python specialization** — Removed all Ruby/Rails, TypeScript, and JavaScript-specific components
- **Removed agents:** dhh-rails-reviewer, kieran-rails-reviewer, kieran-typescript-reviewer, julik-frontend-races-reviewer, lint (Ruby), ankane-readme-writer, every-style-editor
- **Removed skills:** dhh-rails-style, dspy-ruby, andrew-kane-gem-writer, every-style-editor
- **Removed commands:** /test-xcode

### Added

- **`python-style` skill** — PEP 8 + project conventions with reference docs
- **`python-typing` skill** — Type hints and Pydantic v2 patterns
- **`django-patterns` skill** — Models, views, admin, signals, middleware, Django Ninja
- **`django-drf` skill** — Django REST Framework serializers, viewsets, permissions
- **`django-async` skill** — Celery tasks and Django Channels
- **`fastapi-patterns` skill** — Routes, DI, async patterns, auth
- **`fastapi-sqlalchemy` skill** — SQLAlchemy 2.0 async and Alembic migrations
- **`pytest-patterns` skill** — Fixtures, mocking, parametrize, async testing
- **`postgresql-patterns` skill** — Schema design, query optimization, monitoring
- **`postgis-patterns` skill** — Spatial queries, GeoDjango, GeoAlchemy2
- **`python-style-reviewer` agent** — PEP 8 and convention compliance review
- **`python-typing-reviewer` agent** — Type hint and Pydantic model review
- **`django-reviewer` agent** — Django core patterns review (9-section checklist)
- **`django-drf-reviewer` agent** — DRF API review (8-section checklist)
- **`django-celery-reviewer` agent** — Celery task design review (9-section checklist)
- **`django-migration-reviewer` agent** — Migration safety review (9-section checklist)
- **`fastapi-reviewer` agent** — FastAPI architecture review (10-section checklist)
- **`fastapi-sqlalchemy-reviewer` agent** — SQLAlchemy integration review (8-section checklist)
- **`pytest-reviewer` agent** — Test quality review (10-section checklist)
- **`postgresql-reviewer` agent** — Database performance review (10-section checklist)
- **`postgis-reviewer` agent** — Spatial data review (8-section checklist)
- **`python-lint` agent** — ruff linting/formatting and mypy type checking (model: haiku)

### Changed

- **`setup` skill** — Rewritten for Python-only stack detection (Django, FastAPI, DRF, Celery, SQLAlchemy, PostgreSQL, PostGIS, Pydantic)
- **`/workflows:review`** — Updated for Python agents, Django/Alembic migration detection, removed iOS testing
- **`/workflows:work`** — Updated test/lint commands for pytest and ruff/mypy
- **`agent-native-architecture` skill** — Reviewed and confirmed language-agnostic (no changes needed)

### Summary

- 34 agents, 21 commands, 25 skills, 1 MCP server

---

## [2.35.1] - 2026-02-18

### Changed

- **`/workflows:work` system-wide test check** — Added "System-Wide Test Check" to the task execution loop. Before marking a task done, forces five questions: what callbacks/middleware fire when this runs? Do tests exercise the real chain or just mocked isolation? Can failure leave orphaned state? What other interfaces need the same change? Do error strategies align across layers? Includes skip criteria for leaf-node changes. Also added integration test guidance to the "Test Continuously" section.
- **`/workflows:plan` system-wide impact templates** — Added "System-Wide Impact" section to MORE and A LOT plan templates (interaction graph, error propagation, state lifecycle, API surface parity, integration test scenarios) as lightweight prompts to flag risks during planning.

---

## [2.35.0] - 2026-02-17

### Fixed

- **`/lfg` and `/slfg` first-run failures** — Made ralph-loop step optional with graceful fallback when `ralph-wiggum` skill is not installed (#154). Added explicit "do not stop" instruction across all steps (#134).
- **`/workflows:plan` not writing file in pipeline** — Added mandatory "Write Plan File" step with explicit Write tool instructions before Post-Generation Options. The file is now always written to disk before any interactive prompts (#155). Also adds pipeline-mode note to skip AskUserQuestion calls when invoked from LFG/SLFG (#134).
- **Agent namespace typo in `/workflows:plan`** — `Task spec-flow-analyzer(...)` now uses the full qualified name `Task compound-engineering:workflow:spec-flow-analyzer(...)` to prevent Claude from prepending the wrong `workflows:` prefix (#193).

---

## [2.34.0] - 2026-02-14

### Added

- **Gemini CLI target** — New converter target for [Gemini CLI](https://github.com/google-gemini/gemini-cli). Install with `--to gemini` to convert agents to `.gemini/skills/*/SKILL.md`, commands to `.gemini/commands/*.toml` (TOML format with `description` + `prompt`), and MCP servers to `.gemini/settings.json`. Skills pass through unchanged (identical SKILL.md standard). Namespaced commands create directory structure (`workflows:plan` → `commands/workflows/plan.toml`). 29 new tests. (upstream [#190](https://github.com/EveryInc/compound-engineering-plugin/pull/190))

---

## [2.33.1] - 2026-02-13

### Changed

- **`/workflows:plan` command** - All plan templates now include `status: active` in YAML frontmatter. Plans are created with `status: active` and marked `status: completed` when work finishes.
- **`/workflows:work` command** - Phase 4 now updates plan frontmatter from `status: active` to `status: completed` after shipping. Agents can grep for status to distinguish current vs historical plans.

---

## [2.33.0] - 2026-02-12

### Added

- **`setup` skill** — Interactive configurator for review agents
  - Auto-detects project type (Rails, Python, TypeScript, etc.)
  - Two paths: "Auto-configure" (one click) or "Customize" (pick stack, focus areas, depth)
  - Writes `compound-engineering.local.md` in project root (tool-agnostic — works for Claude, Codex, OpenCode)
  - Invoked automatically by `/workflows:review` when no settings file exists
- **`learnings-researcher` in `/workflows:review`** — Always-run agent that searches `docs/solutions/` for past issues related to the PR
- **`schema-drift-detector` wired into `/workflows:review`** — Conditional agent for PRs with migrations

### Changed

- **`/workflows:review`** — Now reads review agents from `compound-engineering.local.md` settings file. Falls back to invoking setup skill if no file exists.
- **`/workflows:work`** — Review agents now configurable via settings file
- **`/release-docs` command** — Moved from plugin to local `.claude/commands/` (repo maintenance, not distributed)

### Removed

- **`/technical_review` command** — Superseded by configurable review agents

---

## [2.32.0] - 2026-02-11

### Added

- **Factory Droid target** — New converter target for [Factory Droid](https://docs.factory.ai). Install with `--to droid` to output agents, commands, and skills to `~/.factory/`. Includes tool name mapping (Claude → Factory), namespace prefix stripping, Task syntax conversion, and agent reference rewriting. 13 new tests (9 converter + 4 writer). (upstream [#174](https://github.com/EveryInc/compound-engineering-plugin/pull/174))

---

## [2.31.1] - 2026-02-09

### Changed

- **`dspy-ruby` skill** — Complete rewrite to DSPy.rb v0.34.3 API: `.call()` / `result.field` patterns, `T::Enum` classes, `DSPy::Tools::Base` / `Toolset`. Added events system, lifecycle callbacks, fiber-local LM context, GEPA optimization, evaluation framework, typed context pattern, BAML/TOON schema formats, storage system, score reporting, RubyLLM adapter. 5 reference files (2 new: toolsets, observability), 3 asset templates rewritten.

## [2.31.0] - 2026-02-08

### Added

- **`document-review` skill** — Brainstorm and plan refinement through structured review ([@Trevin Chow](https://github.com/trevin))
- **`/sync` command** — Sync Claude Code personal config across machines ([@Terry Li](https://github.com/terryli))

### Changed

- **Context token optimization (79% reduction)** — Plugin was consuming 316% of the context description budget, causing Claude Code to silently exclude components. Now at 65% with room to grow:
  - All 29 agent descriptions trimmed from ~1,400 to ~180 chars avg (examples moved to agent body)
  - 18 manual commands marked `disable-model-invocation: true` (side-effect commands like `/lfg`, `/deploy-docs`, `/triage`, etc.)
  - 6 manual skills marked `disable-model-invocation: true` (`orchestrating-swarms`, `git-worktree`, `skill-creator`, `compound-docs`, `file-todos`, `resolve-pr-parallel`)
- **git-worktree**: Remove confirmation prompt for worktree creation ([@Sam Xie](https://github.com/samxie))
- **Prevent subagents from writing intermediary files** in compound workflow ([@Trevin Chow](https://github.com/trevin))

### Fixed

- Fix crash when hook entries have no matcher ([@Roberto Mello](https://github.com/robertomello))
- Fix git-worktree detection where `.git` is a file, not a directory ([@David Alley](https://github.com/davidalley))
- Backup existing config files before overwriting in sync ([@Zac Williams](https://github.com/zacwilliams))
- Note new repository URL ([@Aarni Koskela](https://github.com/aarnikoskela))
- Plugin component counts corrected: 29 agents, 24 commands, 18 skills

---

## [2.30.0] - 2026-02-05

### Added

- **`orchestrating-swarms` skill** - Comprehensive guide to multi-agent orchestration
  - Covers primitives: Agent, Team, Teammate, Leader, Task, Inbox, Message, Backend
  - Documents two spawning methods: subagents vs teammates
  - Explains all 13 TeammateTool operations
  - Includes orchestration patterns: Parallel Specialists, Pipeline, Self-Organizing Swarm
  - Details spawn backends: in-process, tmux, iterm2
  - Provides complete workflow examples
- **`/slfg` command** - Swarm-enabled variant of `/lfg` that uses swarm mode for parallel execution

### Changed

- **`/workflows:work` command** - Added optional Swarm Mode section for parallel execution with coordinated agents

---

## [2.29.0] - 2026-02-04

### Added

- **`schema-drift-detector` agent** - Detects unrelated schema.rb changes in PRs
  - Compares schema.rb diff against migrations in the PR
  - Catches columns, indexes, and tables from other branches
  - Prevents accidental inclusion of local database state
  - Provides clear fix instructions (checkout + migrate)
  - Essential pre-merge check for any PR with database changes

---

## [2.28.0] - 2026-01-21

### Added

- **`/workflows:brainstorm` command** - Guided ideation flow to expand options quickly (#101)

### Changed

- **`/workflows:plan` command** - Smarter research decision logic before deep dives (#100)
- **Research checks** - Mandatory API deprecation validation in research flows (#102)
- **Docs** - Call out experimental OpenCode/Codex providers and install defaults
- **CLI defaults** - `install` pulls from GitHub by default and writes OpenCode/Codex output to global locations

### Merged PRs

- upstream [#102](https://github.com/EveryInc/compound-engineering-plugin/pull/102) feat(research): add mandatory API deprecation validation
- upstream [#101](https://github.com/EveryInc/compound-engineering-plugin/pull/101) feat: Add /workflows:brainstorm command and skill
- upstream [#100](https://github.com/EveryInc/compound-engineering-plugin/pull/100) feat(workflows:plan): Add smart research decision logic

### Contributors

Huge thanks to the community contributors who made this release possible! 🙌

- **[@tmchow](https://github.com/tmchow)** - Brainstorm workflow, research decision logic (2 PRs)
- **[@jaredmorgenstern](https://github.com/jaredmorgenstern)** - API deprecation validation

---

## [2.27.0] - 2026-01-20

### Added

- **`/workflows:plan` command** - Interactive Q&A refinement phase (#88)
  - After generating initial plan, now offers to refine with targeted questions
  - Asks up to 5 questions about ambiguous requirements, edge cases, or technical decisions
  - Incorporates answers to strengthen the plan before finalization

### Changed

- **`/workflows:work` command** - Incremental commits and branch safety (#93)
  - Now commits after each completed task instead of batching at end
  - Added branch protection checks before starting work
  - Better progress tracking with per-task commits

### Fixed

- **`dhh-rails-style` skill** - Fixed broken markdown table formatting (#96)
- **Documentation** - Updated hardcoded year references from 2025 to 2026 (#86, #91)

### Contributors

Huge thanks to the community contributors who made this release possible! 🙌

- **[@tmchow](https://github.com/tmchow)** - Interactive Q&A for plans, incremental commits, year updates (3 PRs!)
- **[@ashwin47](https://github.com/ashwin47)** - Markdown table fix
- **[@rbouschery](https://github.com/rbouschery)** - Documentation year update

### Summary

- 27 agents, 23 commands, 14 skills, 1 MCP server

---

## [2.26.5] - 2026-01-18

### Changed

- **`/workflows:work` command** - Now marks off checkboxes in plan document as tasks complete
  - Added step to update original plan file (`[ ]` → `[x]`) after each task
  - Ensures no checkboxes are left unchecked when work is done
  - Keeps plan as living document showing progress

---

## [2.26.4] - 2026-01-15

### Changed

- **`/workflows:work` command** - PRs now include Compound Engineered badge
  - Updated PR template to include badge at bottom linking to plugin repo
  - Added badge requirement to quality checklist
  - Badge provides attribution and link to the plugin that created the PR

---

## [2.26.3] - 2026-01-14

### Changed

- **`design-iterator` agent** - Now auto-loads design skills at start of iterations
  - Added "Step 0: Discover and Load Design Skills (MANDATORY)" section
  - Discovers skills from ~/.claude/skills/, .claude/skills/, and plugin cache
  - Maps user context to relevant skills (Swiss design → swiss-design skill, etc.)
  - Reads SKILL.md files to load principles into context before iterating
  - Extracts key principles: grid specs, typography rules, color philosophy, layout principles
  - Skills are applied throughout ALL iterations for consistent design language

---

## [2.26.2] - 2026-01-14

### Changed

- **`/test-browser` command** - Clarified to use agent-browser CLI exclusively
  - Added explicit "CRITICAL: Use agent-browser CLI Only" section
  - Added warning: "DO NOT use Chrome MCP tools (mcp__claude-in-chrome__*)"
  - Added Step 0: Verify agent-browser installation before testing
  - Added full CLI reference section at bottom
  - Added Next.js route mapping patterns

---

## [2.26.1] - 2026-01-14

### Changed

- **`best-practices-researcher` agent** - Now checks skills before going online
  - Phase 1: Discovers and reads relevant SKILL.md files from plugin, global, and project directories
  - Phase 2: Only goes online for additional best practices if skills don't provide enough coverage
  - Phase 3: Synthesizes all findings with clear source attribution (skill-based > official docs > community)
  - Skill mappings: Rails → dhh-rails-style, Frontend → frontend-design, AI → agent-native-architecture, etc.
  - Prioritizes curated skill knowledge over external sources for trivial/common patterns

---

## [2.26.0] - 2026-01-14

### Added

- **`/lfg` command** - Full autonomous engineering workflow
  - Orchestrates complete feature development from plan to PR
  - Runs: plan → deepen-plan → work → review → resolve todos → test-browser → feature-video
  - Uses ralph-loop for autonomous completion
  - Migrated from local command, updated to use `/test-browser` instead of `/playwright-test`

### Summary

- 27 agents, 21 commands, 14 skills, 1 MCP server

---

## [2.25.0] - 2026-01-14

### Added

- **`agent-browser` skill** - Browser automation using Vercel's agent-browser CLI
  - Navigate, click, fill forms, take screenshots
  - Uses ref-based element selection (simpler than Playwright)
  - Works in headed or headless mode

### Changed

- **Replaced Playwright MCP with agent-browser** - Simpler browser automation across all browser-related features:
  - `/test-browser` command - Now uses agent-browser CLI with headed/headless mode option
  - `/feature-video` command - Uses agent-browser for screenshots
  - `design-iterator` agent - Browser automation via agent-browser
  - `design-implementation-reviewer` agent - Screenshot comparison
  - `figma-design-sync` agent - Design verification
  - `bug-reproduction-validator` agent - Bug reproduction
  - `/review` workflow - Screenshot capabilities
  - `/work` workflow - Browser testing

- **`/test-browser` command** - Added "Step 0" to ask user if they want headed (visible) or headless browser mode

### Removed

- **Playwright MCP server** - Replaced by agent-browser CLI (simpler, no MCP overhead)
- **`/playwright-test` command** - Renamed to `/test-browser`

### Summary

- 27 agents, 20 commands, 14 skills, 1 MCP server

---

## [2.23.2] - 2026-01-09

### Changed

- **`/reproduce-bug` command** - Enhanced with Playwright visual reproduction:
  - Added Phase 2 for visual bug reproduction using browser automation
  - Step-by-step guide for navigating to affected areas
  - Screenshot capture at each reproduction step
  - Console error checking
  - User flow reproduction with clicks, typing, and snapshots
  - Better documentation structure with 4 clear phases

### Summary

- 27 agents, 21 commands, 13 skills, 2 MCP servers

---

## [2.23.1] - 2026-01-08

### Changed

- **Agent model inheritance** - All 26 agents now use `model: inherit` so they match the user's configured model. Only `lint` keeps `model: haiku` for cost efficiency. (fixes #69)

### Summary

- 27 agents, 21 commands, 13 skills, 2 MCP servers

---

## [2.23.0] - 2026-01-08

### Added

- **`/agent-native-audit` command** - Comprehensive agent-native architecture review
  - Launches 8 parallel sub-agents, one per core principle
  - Principles: Action Parity, Tools as Primitives, Context Injection, Shared Workspace, CRUD Completeness, UI Integration, Capability Discovery, Prompt-Native Features
  - Each agent produces specific score (X/Y format with percentage)
  - Generates summary report with overall score and top 10 recommendations
  - Supports single principle audit via argument

### Summary

- 27 agents, 21 commands, 13 skills, 2 MCP servers

---

## [2.22.0] - 2026-01-05

### Added

- **`rclone` skill** - Upload files to S3, Cloudflare R2, Backblaze B2, and other cloud storage providers

### Changed

- **`/feature-video` command** - Enhanced with:
  - Better ffmpeg commands for video/GIF creation (proper scaling, framerate control)
  - rclone integration for cloud uploads
  - Screenshot copying to project folder
  - Improved upload options workflow

### Summary

- 27 agents, 20 commands, 13 skills, 2 MCP servers

---

## [2.21.0] - 2026-01-05

### Fixed

- Version history cleanup after merge conflict resolution

### Summary

This release consolidates all recent work:
- `/feature-video` command for recording PR demos
- `/deepen-plan` command for enhanced planning
- `create-agent-skills` skill rewrite (official spec compliance)
- `agent-native-architecture` skill major expansion
- `dhh-rails-style` skill consolidation (merged dhh-ruby-style)
- 27 agents, 20 commands, 12 skills, 2 MCP servers

---

## [2.20.0] - 2026-01-05

### Added

- **`/feature-video` command** - Record video walkthroughs of features using Playwright

### Changed

- **`create-agent-skills` skill** - Complete rewrite to match Anthropic's official skill specification

### Removed

- **`dhh-ruby-style` skill** - Merged into `dhh-rails-style` skill

---

## [2.19.0] - 2025-12-31

### Added

- **`/deepen-plan` command** - Power enhancement for plans. Takes an existing plan and runs parallel research sub-agents for each major section to add:
  - Best practices and industry patterns
  - Performance optimizations
  - UI/UX improvements (if applicable)
  - Quality enhancements and edge cases
  - Real-world implementation examples

  The result is a deeply grounded, production-ready plan with concrete implementation details.

### Changed

- **`/workflows:plan` command** - Added `/deepen-plan` as option 2 in post-generation menu. Added note: if running with ultrathink enabled, automatically run deepen-plan for maximum depth.

## [2.18.0] - 2025-12-25

### Added

- **`agent-native-architecture` skill** - Added **Dynamic Capability Discovery** pattern and **Architecture Review Checklist**:

  **New Patterns in mcp-tool-design.md:**
  - **Dynamic Capability Discovery** - For external APIs (HealthKit, HomeKit, GraphQL), build a discovery tool (`list_*`) that returns available capabilities at runtime, plus a generic access tool that takes strings (not enums). The API validates, not your code. This means agents can use new API capabilities without code changes.
  - **CRUD Completeness** - Every entity the agent can create must also be readable, updatable, and deletable. Incomplete CRUD = broken action parity.

  **New in SKILL.md:**
  - **Architecture Review Checklist** - Pushes reviewer findings earlier into the design phase. Covers tool design (dynamic vs static, CRUD completeness), action parity (capability map, edit/delete), UI integration (agent → UI communication), and context injection.
  - **Option 11: API Integration** - New intake option for connecting to external APIs like HealthKit, HomeKit, GraphQL
  - **New anti-patterns:** Static Tool Mapping (building individual tools for each API endpoint), Incomplete CRUD (create-only tools)
  - **Tool Design Criteria** section added to success criteria checklist

  **New in shared-workspace-architecture.md:**
  - **iCloud File Storage for Multi-Device Sync** - Use iCloud Documents for your shared workspace to get free, automatic multi-device sync without building a sync layer. Includes implementation pattern, conflict handling, entitlements, and when NOT to use it.

### Philosophy

This update codifies a key insight for **agent-native apps**: when integrating with external APIs where the agent should have the same access as the user, use **Dynamic Capability Discovery** instead of static tool mapping. Instead of building `read_steps`, `read_heart_rate`, `read_sleep`... build `list_health_types` + `read_health_data(dataType: string)`. The agent discovers what's available, the API validates the type.

Note: This pattern is specifically for agent-native apps following the "whatever the user can do, the agent can do" philosophy. For constrained agents with intentionally limited capabilities, static tool mapping may be appropriate.

---

## [2.17.0] - 2025-12-25

### Enhanced

- **`agent-native-architecture` skill** - Major expansion based on real-world learnings from building the Every Reader iOS app. Added 5 new reference documents and expanded existing ones:

  **New References:**
  - **dynamic-context-injection.md** - How to inject runtime app state into agent system prompts. Covers context injection patterns, what context to inject (resources, activity, capabilities, vocabulary), implementation patterns for Swift/iOS and TypeScript, and context freshness.
  - **action-parity-discipline.md** - Workflow for ensuring agents can do everything users can do. Includes capability mapping templates, parity audit process, PR checklists, tool design for parity, and context parity guidelines.
  - **shared-workspace-architecture.md** - Patterns for agents and users working in the same data space. Covers directory structure, file tools, UI integration (file watching, shared stores), agent-user collaboration patterns, and security considerations.
  - **agent-native-testing.md** - Testing patterns for agent-native apps. Includes "Can Agent Do It?" tests, the Surprise Test, automated parity testing, integration testing, and CI/CD integration.
  - **mobile-patterns.md** - Mobile-specific patterns for iOS/Android. Covers background execution (checkpoint/resume), permission handling, cost-aware design (model tiers, token budgets, network awareness), offline handling, and battery awareness.

  **Updated References:**
  - **architecture-patterns.md** - Added 3 new patterns: Unified Agent Architecture (one orchestrator, many agent types), Agent-to-UI Communication (shared data store, file watching, event bus), and Model Tier Selection (fast/balanced/powerful).

  **Updated Skill Root:**
  - **SKILL.md** - Expanded intake menu (now 10 options including context injection, action parity, shared workspace, testing, mobile patterns). Added 5 new agent-native anti-patterns (Context Starvation, Orphan Features, Sandbox Isolation, Silent Actions, Capability Hiding). Expanded success criteria with agent-native and mobile-specific checklists.

- **`agent-native-reviewer` agent** - Significantly enhanced with comprehensive review process covering all new patterns. Now checks for action parity, context parity, shared workspace, tool design (primitives vs workflows), dynamic context injection, and mobile-specific concerns. Includes detailed anti-patterns, output format template, quick checks ("Write to Location" test, Surprise test), and mobile-specific verification.

### Philosophy

These updates operationalize a key insight from building agent-native mobile apps: **"The agent should be able to do anything the user can do, through tools that mirror UI capabilities, with full context about the app state."** The failure case that prompted these changes: an agent asked "what reading feed?" when a user said "write something in my reading feed"—because it had no `publish_to_feed` tool and no context about what "feed" meant.

## [2.16.0] - 2025-12-21

### Enhanced

- **`dhh-rails-style` skill** - Massively expanded reference documentation incorporating patterns from Marc Köhlbrugge's Unofficial 37signals Coding Style Guide:
  - **controllers.md** - Added authorization patterns, rate limiting, Sec-Fetch-Site CSRF protection, request context concerns
  - **models.md** - Added validation philosophy, let it crash philosophy (bang methods), default values with lambdas, Rails 7.1+ patterns (normalizes, delegated types, store accessor), concern guidelines with touch chains
  - **frontend.md** - Added Turbo morphing best practices, Turbo frames patterns, 6 new Stimulus controllers (auto-submit, dialog, local-time, etc.), Stimulus best practices, view helpers, caching with personalization, broadcasting patterns
  - **architecture.md** - Added path-based multi-tenancy, database patterns (UUIDs, state as records, hard deletes, counter caches), background job patterns (transaction safety, error handling, batch processing), email patterns, security patterns (XSS, SSRF, CSP), Active Storage patterns
  - **gems.md** - Added expanded what-they-avoid section (service objects, form objects, decorators, CSS preprocessors, React/Vue), testing philosophy with Minitest/fixtures patterns

### Credits

- Reference patterns derived from [Marc Köhlbrugge's Unofficial 37signals Coding Style Guide](https://github.com/marckohlbrugge/unofficial-37signals-coding-style-guide)

## [2.15.2] - 2025-12-21

### Fixed

- **All skills** - Fixed spec compliance issues across 12 skills:
  - Reference files now use proper markdown links (`[file.md](./references/file.md)`) instead of backtick text
  - Descriptions now use third person ("This skill should be used when...") per skill-creator spec
  - Affected skills: agent-native-architecture, andrew-kane-gem-writer, compound-docs, create-agent-skills, dhh-rails-style, dspy-ruby, every-style-editor, file-todos, frontend-design, gemini-imagegen

### Added

- **CLAUDE.md** - Added Skill Compliance Checklist with validation commands for ensuring new skills meet spec requirements

## [2.15.1] - 2025-12-18

### Changed

- **`/workflows:review` command** - Section 7 now detects project type (Web, iOS, or Hybrid) and offers appropriate testing. Web projects get `/playwright-test`, iOS projects get `/xcode-test`, hybrid projects can run both.

## [2.15.0] - 2025-12-18

### Added

- **`/xcode-test` command** - Build and test iOS apps on simulator using XcodeBuildMCP. Automatically detects Xcode project, builds app, launches simulator, and runs test suite. Includes retries for flaky tests.

- **`/playwright-test` command** - Run Playwright browser tests on pages affected by current PR or branch. Detects changed files, maps to affected routes, generates/runs targeted tests, and reports results with screenshots.
