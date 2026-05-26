# Stack Detection & Agent Computation

## Detection sources

`pyproject.toml`, `requirements.txt`, `setup.py`, `setup.cfg`, `Pipfile`

## Framework detection

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

## Confirmation signals

| File/Directory | Confirms |
|---------------|----------|
| `manage.py` | Django project |
| `alembic.ini` or `alembic/` | SQLAlchemy + Alembic |
| `celeryconfig.py` or `celery.py` | Celery |

## Agent computation

### Base agents (always)
`python-style-reviewer, python-typing-reviewer, pytest-reviewer, python-lint`

### Framework additions
- Django → `django-reviewer, django-migration-reviewer`
- DRF → `django-drf-reviewer`
- Django Ninja → (covered by `django-reviewer`)
- Celery → `django-celery-reviewer`
- FastAPI → `fastapi-reviewer`
- SQLAlchemy → `fastapi-sqlalchemy-reviewer`

### Database additions
- PostgreSQL → `postgresql-reviewer`
- PostGIS → `postgis-reviewer`

### Focus areas
- Security → `security-sentinel`
- Performance → `performance-oracle`
- Architecture → `architecture-strategist`
- Code simplicity → `code-simplicity-reviewer`

### Depth
- **Fast:** stack + `code-simplicity-reviewer` only
- **Thorough:** stack + all selected focus areas
- **Comprehensive:** thorough + `git-history-analyzer, data-integrity-guardian, agent-native-reviewer`

### Auto-configure defaults
Always include: `python-style-reviewer, python-typing-reviewer, pytest-reviewer, python-lint, code-simplicity-reviewer, security-sentinel, performance-oracle`

Plus framework/database additions from tables above.

### Plan review agents
Base Python reviewers + `code-simplicity-reviewer`.

## Workflow skill auto-mapping

| Detected | Skill |
|----------|-------|
| Django | `django-patterns` |
| DRF | `django-drf` |
| Celery | `django-async` |
| FastAPI | `fastapi-patterns` |
| SQLAlchemy | `fastapi-sqlalchemy` |
| PostgreSQL | `postgresql-patterns` |
| PostGIS | `postgis-patterns` |

Apply to all 4 workflows uniformly. Always add `pytest-patterns` to `work` and `review`.

## Output template

`compound-engineering.local.md`:

```markdown
---
review_agents: [{computed agent list}]
plan_review_agents: [{computed plan agent list}]
frameworks: [{detected or selected}]
database: [{detected or selected}]
workflow_skills:
  brainstorm: [{skill list}]
  plan: [{skill list}]
  work: [{skill list}]
  review: [{skill list}]
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

Omit `workflow_skills` block if user chose "Skip".
