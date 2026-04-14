# Compound Engineering feat. Python

A Claude Code plugin that supercharges Python development with 33 specialized agents, 21 commands, 26 skills, and an MCP server — all wired into a cohesive engineering workflow. Built for Django, FastAPI, pytest, Pydantic, PostgreSQL, and PostGIS projects, with first-class support for multi-service monorepos.

> Fork of [Compound Engineering Plugin](https://github.com/EveryInc/compound-engineering-plugin) by [Kieran Klaassen](https://github.com/kieranklaassen), fully rewritten for the Python ecosystem.

## What It Does

Instead of generic AI assistance, this plugin gives Claude deep knowledge of Python frameworks and enforces a structured engineering workflow:

```
/workflows:brainstorm → /workflows:plan → /workflows:work → /workflows:review → /workflows:compound
```

Each step loads relevant skills (Django patterns, pytest conventions, PostgreSQL optimization...), spawns specialized review agents, and enforces quality gates — tests must pass, linting must be clean, pre-commit hooks must succeed — before anything ships.

For the impatient: `/lfg` runs the entire pipeline autonomously, from plan to PR.

## Installation

This plugin is distributed as its own Claude Code marketplace. Add the repo, then install:

```
/plugin marketplace add weorbitant/compound-engineering-feat-python-plugin
/plugin install compound-engineering-feat-python@compound-engineering-feat-python
```

To install from a local clone instead:

```
/plugin marketplace add /path/to/compound-engineering-feat-python-plugin
/plugin install compound-engineering-feat-python@compound-engineering-feat-python
```

### Optional Dependencies

Checked automatically on session start — you'll see warnings for anything missing:

| Tool | Used By | Install |
|------|---------|---------|
| `agent-browser` | `/test-browser`, `/feature-video`, design agents, bug reproduction | `npm install -g agent-browser && agent-browser install` |
| `rclone` | `/feature-video` (cloud uploads) | [rclone.org/install](https://rclone.org/install/) |

## Quick Start

```bash
# Brainstorm a feature idea
/workflows:brainstorm add rate limiting to the payment API

# Plan the implementation
/workflows:plan add rate limiting with Redis sliding window

# Execute the plan
/workflows:work docs/plans/2026-04-01-rate-limiting.md

# Review the changes
/workflows:review

# Document what you learned
/workflows:compound

# Or just do it all at once
/lfg add rate limiting to the payment API
```

## Core Workflow Commands

Commands use `workflows:` prefix to avoid collisions with Claude Code built-ins (`/plan`, `/review`).

| Command | Purpose |
|---------|---------|
| `/workflows:brainstorm` | Explore requirements and approaches before committing to a plan |
| `/workflows:plan` | Generate implementation plans with size-appropriate detail |
| `/workflows:work` | Execute a plan with incremental commits, quality gates, and test-fix loops |
| `/workflows:review` | Multi-agent code review with configurable reviewer roster |
| `/workflows:compound` | Capture solved problems as searchable documentation in `docs/solutions/` |

Each workflow command:
- Loads project-specific skills from `compound-engineering.local.md` configuration
- Auto-detects multi-service monorepos and adjusts behavior accordingly
- Propagates service context to all sub-agents to prevent information loss

## Utility Commands

| Command | Description |
|---------|-------------|
| `/lfg` | Full autonomous pipeline: plan → deepen → work → review → test → video → PR |
| `/slfg` | Same as `/lfg` but uses swarm mode for parallel execution |
| `/deepen-plan` | Enrich a plan with parallel research agents for each section |
| `/changelog` | Generate changelogs from recent merges |
| `/create-agent-skill` | Guided skill creation |
| `/generate_command` | Generate new slash commands |
| `/reproduce-bug` | Reproduce bugs using logs and browser automation |
| `/resolve_parallel` | Resolve TODO/FIXME comments in parallel |
| `/resolve_todo_parallel` | Resolve todos from plan files in parallel |
| `/triage` | Triage and prioritize issues |
| `/test-browser` | Browser tests on PR-affected pages |
| `/agent-native-audit` | Architecture review against 8 agent-native principles |
| `/deploy-docs` | Deploy documentation |
| `/feature-video` | Record video walkthroughs and attach to PR |
| `/report-bug` | Report a plugin bug |
| `/heal-skill` | Fix skill documentation issues |

## Agents (33)

Agents run as sub-processes during workflows. They are grouped by specialization.

Agents use a 3-tier model strategy to optimize cost without sacrificing quality:

- **Opus** — High-stakes decisions: architecture, security, data integrity, performance, deployment
- **Sonnet** — Domain review and research: framework-specific reviewers, researchers, design agents
- **Haiku** — Mechanical tasks: linting, style checks, pattern lookups, drift detection

### Review — Python Core

| Agent | Model | Focus |
|-------|-------|-------|
| `python-style-reviewer` | haiku | PEP 8, naming, imports, modern syntax |
| `python-typing-reviewer` | sonnet | Type annotations, Pydantic models, generics |
| `pattern-recognition-specialist` | sonnet | Code patterns and anti-patterns |

### Review — Django

| Agent | Model | Focus |
|-------|-------|-------|
| `django-reviewer` | sonnet | Models, views, URLs, admin, signals, middleware, Ninja |
| `django-drf-reviewer` | sonnet | DRF serializers, viewsets, permissions, pagination |
| `django-celery-reviewer` | sonnet | Task design, idempotency, retry strategy, queue routing |
| `django-migration-reviewer` | sonnet | Migration safety, reversibility, lock impact, zero-downtime |

### Review — FastAPI

| Agent | Model | Focus |
|-------|-------|-------|
| `fastapi-reviewer` | sonnet | Routes, DI, async correctness, OpenAPI |
| `fastapi-sqlalchemy-reviewer` | sonnet | Session lifecycle, query patterns, Alembic migrations |

### Review — Testing & Database

| Agent | Model | Focus |
|-------|-------|-------|
| `pytest-reviewer` | sonnet | Fixtures, isolation, assertions, mocking, async |
| `postgresql-reviewer` | sonnet | Query optimization, indexing, connection pooling |
| `postgis-reviewer` | sonnet | SRID consistency, spatial indexing, GeoDjango |

### Review — Strategic (Opus)

| Agent | Model | Focus |
|-------|-------|-------|
| `architecture-strategist` | opus | Architectural decisions and compliance |
| `data-integrity-guardian` | opus | Database migrations and data integrity |
| `data-migration-expert` | opus | ID mapping validation, swapped value detection |
| `deployment-verification-agent` | opus | Go/No-Go deployment checklists |
| `performance-oracle` | opus | Performance analysis and optimization |
| `security-sentinel` | opus | Security audits and vulnerability assessment |

### Review — General

| Agent | Model | Focus |
|-------|-------|-------|
| `agent-native-reviewer` | sonnet | Action + context parity for agent-native features |
| `code-simplicity-reviewer` | sonnet | Final pass for simplicity and minimalism |
| `schema-drift-detector` | haiku | Unrelated schema changes in PRs |

### Research

| Agent | Model | Focus |
|-------|-------|-------|
| `best-practices-researcher` | sonnet | External best practices (checks skills first) |
| `framework-docs-researcher` | sonnet | Framework documentation and patterns |
| `git-history-analyzer` | sonnet | Git history and code evolution |
| `learnings-researcher` | haiku | Past solutions from `docs/solutions/` |
| `repo-research-analyst` | sonnet | Repository structure and conventions |

### Design

| Agent | Model | Focus |
|-------|-------|-------|
| `design-implementation-reviewer` | sonnet | UI vs Figma design comparison |
| `design-iterator` | sonnet | Iterative UI refinement |
| `figma-design-sync` | sonnet | Figma ↔ web synchronization |

### Workflow

| Agent | Model | Focus |
|-------|-------|-------|
| `bug-reproduction-validator` | sonnet | Systematic bug reproduction |
| `python-lint` | haiku | ruff + mypy linting and type-checking |
| `pr-comment-resolver` | sonnet | PR comment resolution |
| `spec-flow-analyzer` | opus | User flow gap analysis |

## Skills (26)

Skills provide domain knowledge that agents and workflows load on demand. They contain reference documentation, conventions, and patterns.

### Python Core
- **`python-style`** — PEP 8, naming, imports, logging with emoji prefixes
- **`python-typing`** — Type hints, Pydantic v2, Protocol, generics

### Django
- **`django-patterns`** — Models, views, admin, signals, middleware, Django Ninja
- **`django-drf`** — DRF serializers, viewsets, permissions, authentication
- **`django-async`** — Celery task patterns, Django Channels

### FastAPI
- **`fastapi-patterns`** — Routes, dependency injection, async patterns, auth
- **`fastapi-sqlalchemy`** — SQLAlchemy 2.0 async, Alembic migrations

### Testing
- **`pytest-patterns`** — Fixtures, parametrize, mocking, async testing

### Database
- **`postgresql-patterns`** — Schema design, indexing, query optimization, monitoring
- **`postgis-patterns`** — Spatial queries, GeoDjango, GeoAlchemy2

### Architecture & Design
- **`agent-native-architecture`** — Agent-native app patterns (action parity, context injection, shared workspace, dynamic capability discovery)
- **`frontend-design`** — Production-grade frontend interfaces

### Development Tools
- **`compound-docs`** — Structured solution documentation
- **`create-agent-skills`** — Skill authoring guide
- **`skill-creator`** — Skill creation framework
- **`setup`** — Interactive project configuration for review agents and workflow skills

### Content & Workflow
- **`brainstorming`** — Collaborative exploration techniques
- **`commit`** — Conventional commits with gitmoji, logical grouping, pre-commit handling
- **`document-review`** — Structured document improvement
- **`file-todos`** — File-based todo tracking
- **`git-worktree`** — Parallel development with Git worktrees
- **`resolve-pr-parallel`** — Parallel PR comment resolution

### Multi-Agent Orchestration
- **`orchestrating-swarms`** — Multi-agent coordination with TeammateTool and Task system

### Integrations
- **`rclone`** — Cloud storage uploads (S3, R2, B2)
- **`agent-browser`** — CLI browser automation via Vercel's agent-browser
- **`gemini-imagegen`** — Image generation/editing with Google Gemini API

## MCP Servers

| Server | Description | Tools |
|--------|-------------|-------|
| `context7` | Framework documentation lookup | `resolve-library-id`, `get-library-docs` |

Supports 100+ frameworks including Django, FastAPI, SQLAlchemy, Celery, and more. Starts automatically when the plugin is enabled.

### Known Issue: MCP Server Not Auto-Loading

If Context7 doesn't load automatically, add it manually to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```

## Configuration

### Workflow Skills

Customize which skills load per workflow via `compound-engineering.local.md` in your project root:

```yaml
---
workflow_skills:
  brainstorm: [django-patterns, holafly-domain]
  plan: [django-patterns]
  work: [django-patterns, pytest-patterns]
  review: [django-patterns, pytest-patterns]
  compound: [django-patterns]
---
```

Skills are **additive** — loaded alongside each command's built-in skills. Project-local skills in `.claude/skills/` can also be referenced by name.

Run `/setup` to configure interactively.

### Review Agents

The `/setup` skill auto-detects your stack (Django, FastAPI, DRF, Celery, SQLAlchemy, PostgreSQL, PostGIS, Pydantic) and configures which review agents run during `/workflows:review`. Settings are written to `compound-engineering.local.md`.

## Microservice Support

For multi-service monorepos, the plugin provides:

- **Auto-detection** — Discovers services via `*/pyproject.toml` at root level
- **Focus Gate** — Each workflow command prompts for relevant services (or accepts `--services` argument)
- **Dependency-aware execution** — Plans with `services:` YAML frontmatter execute in topological order
- **Per-service context** — Loads each service's README, dependencies, and structure before acting
- **Stack-aware routing** — Applies Django patterns to Django services, FastAPI to FastAPI, etc.

### Pipeline Mode

All workflow commands accept `--services` for automated invocation:

```bash
/workflows:brainstorm --services order-service,payment-service "add cross-service event bus"
```

### Documentation Output

| Doc Type | Single Service | Multi-Service |
|----------|---------------|---------------|
| Brainstorms | Single document | `{service}/docs/brainstorms/` per service |
| Plans | `docs/plans/` | Root overview + per-service plan files |
| Solutions | `docs/solutions/` | `{service}/docs/solutions/` with cross-refs |

## How It Works

### The `/workflows:work` Pipeline

The work command is the engine that turns plans into shipped code:

1. **Phase 1 — Quick Start** (opus): Read plan, clarify ambiguities, set up branch/worktree, create task list
2. **Phase 2 — Execute** (sonnet sub-agent): Task loop with incremental commits, system-wide test checks, pattern matching — runs on Sonnet for cost efficiency
3. **Phase 3 — Quality Gate** (opus, mandatory): Full test suite + linting + pre-commit hooks must all pass. Blocks shipping until clean.
4. **Phase 4 — Ship It** (opus): Create commit via `/commit` skill, push, open PR with monitoring plan

Every commit goes through a test-and-fix gate: run tests → fix failures → stage → commit → if pre-commit fails → fix → re-test → retry. Never ships with failing tests, never skips hooks.

### Swarm Mode

For complex features, `/slfg` or explicit swarm mode spawns parallel worker agents:

```
Team lead → spawns implementers + testers → monitors via Task system → ships when done
```

Uses Claude Code's TeammateTool system with dependency-aware task scheduling.

### Knowledge Compounding

`/workflows:compound` captures solutions in `docs/solutions/` with YAML frontmatter. The `learnings-researcher` agent searches these during future reviews, so past solutions inform new work. Knowledge compounds.

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

**Current version: 2.4.0**

## Contributing

Contributions are welcome. The plugin is open source under the MIT license.

1. Fork the repo and create a feature branch
2. Follow the conventions encoded in the plugin's own skills (PEP 8, type hints, pytest, conventional commits)
3. Run the plugin against itself: `/workflows:review` before opening a PR
4. Open a PR against `main` — include a short rationale and any relevant plan/solution docs

Issues, ideas, and discussion: [GitHub Issues](https://github.com/weorbitant/compound-engineering-feat-python-plugin/issues).

## License

MIT — See [LICENSE](LICENSE)

Original work copyright (c) 2025 [Kieran Klaassen](https://github.com/kieranklaassen). Modifications copyright (c) 2026 [BaronVonSario](https://github.com/BaronVonSario).
