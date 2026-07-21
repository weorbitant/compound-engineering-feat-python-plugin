# Pythonic Patterns Reference

This reference covers idiomatic Python patterns and modern language features. Each pattern includes concrete examples and guidance on when to apply it.

---

## List and Dict Comprehensions

Use comprehensions when the logic is simple and readable. Switch to explicit loops when comprehensions become nested or hard to parse at a glance.

### List Comprehensions

```python
# Bad -- loop to build a simple filtered list
result = []
for user in users:
    if user.is_active:
        result.append(user.email)

# Good -- clear comprehension
active_emails = [user.email for user in users if user.is_active]
```

```python
# Bad -- comprehension too complex, hard to read
data = [
    transform(item.value)
    for group in categories
    for item in group.items
    if item.is_valid and item.value > threshold
]

# Good -- use a loop when nesting makes comprehension unreadable
data = []
for group in categories:
    for item in group.items:
        if item.is_valid and item.value > threshold:
            data.append(transform(item.value))
```

### Dict Comprehensions

```python
# Build a lookup dict
user_by_id = {user.id: user for user in users}

# Invert a mapping
inverted = {v: k for k, v in original.items()}

# Filter a dict
high_scores = {name: score for name, score in scores.items() if score >= 90}
```

### Set Comprehensions

```python
unique_domains = {email.split("@")[1] for email in email_addresses}
```

### Generator Expressions

Use generator expressions for large sequences where the full list is not needed in memory:

```python
# Bad -- materializes entire list just to sum
total = sum([order.amount for order in orders])

# Good -- generator avoids intermediate list
total = sum(order.amount for order in orders)
```

---

## Dataclasses vs Pydantic

### Dataclasses -- Internal Data Structures

Use dataclasses for internal domain objects where external validation is not needed:

```python
from dataclasses import dataclass, field

@dataclass
class OrderItem:
    product_id: str
    quantity: int
    unit_price: Decimal
    discount: Decimal = Decimal("0")

    @property
    def total_price(self) -> Decimal:
        return (self.unit_price * self.quantity) - self.discount

@dataclass
class Order:
    order_id: str
    items: list[OrderItem] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)

    @property
    def total(self) -> Decimal:
        return sum(item.total_price for item in self.items)
```

Use `frozen=True` for immutable value objects:

```python
@dataclass(frozen=True)
class Coordinate:
    latitude: float
    longitude: float
```

Use `slots=True` (Python 3.10+) for memory-efficient dataclasses:

```python
@dataclass(slots=True)
class Point:
    x: float
    y: float
```

### Pydantic -- External Boundaries

Use Pydantic models at system boundaries where data arrives from external sources (APIs, config files, user input, databases):

```python
from pydantic import BaseModel, Field, field_validator

class CreateUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str
    age: int = Field(ge=13)

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        if not v.endswith(("@company.com", "@company.org")):
            raise ValueError("Must use company email")
        return v.lower()

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
```

### Decision Guide

| Criterion | Dataclass | Pydantic |
|-----------|-----------|----------|
| Internal domain objects | Yes | No |
| API request/response | No | Yes |
| Config file parsing | No | Yes |
| Database row mapping | Maybe | Yes |
| Immutable value objects | `frozen=True` | `model_config = ConfigDict(frozen=True)` |
| Validation needed | Manual | Built-in |
| Serialization needed | Manual | Built-in |
| Performance-critical internal | Yes | No |

---

## Pattern Matching (Python 3.10+)

Use `match`/`case` for structured data dispatch. It is clearer than chains of `isinstance` checks or nested `if`/`elif`.

### Basic Value Matching

```python
match status_code:
    case 200:
        return parse_response(body)
    case 404:
        raise ResourceNotFoundError(resource_id)
    case 429:
        raise RateLimitError(retry_after=headers.get("Retry-After"))
    case _:
        raise UnexpectedStatusError(status_code)
```

### Structural Matching

```python
match event:
    case {"type": "user.created", "data": {"id": user_id, "email": email}}:
        handle_new_user(user_id, email)
    case {"type": "order.completed", "data": {"id": order_id, "total": total}}:
        handle_completed_order(order_id, total)
    case {"type": event_type}:
        logger.warning("Unhandled event type: %s", event_type)
```

### Class Pattern Matching

```python
match notification:
    case EmailNotification(recipient=r, subject=s):
        send_email(r, s)
    case SMSNotification(phone=p, message=m):
        send_sms(p, m)
    case PushNotification(device_token=t, payload=payload):
        send_push(t, payload)
```

### Guard Clauses

```python
match command:
    case Command(action="delete", target=target) if current_user.is_admin:
        delete_resource(target)
    case Command(action="delete", target=_):
        raise PermissionDeniedError("Only admins can delete resources")
```

---

## Walrus Operator (`:=`)

Use the walrus operator to avoid redundant computations or duplicate function calls in conditions.

```python
# Bad -- calls the function twice
if get_response(url).status_code == 200:
    data = get_response(url).json()

# Good -- single call, result captured
if (response := get_response(url)).status_code == 200:
    data = response.json()
```

```python
# Good -- in while loops for sentinel patterns
while (line := file.readline()) != "":
    process_line(line)
```

```python
# Good -- filter with transformation
valid_results = [
    cleaned
    for raw in inputs
    if (cleaned := clean_and_validate(raw)) is not None
]
```

Do not overuse. Avoid walrus in contexts where it harms readability:

```python
# Bad -- too clever, hard to follow
if (n := len(data)) > 10 and (first := data[0]) > 0 and (last := data[n-1]) < 100:
    ...

# Good -- straightforward assignments
n = len(data)
if n > 10 and data[0] > 0 and data[n - 1] < 100:
    ...
```

---

## Protocols and ABCs

### Protocols -- Structural (Duck) Typing

Use `Protocol` when different classes share a common interface but have no inheritance relationship. This is structural typing -- if it has the right methods, it satisfies the protocol.

```python
from typing import Protocol

class Renderable(Protocol):
    def render(self) -> str:
        ...

class HTMLReport:
    def render(self) -> str:
        return f"<html>{self.content}</html>"

class MarkdownReport:
    def render(self) -> str:
        return f"# {self.title}\n{self.content}"

def publish(document: Renderable) -> None:
    output = document.render()
    save_to_disk(output)

# Both HTMLReport and MarkdownReport satisfy Renderable without inheriting from it
```

Use `runtime_checkable` only when `isinstance` checks are genuinely needed:

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Closeable(Protocol):
    def close(self) -> None:
        ...

def cleanup(resource: object) -> None:
    if isinstance(resource, Closeable):
        resource.close()
```

### ABCs -- When Inheritance Is Intentional

Use `ABC` when classes must share implementation and there is a genuine "is-a" relationship:

```python
from abc import ABC, abstractmethod

class PaymentGateway(ABC):
    @abstractmethod
    def charge(self, amount: Decimal, currency: str) -> TransactionResult:
        ...

    @abstractmethod
    def refund(self, transaction_id: str) -> RefundResult:
        ...

    def validate_currency(self, currency: str) -> bool:
        return currency in self.supported_currencies

class StripeGateway(PaymentGateway):
    supported_currencies = {"USD", "EUR", "GBP"}

    def charge(self, amount: Decimal, currency: str) -> TransactionResult:
        ...

    def refund(self, transaction_id: str) -> RefundResult:
        ...
```

### Decision Guide

| Criterion | Protocol | ABC |
|-----------|----------|-----|
| No shared implementation | Yes | No |
| Shared base methods | No | Yes |
| Third-party classes must conform | Yes | No |
| Enforce method implementation | Implicit | Explicit (`@abstractmethod`) |
| Inheritance relationship | No | Yes |

---

## Enum Patterns

Use `Enum` for fixed sets of related constants. Prefer `StrEnum` (Python 3.11+) when enum values are used as strings.

### Basic Enum

```python
from enum import Enum, auto

class OrderStatus(Enum):
    PENDING = auto()
    PROCESSING = auto()
    SHIPPED = auto()
    DELIVERED = auto()
    CANCELLED = auto()
```

### String Enum

```python
from enum import StrEnum

class LogLevel(StrEnum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"

# StrEnum values work directly as strings
logger.setLevel(LogLevel.DEBUG)  # No need for .value
```

### Enum with Methods

```python
from enum import Enum

class Permission(Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"

    def includes(self, other: "Permission") -> bool:
        hierarchy = {
            Permission.READ: 0,
            Permission.WRITE: 1,
            Permission.ADMIN: 2,
        }
        return hierarchy[self] >= hierarchy[other]
```

### Enum in Pattern Matching

```python
match order.status:
    case OrderStatus.PENDING:
        send_reminder(order)
    case OrderStatus.SHIPPED:
        send_tracking_update(order)
    case OrderStatus.CANCELLED:
        process_refund(order)
```

---

## Logging with Emojis

All log messages must use emoji prefixes. This improves scanning log output and quickly identifying message types.

### Standard Patterns

```python
import logging

logger = logging.getLogger(__name__)

# Startup and shutdown
logger.info("🚀 Starting %s service on port %d", service_name, port)
logger.info("✅ Shutdown complete for %s", service_name)

# Success operations
logger.info("✅ User %s registered successfully", user_id)
logger.info("✅ Order %s processed, total: %s", order_id, total)
logger.info("✅ Migration completed: %d records updated", count)

# Warnings
logger.warning("⚠️ Rate limit approaching for API key %s", api_key)
logger.warning("🔄 Retrying request to %s (attempt %d/%d)", url, attempt, max_retries)
logger.warning("⚠️ Cache miss for key %s, falling back to DB", cache_key)

# Errors
logger.error("❌ Failed to process payment for order %s: %s", order_id, error)
logger.error("❌ Database connection lost: %s", error)

# Debug
logger.debug("🔍 Cache hit for key %s", cache_key)
logger.debug("🔍 Request payload: %s", payload)

# Task progress
logger.info("🔄 Processing batch %d/%d", current, total)
logger.info("✅ Sync complete: %d created, %d updated, %d skipped", created, updated, skipped)
```

### Choosing Emojis

| Category | Emoji | Usage |
|----------|-------|-------|
| Success / completion | ✅ 🎉 | Operations that completed |
| Start / init | 🚀 ⚙️ ▶️ | Service or process starting |
| Warning / caution | ⚠️ ⏳ | Non-fatal issues |
| Error / failure | ❌ 🔥 🛑 | Failed operations |
| Info / progress | 🔍 📋 | Status updates |
| Delete / cleanup | 🗑️ 🧹 | Removal operations |
| Security / auth | 🔒 🔑 🛡️ | Auth-related events |
| Data / sync | 📥 📤 🔄 📦 | Data operations |

---

## Module Extraction Signals

Recognize when a module is doing too much and needs to be split. These signals indicate extraction is warranted:

### Size Signals

- File exceeds ~300-400 lines of actual code (excluding blank lines and imports)
- Class has more than 10 public methods
- Function has more than 5 levels of indentation

### Cohesion Signals

- Imports cluster into distinct groups serving different purposes
- Functions in the same file never call each other
- A class has methods that operate on completely different data

### Naming Signals

- Difficulty naming the module without using "and" or "utils"
- Methods with prefixes suggesting sub-domains: `email_send`, `email_validate`, `sms_send`, `sms_validate`

### Extraction Approach

```
# Before -- monolithic services.py
services.py (500 lines)
  ├── send_email()
  ├── validate_email()
  ├── format_email_body()
  ├── process_payment()
  ├── validate_payment()
  ├── refund_payment()
  ├── generate_report()
  └── export_report()

# After -- extracted by domain
services/
  ├── __init__.py
  ├── email.py       (send, validate, format_body)
  ├── payment.py     (process, validate, refund)
  └── reporting.py   (generate, export)
```

### When NOT to Extract

- Module is under 200 lines and cohesive
- Functions share significant state or are tightly coupled
- Extraction would create circular imports
- The "utils" module is genuinely a collection of small, unrelated helpers used across the project

---

## Itertools and Functional Patterns

### Common itertools Usage

```python
from itertools import chain, groupby, islice, batched

# Flatten nested iterables
all_items = list(chain.from_iterable(nested_lists))

# Group sorted data
sorted_orders = sorted(orders, key=lambda o: o.status)
for status, group in groupby(sorted_orders, key=lambda o: o.status):
    process_group(status, list(group))

# Take first N items from an iterator
first_ten = list(islice(large_iterator, 10))

# Process in batches (Python 3.12+)
for batch in batched(items, 100):
    process_batch(batch)
```

### Avoid Over-Functional Style

```python
# Bad -- chained map/filter is harder to read in Python
result = list(map(lambda x: x.upper(), filter(lambda x: len(x) > 3, words)))

# Good -- comprehension is more Pythonic
result = [word.upper() for word in words if len(word) > 3]
```

---

## Context Manager Patterns

### Custom Context Managers

```python
from contextlib import contextmanager

@contextmanager
def temporary_directory(prefix: str = "tmp"):
    dir_path = Path(tempfile.mkdtemp(prefix=prefix))
    try:
        yield dir_path
    finally:
        shutil.rmtree(dir_path)

with temporary_directory("build_") as build_dir:
    compile_assets(build_dir)
```

### Multiple Context Managers

```python
# Good -- multiple context managers in one statement
with (
    open("input.txt") as infile,
    open("output.txt", "w") as outfile,
):
    outfile.write(infile.read().upper())
```

---

## Unpacking and Assignment Patterns

```python
# Swap values
a, b = b, a

# Unpack with ignore
_, _, third = get_coordinates()

# Extended unpacking
first, *middle, last = sorted_scores

# Unpack in loops
for name, score in student_scores.items():
    print(f"{name}: {score}")

# Named unpacking with dataclass/tuple
from typing import NamedTuple

class ServerConfig(NamedTuple):
    host: str
    port: int
    debug: bool

config = ServerConfig("localhost", 8000, True)
host, port, debug = config
```

---

## Dictionary Patterns

```python
# Merge dicts (Python 3.9+)
merged = defaults | overrides

# Update in place
config |= user_settings

# Get with default
timeout = config.get("timeout", 30)

# setdefault for mutable defaults
cache.setdefault(key, []).append(value)

# defaultdict for automatic initialization
from collections import defaultdict

word_counts: dict[str, int] = defaultdict(int)
for word in words:
    word_counts[word] += 1
```
