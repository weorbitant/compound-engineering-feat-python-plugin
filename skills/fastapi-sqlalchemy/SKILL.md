---
name: fastapi-sqlalchemy
description: Async SQLAlchemy 2.0 patterns with FastAPI and Alembic migration management. Use when working on FastAPI projects with sqlalchemy in their dependencies.
model: haiku
---

# FastAPI + SQLAlchemy

Patterns for building FastAPI applications with async SQLAlchemy 2.0 and Alembic migrations.
Covers session management, repository pattern, relationship loading, transaction handling,
and zero-downtime migration strategies.

## Core Principles

- **Async-first** -- Use `create_async_engine` and `async_sessionmaker` for non-blocking I/O
- **Request-scoped sessions** -- One session per request via FastAPI dependency injection
- **Repository pattern** -- Encapsulate query logic in repository classes, keep routes thin
- **Type-safe queries** -- Use SQLAlchemy 2.0 `select()` style instead of legacy `Query` API
- **Small migrations** -- Each Alembic revision should make one logical change

## When to Use

- Project has `sqlalchemy` in its dependencies (check `pyproject.toml` or `requirements.txt`)
- Building or modifying database models, queries, or migrations
- Setting up async database connectivity in a FastAPI application
- Designing repository or service layers for data access
- Creating or reviewing Alembic migration scripts

## Quick Start

### Declarative Model

```python
from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

### Async Engine and Session

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/dbname",
    pool_size=20,
    max_overflow=10,
    pool_recycle=3600,
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
```

### FastAPI Session Dependency

```python
from collections.abc import AsyncGenerator

from fastapi import Depends


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


@app.get("/users/{user_id}")
async def get_user(
    user_id: int,
    session: AsyncSession = Depends(get_session),
) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
```

## Type Hints

Use `| None` instead of `Optional` for all type annotations:

```python
def find_by_email(self, email: str) -> User | None:
    ...

async def list_users(
    self, limit: int = 20, offset: int = 0
) -> list[User]:
    ...
```

## Logging

Use emojis as prefixes in log messages:

```python
logger.info("✅ User %s created successfully", user.id)
logger.warning("⚠️ Slow query detected: %dms for %s", duration_ms, query_name)
logger.error("❌ Database connection failed: %s", exc)
```

## Reference Documents

- [sqlalchemy.md](./references/sqlalchemy.md) -- Async SQLAlchemy 2.0 patterns: declarative
  models, session lifecycle, query patterns, relationship loading, repository pattern,
  transactions, and connection pooling
- [alembic.md](./references/alembic.md) -- Alembic migration management: async setup,
  autogeneration, data migrations, branching, CI/CD integration, and zero-downtime strategies

## Decision Guide

| Scenario | Approach |
|----------|----------|
| Simple CRUD endpoint | Session dependency + inline query |
| Complex query logic | Repository class method |
| Multiple writes in one request | Explicit transaction block |
| Eager load related data | `selectinload` for collections, `joinedload` for scalars |
| Add a column | Alembic migration with `op.add_column` |
| Rename a column safely | Three-step: add new, backfill, drop old |
| Bulk insert thousands of rows | `session.execute(insert(Model), list_of_dicts)` |
| Read-only reporting queries | Separate read replica engine |
