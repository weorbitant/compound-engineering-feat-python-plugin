---
name: python-style
description: Enforce Python code style conventions including PEP 8 overrides, modern syntax, and Pythonic patterns. Use when writing, reviewing, or refactoring Python code to ensure consistency with project standards.
model: haiku
---

# Python Style Guide

This skill defines the Python code style conventions for the project. It combines PEP 8 defaults with project-specific overrides and modern Python idioms. All Python code produced or reviewed must conform to these standards.

## Scope

This guide covers naming, imports, formatting, type hints, error handling, logging, and module structure. For detailed rules with concrete examples, consult the reference files:

- [conventions.md](./references/conventions.md) -- PEP 8 with project overrides, type hints, imports, naming, and formatting rules
- [patterns.md](./references/patterns.md) -- Pythonic patterns including comprehensions, dataclasses, pattern matching, and module design

## Key Project Overrides

These rules override PEP 8 defaults and must always be followed:

1. **Line length: 100** (not 79)
2. **Imports at the top only** -- never import in the middle of a file
3. **`| None` not `Optional`** -- use `str | None` instead of `Optional[str]`
4. **Modern generics** -- use `list[str]` not `List[str]`, `dict[str, int]` not `Dict[str, int]`
5. **Minimal comments** -- avoid docstrings and comments unless they explain a non-obvious decision, a specific use case, or an exception
6. **Descriptive names** -- code should be self-explanatory through naming alone
7. **Emoji log prefixes** -- all log messages must use emoji prefixes for readability

## Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Functions, methods, variables | `snake_case` | `calculate_total`, `user_count` |
| Classes | `PascalCase` | `OrderProcessor`, `UserProfile` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Private attributes | Leading underscore | `_internal_cache` |
| Protected methods | Leading underscore | `_validate_input` |
| Module-level dunder | Double underscore | `__all__`, `__version__` |

Choose names that communicate intent. Prefer `active_user_count` over `cnt`. Prefer `fetch_order_details` over `get_data`.

## Imports

Organize imports in three groups separated by blank lines:

1. Standard library
2. Third-party packages
3. Local/project imports

Use absolute imports only. Never use wildcard imports. Never place imports inside functions, conditionals, or loops.

```python
import os
from collections import defaultdict
from pathlib import Path

from django.db import models
from pydantic import BaseModel

from myapp.services.billing import BillingService
from myapp.utils.formatting import format_currency
```

## Formatting

- Maximum line length: 100 characters
- Use trailing commas in multi-line collections and function signatures
- Use f-strings for string formatting (never `%` or `.format()`)
- Use `pathlib.Path` instead of `os.path`
- Use context managers (`with`) for all resource handling

## Type Hints

Apply type hints to all function signatures. Use modern syntax available in Python 3.10+:

```python
def process_items(items: list[str], config: dict[str, int] | None = None) -> bool:
    ...
```

Never use `typing.Optional`, `typing.List`, `typing.Dict`, `typing.Tuple`, or `typing.Set`. See [conventions.md](./references/conventions.md) for the complete type hint reference.

## Error Handling

- Catch specific exceptions, never bare `except:`
- Use custom exception classes for domain errors
- Keep try blocks narrow -- only wrap the line that can raise
- Provide context in error messages

```python
try:
    result = external_api.fetch(resource_id)
except ConnectionError as exc:
    logger.error("Failed to fetch resource %s: %s", resource_id, exc)
    raise ServiceUnavailableError(f"Cannot reach API for resource {resource_id}") from exc
```

## Logging

All log messages must include an emoji prefix that reflects the log level or action:

```python
logger.info("🚀 Started processing batch %s", batch_id)
logger.info("✅ User %s registered successfully", user_id)
logger.warning("⚠️ Retrying request to %s (attempt %d/%d)", url, attempt, max_retries)
logger.error("❌ Failed to process payment for order %s", order_id)
logger.debug("🔍 Cache hit for key %s", cache_key)
```

Common emoji prefixes:

| Emoji | Usage |
|-------|-------|
| ✅ | Success, completion |
| ❌ | Failure, error |
| ⚠️ | Warning, degraded state |
| 🚀 | Starting a process |
| 🔍 | Debug, inspection |
| 🔄 | Retry, refresh |
| 📥 | Receiving data |
| 📤 | Sending data |
| 🗑️ | Deletion |
| 🔒 | Auth, security |

## Module Structure

Order elements within a module as follows:

1. Module-level dunder attributes (`__all__`, `__version__`)
2. Imports (stdlib, third-party, local)
3. Constants
4. Exceptions
5. Type aliases
6. Helper/utility functions (private)
7. Main classes
8. Public functions
9. Entry point guard (`if __name__ == "__main__":`)

## When to Consult References

- Before writing a new module or class, review [conventions.md](./references/conventions.md) for the full set of formatting and naming rules
- Before implementing complex logic, review [patterns.md](./references/patterns.md) for Pythonic approaches including comprehensions, dataclasses vs Pydantic, pattern matching, and module extraction signals
- During code review, use both references as checklists
