---
name: postgresql-patterns
description: PostgreSQL optimization patterns for schema design, indexing, query tuning, and monitoring. Use when working on projects with psycopg2, asyncpg, or psycopg in their dependencies.
---

# PostgreSQL Patterns

Patterns and techniques for designing, optimizing, and operating PostgreSQL databases in
Python applications. Focus on correct schema design first, measure with EXPLAIN ANALYZE,
and tune based on evidence rather than assumptions.

## Core Principles

- **Schema design drives performance** -- Choose the right data types, normalize
  appropriately, and define constraints at the database level rather than the application
- **Index with intent** -- Create indexes to support specific query patterns; every index
  has a write-cost tradeoff that must justify its read benefit
- **Measure before tuning** -- Use EXPLAIN ANALYZE and pg_stat_statements to identify
  actual bottlenecks rather than guessing
- **Connection discipline** -- Use connection pooling, keep transactions short, and avoid
  holding locks longer than necessary

## When to Use

Apply these patterns when working on any project that lists `psycopg2`, `psycopg2-binary`,
`asyncpg`, or `psycopg` in its dependencies. Detect this by checking `pyproject.toml`,
`requirements.txt`, or `Pipfile`. These patterns also apply when using Django ORM or
SQLAlchemy against a PostgreSQL backend.

## Reference Documents

- [schema-indexing.md](./references/schema-indexing.md) -- Schema design, data types,
  index types, partitioning, JSONB, constraints, and connection pooling
- [query-optimization.md](./references/query-optimization.md) -- EXPLAIN ANALYZE, query
  anti-patterns, CTEs, window functions, batch operations, locking, and ORM integration
- [monitoring.md](./references/monitoring.md) -- pg_stat views, vacuum tuning, bloat
  detection, replication monitoring, lock analysis, and query logging
