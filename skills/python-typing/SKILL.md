---
name: python-typing
description: Apply modern Python 3.10+ type annotations and Pydantic v2 patterns. Use when writing type-safe Python code, designing data models, adding type hints to existing code, or integrating Pydantic with frameworks like FastAPI or Django Ninja.
---

# Python Typing

Modern Python typing leverages 3.10+ syntax for clarity and correctness. This skill covers the
full type annotation system and Pydantic v2 model patterns used across Python projects.

## Core Principles

- Always annotate function parameters and return types
- Use built-in generic syntax: `list[str]`, `dict[str, int]`, `tuple[str, ...]`
- Use `X | None` instead of `Optional[X]`
- Use `X | Y` instead of `Union[X, Y]`
- Prefer `Protocol` over abstract base classes for structural subtyping
- Use `TYPE_CHECKING` guards to break circular imports

## Basic Type Annotations

### Function Signatures

```python
def process_items(items: list[str], limit: int = 10) -> dict[str, int]:
    return {item: len(item) for item in items[:limit]}

def find_user(user_id: int) -> User | None:
    return db.get(user_id)

async def fetch_data(url: str, *, timeout: float = 30.0) -> bytes:
    ...
```

### Variables and Constants

```python
from typing import Final

MAX_RETRIES: Final = 3
active_connections: set[str] = set()
registry: dict[str, type] = {}
```

## Generics and TypeVar

```python
from typing import TypeVar

T = TypeVar("T")
K = TypeVar("K", bound=str)

def first(items: list[T]) -> T | None:
    return items[0] if items else None

def get_by_key(mapping: dict[K, T], key: K, default: T) -> T:
    return mapping.get(key, default)
```

## Protocols (Structural Subtyping)

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Renderable(Protocol):
    def render(self) -> str: ...

class Widget:
    def render(self) -> str:
        return "<widget />"

def display(item: Renderable) -> None:
    print(item.render())

# Widget satisfies Renderable without inheriting from it
display(Widget())
```

## Pydantic v2 Models

Pydantic v2 provides runtime validation with full type safety. Core patterns:

```python
from pydantic import BaseModel, Field, field_validator

class CreateUserRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str
    age: int | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("invalid email address")
        return v.lower()
```

### Serialization

```python
user = CreateUserRequest(name="Alice", email="Alice@Example.com")
user.model_dump()             # -> {"name": "Alice", "email": "alice@example.com", "age": None}
user.model_dump(exclude_none=True)  # -> {"name": "Alice", "email": "alice@example.com"}
user.model_dump_json()        # -> JSON string
```

## Reference Materials

For comprehensive coverage of each topic area, consult:

- [type-hints.md](./references/type-hints.md) -- Full reference on Python type annotations,
  including TypeVar, Protocol, TypedDict, Literal, Annotated, overload, TYPE_CHECKING, and mypy
  configuration
- [pydantic-patterns.md](./references/pydantic-patterns.md) -- Complete Pydantic v2 patterns
  including validators, custom types, BaseSettings, discriminated unions, generic models, and
  framework integration

## When to Consult References

- **Adding types to an untyped codebase**: Read [type-hints.md](./references/type-hints.md) for
  the full syntax reference and mypy configuration
- **Designing API request/response models**: Read
  [pydantic-patterns.md](./references/pydantic-patterns.md) for validation, serialization, and
  framework integration
- **Working with generics or Protocols**: Read the TypeVar and Protocol sections in
  [type-hints.md](./references/type-hints.md)
- **Configuring application settings**: Read the BaseSettings section in
  [pydantic-patterns.md](./references/pydantic-patterns.md)
- **Handling polymorphic data**: Read discriminated unions in
  [pydantic-patterns.md](./references/pydantic-patterns.md)
