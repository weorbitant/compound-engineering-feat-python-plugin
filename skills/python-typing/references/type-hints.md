# Python Type Hints Reference

Comprehensive reference for modern Python 3.10+ type annotations.

## Function Signatures

Always annotate parameters and return values. Use `-> None` explicitly for functions that return
nothing.

```python
def greet(name: str) -> str:
    return f"Hello, {name}"

def save_record(record: Record) -> None:
    db.save(record)

def parse_config(path: str, *, strict: bool = False) -> dict[str, Any]:
    ...

async def fetch(url: str, timeout: float = 30.0) -> bytes:
    ...
```

### Callable Types

```python
from collections.abc import Callable, Awaitable

Handler = Callable[[Request], Response]
AsyncHandler = Callable[[Request], Awaitable[Response]]
Middleware = Callable[[Handler], Handler]

def retry(fn: Callable[..., T], attempts: int = 3) -> T:
    ...
```

## Modern Built-in Generic Syntax (3.10+)

Use lowercase built-in types directly -- no imports from `typing` needed.

```python
names: list[str] = ["alice", "bob"]
counts: dict[str, int] = {"alice": 3, "bob": 7}
pair: tuple[str, int] = ("alice", 3)
varlen: tuple[int, ...] = (1, 2, 3, 4)
unique: set[str] = {"alice", "bob"}
frozen: frozenset[int] = frozenset({1, 2, 3})
```

### Collections from `collections.abc`

```python
from collections.abc import Sequence, Mapping, Iterable, Iterator, MutableMapping

def process(items: Sequence[str]) -> None:
    ...

def merge(base: Mapping[str, int], overrides: Mapping[str, int]) -> dict[str, int]:
    return {**base, **overrides}

def stream(data: Iterable[bytes]) -> Iterator[str]:
    for chunk in data:
        yield chunk.decode()
```

## Union Types with `|` Syntax

```python
# Modern syntax (3.10+)
value: str | int = "hello"
result: User | None = find_user(42)

# Multiple types
def handle(event: KeyEvent | MouseEvent | TouchEvent) -> None:
    ...

# In function signatures
def load(source: str | Path) -> bytes:
    ...
```

## TypeVar and Bounded Generics

### Basic TypeVar

```python
from typing import TypeVar

T = TypeVar("T")

def identity(x: T) -> T:
    return x

def first_or_default(items: list[T], default: T) -> T:
    return items[0] if items else default
```

### Bounded TypeVar

```python
from typing import TypeVar

Numeric = TypeVar("Numeric", bound=int | float)

def clamp(value: Numeric, low: Numeric, high: Numeric) -> Numeric:
    return max(low, min(value, high))
```

### Constrained TypeVar

```python
from typing import TypeVar

StrOrBytes = TypeVar("StrOrBytes", str, bytes)

def concat(a: StrOrBytes, b: StrOrBytes) -> StrOrBytes:
    return a + b
```

### Parameterized Classes (Generic Classes)

```python
from typing import Generic, TypeVar

T = TypeVar("T")
K = TypeVar("K")
V = TypeVar("V")

class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

    def peek(self) -> T | None:
        return self._items[-1] if self._items else None


class Registry(Generic[K, V]):
    def __init__(self) -> None:
        self._data: dict[K, V] = {}

    def register(self, key: K, value: V) -> None:
        self._data[key] = value

    def lookup(self, key: K) -> V | None:
        return self._data.get(key)


# Usage
stack: Stack[int] = Stack()
stack.push(42)

registry: Registry[str, Handler] = Registry()
```

### Python 3.12+ Syntax for Generics

```python
# 3.12+: TypeVar declared inline
def first[T](items: list[T]) -> T | None:
    return items[0] if items else None

class Stack[T]:
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()
```

## Protocols (Structural Subtyping)

Protocols define interfaces through structure, not inheritance. A class satisfies a Protocol if it
has the required attributes and methods with compatible signatures.

### Basic Protocol

```python
from typing import Protocol

class Closeable(Protocol):
    def close(self) -> None: ...

class DatabaseConnection:
    def close(self) -> None:
        self.conn.close()

class FileHandle:
    def close(self) -> None:
        self.fd.close()

def cleanup(resource: Closeable) -> None:
    resource.close()

# Both satisfy Closeable without inheriting from it
cleanup(DatabaseConnection())
cleanup(FileHandle())
```

### Protocol with Properties and Attributes

```python
from typing import Protocol

class HasName(Protocol):
    @property
    def name(self) -> str: ...

class Sized(Protocol):
    size: int

class User:
    def __init__(self, name: str) -> None:
        self._name = name

    @property
    def name(self) -> str:
        return self._name
```

### Generic Protocol

```python
from typing import Protocol, TypeVar

T_co = TypeVar("T_co", covariant=True)

class Repository(Protocol[T_co]):
    def get(self, id: int) -> T_co | None: ...
    def list(self) -> list[T_co]: ...

class UserRepo:
    def get(self, id: int) -> User | None:
        return db.users.get(id)

    def list(self) -> list[User]:
        return db.users.all()

def count_items(repo: Repository[Any]) -> int:
    return len(repo.list())
```

### Runtime Checkable Protocol

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Drawable(Protocol):
    def draw(self, canvas: Canvas) -> None: ...

widget = SomeWidget()
if isinstance(widget, Drawable):
    widget.draw(canvas)
```

## TypeAlias

Declare explicit type aliases for readability.

```python
from typing import TypeAlias

UserId: TypeAlias = int
Headers: TypeAlias = dict[str, str]
Middleware: TypeAlias = Callable[[Request, Handler], Response]
JSON: TypeAlias = dict[str, "JSON"] | list["JSON"] | str | int | float | bool | None

def fetch_user(user_id: UserId) -> User | None:
    ...
```

### Python 3.12+ Type Statement

```python
# 3.12+
type UserId = int
type JSON = dict[str, JSON] | list[JSON] | str | int | float | bool | None
```

## TypedDict

Define dictionaries with specific key-value types. Useful for working with JSON-like data
structures where Pydantic is not warranted.

```python
from typing import TypedDict, NotRequired

class UserProfile(TypedDict):
    name: str
    email: str
    age: NotRequired[int]

class APIResponse(TypedDict):
    status: int
    data: list[UserProfile]
    next_cursor: NotRequired[str]

def parse_response(raw: dict[str, Any]) -> APIResponse:
    ...

# TypedDict supports inheritance
class AdminProfile(UserProfile):
    role: str
    permissions: list[str]
```

### Functional Syntax (for keys that are not valid identifiers)

```python
from typing import TypedDict

Metadata = TypedDict("Metadata", {"content-type": str, "x-request-id": str})
```

## Literal

Restrict values to specific literals. Prefer over bare `str` or `int` when only specific values
are valid.

```python
from typing import Literal

Direction = Literal["north", "south", "east", "west"]
HttpMethod = Literal["GET", "POST", "PUT", "DELETE", "PATCH"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]

def move(direction: Direction, steps: int = 1) -> None:
    ...

def request(method: HttpMethod, url: str) -> Response:
    ...

# Combine with overload for precise return types
@overload
def fetch(url: str, raw: Literal[True]) -> bytes: ...
@overload
def fetch(url: str, raw: Literal[False] = ...) -> str: ...
def fetch(url: str, raw: bool = False) -> bytes | str:
    data = download(url)
    return data if raw else data.decode()
```

## Annotated

Attach metadata to types. Used extensively by Pydantic, FastAPI, and other frameworks for
validation and documentation.

```python
from typing import Annotated
from pydantic import Field

PositiveInt = Annotated[int, Field(gt=0)]
EmailStr = Annotated[str, Field(pattern=r"^[\w.-]+@[\w.-]+\.\w+$")]
BoundedStr = Annotated[str, Field(min_length=1, max_length=255)]

class CreateUser(BaseModel):
    name: BoundedStr
    email: EmailStr
    age: PositiveInt | None = None
```

### FastAPI Dependency Injection

```python
from typing import Annotated
from fastapi import Depends, Query

CurrentUser = Annotated[User, Depends(get_current_user)]
PageSize = Annotated[int, Query(ge=1, le=100, description="Items per page")]

@app.get("/items")
async def list_items(user: CurrentUser, page_size: PageSize = 20) -> list[Item]:
    ...
```

## Overload

Provide multiple type signatures for a single function. The implementation signature must be
compatible with all overloads.

```python
from typing import overload

@overload
def parse(data: str) -> dict[str, Any]: ...
@overload
def parse(data: bytes) -> dict[str, Any]: ...
@overload
def parse(data: str, as_list: Literal[True]) -> list[Any]: ...

def parse(data: str | bytes, as_list: bool = False) -> dict[str, Any] | list[Any]:
    if isinstance(data, bytes):
        data = data.decode()
    result = json.loads(data)
    if as_list and isinstance(result, dict):
        return list(result.values())
    return result
```

### Overload with Different Return Types

```python
from typing import overload

@overload
def get_user(id: int) -> User: ...
@overload
def get_user(id: int, optional: Literal[True]) -> User | None: ...

def get_user(id: int, optional: bool = False) -> User | None:
    user = db.users.get(id)
    if user is None and not optional:
        raise UserNotFoundError(id)
    return user
```

## TYPE_CHECKING Guard

Break circular imports and avoid runtime overhead from type-only imports.

```python
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from myapp.models import User
    from myapp.services import EmailService

class UserHandler:
    def __init__(self, email_service: EmailService) -> None:
        self._email = email_service

    def process(self, user: User) -> None:
        self._email.send_welcome(user)
```

### When to Use

- **Circular imports**: Module A imports from B, and B imports from A
- **Heavy imports**: Large modules only needed for type annotations (e.g., `pandas`, `numpy`)
- **Forward references**: Referencing a class before it is defined

### Important Notes

- `from __future__ import annotations` makes all annotations strings at runtime (PEP 563),
  enabling forward references everywhere in the module
- Without `from __future__ import annotations`, use string literals for forward references:
  `def process(self, user: "User") -> None`
- Code inside `if TYPE_CHECKING:` never executes at runtime -- only type checkers see it

## mypy Configuration Best Practices

### Recommended `pyproject.toml` Configuration

```toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
disallow_untyped_decorators = true
no_implicit_optional = true
warn_redundant_casts = true
warn_unused_ignores = true
show_error_codes = true
enable_error_code = ["ignore-without-code", "redundant-expr", "truthy-bool"]

# Per-module overrides for third-party libraries without stubs
[[tool.mypy.overrides]]
module = ["some_untyped_library.*"]
ignore_missing_imports = true
```

### Gradual Adoption Strategy

When adding types to an existing codebase, start strict on new code and relax on legacy code:

```toml
[tool.mypy]
strict = true

# Relax strictness on legacy modules
[[tool.mypy.overrides]]
module = ["legacy_module.*"]
disallow_untyped_defs = false
disallow_incomplete_defs = false
```

### Common mypy Patterns

```python
# Explicit type ignore with error code
result = untyped_function()  # type: ignore[no-untyped-call]

# Reveal type for debugging (removed before commit)
reveal_type(some_value)  # mypy will print the inferred type

# Assert type for narrowing
from typing import assert_type
assert_type(value, int)  # fails if mypy infers a different type

# Cast as last resort (bypasses type checking)
from typing import cast
raw = get_data()
typed = cast(list[str], raw)
```

### Type Narrowing

mypy understands several narrowing patterns:

```python
def process(value: str | int | None) -> str:
    # isinstance narrowing
    if isinstance(value, str):
        return value.upper()

    # None check narrowing
    if value is None:
        return "default"

    # At this point, mypy knows value is int
    return str(value)

# TypeGuard for custom narrowing
from typing import TypeGuard

def is_string_list(val: list[Any]) -> TypeGuard[list[str]]:
    return all(isinstance(item, str) for item in val)

def process_list(items: list[Any]) -> None:
    if is_string_list(items):
        # mypy knows items is list[str] here
        print(", ".join(items))
```

## ParamSpec and Concatenate

Preserve parameter types through decorators.

```python
from typing import Concatenate, ParamSpec, TypeVar
from collections.abc import Callable
from functools import wraps

P = ParamSpec("P")
R = TypeVar("R")

def with_logging(fn: Callable[P, R]) -> Callable[P, R]:
    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        logger.info("Calling %s", fn.__name__)
        return fn(*args, **kwargs)
    return wrapper

# Concatenate adds parameters to the front
def with_user(
    fn: Callable[Concatenate[User, P], R],
) -> Callable[P, R]:
    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        user = get_current_user()
        return fn(user, *args, **kwargs)
    return wrapper

@with_user
def delete_item(user: User, item_id: int) -> None:
    ...

# Called without the user parameter -- injected by decorator
delete_item(item_id=42)
```

## Never Type

Indicate functions that never return (raise exceptions, run forever).

```python
from typing import Never, assert_never

def fail(message: str) -> Never:
    raise RuntimeError(message)

# Exhaustiveness checking with assert_never
class Shape:
    kind: Literal["circle", "square"]

def area(shape: Shape) -> float:
    if shape.kind == "circle":
        return 3.14 * shape.radius ** 2
    elif shape.kind == "square":
        return shape.side ** 2
    else:
        assert_never(shape.kind)  # mypy error if a case is missed
```

## Self Type

Reference the current class in return types (useful for fluent APIs and classmethods).

```python
from typing import Self

class Builder:
    def __init__(self) -> None:
        self._options: dict[str, str] = {}

    def set(self, key: str, value: str) -> Self:
        self._options[key] = value
        return self

    @classmethod
    def from_dict(cls, data: dict[str, str]) -> Self:
        instance = cls()
        instance._options = data
        return instance

# Works correctly with subclasses
class AdvancedBuilder(Builder):
    def set_advanced(self, key: str, value: str) -> Self:
        ...

# Returns AdvancedBuilder, not Builder
builder = AdvancedBuilder().set("a", "1").set_advanced("b", "2")
```
