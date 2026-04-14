# Python Conventions Reference

This reference codifies PEP 8 rules with project-specific overrides. Every rule includes concrete good/bad examples.

---

## Line Length

**Project override: 100 characters** (PEP 8 default is 79).

```python
# Bad -- exceeds 100 characters
result = some_service.process_transaction(user_id=current_user.id, amount=calculated_total, currency=default_currency, metadata=transaction_metadata)

# Good -- break at logical points
result = some_service.process_transaction(
    user_id=current_user.id,
    amount=calculated_total,
    currency=default_currency,
    metadata=transaction_metadata,
)
```

---

## Type Hints

Use modern built-in generics (Python 3.10+). Never import from `typing` for basic container types.

### Basic Types

```python
# Bad
from typing import Optional, List, Dict, Tuple, Set, Union

def process(items: List[str], config: Optional[Dict[str, int]] = None) -> Tuple[bool, str]:
    ...

# Good
def process(items: list[str], config: dict[str, int] | None = None) -> tuple[bool, str]:
    ...
```

### Union Types

```python
# Bad
from typing import Union
value: Union[str, int]

# Good
value: str | int
```

### Optional / Nullable

```python
# Bad
from typing import Optional
name: Optional[str] = None

# Good
name: str | None = None
```

### Collection Types

```python
# Bad
from typing import List, Dict, Set, Tuple, FrozenSet

items: List[str]
mapping: Dict[str, int]
unique: Set[int]
record: Tuple[str, int, float]
immutable: FrozenSet[str]

# Good
items: list[str]
mapping: dict[str, int]
unique: set[int]
record: tuple[str, int, float]
immutable: frozenset[str]
```

### Callable and Complex Types

```python
from collections.abc import Callable, Iterator, Sequence

# Bad
from typing import Callable, Iterator, Sequence

# Good -- import from collections.abc
handler: Callable[[str, int], bool]
items: Iterator[str]
data: Sequence[int]
```

### Type Aliases

```python
# Simple alias
UserID = int
Headers = dict[str, str]

# Complex alias with TypeAlias (when needed for clarity)
from typing import TypeAlias

JSONValue: TypeAlias = str | int | float | bool | None | list["JSONValue"] | dict[str, "JSONValue"]
```

### Function Signatures

Always annotate function parameters and return types:

```python
# Bad -- no type hints
def fetch_user(user_id):
    ...

# Bad -- missing return type
def fetch_user(user_id: int):
    ...

# Good
def fetch_user(user_id: int) -> User | None:
    ...
```

---

## Imports

### Ordering

Three groups, separated by blank lines:

```python
# 1. Standard library
import os
import sys
from collections import defaultdict
from pathlib import Path

# 2. Third-party packages
from django.db import models
from pydantic import BaseModel, Field
from rest_framework import serializers

# 3. Local/project imports
from myapp.models import User
from myapp.services.billing import BillingService
```

### Rules

```python
# Bad -- wildcard import
from os.path import *

# Bad -- relative import
from .models import User
from ..utils import helper

# Good -- absolute import
from myapp.models import User
from myapp.utils import helper
```

```python
# Bad -- import inside function
def process_data(raw):
    import json  # Never do this
    return json.loads(raw)

# Good -- import at top of file
import json

def process_data(raw: str) -> dict:
    return json.loads(raw)
```

```python
# Bad -- multiple imports on one line
import os, sys, json

# Good -- one import per line for standard library modules
import json
import os
import sys
```

### Import Grouping Within Sections

Within each section, alphabetize. Place `import X` before `from X import Y`:

```python
import hashlib
import json
import os
from collections import defaultdict
from pathlib import Path
```

---

## Naming Conventions

### Functions and Variables

```python
# Bad
def GetUserData(UserId):
    userData = fetchFromDB(UserId)
    return userData

# Good
def get_user_data(user_id: int) -> UserData:
    user_data = fetch_from_db(user_id)
    return user_data
```

### Classes

```python
# Bad
class order_processor:
    ...

class orderProcessor:
    ...

# Good
class OrderProcessor:
    ...
```

### Constants

```python
# Bad
maxRetries = 3
default_timeout = 30

# Good
MAX_RETRIES = 3
DEFAULT_TIMEOUT = 30
```

### Boolean Variables and Functions

```python
# Bad
def check_valid(user: User) -> bool:
    ...

active = True
flag = False

# Good
def is_valid(user: User) -> bool:
    ...

is_active = True
has_permission = False
```

### Private and Protected

```python
class PaymentProcessor:
    # Private attribute -- internal implementation detail
    _transaction_log: list[Transaction]

    # Protected method -- subclass can override
    def _validate_amount(self, amount: Decimal) -> bool:
        ...

    # Public method -- part of the API
    def process_payment(self, order: Order) -> Receipt:
        ...
```

### Descriptive Over Short

```python
# Bad
def proc(d, f):
    r = f(d)
    return r

# Good
def process_document(document: Document, formatter: Callable) -> FormattedDocument:
    formatted_result = formatter(document)
    return formatted_result
```

---

## String Formatting

Always use f-strings. Never use `%` formatting or `.format()`.

```python
# Bad
message = "User %s has %d items" % (username, item_count)
message = "User {} has {} items".format(username, item_count)

# Good
message = f"User {username} has {item_count} items"
```

For log messages, use `%s` style (logging module handles lazy formatting) and always prefix with an emoji:

```python
# Good -- logging uses % style for lazy evaluation, emoji prefix for readability
logger.info("📦 Processing order %s for user %s", order_id, user_id)
```

---

## Path Handling

Use `pathlib.Path` instead of `os.path`.

```python
# Bad
import os

config_path = os.path.join(base_dir, "config", "settings.yaml")
if os.path.exists(config_path):
    with open(config_path) as f:
        content = f.read()
parent = os.path.dirname(config_path)

# Good
from pathlib import Path

config_path = Path(base_dir) / "config" / "settings.yaml"
if config_path.exists():
    content = config_path.read_text()
parent = config_path.parent
```

---

## Context Managers

Use `with` statements for all resource handling:

```python
# Bad
f = open("data.txt")
content = f.read()
f.close()

# Bad -- no guarantee of cleanup
conn = database.connect()
cursor = conn.cursor()
cursor.execute(query)
conn.close()

# Good
with open("data.txt") as f:
    content = f.read()

# Good
with database.connect() as conn:
    cursor = conn.cursor()
    cursor.execute(query)
```

---

## Properties Over Getters/Setters

```python
# Bad -- Java-style getters and setters
class User:
    def __init__(self, first_name: str, last_name: str):
        self._first_name = first_name
        self._last_name = last_name

    def get_full_name(self) -> str:
        return f"{self._first_name} {self._last_name}"

    def set_first_name(self, name: str) -> None:
        self._first_name = name

# Good -- Pythonic properties
class User:
    def __init__(self, first_name: str, last_name: str):
        self.first_name = first_name
        self.last_name = last_name

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
```

---

## Comments and Docstrings

Avoid docstrings and comments unless they explain a specific use case, an exception, or a non-obvious decision. The code should be self-explanatory through descriptive naming.

```python
# Bad -- obvious comment
# Increment the counter
counter += 1

# Bad -- docstring restating the signature
def calculate_total(items: list[LineItem]) -> Decimal:
    """Calculate the total of items."""
    ...

# Good -- no comment needed when naming is clear
def calculate_order_total(line_items: list[LineItem]) -> Decimal:
    ...

# Good -- comment explains non-obvious decision
# Retry limit is 5 because the upstream API has a known issue
# where the first 2-3 requests after a cold start timeout
MAX_API_RETRIES = 5
```

---

## Trailing Commas

Use trailing commas in multi-line structures to produce cleaner diffs:

```python
# Bad -- adding an item changes two lines in the diff
config = {
    "debug": True,
    "verbose": False
}

# Good -- adding an item changes one line in the diff
config = {
    "debug": True,
    "verbose": False,
}

# Good -- function signatures
def create_user(
    username: str,
    email: str,
    is_active: bool = True,
) -> User:
    ...
```

---

## Comparison and Identity

```python
# Bad
if x == None:
    ...
if x == True:
    ...
if type(x) == int:
    ...

# Good
if x is None:
    ...
if x is True:  # only when checking for the literal True, not truthiness
    ...
if isinstance(x, int):
    ...
```

---

## Error Handling

### Catch Specific Exceptions

```python
# Bad -- bare except
try:
    process(data)
except:
    pass

# Bad -- too broad
try:
    result = api.fetch(resource_id)
    parsed = json.loads(result.body)
    save_to_db(parsed)
except Exception:
    logger.error("❌ Something went wrong")

# Good -- specific exceptions, narrow try blocks
try:
    result = api.fetch(resource_id)
except ConnectionError as exc:
    logger.error("❌ API connection failed for %s: %s", resource_id, exc)
    raise

parsed = json.loads(result.body)

try:
    save_to_db(parsed)
except IntegrityError as exc:
    logger.error("❌ Duplicate record for resource %s", resource_id)
    raise DuplicateResourceError(resource_id) from exc
```

### Custom Exceptions

```python
class ServiceError(Exception):
    pass

class PaymentDeclinedError(ServiceError):
    def __init__(self, order_id: str, reason: str):
        self.order_id = order_id
        self.reason = reason
        super().__init__(f"Payment declined for order {order_id}: {reason}")
```

### Exception Chaining

```python
# Bad -- original traceback lost
try:
    data = external_service.fetch()
except ConnectionError:
    raise ServiceUnavailableError("External service down")

# Good -- chain with `from`
try:
    data = external_service.fetch()
except ConnectionError as exc:
    raise ServiceUnavailableError("External service down") from exc
```
