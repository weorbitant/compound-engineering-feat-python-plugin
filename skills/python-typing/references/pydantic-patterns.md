# Pydantic v2 Patterns Reference

Comprehensive reference for Pydantic v2 model design, validation, serialization, and framework
integration.

## BaseModel Fundamentals

```python
from pydantic import BaseModel, Field

class User(BaseModel):
    id: int
    name: str = Field(min_length=1, max_length=100)
    email: str
    age: int | None = None
    tags: list[str] = Field(default_factory=list)

# Construction
user = User(id=1, name="Alice", email="alice@example.com")
user = User.model_validate({"id": 1, "name": "Alice", "email": "alice@example.com"})
user = User.model_validate_json('{"id": 1, "name": "Alice", "email": "alice@example.com"}')
```

### Model Configuration

```python
from pydantic import BaseModel, ConfigDict

class StrictUser(BaseModel):
    model_config = ConfigDict(
        strict=True,              # no type coercion
        frozen=True,              # immutable instances
        str_strip_whitespace=True,
        validate_default=True,
        extra="forbid",           # error on unknown fields
        populate_by_name=True,    # allow both alias and field name
    )

    id: int
    name: str
    email: str = Field(alias="emailAddress")
```

## Field Configuration

```python
from pydantic import BaseModel, Field, computed_field

class Product(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0, description="Price in USD")
    quantity: int = Field(ge=0, default=0)
    sku: str = Field(pattern=r"^[A-Z]{2}-\d{4}$")
    tags: list[str] = Field(default_factory=list, max_length=10)

    # Computed field (read-only, derived from other fields)
    @computed_field
    @property
    def total_value(self) -> float:
        return self.price * self.quantity
```

### Field with Alias

```python
from pydantic import BaseModel, Field

class APIResponse(BaseModel):
    status_code: int = Field(alias="statusCode")
    error_message: str | None = Field(default=None, alias="errorMessage")
    request_id: str = Field(alias="requestId")

# Accepts both alias and field name when populate_by_name=True
response = APIResponse(statusCode=200, requestId="abc-123")
response = APIResponse(status_code=200, request_id="abc-123")
```

## field_validator

Validate individual fields. Always use `@classmethod` decorator.

```python
from pydantic import BaseModel, field_validator

class Registration(BaseModel):
    username: str
    email: str
    password: str
    age: int

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("must be alphanumeric")
        return v

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("invalid email format")
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("must contain an uppercase letter")
        return v

    # Validate multiple fields with the same validator
    @field_validator("username", "email")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        return v
```

### Validator Modes

```python
from pydantic import BaseModel, field_validator

class Item(BaseModel):
    price: float

    # mode="before": runs before Pydantic's own parsing
    @field_validator("price", mode="before")
    @classmethod
    def parse_price(cls, v: Any) -> float:
        if isinstance(v, str):
            v = v.replace("$", "").replace(",", "")
        return float(v)

    # mode="after" (default): runs after Pydantic's parsing and type coercion
    @field_validator("price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("price must be positive")
        return round(v, 2)
```

## model_validator

Validate across multiple fields simultaneously.

### Before Mode

Runs before individual field validation. Receives raw input data.

```python
from pydantic import BaseModel, model_validator

class DateRange(BaseModel):
    start_date: date
    end_date: date

    @model_validator(mode="before")
    @classmethod
    def preprocess(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Normalize field names from API
            if "from" in data:
                data["start_date"] = data.pop("from")
            if "to" in data:
                data["end_date"] = data.pop("to")
        return data
```

### After Mode

Runs after all fields are validated. Receives the fully constructed model instance.

```python
from pydantic import BaseModel, model_validator

class DateRange(BaseModel):
    start_date: date
    end_date: date
    duration_days: int | None = None

    @model_validator(mode="after")
    def validate_range(self) -> Self:
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        if self.duration_days is None:
            self.duration_days = (self.end_date - self.start_date).days
        return self
```

### Wrap Mode

Full control: receives the input and a handler to call the inner validation.

```python
from pydantic import BaseModel, model_validator

class FlexibleUser(BaseModel):
    name: str
    email: str

    @model_validator(mode="wrap")
    @classmethod
    def handle_legacy(cls, data: Any, handler: Any) -> Self:
        if isinstance(data, str):
            # Legacy format: "name:email"
            name, email = data.split(":")
            data = {"name": name, "email": email}
        return handler(data)
```

## Custom Types with `__get_pydantic_core_schema__`

Create reusable custom types with full Pydantic integration.

```python
from typing import Any, Annotated
from pydantic import GetCoreSchemaHandler, GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import CoreSchema, core_schema

class Color:
    def __init__(self, hex_value: str) -> None:
        if not hex_value.startswith("#") or len(hex_value) != 7:
            raise ValueError(f"invalid hex color: {hex_value}")
        self.hex_value = hex_value

    def __repr__(self) -> str:
        return f"Color({self.hex_value!r})"

    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        source_type: Any,
        handler: GetCoreSchemaHandler,
    ) -> CoreSchema:
        return core_schema.no_info_plain_validator_function(
            cls._validate,
            serialization=core_schema.to_string_ser_schema(),
        )

    @classmethod
    def _validate(cls, value: Any) -> "Color":
        if isinstance(value, cls):
            return value
        if isinstance(value, str):
            return cls(value)
        raise ValueError(f"cannot create Color from {type(value)}")

    @classmethod
    def __get_pydantic_json_schema__(
        cls,
        _schema: CoreSchema,
        handler: GetJsonSchemaHandler,
    ) -> JsonSchemaValue:
        return {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"}

    def __str__(self) -> str:
        return self.hex_value


class Theme(BaseModel):
    primary: Color
    secondary: Color
    background: Color = Color("#ffffff")

theme = Theme(primary="#ff0000", secondary="#00ff00")
```

### Simpler Custom Types with Annotated

For simpler cases, use `Annotated` with Pydantic validators:

```python
from typing import Annotated
from pydantic import AfterValidator, BeforeValidator

def validate_non_empty(v: str) -> str:
    if not v.strip():
        raise ValueError("must not be empty")
    return v.strip()

def parse_comma_list(v: str | list[str]) -> list[str]:
    if isinstance(v, str):
        return [item.strip() for item in v.split(",")]
    return v

NonEmptyStr = Annotated[str, AfterValidator(validate_non_empty)]
CommaList = Annotated[list[str], BeforeValidator(parse_comma_list)]

class Config(BaseModel):
    name: NonEmptyStr
    allowed_hosts: CommaList
```

## Nested Models and Forward References

```python
from __future__ import annotations
from pydantic import BaseModel

class Address(BaseModel):
    street: str
    city: str
    country: str = "US"

class Company(BaseModel):
    name: str
    address: Address
    employees: list[Employee]  # forward reference resolved by __future__ annotations

class Employee(BaseModel):
    name: str
    email: str
    company: Company | None = None  # circular reference

# model_rebuild() resolves forward references if not using __future__ annotations
Company.model_rebuild()
Employee.model_rebuild()

# Nested construction from dicts
company = Company(
    name="Acme",
    address={"street": "123 Main", "city": "Springfield"},
    employees=[{"name": "Alice", "email": "alice@acme.com"}],
)
```

## Serialization: model_dump and model_dump_json

```python
from pydantic import BaseModel, Field

class Order(BaseModel):
    id: int
    customer_name: str = Field(alias="customerName")
    items: list[str]
    total: float
    notes: str | None = None

order = Order(id=1, customerName="Alice", items=["widget"], total=29.99)

# Dictionary serialization
order.model_dump()
# {"id": 1, "customer_name": "Alice", "items": ["widget"], "total": 29.99, "notes": None}

order.model_dump(exclude_none=True)
# {"id": 1, "customer_name": "Alice", "items": ["widget"], "total": 29.99}

order.model_dump(by_alias=True)
# {"id": 1, "customerName": "Alice", "items": ["widget"], "total": 29.99, "notes": None}

order.model_dump(include={"id", "total"})
# {"id": 1, "total": 29.99}

order.model_dump(exclude={"notes"})
# {"id": 1, "customer_name": "Alice", "items": ["widget"], "total": 29.99}

# JSON serialization
order.model_dump_json()
order.model_dump_json(indent=2, exclude_none=True)

# Round-trip: JSON string -> model
Order.model_validate_json(order.model_dump_json())
```

### Custom Serialization

```python
from pydantic import BaseModel, field_serializer, model_serializer
from datetime import datetime

class Event(BaseModel):
    name: str
    timestamp: datetime

    @field_serializer("timestamp")
    def serialize_timestamp(self, value: datetime, _info: Any) -> str:
        return value.isoformat()

class WrappedResponse(BaseModel):
    data: dict[str, Any]
    meta: dict[str, Any]

    @model_serializer
    def serialize(self) -> dict[str, Any]:
        return {"data": self.data, "meta": self.meta, "version": "2.0"}
```

## BaseSettings for Configuration

Load settings from environment variables, `.env` files, and other sources.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr

class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="DB_",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    host: str = "localhost"
    port: int = 5432
    name: str
    user: str
    password: SecretStr

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    debug: bool = False
    secret_key: SecretStr
    allowed_hosts: list[str] = Field(default_factory=lambda: ["localhost"])
    db: DatabaseSettings = DatabaseSettings()

# Reads from environment:
# DB_HOST=postgres DB_PORT=5432 DB_NAME=myapp DB_USER=admin DB_PASSWORD=secret
# DEBUG=true SECRET_KEY=abc123

settings = AppSettings()
print(settings.db.host)                    # "postgres"
print(settings.db.password.get_secret_value())  # "secret"
```

### Nested Settings with Environment Variable Prefixes

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class RedisSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="REDIS_")

    host: str = "localhost"
    port: int = 6379
    db: int = 0

class CacheSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CACHE_")

    ttl: int = 300
    redis: RedisSettings = RedisSettings()
```

## Discriminated Unions

Efficiently handle polymorphic data by selecting the correct model based on a discriminator field.

### String Discriminator

```python
from typing import Literal, Annotated
from pydantic import BaseModel, Field

class CreditCardPayment(BaseModel):
    type: Literal["credit_card"]
    card_number: str
    expiry: str

class BankTransferPayment(BaseModel):
    type: Literal["bank_transfer"]
    account_number: str
    routing_number: str

class CryptoPayment(BaseModel):
    type: Literal["crypto"]
    wallet_address: str
    currency: Literal["BTC", "ETH"]

Payment = Annotated[
    CreditCardPayment | BankTransferPayment | CryptoPayment,
    Field(discriminator="type"),
]

class Order(BaseModel):
    id: int
    amount: float
    payment: Payment

# Pydantic selects the correct model based on "type"
order = Order(
    id=1,
    amount=99.99,
    payment={"type": "credit_card", "card_number": "4111...", "expiry": "12/25"},
)
assert isinstance(order.payment, CreditCardPayment)
```

### Callable Discriminator

For cases where the discriminator logic is more complex than a single field:

```python
from typing import Annotated
from pydantic import BaseModel, Discriminator, Tag

class Circle(BaseModel):
    radius: float

class Rectangle(BaseModel):
    width: float
    height: float

def shape_discriminator(data: dict[str, Any]) -> str:
    if "radius" in data:
        return "circle"
    return "rectangle"

Shape = Annotated[
    Annotated[Circle, Tag("circle")] | Annotated[Rectangle, Tag("rectangle")],
    Discriminator(shape_discriminator),
]

class Canvas(BaseModel):
    shapes: list[Shape]
```

## Generic Models

Create reusable model templates parameterized by type.

```python
from typing import Generic, TypeVar
from pydantic import BaseModel, computed_field

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int

    @computed_field
    @property
    def has_next(self) -> bool:
        return self.page * self.page_size < self.total

class User(BaseModel):
    id: int
    name: str

class Product(BaseModel):
    id: int
    title: str
    price: float

# Concrete parameterized types
UserPage = PaginatedResponse[User]
ProductPage = PaginatedResponse[Product]

response = UserPage(
    items=[User(id=1, name="Alice")],
    total=50,
    page=1,
    page_size=20,
)
```

### Generic with Multiple Parameters

```python
from typing import Generic, Self, TypeVar
from pydantic import BaseModel, model_validator

T = TypeVar("T")
E = TypeVar("E")

class Result(BaseModel, Generic[T, E]):
    data: T | None = None
    error: E | None = None
    success: bool

    @model_validator(mode="after")
    def check_consistency(self) -> Self:
        if self.success and self.data is None:
            raise ValueError("successful result must have data")
        if not self.success and self.error is None:
            raise ValueError("failed result must have error")
        return self

class ValidationError(BaseModel):
    field: str
    message: str

UserResult = Result[User, ValidationError]
```

## FastAPI Integration

```python
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

app = FastAPI()

class CreateItemRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0)
    tags: list[str] = Field(default_factory=list, max_length=10)

class ItemResponse(BaseModel):
    id: int
    name: str
    price: float
    tags: list[str]

class PaginatedItems(BaseModel):
    items: list[ItemResponse]
    total: int

@app.post("/items", response_model=ItemResponse, status_code=201)
async def create_item(request: CreateItemRequest) -> ItemResponse:
    item = await db.create_item(**request.model_dump())
    return ItemResponse.model_validate(item)

@app.get("/items", response_model=PaginatedItems)
async def list_items(
    page: int = Query(ge=1, default=1),
    size: int = Query(ge=1, le=100, default=20),
    tag: str | None = None,
) -> PaginatedItems:
    items, total = await db.list_items(page=page, size=size, tag=tag)
    return PaginatedItems(
        items=[ItemResponse.model_validate(i) for i in items],
        total=total,
    )
```

### FastAPI with Discriminated Unions

```python
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Annotated, Literal

class WebhookPush(BaseModel):
    event: Literal["push"]
    branch: str
    commits: list[str]

class WebhookPR(BaseModel):
    event: Literal["pull_request"]
    action: Literal["opened", "closed", "merged"]
    pr_number: int

WebhookPayload = Annotated[
    WebhookPush | WebhookPR,
    Field(discriminator="event"),
]

@app.post("/webhook")
async def handle_webhook(payload: WebhookPayload) -> dict[str, str]:
    match payload:
        case WebhookPush():
            return {"status": f"processed push to {payload.branch}"}
        case WebhookPR():
            return {"status": f"processed PR #{payload.pr_number} ({payload.action})"}
```

## Django Ninja Integration

```python
from ninja import NinjaAPI, Schema, Query
from pydantic import Field

api = NinjaAPI()

class CreateUserSchema(Schema):
    username: str = Field(min_length=3, max_length=50)
    email: str
    password: str = Field(min_length=8)

class UserOut(Schema):
    id: int
    username: str
    email: str

class FilterParams(Schema):
    search: str | None = None
    is_active: bool = True
    page: int = Field(ge=1, default=1)
    size: int = Field(ge=1, le=100, default=20)

@api.post("/users", response=UserOut)
def create_user(request, payload: CreateUserSchema):
    user = User.objects.create_user(
        username=payload.username,
        email=payload.email,
        password=payload.password,
    )
    return user

@api.get("/users", response=list[UserOut])
def list_users(request, filters: Query[FilterParams]):
    qs = User.objects.filter(is_active=filters.is_active)
    if filters.search:
        qs = qs.filter(username__icontains=filters.search)
    offset = (filters.page - 1) * filters.size
    return list(qs[offset : offset + filters.size])
```

### Django Model to Pydantic Conversion

```python
from ninja import Schema, ModelSchema
from myapp.models import Product

# Automatic schema from Django model
class ProductSchema(ModelSchema):
    class Meta:
        model = Product
        fields = ["id", "name", "price", "category"]

# Manual schema with custom validation
class ProductCreateSchema(Schema):
    name: str = Field(min_length=1)
    price: float = Field(gt=0)
    category_id: int

    @field_validator("name")
    @classmethod
    def name_title_case(cls, v: str) -> str:
        return v.strip().title()
```

## Error Handling Patterns

```python
from pydantic import BaseModel, ValidationError

class UserInput(BaseModel):
    name: str
    age: int

# Catch and handle validation errors
try:
    user = UserInput(name="", age="not_a_number")
except ValidationError as e:
    for error in e.errors():
        print(f"Field: {error['loc']}, Error: {error['msg']}")
    # Field: ('name',), Error: String should have at least 1 character
    # Field: ('age',), Error: Input should be a valid integer

# Structured error response for APIs
def format_validation_errors(exc: ValidationError) -> dict[str, list[str]]:
    errors: dict[str, list[str]] = {}
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.setdefault(field, []).append(error["msg"])
    return errors
```

## Abstract Base Models

Share common fields and configuration across models.

```python
from datetime import datetime, timezone
from pydantic import BaseModel, Field, computed_field

class TimestampedModel(BaseModel):
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SoftDeletableModel(TimestampedModel):
    deleted_at: datetime | None = None

    @computed_field
    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

class User(SoftDeletableModel):
    id: int
    name: str
    email: str

class Post(SoftDeletableModel):
    id: int
    title: str
    author_id: int
```

## JSON Schema Generation

```python
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str
    email: str
    age: int | None = None

# Generate JSON Schema
schema = User.model_json_schema()
# {
#     "properties": {
#         "id": {"title": "Id", "type": "integer"},
#         "name": {"title": "Name", "type": "string"},
#         "email": {"title": "Email", "type": "string"},
#         "age": {"anyOf": [{"type": "integer"}, {"type": "null"}], "default": null}
#     },
#     "required": ["id", "name", "email"],
#     "title": "User",
#     "type": "object"
# }
```
