---
name: postgis-patterns
description: PostGIS spatial database patterns covering geometry types, spatial queries, indexing, GeoDjango, and GeoAlchemy2. Use when working on projects with django.contrib.gis or geoalchemy2 in their dependencies.
model: haiku
---

# PostGIS Patterns

Patterns and conventions for building spatial applications with PostGIS. Covers geometry
and geography types, spatial indexing, common spatial queries, GeoDjango integration, and
GeoAlchemy2 for SQLAlchemy-based projects.

## Core Principles

- **Geography for global distance** -- Use geography type for distance calculations on
  the Earth's surface; use geometry for planar operations within a known projection
- **Index everything spatial** -- Always create GiST indexes on spatial columns; without
  them, spatial queries perform full table scans
- **ST_DWithin over ST_Distance** -- Prefer `ST_DWithin` for proximity queries because
  it uses spatial indexes, while `ST_Distance < X` does not
- **SRID consistency** -- Keep all data in a consistent SRID (typically 4326 for
  lat/lng); transform only when needed for calculations

## When to Use

Apply these patterns when working on any project that uses spatial data. Detect this by
checking `pyproject.toml`, `requirements.txt`, or `Pipfile` for `django.contrib.gis`,
`geoalchemy2`, or `psycopg2`/`PostGIS` references. Also applies when SQL files or
migrations reference `geometry` or `geography` column types.

## Reference Documents

- [spatial-queries.md](./references/spatial-queries.md) -- PostGIS SQL patterns: geometry
  vs geography types, spatial indexes, ST_ functions, distance queries, GeoJSON, spatial
  joins, nearest neighbor, and performance considerations
- [geodjango.md](./references/geodjango.md) -- GeoDjango setup, spatial model fields,
  spatial lookups, distance queries, serialization, admin integration, forms, GeoAlchemy2
  alternative, and testing spatial queries
