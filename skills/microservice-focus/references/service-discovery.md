# Service Discovery & Dependency Cross-Reference

## Discovering services

Single-line discovery:

```
Glob("*/pyproject.toml")
```

Each match represents one candidate service. Strip the suffix:

```
service-a/pyproject.toml  →  service-a
service-b/pyproject.toml  →  service-b
lib-common/pyproject.toml →  lib-common
```

If the glob returns 0 results: not a Python repo — return single-service mode.
If 1 result: single-service repo — return single-service mode.
If 2+ results: multi-service repo — proceed with focus gate.

## Reading service metadata

For each discovered service:

1. **Name and stack** — parse `{service}/pyproject.toml`. Extract:
   - Package name (from `[tool.poetry].name` or `[project].name`)
   - Python requirement (from `python` field)
   - Dependency list (from `[tool.poetry.dependencies]` or `[project].dependencies`)

   The stack summary in `<focus_context>` is derived from notable dependencies: `django`, `fastapi`, `celery`, `sqlalchemy`, `psycopg2`/`psycopg`, `redis`, `pydantic`, etc. Pick the 2-4 most architecturally significant ones.

2. **Description** — first usable text from `{service}/.claude/prompt.md` (first paragraph, max 200 chars) or `{service}/README.md` (first non-empty paragraph after the title, max 200 chars).

3. **Structure** — enumerate `{service}/src/*/` top-level dirs and list as comma-separated. Limit to ~5 entries; if more exist, suffix with `, ...`.

## Cross-referencing internal dependencies

To detect that service-b depends on service-a:

1. Build a list of all package names from the focused services (read from each `pyproject.toml`'s `name` field).
2. For each focused service, scan its `dependencies` list for entries that match another focused service's package name.
3. Record the dependency: "service-b depends on service-a".
4. Optionally infer the reason by reading the depending service's import statements or recent commits — leave blank if unknown.

## Detecting `lib-*` shared libraries

Any service whose name starts with `lib-` is treated as a library candidate. If multiple focused services depend on `lib-common` (or similar), surface that as a "both depend on lib-common" line in `dependencies:`.

## Edge cases

- **Service has no `src/`** — list the top-level Python packages instead, or omit `structure:`.
- **Service has no `pyproject.toml`** — skip; it should not have been discovered in the first place.
- **Circular dependency between focused services** — record both directions, do NOT halt; let the consumer skill decide how to handle it.
- **Service named identically to a top-level project module** — disambiguate by path, not by name.
