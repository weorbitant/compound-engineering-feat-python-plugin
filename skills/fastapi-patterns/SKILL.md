---
name: fastapi-patterns
description: FastAPI core patterns for routes, dependency injection, async, auth, and OpenAPI. Use when working on projects with fastapi in their dependencies.
---

# FastAPI Patterns

Patterns and conventions for building FastAPI applications. Follow the principle of
explicit dependency injection, leverage async where it matters, and use Pydantic models
as the single source of truth for request/response schemas.

## Core Principles

- **Dependency injection everywhere** -- Use `Depends()` for database sessions, auth,
  config, and shared logic instead of global state or imports
- **Pydantic as contract** -- Define request and response models explicitly with Pydantic;
  avoid raw dicts in route signatures
- **Async when beneficial** -- Use `async def` for I/O-bound routes with async drivers;
  use plain `def` for CPU-bound or sync-only code
- **Router organization** -- Split routes into `APIRouter` modules by domain, compose them
  in the main app with prefixes and tags

## When to Use

Apply these patterns when working on any project that lists `fastapi` in its dependencies.
Detect this by checking `pyproject.toml`, `requirements.txt`, or `Pipfile` for FastAPI.

## Type Hints

Use `| None` instead of `Optional` for all type annotations:

```python
from fastapi import Query

async def list_items(
    category: str | None = Query(None, description="Filter by category"),
) -> list[ItemResponse]:
    ...
```

## Logging

Use emojis as prefixes in log messages:

```python
logger.info("✅ Request processed for %s", endpoint)
logger.warning("⚠️ Rate limit approaching for client %s", client_id)
logger.error("❌ Failed to connect to database: %s", exc)
```

## Project Structure

```
src/
├── main.py              # App factory, lifespan, router composition
├── config.py            # Settings with pydantic-settings
├── dependencies.py      # Shared dependencies (DB session, current user)
├── routes/
│   ├── __init__.py
│   ├── users.py         # APIRouter for user endpoints
│   └── items.py         # APIRouter for item endpoints
├── models/              # SQLAlchemy or ORM models
├── schemas/             # Pydantic request/response models
├── services/            # Business logic layer
└── middleware/           # Custom middleware
```

## Reference Documents

- [routes-di.md](./references/routes-di.md) -- Routes, dependency injection, middleware,
  error handling, OpenAPI customization, lifespan events
- [async-patterns.md](./references/async-patterns.md) -- Async/await patterns, background
  tasks, WebSockets, streaming, connection pooling, testing
- [auth.md](./references/auth.md) -- Authentication and authorization: OAuth2, JWT, API
  keys, RBAC, scopes, password hashing, CORS for auth
