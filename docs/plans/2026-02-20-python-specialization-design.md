# Python Specialization Design

Specialize the compound-engineering plugin for the Python ecosystem: Django, FastAPI, pytest, Pydantic, PostgreSQL, and PostGIS. Remove all Ruby/Rails/TypeScript/JS-specific components. Adapt generic components to Python context. Stack-aware activation ensures only relevant agents run per project.

## Components to Remove

### Agents (7)

| Agent | Reason |
|-------|--------|
| `dhh-rails-reviewer` | Ruby/Rails-specific |
| `kieran-rails-reviewer` | Ruby/Rails-specific |
| `kieran-typescript-reviewer` | TypeScript-specific |
| `julik-frontend-races-reviewer` | JavaScript/Stimulus-specific |
| `lint` | Ruby/ERB linter |
| `ankane-readme-writer` | Ruby gem README style |
| `every-style-editor` | Editorial style guide, not code |

### Skills (4)

| Skill | Reason |
|-------|--------|
| `dhh-rails-style` | Ruby/Rails-specific |
| `dspy-ruby` | Ruby-specific |
| `andrew-kane-gem-writer` | Ruby gem-specific |
| `every-style-editor` | Editorial style guide, not code |

### Commands (1)

| Command | Reason |
|---------|--------|
| `/test-xcode` | iOS-specific |

## New Skills (10)

### Python Core (2)

**`python-style`** — PEP 8 + CLAUDE.md rules: line length 100, `| None` not Optional, no unnecessary docstrings, descriptive names, imports at top, f-strings, pathlib, modern 3.10+ syntax.
- References: `conventions.md`, `patterns.md`

**`python-typing`** — Type hints, Pydantic v2 models, Protocols, generics, TypeVar, `| None`, runtime validation, model_validator, field_validator, custom types.
- References: `type-hints.md`, `pydantic-patterns.md`

### Django (3)

**`django-patterns`** — Models, views (CBV/FBV), URLs, forms, admin, signals, middleware, management commands, settings structure, Django Ninja integration.
- References: `models.md`, `views.md`, `admin-signals-middleware.md`, `ninja.md`

**`django-drf`** — DRF serializers, viewsets, routers, permissions, throttling, pagination, filtering, versioning.
- References: `serializers.md`, `viewsets.md`, `permissions-auth.md`

**`django-async`** — Celery tasks, beat scheduling, result backends, error handling, Channels consumers, WebSocket routing.
- References: `celery.md`, `channels.md`

### FastAPI (2)

**`fastapi-patterns`** — Routes, dependency injection, middleware, error handling, OpenAPI customization, auth (OAuth2/JWT), async/await, background tasks, WebSockets, streaming.
- References: `routes-di.md`, `async-patterns.md`, `auth.md`

**`fastapi-sqlalchemy`** — SQLAlchemy 2.0 async, Alembic migrations, session management, repository pattern, relationship loading.
- References: `sqlalchemy.md`, `alembic.md`

### Testing (1)

**`pytest-patterns`** — Fixtures, conftest, parametrize, markers, mocking (unittest.mock + pytest-mock), async tests (pytest-asyncio), factory_boy, coverage, Django test client, FastAPI TestClient/httpx.
- References: `fixtures-parametrize.md`, `mocking.md`, `async-testing.md`

### Database (2)

**`postgresql-patterns`** — Schema design, indexing (B-tree, GIN, GiST), query optimization, EXPLAIN analysis, JSONB, partitioning, connection pooling, pg_stat views, vacuum tuning, migrations best practices.
- References: `schema-indexing.md`, `query-optimization.md`, `monitoring.md`

**`postgis-patterns`** — Geometry/geography types, spatial indexes (GiST/SP-GiST), distance/area queries, GeoJSON, ST_ functions, GeoDjango integration, coordinate systems (SRID), spatial joins.
- References: `spatial-queries.md`, `geodjango.md`

## New Agents (12)

### Python Core (2)

| Agent | Category | Activation | Focus |
|-------|----------|------------|-------|
| `python-style-reviewer` | review | Always (Python project) | PEP 8 + CLAUDE.md rules, naming, imports, modern syntax |
| `python-typing-reviewer` | review | Always (Python project) | Type hint completeness, Pydantic model design, Protocol usage |

### Django (4)

| Agent | Category | Activation | Focus |
|-------|----------|------------|-------|
| `django-reviewer` | review | Django detected | Models, views, URLs, forms, admin, signals, middleware, Ninja |
| `django-drf-reviewer` | review | DRF detected | Serializer design, viewset patterns, permissions, API consistency |
| `django-celery-reviewer` | review | Celery detected | Task design, idempotency, error handling, retry strategies |
| `django-migration-reviewer` | review | Django detected | Migration safety, data migrations, backwards compatibility |

### FastAPI (2)

| Agent | Category | Activation | Focus |
|-------|----------|------------|-------|
| `fastapi-reviewer` | review | FastAPI detected | Route design, DI, async correctness, error handling, auth |
| `fastapi-sqlalchemy-reviewer` | review | SQLAlchemy detected | Session lifecycle, query patterns, relationship loading, Alembic |

### Testing (1)

| Agent | Category | Activation | Focus |
|-------|----------|------------|-------|
| `pytest-reviewer` | review | Always (Python project) | Test quality, fixture design, coverage, isolation, assertions |

### Database (2)

| Agent | Category | Activation | Focus |
|-------|----------|------------|-------|
| `postgresql-reviewer` | review | PostgreSQL detected | Query performance, indexing, migration safety, schema anti-patterns |
| `postgis-reviewer` | review | PostGIS detected | Spatial query correctness, SRID consistency, GeoDjango |

### Workflow (1)

| Agent | Category | Activation | Focus |
|-------|----------|------------|-------|
| `python-lint` | workflow | Always (Python project) | Runs ruff, mypy |

## Detection & Setup Mechanism

### Auto-detection Logic

```
1. Parse pyproject.toml / requirements.txt / setup.py for dependencies
2. Detect frameworks:
   - Django        → "django" in deps
   - DRF           → "djangorestframework" in deps
   - Django Ninja  → "django-ninja" in deps
   - Celery        → "celery" in deps
   - FastAPI       → "fastapi" in deps
   - SQLAlchemy    → "sqlalchemy" in deps
   - PostgreSQL    → psycopg2 / asyncpg / psycopg in deps
   - PostGIS       → django.contrib.gis in INSTALLED_APPS or geoalchemy2 in deps
   - Pydantic      → "pydantic" in deps (also implied by FastAPI)
3. Confirm: manage.py → Django; alembic.ini → SQLAlchemy
```

### Config File

`compound-engineering.local.md` written by setup skill:

```markdown
---
stack: python
frameworks:
  - django        # or fastapi, or both
  - drf
  - celery
database:
  - postgresql
  - postgis
review_agents:
  - python-style-reviewer
  - python-typing-reviewer
  - kieran-python-reviewer
  - django-reviewer
  - django-drf-reviewer
  - django-celery-reviewer
  - django-migration-reviewer
  - postgresql-reviewer
  - postgis-reviewer
  - pytest-reviewer
  - python-lint
  - code-simplicity-reviewer
  - security-sentinel
  - performance-oracle
plan_review_agents:
  - kieran-python-reviewer
  - code-simplicity-reviewer
---

# Review Context

Add project-specific review instructions here.
```

### Workflow Integration

1. `/workflows:review` reads `compound-engineering.local.md`
2. If not found, invokes `setup` skill (auto-detect + confirm)
3. Launches only the agents listed in `review_agents`

## Generic Component Adaptations

### Skills — keep and adapt where needed

| Skill | Action |
|-------|--------|
| `setup` | Rewrite for Python-only stack detection |
| `agent-native-architecture` | Adapt examples to Python |
| All other generic skills | Keep as-is (language-agnostic) |

### Commands — update references

| Command | Action |
|---------|--------|
| `/workflows:review` | Update agent lists for Python agents |
| `/workflows:work` | Update agent references |
| All other commands | Keep as-is |

### Agents — keep all generic ones

All research (5), generic review (7), design (3), and generic workflow agents (3) stay unchanged.

## Final Component Count

| Component | Before | Removed | Added | After |
|-----------|--------|---------|-------|-------|
| Agents | 29 | 7 | 12 | 34 |
| Skills | 19 | 4 | 10 | 25 |
| Commands | 22 | 1 | 0 | 21 |
| MCP Servers | 1 | 0 | 0 | 1 |
