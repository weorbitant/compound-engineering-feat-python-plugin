<overview>
Django Ninja integration patterns for building type-safe APIs. Django Ninja uses Pydantic
schemas for input/output validation and provides a clean router-based API with automatic
OpenAPI documentation. Prefer Django Ninja over DRF for new API projects.
</overview>

<router_setup>
## Router Setup and API Versioning

### Basic Setup

```python
# config/api.py
from ninja import NinjaAPI

api = NinjaAPI(
    title="My App API",
    version="1.0.0",
    description="API for My App",
)
```

### Router-Based Organization

Split endpoints into routers per app:

```python
# orders/api.py
from ninja import Router

router = Router(tags=["orders"])


@router.get("/", response=list[OrderOut])
def list_orders(request):
    return Order.objects.filter(customer=request.user).active()


@router.get("/{order_id}", response=OrderOut)
def get_order(request, order_id: int):
    return get_object_or_404(
        Order.objects.select_related("customer"),
        id=order_id,
        customer=request.user,
    )
```

Register routers in the main API:

```python
# config/api.py
from ninja import NinjaAPI

from orders.api import router as orders_router
from customers.api import router as customers_router

api = NinjaAPI(title="My App API", version="1.0.0")

api.add_router("/orders/", orders_router)
api.add_router("/customers/", customers_router)
```

### API Versioning

```python
# config/api.py
from ninja import NinjaAPI

api_v1 = NinjaAPI(version="1.0.0", urls_namespace="api_v1")
api_v2 = NinjaAPI(version="2.0.0", urls_namespace="api_v2")

# config/urls.py
urlpatterns = [
    path("api/v1/", api_v1.urls),
    path("api/v2/", api_v2.urls),
]
```

### URL Configuration

```python
# config/urls.py
from django.urls import path

from config.api import api

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
```
</router_setup>

<schemas>
## Schema Definitions

Use Pydantic models (schemas) for input validation and output serialization.

### Output Schemas

```python
from datetime import datetime
from decimal import Decimal

from ninja import Schema


class CustomerOut(Schema):
    id: int
    email: str
    full_name: str


class OrderItemOut(Schema):
    id: int
    product_name: str
    quantity: int
    unit_price: Decimal

    @staticmethod
    def resolve_product_name(obj):
        return obj.product.name


class OrderOut(Schema):
    id: int
    customer: CustomerOut
    status: str
    total: Decimal
    items: list[OrderItemOut]
    created_at: datetime
    updated_at: datetime
```

### Input Schemas

```python
class OrderItemIn(Schema):
    product_id: int
    quantity: int = 1


class OrderCreateIn(Schema):
    shipping_address: str
    notes: str = ""
    items: list[OrderItemIn]


class OrderUpdateIn(Schema):
    shipping_address: str | None = None
    notes: str | None = None
```

### Schema with Validation

```python
from pydantic import field_validator


class OrderCreateIn(Schema):
    shipping_address: str
    items: list[OrderItemIn]

    @field_validator("shipping_address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if len(v) < 10:
            raise ValueError("Provide a complete shipping address")
        return v

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: list[OrderItemIn]) -> list[OrderItemIn]:
        if not v:
            raise ValueError("Order must contain at least one item")
        return v
```

### ModelSchema

Auto-generate schemas from Django models:

```python
from ninja import ModelSchema

from orders.models import Order


class OrderOut(ModelSchema):
    class Meta:
        model = Order
        fields = ["id", "status", "total", "created_at"]
```
</schemas>

<path_query_parameters>
## Path and Query Parameters

### Path Parameters

```python
@router.get("/{order_id}", response=OrderOut)
def get_order(request, order_id: int):
    return get_object_or_404(Order, id=order_id, customer=request.user)


@router.get("/by-status/{status}", response=list[OrderOut])
def orders_by_status(request, status: str):
    return Order.objects.filter(customer=request.user, status=status)
```

### Query Parameters

```python
from ninja import Query


class OrderFilterParams(Schema):
    status: str | None = None
    min_total: Decimal | None = None
    max_total: Decimal | None = None
    created_after: datetime | None = None
    search: str | None = None


@router.get("/", response=list[OrderOut])
def list_orders(request, filters: Query[OrderFilterParams]):
    qs = Order.objects.filter(customer=request.user).active()

    if filters.status:
        qs = qs.filter(status=filters.status)
    if filters.min_total is not None:
        qs = qs.filter(total__gte=filters.min_total)
    if filters.max_total is not None:
        qs = qs.filter(total__lte=filters.max_total)
    if filters.created_after:
        qs = qs.filter(created_at__gte=filters.created_after)
    if filters.search:
        qs = qs.filter(
            Q(customer__email__icontains=filters.search)
            | Q(id__icontains=filters.search)
        )

    return qs.select_related("customer").prefetch_related("items__product")
```

### Combining Path and Query Parameters

```python
@router.get("/{order_id}/items", response=list[OrderItemOut])
def list_order_items(
    request,
    order_id: int,
    min_quantity: int = 1,
):
    order = get_object_or_404(Order, id=order_id, customer=request.user)
    return order.items.filter(
        quantity__gte=min_quantity,
    ).select_related("product")
```
</path_query_parameters>

<authentication>
## Authentication

### Session-Based (Django auth)

Endpoints are public unless auth is configured. Use `django_auth` to require a
logged-in Django session (CSRF applies to unsafe methods):

```python
from ninja.security import django_auth

api = NinjaAPI(auth=django_auth)

@api.get("/me", response=UserOut)
def get_current_user(request):
    return request.user
```

### API Key Authentication

```python
from ninja.security import APIKeyHeader


class ApiKeyAuth(APIKeyHeader):
    param_name = "X-API-Key"

    def authenticate(self, request, key: str | None) -> User | None:
        if key is None:
            return None
        try:
            api_key = APIKey.objects.select_related("user").get(
                key=key,
                is_active=True,
            )
            return api_key.user
        except APIKey.DoesNotExist:
            return None


api_key_auth = ApiKeyAuth()

@router.get("/orders", auth=api_key_auth, response=list[OrderOut])
def list_orders(request):
    return Order.objects.filter(customer=request.user)
```

### JWT Authentication

```python
import jwt
from django.conf import settings
from ninja.security import HttpBearer


class JWTAuth(HttpBearer):
    def authenticate(self, request, token: str) -> User | None:
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=["HS256"],
            )
            return User.objects.get(id=payload["user_id"])
        except (jwt.InvalidTokenError, User.DoesNotExist):
            return None


jwt_auth = JWTAuth()

api = NinjaAPI(auth=jwt_auth)  # Apply globally
```

### Per-Router Authentication

```python
# Public router (no auth)
public_router = Router(tags=["public"])

# Authenticated router
private_router = Router(tags=["private"], auth=jwt_auth)

api.add_router("/public/", public_router)
api.add_router("/private/", private_router)
```
</authentication>

<error_handling>
## Error Handling

### Custom Exception Handlers

```python
from ninja import NinjaAPI
from ninja.errors import ValidationError as NinjaValidationError


api = NinjaAPI()


class NotFoundError(Exception):
    def __init__(self, message: str = "Resource not found"):
        self.message = message


class PermissionDeniedError(Exception):
    def __init__(self, message: str = "Permission denied"):
        self.message = message


@api.exception_handler(NotFoundError)
def not_found_handler(request, exc: NotFoundError):
    return api.create_response(
        request,
        {"error": exc.message},
        status=404,
    )


@api.exception_handler(PermissionDeniedError)
def permission_denied_handler(request, exc: PermissionDeniedError):
    return api.create_response(
        request,
        {"error": exc.message},
        status=403,
    )


@api.exception_handler(Exception)
def generic_error_handler(request, exc: Exception):
    logger.error("❌ Unhandled API error: %s", exc, exc_info=True)
    return api.create_response(
        request,
        {"error": "Internal server error"},
        status=500,
    )
```

### Validation Error Response

Django Ninja automatically returns 422 for schema validation errors. Customize the
format:

```python
@api.exception_handler(NinjaValidationError)
def validation_error_handler(request, exc: NinjaValidationError):
    errors = []
    for error in exc.errors:
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
        })
    return api.create_response(
        request,
        {"errors": errors},
        status=422,
    )
```

### Using Errors in Endpoints

```python
@router.post("/", response={201: OrderOut, 400: ErrorOut})
def create_order(request, payload: OrderCreateIn):
    try:
        order = Order.objects.create_order(
            customer=request.user,
            items_data=payload.items,
        )
        return 201, order
    except Product.DoesNotExist:
        return 400, {"error": "One or more products not found"}
```
</error_handling>

<file_uploads_and_pagination>
## File Uploads

```python
from ninja import File, UploadedFile


@router.post("/{order_id}/attachments")
def upload_attachment(
    request,
    order_id: int,
    file: UploadedFile = File(...),
):
    order = get_object_or_404(Order, id=order_id, customer=request.user)
    attachment = OrderAttachment.objects.create(
        order=order,
        file=file,
        filename=file.name,
        size=file.size,
    )
    logger.info(
        "📎 Attachment %s uploaded for order %s",
        attachment.filename,
        order.id,
    )
    return {"id": attachment.id, "filename": attachment.filename}
```

### Multiple File Upload

```python
@router.post("/{order_id}/attachments/bulk")
def upload_multiple(
    request,
    order_id: int,
    files: list[UploadedFile] = File(...),
):
    order = get_object_or_404(Order, id=order_id, customer=request.user)
    attachments = []
    for f in files:
        attachment = OrderAttachment.objects.create(
            order=order,
            file=f,
            filename=f.name,
            size=f.size,
        )
        attachments.append(attachment)
    return {"uploaded": len(attachments)}
```

## Pagination

### Built-In Pagination

```python
from ninja.pagination import paginate, PageNumberPagination


@router.get("/", response=list[OrderOut])
@paginate(PageNumberPagination, page_size=25)
def list_orders(request):
    return Order.objects.filter(customer=request.user).active()
```

### Cursor-Based Pagination

Django Ninja has no built-in cursor pagination -- implement it on `PaginationBase`:

```python
from ninja.pagination import paginate, PaginationBase


class OrderCursorPagination(PaginationBase):
    class Input(Schema):
        cursor: str | None = None
        limit: int = 25

    class Output(Schema):
        items: list[OrderOut]
        next_cursor: str | None

    def paginate_queryset(self, queryset, pagination, **params):
        if pagination.cursor:
            queryset = queryset.filter(id__lt=int(pagination.cursor))
        results = list(queryset[:pagination.limit + 1])
        has_next = len(results) > pagination.limit
        results = results[:pagination.limit]
        next_cursor = str(results[-1].id) if has_next and results else None
        return {
            "items": results,
            "next_cursor": next_cursor,
        }


@router.get("/", response=list[OrderOut])
@paginate(OrderCursorPagination)
def list_orders(request):
    return Order.objects.filter(customer=request.user).order_by("-id")
```
</file_uploads_and_pagination>

<orm_integration>
## Integration with Django ORM

### Returning QuerySets

Django Ninja serializes querysets automatically through schemas:

```python
@router.get("/", response=list[OrderOut])
def list_orders(request):
    return (
        Order.objects
        .filter(customer=request.user)
        .select_related("customer")
        .prefetch_related("items__product")
    )
```

### Using get_object_or_404

```python
from django.shortcuts import get_object_or_404


@router.get("/{order_id}", response=OrderOut)
def get_order(request, order_id: int):
    return get_object_or_404(
        Order.objects.select_related("customer").prefetch_related("items"),
        id=order_id,
        customer=request.user,
    )
```

### Transactions

```python
from django.db import transaction


@router.post("/", response={201: OrderOut})
def create_order(request, payload: OrderCreateIn):
    with transaction.atomic():
        order = Order.objects.create(
            customer=request.user,
            shipping_address=payload.shipping_address,
        )
        total = Decimal("0")
        for item in payload.items:
            product = get_object_or_404(Product, id=item.product_id)
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=item.quantity,
                unit_price=product.price,
            )
            total += product.price * item.quantity
        order.total = total
        order.save(update_fields=["total"])
    logger.info("✅ Order %s created via API", order.id)
    return 201, order
```

### Async Endpoints

Django Ninja supports async views when using Django 4.1+:

```python
from asgiref.sync import sync_to_async


@router.get("/{order_id}", response=OrderOut)
async def get_order(request, order_id: int):
    return await sync_to_async(get_object_or_404)(
        Order.objects.select_related("customer"),
        id=order_id,
        customer=request.user,
    )
```
</orm_integration>

<testing>
## Testing Ninja Endpoints

### Test Client Setup

```python
import pytest
from ninja.testing import TestClient

from config.api import api


@pytest.fixture
def client():
    return TestClient(api)
```

Ninja's `TestClient` has no `force_authenticate` (that is DRF's `APIClient`).
Authenticate by passing `user=` per request -- extra keyword arguments are set
as attributes on the mock request.

### Testing Endpoints

```python
def test_list_orders(client, user, order_factory):
    order_factory.create_batch(3)

    response = client.get("/orders/", user=user)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


def test_create_order(client, user, product):
    payload = {
        "shipping_address": "123 Main St, City, State 12345",
        "items": [
            {"product_id": product.id, "quantity": 2},
        ],
    }

    response = client.post("/orders/", json=payload, user=user)

    assert response.status_code == 201
    data = response.json()
    assert data["total"] == str(product.price * 2)


def test_create_order_validation_error(client, user):
    payload = {
        "shipping_address": "short",
        "items": [],
    }

    response = client.post("/orders/", json=payload, user=user)

    assert response.status_code == 422
```

### Testing Authentication

```python
def test_unauthenticated_request(client):
    response = client.get("/orders/")

    assert response.status_code == 401


def test_api_key_auth(client, api_key):
    response = client.get(
        "/orders/",
        headers={"X-API-Key": api_key.key},
    )

    assert response.status_code == 200
```

### Testing with Django TestCase (alternative)

```python
from django.test import TestCase, override_settings


@pytest.fixture
def api_client():
    from django.test import Client
    return Client()


def test_order_api_integration(api_client, user):
    api_client.force_login(user)
    response = api_client.get("/api/orders/")
    assert response.status_code == 200
```

### Running Tests

```bash
ENVIRONMENT=test poetry run pytest tests/ -v
ENVIRONMENT=test poetry run pytest tests/test_api.py -v -k "test_create_order"
```
</testing>
