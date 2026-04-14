---
name: setup
description: Configure which review agents run for your project. Auto-detects Python stack and writes compound-engineering.local.md.
disable-model-invocation: true
---

# Compound Engineering Setup

Interactive setup for `compound-engineering.local.md` — configures which agents run during `/workflows:review` and `/workflows:work`.

## Step 1: Check Existing Config

Read `compound-engineering.local.md` in the project root. If it exists, display current settings summary and use AskUserQuestion:

```
question: "Settings file already exists. What would you like to do?"
header: "Config"
options:
  - label: "Reconfigure"
    description: "Run the interactive setup again from scratch"
  - label: "View current"
    description: "Show the file contents, then stop"
  - label: "Cancel"
    description: "Keep current settings"
```

If "View current": read and display the file, then stop.
If "Cancel": stop.

## Step 2: Detect Python Stack

Auto-detect the project stack by scanning dependency files:

**Detection sources:** `pyproject.toml`, `requirements.txt`, `setup.py`, `setup.cfg`, `Pipfile`

**Framework detection:**

| Dependency | Detected As |
|-----------|-------------|
| `django` | Django |
| `djangorestframework` | DRF |
| `django-ninja` | Django Ninja |
| `celery` | Celery |
| `django-channels` or `channels` | Channels |
| `fastapi` | FastAPI |
| `sqlalchemy` | SQLAlchemy |
| `psycopg2`, `psycopg`, `asyncpg` | PostgreSQL |
| `django.contrib.gis` in settings or `geoalchemy2` | PostGIS |
| `pydantic` | Pydantic |
| `alembic` | Alembic |

**Confirmation signals:**

| File/Directory | Confirms |
|---------------|----------|
| `manage.py` | Django project |
| `alembic.ini` or `alembic/` | SQLAlchemy + Alembic |
| `celeryconfig.py` or `celery.py` in project | Celery |

Use AskUserQuestion:

```
question: "Detected Python project with: {detected_frameworks}. How would you like to configure?"
header: "Setup"
options:
  - label: "Auto-configure (Recommended)"
    description: "Use smart defaults for your detected stack. Done in one click."
  - label: "Customize"
    description: "Choose frameworks, focus areas, and review depth."
```

### If Auto-configure → Skip to Step 4 with defaults

**Always included:**
`[python-style-reviewer, python-typing-reviewer, pytest-reviewer, python-lint, code-simplicity-reviewer, security-sentinel, performance-oracle]`

**Conditional additions:**

| Detected | Agents Added |
|----------|-------------|
| Django | `django-reviewer, django-migration-reviewer` |
| DRF | `django-drf-reviewer` |
| Django Ninja | (covered by `django-reviewer`) |
| Celery | `django-celery-reviewer` |
| FastAPI | `fastapi-reviewer` |
| SQLAlchemy | `fastapi-sqlalchemy-reviewer` |
| PostgreSQL | `postgresql-reviewer` |
| PostGIS | `postgis-reviewer` |

### If Customize → Step 3

## Step 3: Customize (4 questions)

**a. Frameworks** — confirm or override:

```
question: "Which frameworks does this project use?"
header: "Frameworks"
multiSelect: true
options:
  - label: "Django"
    description: "Django web framework — adds Django pattern and migration reviewers"
  - label: "DRF"
    description: "Django REST Framework — adds serializer and viewset reviewer"
  - label: "Celery"
    description: "Celery task queue — adds task design and reliability reviewer"
  - label: "FastAPI"
    description: "FastAPI — adds route, DI, and async correctness reviewer"
```

**b. Database** — select database tools:

```
question: "Which database tools apply?"
header: "Database"
multiSelect: true
options:
  - label: "PostgreSQL"
    description: "PostgreSQL — adds query optimization and schema reviewer"
  - label: "PostGIS"
    description: "PostGIS spatial — adds SRID, spatial index, and GeoDjango reviewer"
  - label: "SQLAlchemy"
    description: "SQLAlchemy ORM — adds session lifecycle and Alembic migration reviewer"
```

**c. Focus areas** — multiSelect:

```
question: "Which review areas matter most?"
header: "Focus"
multiSelect: true
options:
  - label: "Security"
    description: "Vulnerability scanning, auth, input validation (security-sentinel)"
  - label: "Performance"
    description: "N+1 queries, memory leaks, complexity (performance-oracle)"
  - label: "Architecture"
    description: "Design patterns, SOLID, separation of concerns (architecture-strategist)"
  - label: "Code simplicity"
    description: "Over-engineering, YAGNI violations (code-simplicity-reviewer)"
```

**d. Depth:**

```
question: "How thorough should reviews be?"
header: "Depth"
options:
  - label: "Thorough (Recommended)"
    description: "Stack reviewers + all selected focus agents."
  - label: "Fast"
    description: "Stack reviewers + code simplicity only. Less context, quicker."
  - label: "Comprehensive"
    description: "All above + git history, data integrity, agent-native checks."
```

**e. Workflow Skills** — configure per-workflow skills:

```
question: "Load framework/database skills into workflow commands?"
header: "Wf Skills"
options:
  - label: "Auto-configure (Recommended)"
    description: "Load detected stack skills into all workflows automatically."
  - label: "Customize per workflow"
    description: "Choose which skills load for each workflow command."
  - label: "Skip"
    description: "Don't configure workflow skills. Commands use only their built-in skills."
```

**If Auto-configure:**
Build a `workflow_skills` map using the detected/selected frameworks and database:

| Detected | Skills Added |
|----------|-------------|
| Django | `django-patterns` |
| DRF | `django-drf` |
| Celery | `django-async` |
| FastAPI | `fastapi-patterns` |
| SQLAlchemy | `fastapi-sqlalchemy` |
| PostgreSQL | `postgresql-patterns` |
| PostGIS | `postgis-patterns` |

Apply these skills to all 5 workflow commands uniformly. Always add `pytest-patterns` to `work` and `review`.

**If Customize per workflow:**
For each of the 5 workflows (`brainstorm`, `plan`, `work`, `review`, `compound`), present a multiSelect of available skills:

```
question: "Which skills should load for /workflows:{command}?"
header: "{Command} Skills"
multiSelect: true
options:
  - label: "django-patterns"
    description: "Django models, views, admin, signals, middleware patterns"
  - label: "django-drf"
    description: "DRF serializers, viewsets, permissions"
  - label: "django-async"
    description: "Celery task patterns, Django Channels"
  - label: "fastapi-patterns"
    description: "FastAPI routes, DI, async patterns"
  - label: "fastapi-sqlalchemy"
    description: "SQLAlchemy 2.0 async, Alembic migrations"
  - label: "pytest-patterns"
    description: "Fixtures, parametrize, mocking, async testing"
  - label: "postgresql-patterns"
    description: "Schema design, indexing, query optimization"
  - label: "postgis-patterns"
    description: "Spatial queries, GeoDjango, GeoAlchemy2"
```

Also include any project-local skills found in `.claude/skills/` as additional options.

**If Skip:** Omit `workflow_skills` from the config file entirely.

## Step 4: Build Agent List and Write File

**Base agents (always included):**
`python-style-reviewer, python-typing-reviewer, pytest-reviewer, python-lint`

**Framework agents:**
- Django → `django-reviewer, django-migration-reviewer`
- DRF → `django-drf-reviewer`
- Celery → `django-celery-reviewer`
- FastAPI → `fastapi-reviewer`
- SQLAlchemy → `fastapi-sqlalchemy-reviewer`

**Database agents:**
- PostgreSQL → `postgresql-reviewer`
- PostGIS → `postgis-reviewer`

**Focus area agents:**
- Security → `security-sentinel`
- Performance → `performance-oracle`
- Architecture → `architecture-strategist`
- Code simplicity → `code-simplicity-reviewer`

**Depth:**
- Thorough: stack + selected focus areas
- Fast: stack + `code-simplicity-reviewer` only
- Comprehensive: all above + `git-history-analyzer, data-integrity-guardian, agent-native-reviewer`

**Plan review agents:** base Python reviewers + `code-simplicity-reviewer`.

Write `compound-engineering.local.md`:

```markdown
---
review_agents: [{computed agent list}]
plan_review_agents: [{computed plan agent list}]
frameworks: [{detected or selected frameworks}]
database: [{detected or selected database tools}]
workflow_skills:
  brainstorm: [{computed skill list}]
  plan: [{computed skill list}]
  work: [{computed skill list}]
  review: [{computed skill list}]
  compound: [{computed skill list}]
---

# Review Context

Add project-specific review instructions here.
These notes are passed to all review agents during /workflows:review and /workflows:work.

Examples:
- "We use Django Ninja for the API — check schema design and router organization"
- "Our API is public — extra scrutiny on input validation"
- "Performance-critical: we serve 10k req/s on this endpoint"
- "We use Celery with Redis broker — check task idempotency"
```

Omit the `workflow_skills` block entirely if the user chose "Skip" in Step 3e.

## Step 5: Confirm

```
Saved to compound-engineering.local.md

Stack:        Python
Frameworks:   {framework list}
Database:     {database list}
Review depth: {depth}
Agents:       {count} configured
              {agent list, one per line}
Workflow skills: {count} skills across {count} workflows
              brainstorm: {skill list or "none"}
              plan:       {skill list or "none"}
              work:       {skill list or "none"}
              review:     {skill list or "none"}
              compound:   {skill list or "none"}

Tip: Edit the "Review Context" section to add project-specific instructions.
     Edit workflow_skills in the YAML frontmatter to customize per-workflow skills.
     Re-run this setup anytime to reconfigure.
```
