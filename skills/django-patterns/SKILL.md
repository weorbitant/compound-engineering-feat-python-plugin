---
name: django-patterns
description: Django core patterns for models, views, admin, signals, middleware, and Django Ninja APIs. Use when working on projects with django in their dependencies.
model: haiku
---

# Django Patterns

Patterns and conventions for building Django applications. Follow the philosophy of fat
models and thin views, prefer explicit over implicit, and adhere to Django conventions
for project structure and naming.

## Core Principles

- **Fat models, thin views** -- Place business logic in model methods and managers, keep
  views focused on request handling and response rendering
- **Explicit over implicit** -- Prefer named URL patterns, explicit field definitions,
  and clear import paths over magic or convention-only behavior
- **Django conventions** -- Follow the framework's naming conventions for apps, models,
  URLs, and templates to maximize compatibility with third-party packages
- **DRY with discipline** -- Use abstract models, mixins, and shared utilities to avoid
  repetition, but keep indirection minimal and traceable

## When to Use

Apply these patterns when working on any project that lists `django` in its dependencies.
Detect this by checking `pyproject.toml`, `requirements.txt`, or `Pipfile` for Django.

## Running Locally

Always run Django apps locally without Docker:

```bash
ENVIRONMENT=local poetry run python src/manage.py runserver 0.0.0.0:8000
```

## Type Hints

Use `| None` instead of `Optional` for all type annotations:

```python
def get_user(user_id: int) -> User | None:
    ...
```

## Logging

Use emojis as prefixes in log messages:

```python
logger.info("✅ Order %s created successfully", order.id)
logger.warning("⚠️ Payment retry #%d for order %s", attempt, order.id)
logger.error("❌ Failed to process webhook: %s", exc)
```

## Reference Documents

- [models.md](./references/models.md) -- Django ORM patterns: fields, querysets,
  managers, migrations, abstract models, constraints
- [views.md](./references/views.md) -- Views, URL routing, forms, templates, middleware,
  settings organization
- [admin-signals-middleware.md](./references/admin-signals-middleware.md) -- Admin
  customization, signals, middleware, management commands
- [ninja.md](./references/ninja.md) -- Django Ninja integration: routers, schemas,
  authentication, error handling, testing
