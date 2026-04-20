---
name: pytest-patterns
description: Pytest patterns for fixtures, parametrize, mocking, async testing, and factory_boy. Use when writing or reviewing Python tests, setting up test infrastructure, or debugging test failures.
model: haiku
---

# Pytest Patterns

Patterns and conventions for writing Python tests with pytest. Follow the principle of plain
test functions over class-based tests, leverage fixtures for setup and teardown, and prefer
integration tests over excessive mocking.

## Core Rules

- **Plain test functions** -- Never use `TestCase` classes. Write standalone `test_` functions
- **Fixtures for setup** -- Use fixtures for all test setup; shared fixtures go in `conftest.py`
- **Run with poetry** -- Execute tests using `workspace/.venv` environment and poetry:
  `poetry run pytest`
- **`| None` over `Optional`** -- Use modern union syntax in all test code
- **100-character line limit** -- Applies to test files as well
- **No docstrings unless necessary** -- Test function names should be self-explanatory

## Running Tests

```bash
# Run all tests
poetry run pytest

# Run with verbose output
poetry run pytest -v

# Run a specific file
poetry run pytest tests/test_orders.py

# Run a specific test
poetry run pytest tests/test_orders.py::test_create_order_with_valid_data

# Run tests matching a keyword
poetry run pytest -k "order and not cancel"

# Run with coverage
poetry run pytest --cov=src --cov-report=term-missing
```

## Key Patterns Overview

### Fixtures

Fixtures provide reusable test setup with automatic cleanup. Define fixtures in `conftest.py`
for sharing across test modules. Use fixture scopes (`function`, `module`, `session`) to control
lifecycle. Fixture factories return callables for parameterized object creation.

### Parametrize

`@pytest.mark.parametrize` runs the same test with different inputs. Combine multiple parameter
sets, use `indirect` to pass parameters through fixtures, and use `pytest.param` with `id` for
readable test IDs.

### Mocking

Use `pytest-mock`'s `mocker` fixture over raw `unittest.mock.patch`. Patch at the import site,
not the definition site. Prefer `spec=True` for type-safe mocks. Use `side_effect` for
conditional returns or exceptions.

### Async Testing

Use `pytest-asyncio` with `asyncio_mode = "auto"` in `pyproject.toml` to avoid decorating every
async test. Use `@pytest_asyncio.fixture` for async fixtures. Test FastAPI with
`httpx.AsyncClient` and `ASGITransport`.

### Factory Boy

Use `factory_boy` with `DjangoModelFactory` for test data generation. Define `SubFactory` for
related models, `LazyAttribute` for computed fields, and `Trait` for common variations.

## Reference Documents

- [fixtures-parametrize.md](./references/fixtures-parametrize.md) -- Fixture scopes, factories,
  conftest hierarchy, parametrize patterns, factory_boy, monkeypatch, markers, and configuration
- [mocking.md](./references/mocking.md) -- unittest.mock, pytest-mock, patching strategies,
  spec-based mocks, external API mocking, Django/FastAPI test clients
- [async-testing.md](./references/async-testing.md) -- pytest-asyncio, async fixtures, FastAPI
  async testing, Celery task testing, WebSocket testing, anyio, event loop configuration

## When to Consult References

- **Setting up test fixtures**: Read
  [fixtures-parametrize.md](./references/fixtures-parametrize.md) for scope management, conftest
  hierarchy, and fixture factories
- **Writing parametrized tests**: Read
  [fixtures-parametrize.md](./references/fixtures-parametrize.md) for single/multiple params,
  indirect parametrize, and factory_boy
- **Mocking dependencies**: Read [mocking.md](./references/mocking.md) for patch targets,
  mock types, and framework-specific test clients
- **Testing async code**: Read [async-testing.md](./references/async-testing.md) for
  pytest-asyncio setup, async fixtures, and framework integration
- **Testing external APIs**: Read [mocking.md](./references/mocking.md) for responses library,
  httpx mock, and when to prefer integration tests
