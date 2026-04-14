# Python Specialization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the compound-engineering plugin into a Python-specialized tool by removing Ruby/Rails/TS/JS components, adding Django, FastAPI, pytest, Pydantic, PostgreSQL, and PostGIS skills and agents, and updating detection/workflow commands.

**Architecture:** Domain-based skills (reference docs with patterns) consumed by specialized review agents. Detection via `setup` skill auto-reads `pyproject.toml`/`requirements.txt` and writes `compound-engineering.local.md` with per-project agent lists. Workflow commands (`/workflows:review`, `/workflows:work`) read this config to dispatch only relevant agents.

**Tech Stack:** Markdown files (agents, skills, commands), YAML frontmatter, Claude Code plugin system.

**Design doc:** `docs/plans/2026-02-20-python-specialization-design.md`

---

## Task 1: Remove Ruby/Rails/TS/JS Components

**Files:**
- Delete: `agents/review/dhh-rails-reviewer.md`
- Delete: `agents/review/kieran-rails-reviewer.md`
- Delete: `agents/review/kieran-typescript-reviewer.md`
- Delete: `agents/review/julik-frontend-races-reviewer.md`
- Delete: `agents/workflow/lint.md`
- Delete: `agents/docs/ankane-readme-writer.md`
- Delete: `agents/workflow/every-style-editor.md`
- Delete: `skills/dhh-rails-style/` (entire directory)
- Delete: `skills/dspy-ruby/` (entire directory)
- Delete: `skills/andrew-kane-gem-writer/` (entire directory)
- Delete: `skills/every-style-editor/` (entire directory)
- Delete: `commands/test-xcode.md`

**Step 1: Delete all files**

```bash
# Agents
rm agents/review/dhh-rails-reviewer.md
rm agents/review/kieran-rails-reviewer.md
rm agents/review/kieran-typescript-reviewer.md
rm agents/review/julik-frontend-races-reviewer.md
rm agents/workflow/lint.md
rm agents/docs/ankane-readme-writer.md
rm agents/workflow/every-style-editor.md

# Skills (full directories)
rm -rf skills/dhh-rails-style/
rm -rf skills/dspy-ruby/
rm -rf skills/andrew-kane-gem-writer/
rm -rf skills/every-style-editor/

# Commands
rm commands/test-xcode.md
```

**Step 2: Verify deletions**

```bash
# Should return nothing for each
ls agents/review/dhh-rails-reviewer.md 2>&1
ls skills/dhh-rails-style/ 2>&1
ls commands/test-xcode.md 2>&1
```

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove Ruby/Rails/TS/JS-specific components

Remove 7 agents, 4 skills, and 1 command that are specific to
Ruby/Rails, TypeScript, JavaScript, or iOS development."
```

---

## Task 2: Create `python-style` Skill

**Files:**
- Create: `skills/python-style/SKILL.md`
- Create: `skills/python-style/references/conventions.md`
- Create: `skills/python-style/references/patterns.md`

**Step 1: Create skill directory**

```bash
mkdir -p skills/python-style/references
```

**Step 2: Write `SKILL.md`**

Create `skills/python-style/SKILL.md` with:

- YAML frontmatter: `name: python-style`, description about PEP 8 + project conventions
- Overview of the style guide scope
- Sections: naming conventions, import organization, string formatting, modern syntax (3.10+), error handling, module structure
- Links to [conventions.md](./references/conventions.md) and [patterns.md](./references/patterns.md)
- Key rules from CLAUDE.md: line length 100, `| None` not `Optional`, no unnecessary docstrings, descriptive names, imports at top

**Step 3: Write `references/conventions.md`**

Reference doc covering:
- PEP 8 conventions with project-specific overrides (line length 100)
- Type hint syntax: `list[str]` not `List[str]`, `str | None` not `Optional[str]`
- Import ordering: stdlib, third-party, local (absolute imports only)
- Naming: snake_case for functions/variables, PascalCase for classes, UPPER_CASE for constants
- f-strings for formatting (never % or .format())
- pathlib over os.path
- Context managers for resource management
- Properties over getters/setters

**Step 4: Write `references/patterns.md`**

Reference doc covering:
- List/dict comprehensions (when readable)
- Dataclasses vs Pydantic models (when to use each)
- Pattern matching (Python 3.10+)
- Walrus operator usage
- Protocols and ABCs for interfaces
- Enum patterns
- Logging with emojis (per CLAUDE.md)
- Module extraction signals

**Step 5: Commit**

```bash
git add skills/python-style/
git commit -m "feat: add python-style skill

PEP 8 + project conventions with references for conventions
and Pythonic patterns."
```

---

## Task 3: Create `python-typing` Skill

**Files:**
- Create: `skills/python-typing/SKILL.md`
- Create: `skills/python-typing/references/type-hints.md`
- Create: `skills/python-typing/references/pydantic-patterns.md`

**Step 1: Create skill directory**

```bash
mkdir -p skills/python-typing/references
```

**Step 2: Write `SKILL.md`**

Create `skills/python-typing/SKILL.md` with:

- YAML frontmatter: `name: python-typing`, description about type hints and Pydantic
- Overview: modern Python type system and Pydantic v2 data validation
- Sections: basic type hints, generics, Protocols, TypeVar, Pydantic models, validation
- Links to [type-hints.md](./references/type-hints.md) and [pydantic-patterns.md](./references/pydantic-patterns.md)

**Step 3: Write `references/type-hints.md`**

Reference doc covering:
- Function signatures: always type parameters and return values
- Modern syntax: `list[str]`, `dict[str, Any]`, `str | None`
- Generic types: `TypeVar`, bounded generics, parameterized classes
- Protocols for structural subtyping (duck typing with type safety)
- `TypeAlias` for complex types
- `TypedDict` for dictionary shapes
- `Literal` for constrained values
- `Annotated` for metadata-rich types
- `overload` for multiple signatures
- `TYPE_CHECKING` guard for circular imports
- mypy configuration best practices

**Step 4: Write `references/pydantic-patterns.md`**

Reference doc covering:
- Pydantic v2 BaseModel patterns
- Field definitions: `Field(...)` with validators
- `model_validator` (before/after modes)
- `field_validator` patterns
- Custom types with `__get_pydantic_core_schema__`
- Nested models and forward references
- Model serialization: `model_dump()`, `model_dump_json()`
- Settings management: `BaseSettings`
- Discriminated unions
- Generic models
- Integration with FastAPI and Django (via django-ninja)

**Step 5: Commit**

```bash
git add skills/python-typing/
git commit -m "feat: add python-typing skill

Type hints reference and Pydantic v2 patterns."
```

---

## Task 4: Create `django-patterns` Skill

**Files:**
- Create: `skills/django-patterns/SKILL.md`
- Create: `skills/django-patterns/references/models.md`
- Create: `skills/django-patterns/references/views.md`
- Create: `skills/django-patterns/references/admin-signals-middleware.md`
- Create: `skills/django-patterns/references/ninja.md`

**Step 1: Create skill directory**

```bash
mkdir -p skills/django-patterns/references
```

**Step 2: Write `SKILL.md`**

Create `skills/django-patterns/SKILL.md` with:

- YAML frontmatter: `name: django-patterns`, description about Django core patterns
- Overview: Django ORM, views, URL routing, admin, signals, middleware, Django Ninja
- Links to all 4 reference docs
- When to use: projects with `django` in dependencies
- Key principles: fat models thin views, explicit over implicit, follow Django conventions

**Step 3: Write `references/models.md`**

Reference doc covering:
- Model field design (choices, constraints, indexes, Meta class)
- QuerySet patterns: custom managers, `select_related`/`prefetch_related`, `Q` objects, `F` expressions
- Model methods vs manager methods vs QuerySet methods
- Signals: when to use (sparingly), `post_save`, `pre_save`, `post_delete`
- Abstract models and mixins (TimeStampedModel, etc.)
- Database constraints: `UniqueConstraint`, `CheckConstraint`
- Migration best practices: data migrations, RunPython, backwards compatibility

**Step 4: Write `references/views.md`**

Reference doc covering:
- Function-based views vs class-based views (when to use each)
- CBV mixins: `LoginRequiredMixin`, `PermissionRequiredMixin`
- URL routing: `path()`, `include()`, namespaces, URL naming conventions
- Forms: `ModelForm`, custom validation, form sets
- Template patterns: template inheritance, context processors
- Middleware: request/response cycle, custom middleware structure
- Settings organization: base/local/production split

**Step 5: Write `references/admin-signals-middleware.md`**

Reference doc covering:
- Admin: `ModelAdmin`, `list_display`, `list_filter`, `search_fields`, inlines, custom actions
- Admin customization: custom templates, admin site branding
- Signals: `pre_save`, `post_save`, `pre_delete`, `post_delete`, `m2m_changed`
- Signal anti-patterns: circular signals, heavy logic in signals
- Middleware: order matters, `process_request`/`process_response`/`process_exception`
- Custom middleware: logging, rate limiting, request ID injection
- Management commands: `BaseCommand`, argument parsing, output handling

**Step 6: Write `references/ninja.md`**

Reference doc covering:
- Django Ninja router setup and API versioning
- Schema definitions (Pydantic models for input/output)
- Path/query parameters with type validation
- Authentication: API keys, JWT, session-based
- Error handling and custom exception handlers
- File uploads
- Pagination patterns
- Integration with Django ORM models
- Testing Ninja endpoints

**Step 7: Commit**

```bash
git add skills/django-patterns/
git commit -m "feat: add django-patterns skill

Django core patterns covering models, views, admin, signals,
middleware, and Django Ninja integration."
```

---

## Task 5: Create `django-drf` Skill

**Files:**
- Create: `skills/django-drf/SKILL.md`
- Create: `skills/django-drf/references/serializers.md`
- Create: `skills/django-drf/references/viewsets.md`
- Create: `skills/django-drf/references/permissions-auth.md`

**Step 1: Create skill directory**

```bash
mkdir -p skills/django-drf/references
```

**Step 2: Write `SKILL.md`**

- YAML frontmatter: `name: django-drf`, description about Django REST Framework patterns
- Overview: serializers, viewsets, routers, permissions, authentication
- When to use: projects with `djangorestframework` in dependencies
- Links to all 3 reference docs

**Step 3: Write `references/serializers.md`**

Reference doc covering:
- `ModelSerializer` vs `Serializer` (when to use each)
- Nested serializers and `depth` control
- `SerializerMethodField` patterns
- Validation: field-level, object-level, `UniqueTogetherValidator`
- Write vs read fields: `read_only_fields`, `write_only_fields`
- `to_representation` / `to_internal_value` customization
- Handling related objects: `PrimaryKeyRelatedField`, `SlugRelatedField`, nested writes
- Performance: `select_related` in viewset queryset, not in serializer

**Step 4: Write `references/viewsets.md`**

Reference doc covering:
- `ModelViewSet` vs `GenericViewSet` vs `ViewSet`
- Router registration and URL patterns
- Custom actions: `@action` decorator
- Filtering: `django-filter`, `SearchFilter`, `OrderingFilter`
- Pagination: `PageNumberPagination`, `CursorPagination`, custom pagination
- Throttling: `UserRateThrottle`, `AnonRateThrottle`, scoped throttles
- Content negotiation and versioning
- `get_queryset()` and `get_serializer_class()` patterns
- Bulk operations

**Step 5: Write `references/permissions-auth.md`**

Reference doc covering:
- Authentication: `TokenAuthentication`, `SessionAuthentication`, JWT (SimpleJWT)
- Permission classes: `IsAuthenticated`, `IsAdminUser`, custom permissions
- Object-level permissions
- Composing permissions: AND/OR logic
- DRF's `DEFAULT_AUTHENTICATION_CLASSES` and `DEFAULT_PERMISSION_CLASSES`
- API key authentication patterns
- OAuth2 integration
- Rate limiting per user/endpoint

**Step 6: Commit**

```bash
git add skills/django-drf/
git commit -m "feat: add django-drf skill

Django REST Framework patterns for serializers, viewsets,
permissions, and authentication."
```

---

## Task 6: Create `django-async` Skill

**Files:**
- Create: `skills/django-async/SKILL.md`
- Create: `skills/django-async/references/celery.md`
- Create: `skills/django-async/references/channels.md`

**Step 1: Create skill directory**

```bash
mkdir -p skills/django-async/references
```

**Step 2: Write `SKILL.md`**

- YAML frontmatter: `name: django-async`, description about Celery and Channels
- Overview: async task queues, WebSocket support, background processing
- When to use: projects with `celery` or `channels` in dependencies
- Links to reference docs

**Step 3: Write `references/celery.md`**

Reference doc covering:
- Celery app configuration with Django
- Task definition: `@shared_task`, `bind=True`, `base` classes
- Task patterns: idempotency, retry strategies (`autoretry_for`, `retry_backoff`)
- Beat scheduling: periodic tasks, crontab schedules
- Result backends: Redis, database, RPC
- Error handling: `on_failure`, `on_retry`, dead letter queues
- Task routing and queues
- Canvas patterns: chains, groups, chords
- Monitoring: Flower, custom signals
- Testing Celery tasks: `CELERY_ALWAYS_EAGER`, `task_always_eager`

**Step 4: Write `references/channels.md`**

Reference doc covering:
- ASGI setup with Django Channels
- Consumer types: `WebsocketConsumer`, `AsyncWebsocketConsumer`, `JsonWebsocketConsumer`
- Channel layers: Redis backend, `channel_layer.group_send`
- Routing: `URLRouter`, `ProtocolTypeRouter`
- Authentication in WebSocket connections
- Group management: `group_add`, `group_discard`, `group_send`
- Testing consumers: `WebsocketCommunicator`
- Integration with Celery for long-running tasks over WebSocket

**Step 5: Commit**

```bash
git add skills/django-async/
git commit -m "feat: add django-async skill

Celery task patterns and Django Channels WebSocket support."
```

---

## Task 7: Create `fastapi-patterns` Skill

**Files:**
- Create: `skills/fastapi-patterns/SKILL.md`
- Create: `skills/fastapi-patterns/references/routes-di.md`
- Create: `skills/fastapi-patterns/references/async-patterns.md`
- Create: `skills/fastapi-patterns/references/auth.md`

**Step 1: Create skill directory**

```bash
mkdir -p skills/fastapi-patterns/references
```

**Step 2: Write `SKILL.md`**

- YAML frontmatter: `name: fastapi-patterns`, description about FastAPI core patterns
- Overview: routes, DI, middleware, async, auth, OpenAPI
- When to use: projects with `fastapi` in dependencies
- Links to all 3 reference docs

**Step 3: Write `references/routes-di.md`**

Reference doc covering:
- Route definition: `@app.get`, `@app.post`, path/query parameters
- Router organization: `APIRouter`, `include_router`, tags, prefixes
- Dependency injection: `Depends()`, sub-dependencies, `yield` dependencies
- Request/response models with Pydantic
- Path operation configuration: `response_model`, `status_code`, `summary`
- Middleware: CORS, trusted hosts, custom middleware
- Error handling: `HTTPException`, custom exception handlers, `RequestValidationError`
- OpenAPI customization: operation IDs, descriptions, examples
- Lifespan events: `@asynccontextmanager` lifespan

**Step 4: Write `references/async-patterns.md`**

Reference doc covering:
- `async def` vs `def` routes (when to use each)
- Running sync code in async context: `run_in_executor`
- Background tasks: `BackgroundTasks` parameter
- WebSocket endpoints: connection lifecycle, broadcasting
- Streaming responses: `StreamingResponse`, SSE
- `asyncio` patterns: `gather`, `create_task`, `semaphore`
- Connection pooling with async: `asyncpg`, `aioredis`
- Testing async code: `pytest-asyncio`, `httpx.AsyncClient`

**Step 5: Write `references/auth.md`**

Reference doc covering:
- OAuth2 password flow: `OAuth2PasswordBearer`, `OAuth2PasswordRequestForm`
- JWT tokens: creation, validation, refresh tokens
- API key authentication: header-based, query parameter
- Dependency-based auth: `get_current_user` pattern
- Role-based access control (RBAC)
- Scopes and permission levels
- Security utilities: password hashing (`passlib`), token generation
- Cookie-based sessions
- CORS configuration for auth

**Step 6: Commit**

```bash
git add skills/fastapi-patterns/
git commit -m "feat: add fastapi-patterns skill

FastAPI core patterns for routes, dependency injection,
async patterns, and authentication."
```

---

## Task 8: Create `fastapi-sqlalchemy` Skill

**Files:**
- Create: `skills/fastapi-sqlalchemy/SKILL.md`
- Create: `skills/fastapi-sqlalchemy/references/sqlalchemy.md`
- Create: `skills/fastapi-sqlalchemy/references/alembic.md`

**Step 1: Create skill directory**

```bash
mkdir -p skills/fastapi-sqlalchemy/references
```

**Step 2: Write `SKILL.md`**

- YAML frontmatter: `name: fastapi-sqlalchemy`, description about SQLAlchemy 2.0 + Alembic
- Overview: async SQLAlchemy, session management, repository pattern, migrations
- When to use: projects with `sqlalchemy` in dependencies
- Links to reference docs

**Step 3: Write `references/sqlalchemy.md`**

Reference doc covering:
- SQLAlchemy 2.0 declarative models: `DeclarativeBase`, `Mapped`, `mapped_column`
- Async engine and session: `create_async_engine`, `async_sessionmaker`
- Session lifecycle in FastAPI: `yield` dependency for request-scoped sessions
- Query patterns: `select()`, `where()`, `join()`, `options()`
- Relationship loading: `selectinload`, `joinedload`, `subqueryload`
- Repository pattern implementation
- Transaction management
- Connection pooling: pool size, overflow, recycle
- Type-safe queries with 2.0 style
- Hybrid properties and computed columns

**Step 4: Write `references/alembic.md`**

Reference doc covering:
- Alembic setup with async SQLAlchemy
- Migration generation: `alembic revision --autogenerate`
- Migration scripts: `upgrade()`, `downgrade()`, `op.` operations
- Data migrations: `op.execute()`, bulk operations
- Migration best practices: small migrations, no business logic
- Branching and merging migrations
- Testing migrations: up/down verification
- Environment configuration: `env.py` setup for async
- Migration in CI/CD pipelines
- Zero-downtime migrations: add column, backfill, make non-null

**Step 5: Commit**

```bash
git add skills/fastapi-sqlalchemy/
git commit -m "feat: add fastapi-sqlalchemy skill

SQLAlchemy 2.0 async patterns and Alembic migration management."
```

---

## Task 9: Create `pytest-patterns` Skill

**Files:**
- Create: `skills/pytest-patterns/SKILL.md`
- Create: `skills/pytest-patterns/references/fixtures-parametrize.md`
- Create: `skills/pytest-patterns/references/mocking.md`
- Create: `skills/pytest-patterns/references/async-testing.md`

**Step 1: Create skill directory**

```bash
mkdir -p skills/pytest-patterns/references
```

**Step 2: Write `SKILL.md`**

- YAML frontmatter: `name: pytest-patterns`, description about pytest testing patterns
- Overview: fixtures, parametrize, mocking, async testing, factory_boy
- Key rules from CLAUDE.md: plain test functions (no TestCase classes), fixtures for setup, shared fixtures in conftest.py, use poetry + workspace/.venv
- Links to all 3 reference docs

**Step 3: Write `references/fixtures-parametrize.md`**

Reference doc covering:
- Fixture scopes: `function`, `class`, `module`, `session`
- Fixture factories (fixtures that return factories)
- `conftest.py` hierarchy and shared fixtures
- `@pytest.mark.parametrize`: single/multiple parameters, indirect
- Fixture finalization: `yield` fixtures, `request.addfinalizer`
- `factory_boy` integration: `DjangoModelFactory`, `SubFactory`, `LazyAttribute`
- `tmp_path` and `tmp_path_factory` for file-based tests
- `monkeypatch` for environment variables and attributes
- Markers: `pytest.mark.slow`, `pytest.mark.integration`, custom markers
- `pytest.ini` / `pyproject.toml` configuration

**Step 4: Write `references/mocking.md`**

Reference doc covering:
- `unittest.mock.patch` and `pytest-mock`'s `mocker` fixture
- `Mock` vs `MagicMock` vs `AsyncMock`
- Patching targets: `where to patch` (import path of usage, not definition)
- `side_effect` for conditional returns or exceptions
- `spec=True` for type-safe mocks
- `call_args`, `call_count`, `assert_called_with`
- Mocking external APIs: `responses` library, `httpx` mock
- Django test client: `client` fixture, `APIClient` for DRF
- FastAPI: `TestClient` from Starlette, `httpx.AsyncClient` with `ASGITransport`
- When NOT to mock: prefer integration tests for DB, use factories

**Step 5: Write `references/async-testing.md`**

Reference doc covering:
- `pytest-asyncio`: `@pytest.mark.asyncio`, `asyncio_mode = "auto"`
- Async fixtures: `@pytest_asyncio.fixture`
- Testing async FastAPI endpoints with `httpx.AsyncClient`
- Testing Celery tasks: `CELERY_ALWAYS_EAGER`, mocking `delay()`
- Testing Django async views
- Testing WebSocket consumers: `WebsocketCommunicator`
- `anyio` for backend-agnostic async tests
- Event loop configuration and isolation
- Database fixtures for async tests: `@pytest.fixture` with async session

**Step 6: Commit**

```bash
git add skills/pytest-patterns/
git commit -m "feat: add pytest-patterns skill

Pytest testing patterns for fixtures, mocking, and async testing."
```

---

## Task 10: Create `postgresql-patterns` Skill

**Files:**
- Create: `skills/postgresql-patterns/SKILL.md`
- Create: `skills/postgresql-patterns/references/schema-indexing.md`
- Create: `skills/postgresql-patterns/references/query-optimization.md`
- Create: `skills/postgresql-patterns/references/monitoring.md`

**Step 1: Create skill directory**

```bash
mkdir -p skills/postgresql-patterns/references
```

**Step 2: Write `SKILL.md`**

- YAML frontmatter: `name: postgresql-patterns`, description about PostgreSQL optimization and management
- Overview: schema design, indexing, query optimization, monitoring, migrations
- When to use: projects with `psycopg2`/`asyncpg`/`psycopg` in dependencies
- Links to all 3 reference docs

**Step 3: Write `references/schema-indexing.md`**

Reference doc covering:
- Data types: choosing the right type, `UUID`, `JSONB`, `ARRAY`, `CITEXT`
- Index types: B-tree, GIN (for JSONB, full-text, arrays), GiST (spatial, range), Hash, BRIN
- Partial indexes: `WHERE` clause, conditional indexes
- Composite indexes: column order matters, covering indexes (`INCLUDE`)
- Unique constraints vs unique indexes
- Foreign key design: cascading, deferrable constraints
- Partitioning: range, list, hash partitioning, partition pruning
- JSONB: operators (`->`, `->>`, `@>`, `?`), indexing JSONB with GIN
- Table inheritance vs partitioning
- Connection pooling: PgBouncer, transaction vs session mode

**Step 4: Write `references/query-optimization.md`**

Reference doc covering:
- `EXPLAIN ANALYZE` reading: seq scan, index scan, bitmap scan, nested loop, hash join, merge join
- Cost estimation: `seq_page_cost`, `random_page_cost`, row estimates
- Common anti-patterns: `SELECT *`, missing indexes, implicit casts, OR vs UNION
- CTEs: materialized vs inline, recursive CTEs
- Window functions: `ROW_NUMBER`, `RANK`, `LAG`/`LEAD`, running totals
- Batch operations: `INSERT ... ON CONFLICT`, `COPY`, `unnest`
- Locking: row-level, table-level, advisory locks, `SELECT FOR UPDATE SKIP LOCKED`
- Django ORM: `select_related` → JOIN, `prefetch_related` → IN, `.only()`, `.defer()`
- SQLAlchemy: eager loading, `contains_eager`, query compilation

**Step 5: Write `references/monitoring.md`**

Reference doc covering:
- `pg_stat_user_tables`: seq scans, index usage ratio, dead tuples
- `pg_stat_user_indexes`: index usage, unused indexes
- `pg_stat_statements`: slow queries, most frequent queries, total time
- `pg_stat_activity`: active queries, locks, idle connections
- Vacuum: autovacuum tuning, `VACUUM ANALYZE`, dead tuple management
- Bloat detection: table bloat, index bloat, `pgstattuple`
- Replication monitoring: lag, slot management
- Lock monitoring: lock waits, deadlock detection
- Performance baselines and alerting thresholds
- Query logging: `log_min_duration_statement`, `auto_explain`

**Step 6: Commit**

```bash
git add skills/postgresql-patterns/
git commit -m "feat: add postgresql-patterns skill

PostgreSQL schema design, query optimization, and monitoring."
```

---

## Task 11: Create `postgis-patterns` Skill

**Files:**
- Create: `skills/postgis-patterns/SKILL.md`
- Create: `skills/postgis-patterns/references/spatial-queries.md`
- Create: `skills/postgis-patterns/references/geodjango.md`

**Step 1: Create skill directory**

```bash
mkdir -p skills/postgis-patterns/references
```

**Step 2: Write `SKILL.md`**

- YAML frontmatter: `name: postgis-patterns`, description about PostGIS spatial data patterns
- Overview: geometry/geography types, spatial queries, GeoDjango, GeoAlchemy2
- When to use: projects with `django.contrib.gis` or `geoalchemy2` in dependencies
- Links to reference docs

**Step 3: Write `references/spatial-queries.md`**

Reference doc covering:
- Geometry vs Geography types (when to use each)
- Coordinate reference systems: SRID 4326 (WGS84), `ST_Transform`
- Spatial indexes: GiST for geometry, SP-GiST for points
- Common ST_ functions: `ST_Distance`, `ST_DWithin`, `ST_Contains`, `ST_Intersects`, `ST_Area`, `ST_Buffer`
- Distance queries: `ST_DWithin` (indexed) vs `ST_Distance` (not indexed)
- GeoJSON: `ST_AsGeoJSON`, `ST_GeomFromGeoJSON`
- Spatial joins: `ST_Intersects` in JOIN clauses
- Bounding box queries: `&&` operator
- Nearest neighbor: `<->` operator with KNN GiST
- Performance: geography vs geometry for distance, index usage

**Step 4: Write `references/geodjango.md`**

Reference doc covering:
- GeoDjango setup: `GDAL`, `GEOS`, `PROJ` dependencies
- Spatial model fields: `PointField`, `PolygonField`, `MultiPolygonField`, `LineStringField`
- Spatial lookups: `__contains`, `__within`, `__distance_lte`, `__intersects`
- `GeoManager` and spatial querysets
- `Distance` and `D` objects for distance queries
- Serialization: GeoJSON serializer, DRF-GIS
- Admin integration: `GeoModelAdmin`, `OSMGeoAdmin`
- Forms: `PointWidget`, `OSMWidget`
- GeoAlchemy2 alternative: `Geometry` column type, spatial functions
- Testing spatial queries: fixture data with WKT/GeoJSON

**Step 5: Commit**

```bash
git add skills/postgis-patterns/
git commit -m "feat: add postgis-patterns skill

PostGIS spatial queries and GeoDjango/GeoAlchemy2 integration."
```

---

## Task 12: Create Python Core Review Agents

**Files:**
- Create: `agents/review/python-style-reviewer.md`
- Create: `agents/review/python-typing-reviewer.md`

**Step 1: Write `python-style-reviewer.md`**

Follow the agent pattern (see `security-sentinel.md` for structure):
- YAML frontmatter: `name: python-style-reviewer`, description, `model: inherit`
- 2-3 examples in `<examples>` tags
- Role: Python style expert enforcing PEP 8 + project conventions
- Review checklist:
  1. Import organization (stdlib → third-party → local, absolute imports)
  2. Naming conventions (snake_case, PascalCase, descriptive names)
  3. String formatting (f-strings only)
  4. Modern syntax (3.10+ features, `| None`, `list[str]`)
  5. Line length (100 chars max)
  6. Module structure (no mid-file imports, logical grouping)
  7. Error handling (specific exceptions, context managers)
  8. Anti-patterns: bare `except`, mutable default args, `import *`
- Output format: categorized findings with severity and file locations
- Reference: link to `python-style` skill for detailed conventions

**Step 2: Write `python-typing-reviewer.md`**

- YAML frontmatter: `name: python-typing-reviewer`, description, `model: inherit`
- 2-3 examples
- Role: Type safety specialist reviewing type annotations and Pydantic models
- Review checklist:
  1. All function parameters and return types annotated
  2. Modern syntax: `list[str]` not `List[str]`, `str | None` not `Optional[str]`
  3. Pydantic model design: proper field definitions, validators
  4. Protocol usage for interfaces
  5. Generic type correctness
  6. `TypedDict` for dictionary shapes
  7. Missing `TYPE_CHECKING` guards for circular imports
  8. Overuse of `Any` (flag unless justified)
- Reference: link to `python-typing` skill

**Step 3: Commit**

```bash
git add agents/review/python-style-reviewer.md agents/review/python-typing-reviewer.md
git commit -m "feat: add Python core review agents

python-style-reviewer for PEP 8 and conventions.
python-typing-reviewer for type hints and Pydantic."
```

---

## Task 13: Create Django Review Agents

**Files:**
- Create: `agents/review/django-reviewer.md`
- Create: `agents/review/django-drf-reviewer.md`
- Create: `agents/review/django-celery-reviewer.md`
- Create: `agents/review/django-migration-reviewer.md`

**Step 1: Write `django-reviewer.md`**

- YAML frontmatter: `name: django-reviewer`, description, `model: inherit`
- 2-3 examples
- Role: Django architecture specialist
- Review checklist:
  1. Model design: field types, constraints, indexes, Meta options
  2. View patterns: CBV vs FBV appropriateness, mixin usage
  3. URL routing: naming, namespaces, RESTful patterns
  4. Forms: validation, CSRF, `ModelForm` usage
  5. Admin: registered models, customization quality
  6. Signals: sparingly used, no circular dependencies
  7. Middleware: order, performance impact
  8. Settings: sensitive data not hardcoded, proper env handling
  9. Django Ninja: schema design, router organization
- Reference: link to `django-patterns` skill

**Step 2: Write `django-drf-reviewer.md`**

- YAML frontmatter: `name: django-drf-reviewer`, description, `model: inherit`
- 2-3 examples
- Role: DRF API specialist
- Review checklist:
  1. Serializer design: ModelSerializer vs Serializer, nested depth
  2. Viewset queryset optimization: `select_related`/`prefetch_related`
  3. Permission classes: proper scoping, object-level permissions
  4. Pagination and filtering configuration
  5. Throttling: appropriate rate limits
  6. API versioning consistency
  7. Error response format consistency
  8. Authentication: proper classes, token management
- Reference: link to `django-drf` skill

**Step 3: Write `django-celery-reviewer.md`**

- YAML frontmatter: `name: django-celery-reviewer`, description, `model: inherit`
- 2-3 examples
- Role: Celery task design specialist
- Review checklist:
  1. Task idempotency: can the task be safely retried?
  2. Error handling: `autoretry_for`, `max_retries`, `retry_backoff`
  3. Task granularity: not too large, not too small
  4. Result backend usage: needed or wasteful?
  5. Queue routing: proper queue assignment
  6. Serialization: JSON-safe arguments (no ORM objects)
  7. Transaction safety: task dispatch inside/outside transactions
  8. Beat schedule: proper crontab, no overlapping runs
  9. Monitoring: logging, error tracking
- Reference: link to `django-async` skill

**Step 4: Write `django-migration-reviewer.md`**

- YAML frontmatter: `name: django-migration-reviewer`, description, `model: inherit`
- 2-3 examples
- Role: Migration safety specialist
- Review checklist:
  1. Reversibility: can the migration be rolled back?
  2. Data migration safety: `RunPython` with reverse function
  3. No data loss: default values, nullable transitions
  4. Lock impact: `AddField` with default (Django 5+ safe), `AddIndex` concurrently
  5. Large table handling: batch operations, no full-table locks
  6. Dependency ordering: proper `dependencies` list
  7. Squash candidates: too many small migrations
  8. Schema vs data: separate schema and data migrations
  9. Zero-downtime: add nullable → backfill → make non-null → deploy
- Reference: link to `django-patterns` skill (models.md)

**Step 5: Commit**

```bash
git add agents/review/django-reviewer.md agents/review/django-drf-reviewer.md \
      agents/review/django-celery-reviewer.md agents/review/django-migration-reviewer.md
git commit -m "feat: add Django review agents

django-reviewer, django-drf-reviewer, django-celery-reviewer,
and django-migration-reviewer."
```

---

## Task 14: Create FastAPI Review Agents

**Files:**
- Create: `agents/review/fastapi-reviewer.md`
- Create: `agents/review/fastapi-sqlalchemy-reviewer.md`

**Step 1: Write `fastapi-reviewer.md`**

- YAML frontmatter: `name: fastapi-reviewer`, description, `model: inherit`
- 2-3 examples
- Role: FastAPI architecture specialist
- Review checklist:
  1. Route design: proper HTTP methods, status codes, response models
  2. Dependency injection: `Depends()` usage, lifecycle management
  3. Async correctness: no blocking calls in `async def` routes
  4. Error handling: `HTTPException` with proper codes, custom handlers
  5. Pydantic models: input/output separation, validation
  6. Middleware: CORS, trusted hosts, custom middleware
  7. OpenAPI: operation IDs, descriptions, examples
  8. Auth: proper security scheme, dependency-based auth
  9. Background tasks: appropriate use, not for critical work
  10. WebSocket: connection lifecycle, error handling
- Reference: link to `fastapi-patterns` skill

**Step 2: Write `fastapi-sqlalchemy-reviewer.md`**

- YAML frontmatter: `name: fastapi-sqlalchemy-reviewer`, description, `model: inherit`
- 2-3 examples
- Role: SQLAlchemy integration specialist
- Review checklist:
  1. Session lifecycle: request-scoped via `Depends`, proper cleanup
  2. Model design: `DeclarativeBase`, `Mapped`, `mapped_column`
  3. Query patterns: 2.0 style `select()`, no legacy 1.x patterns
  4. Relationship loading: explicit strategy, N+1 prevention
  5. Transaction boundaries: proper commit/rollback
  6. Connection pool: appropriate settings for workload
  7. Alembic migrations: autogenerate accuracy, manual review
  8. Async engine: proper async session factory
- Reference: link to `fastapi-sqlalchemy` skill

**Step 3: Commit**

```bash
git add agents/review/fastapi-reviewer.md agents/review/fastapi-sqlalchemy-reviewer.md
git commit -m "feat: add FastAPI review agents

fastapi-reviewer and fastapi-sqlalchemy-reviewer."
```

---

## Task 15: Create Testing and Database Agents

**Files:**
- Create: `agents/review/pytest-reviewer.md`
- Create: `agents/review/postgresql-reviewer.md`
- Create: `agents/review/postgis-reviewer.md`

**Step 1: Write `pytest-reviewer.md`**

- YAML frontmatter: `name: pytest-reviewer`, description, `model: inherit`
- 2-3 examples
- Role: Test quality specialist
- Review checklist:
  1. Test structure: plain functions (no TestCase classes per CLAUDE.md)
  2. Fixture design: proper scoping, shared fixtures in conftest.py
  3. Test isolation: no inter-test dependencies
  4. Assertion quality: specific assertions, good error messages
  5. Coverage gaps: untested branches, edge cases
  6. Mocking discipline: mock at boundaries, not internal details
  7. Parametrize usage: for similar test cases
  8. Naming: `test_<what>_<condition>_<expected>` pattern
  9. Factory usage: factory_boy for model creation
  10. Async tests: proper `pytest-asyncio` usage
- Reference: link to `pytest-patterns` skill

**Step 2: Write `postgresql-reviewer.md`**

- YAML frontmatter: `name: postgresql-reviewer`, description, `model: inherit`
- 2-3 examples
- Role: Database performance specialist
- Review checklist:
  1. Missing indexes on filtered/joined columns
  2. N+1 queries in ORM code
  3. Full-table scans on large tables
  4. Migration safety: locking, zero-downtime
  5. JSONB: proper indexing with GIN
  6. Connection pooling configuration
  7. Transaction scope: too broad or too narrow
  8. Dead tuple management: vacuum settings
  9. Query anti-patterns: `SELECT *`, implicit casts, OR vs UNION
  10. Partitioning candidates for large tables
- Reference: link to `postgresql-patterns` skill

**Step 3: Write `postgis-reviewer.md`**

- YAML frontmatter: `name: postgis-reviewer`, description, `model: inherit`
- 2-3 examples
- Role: Spatial data specialist
- Review checklist:
  1. SRID consistency: all geometries use same SRID or explicit transforms
  2. Geometry vs Geography: correct type for the use case
  3. Spatial index usage: GiST indexes on geometry columns
  4. Distance queries: `ST_DWithin` (indexed) vs `ST_Distance` (not indexed)
  5. GeoJSON handling: proper serialization/deserialization
  6. GeoDjango lookups: using spatial lookups correctly
  7. Coordinate order: lon/lat vs lat/lon consistency
  8. Performance: bounding box pre-filter before expensive operations
- Reference: link to `postgis-patterns` skill

**Step 4: Commit**

```bash
git add agents/review/pytest-reviewer.md agents/review/postgresql-reviewer.md \
      agents/review/postgis-reviewer.md
git commit -m "feat: add testing and database review agents

pytest-reviewer, postgresql-reviewer, and postgis-reviewer."
```

---

## Task 16: Create `python-lint` Workflow Agent

**Files:**
- Create: `agents/workflow/python-lint.md`

**Step 1: Write `python-lint.md`**

- YAML frontmatter: `name: python-lint`, description about running ruff and mypy, `model: haiku` (like the old `lint` agent — lint agents are cost-efficient with haiku)
- 2-3 examples
- Role: Python linting and type checking agent
- Process:
  1. Detect project structure (src layout vs flat)
  2. Run `ruff check .` for linting (or `poetry run ruff check .`)
  3. Run `ruff format --check .` for formatting
  4. Run `mypy .` (or `poetry run mypy .`) for type checking
  5. Parse output, categorize issues by severity
  6. Report findings with file locations and fix suggestions
  7. Optionally auto-fix with `ruff check --fix .`

**Step 2: Commit**

```bash
git add agents/workflow/python-lint.md
git commit -m "feat: add python-lint workflow agent

Runs ruff linting/formatting and mypy type checking."
```

---

## Task 17: Update `setup` Skill for Python Detection

**Files:**
- Modify: `skills/setup/SKILL.md`

**Step 1: Rewrite `SKILL.md`**

Replace the current setup skill content with Python-focused detection:

- Remove all Ruby/Rails/TypeScript detection logic
- Update auto-detection to scan `pyproject.toml`, `requirements.txt`, `setup.py`:
  ```
  django → "django" in deps
  drf → "djangorestframework" in deps
  ninja → "django-ninja" in deps
  celery → "celery" in deps
  fastapi → "fastapi" in deps
  sqlalchemy → "sqlalchemy" in deps
  postgresql → psycopg2 / asyncpg / psycopg in deps
  postgis → django.contrib.gis in INSTALLED_APPS or geoalchemy2 in deps
  pydantic → "pydantic" in deps
  ```
- Confirm: `manage.py` → Django, `alembic.ini` → SQLAlchemy
- Update auto-configure defaults:
  - Always: `[python-style-reviewer, python-typing-reviewer, kieran-python-reviewer, pytest-reviewer, python-lint, code-simplicity-reviewer, security-sentinel, performance-oracle]`
  - If Django: add `[django-reviewer, django-migration-reviewer]`
  - If DRF: add `[django-drf-reviewer]`
  - If Celery: add `[django-celery-reviewer]`
  - If FastAPI: add `[fastapi-reviewer]`
  - If SQLAlchemy: add `[fastapi-sqlalchemy-reviewer]`
  - If PostgreSQL: add `[postgresql-reviewer]`
  - If PostGIS: add `[postgis-reviewer]`
- Update customize options: stack choices are Django, FastAPI, or both
- Update focus areas to include database-specific options
- Update config file format with `frameworks` and `database` fields

**Step 2: Commit**

```bash
git add skills/setup/SKILL.md
git commit -m "feat: rewrite setup skill for Python-only detection

Auto-detects Django, FastAPI, DRF, Celery, SQLAlchemy,
PostgreSQL, PostGIS, and Pydantic from project dependencies."
```

---

## Task 18: Update `workflows:review` Command

**Files:**
- Modify: `commands/workflows/review.md`

**Step 1: Update agent references**

- In the Summary Report example: replace `kieran-rails-reviewer` with `kieran-python-reviewer`
- In conditional agents section: update migration detection from `db/migrate/*.rb` or `db/schema.rb` to Django migration patterns (`*/migrations/*.py`) and Alembic (`alembic/versions/*.py`)
- Update conditional agents: replace `schema-drift-detector` references (Rails schema.rb specific) with Django/Alembic migration checks
- In end-to-end testing section: remove iOS/Xcode option, keep web testing only
- Remove references to Ruby-specific grep commands in security-sentinel examples
- Update tagging: replace `rails` tag with `django`, `fastapi`, `python`

**Step 2: Commit**

```bash
git add commands/workflows/review.md
git commit -m "feat: update workflows:review for Python stack

Replace Ruby/Rails references with Django/FastAPI/Python.
Remove iOS testing option."
```

---

## Task 19: Update `workflows:work` Command

**Files:**
- Modify: `commands/workflows/work.md`

**Step 1: Update Python-specific references**

- In Phase 2 test commands: change examples from `bin/rails test, npm test` to `pytest, poetry run pytest`
- In Quality Check: update linting reference to `python-lint` agent
- Remove Figma design sync references or keep as optional (still relevant for web UI work)
- Keep `agent-browser` references (still relevant for Python web apps)

**Step 2: Commit**

```bash
git add commands/workflows/work.md
git commit -m "feat: update workflows:work for Python stack

Update test and lint commands to pytest and ruff/mypy."
```

---

## Task 20: Update `agent-native-architecture` Skill

**Files:**
- Modify: `skills/agent-native-architecture/SKILL.md`
- Modify relevant reference files if they contain Ruby/Swift examples

**Step 1: Review SKILL.md and references**

Read through the skill and its references. Where examples use Swift/iOS or Ruby/Rails code, adapt them to use Python/Django/FastAPI equivalents. Keep the concepts identical — only change the language of the examples.

**Step 2: Commit**

```bash
git add skills/agent-native-architecture/
git commit -m "refactor: adapt agent-native-architecture examples to Python

Replace Swift/iOS and Ruby/Rails examples with Python equivalents."
```

---

## Task 21: Update Metadata Files

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Step 1: Update `plugin.json`**

- Bump version to `2.0.0` (major: breaking change, full Ruby removal)
- Update description: "Python-specialized development tools. 34 agents, 21 commands, 25 skills, 1 MCP server."
- Update keywords: remove `workflow-automation`, add `django`, `fastapi`, `pytest`, `pydantic`, `postgresql`

**Step 2: Update `README.md`**

- Update title and description
- Update component count table: 34 agents, 21 commands, 25 skills, 1 MCP server
- Remove all Ruby/Rails/TS/JS agents from tables
- Add new Python agents to tables under new categories:
  - Python Core (2), Django (4), FastAPI (2), Testing (1), Database (2), Workflow (1)
- Remove Ruby/Rails skills from tables
- Add new Python skills under categories:
  - Python Core (2), Django (3), FastAPI (2), Testing (1), Database (2)
- Remove `/test-xcode` from commands table
- Update installation section if needed
- Remove references to Ruby gems, Bundler, etc.

**Step 3: Update `CHANGELOG.md`**

Add new entry at top:

```markdown
## [2.0.0] - 2026-02-20

### Breaking Changes

- **Full Python specialization** — Removed all Ruby/Rails, TypeScript, and JavaScript-specific components
- **Removed agents:** dhh-rails-reviewer, kieran-rails-reviewer, kieran-typescript-reviewer, julik-frontend-races-reviewer, lint (Ruby), ankane-readme-writer, every-style-editor
- **Removed skills:** dhh-rails-style, dspy-ruby, andrew-kane-gem-writer, every-style-editor
- **Removed commands:** /test-xcode

### Added

- **`python-style` skill** — PEP 8 + project conventions
- **`python-typing` skill** — Type hints and Pydantic v2 patterns
- **`django-patterns` skill** — Models, views, admin, signals, middleware, Django Ninja
- **`django-drf` skill** — Django REST Framework patterns
- **`django-async` skill** — Celery tasks and Django Channels
- **`fastapi-patterns` skill** — Routes, DI, async, auth
- **`fastapi-sqlalchemy` skill** — SQLAlchemy 2.0 async and Alembic
- **`pytest-patterns` skill** — Fixtures, mocking, async testing
- **`postgresql-patterns` skill** — Schema, queries, monitoring
- **`postgis-patterns` skill** — Spatial queries, GeoDjango, GeoAlchemy2
- **`python-style-reviewer` agent** — PEP 8 and convention compliance
- **`python-typing-reviewer` agent** — Type hint and Pydantic review
- **`django-reviewer` agent** — Django core patterns review
- **`django-drf-reviewer` agent** — DRF API review
- **`django-celery-reviewer` agent** — Celery task design review
- **`django-migration-reviewer` agent** — Migration safety review
- **`fastapi-reviewer` agent** — FastAPI architecture review
- **`fastapi-sqlalchemy-reviewer` agent** — SQLAlchemy integration review
- **`pytest-reviewer` agent** — Test quality review
- **`postgresql-reviewer` agent** — Database performance review
- **`postgis-reviewer` agent** — Spatial data review
- **`python-lint` agent** — ruff and mypy linting

### Changed

- **`setup` skill** — Rewritten for Python-only stack detection (Django, FastAPI, DRF, Celery, SQLAlchemy, PostgreSQL, PostGIS, Pydantic)
- **`/workflows:review`** — Updated for Python agents, Django/Alembic migration detection
- **`/workflows:work`** — Updated test/lint commands for pytest and ruff
- **`agent-native-architecture` skill** — Examples adapted to Python
```

**Step 4: Commit**

```bash
git add .claude-plugin/plugin.json README.md CHANGELOG.md
git commit -m "docs: update metadata for v2.0.0 Python specialization

Bump to 2.0.0, update component counts, changelog, and README
with all new Python components and removed Ruby/Rails ones."
```

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Remove Ruby/Rails/TS/JS components | None |
| 2 | Create `python-style` skill | None |
| 3 | Create `python-typing` skill | None |
| 4 | Create `django-patterns` skill | None |
| 5 | Create `django-drf` skill | None |
| 6 | Create `django-async` skill | None |
| 7 | Create `fastapi-patterns` skill | None |
| 8 | Create `fastapi-sqlalchemy` skill | None |
| 9 | Create `pytest-patterns` skill | None |
| 10 | Create `postgresql-patterns` skill | None |
| 11 | Create `postgis-patterns` skill | None |
| 12 | Create Python core review agents | Tasks 2, 3 |
| 13 | Create Django review agents | Tasks 4, 5, 6 |
| 14 | Create FastAPI review agents | Tasks 7, 8 |
| 15 | Create testing and database agents | Tasks 9, 10, 11 |
| 16 | Create `python-lint` workflow agent | None |
| 17 | Update `setup` skill | Tasks 12-16 |
| 18 | Update `workflows:review` | Task 17 |
| 19 | Update `workflows:work` | Task 17 |
| 20 | Update `agent-native-architecture` | None |
| 21 | Update metadata files | Tasks 1-20 |

**Parallelization:** Tasks 1-11 and 16, 20 are independent and can run in parallel. Tasks 12-15 depend on their respective skills. Tasks 17-19 depend on all agents being created. Task 21 is the final metadata update.
