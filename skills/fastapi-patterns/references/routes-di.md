# Routes, Dependency Injection, and Middleware

## Route Definition

Define routes with HTTP method decorators on `APIRouter` or the app instance. Use type
annotations for automatic parameter parsing and validation.

### Path and Query Parameters

```python
from fastapi import APIRouter, Path, Query

router = APIRouter()


@router.get("/items/{item_id}")
async def get_item(
    item_id: int = Path(..., gt=0, description="The item ID"),
    include_details: bool = Query(False, description="Include full details"),
) -> ItemResponse:
    ...


@router.get("/items")
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    category: str | None = Query(None),
) -> list[ItemResponse]:
    ...
```

### Request Body

```python
from fastapi import APIRouter
from pydantic import BaseModel, Field


class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    price: float = Field(..., gt=0)
    tags: list[str] = Field(default_factory=list)


@router.post("/items", status_code=201)
async def create_item(item: ItemCreate) -> ItemResponse:
    ...
```

### Multiple Parameter Sources

```python
from fastapi import APIRouter, Body, Header


@router.put("/items/{item_id}")
async def update_item(
    item_id: int,
    item: ItemUpdate,
    x_request_id: str = Header(...),
    priority: int = Body(0, embed=True),
) -> ItemResponse:
    ...
```

## Router Organization

Split routes into domain-specific routers and compose them in the main application.

### APIRouter with Prefix and Tags

```python
# src/routes/users.py
from fastapi import APIRouter

router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses={404: {"description": "User not found"}},
)


@router.get("/")
async def list_users() -> list[UserResponse]:
    ...


@router.get("/{user_id}")
async def get_user(user_id: int) -> UserResponse:
    ...
```

### Composing Routers in the App

```python
# src/main.py
from fastapi import FastAPI

from routes.users import router as users_router
from routes.items import router as items_router

app = FastAPI(title="My API", version="1.0.0")

app.include_router(users_router, prefix="/api/v1")
app.include_router(items_router, prefix="/api/v1")
```

### Nested Routers

```python
# src/routes/admin/__init__.py
from fastapi import APIRouter

from .users import router as admin_users_router
from .settings import router as admin_settings_router

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(admin_users_router)
router.include_router(admin_settings_router)
```

## Dependency Injection

Use `Depends()` to inject shared logic, resources, and configuration into route handlers.

### Basic Dependencies

```python
from fastapi import Depends

from config import Settings


def get_settings() -> Settings:
    return Settings()


@router.get("/info")
async def app_info(settings: Settings = Depends(get_settings)) -> dict:
    return {"app_name": settings.app_name, "version": settings.version}
```

### Database Session Dependency

```python
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


@router.get("/items")
async def list_items(db: AsyncSession = Depends(get_db)) -> list[ItemResponse]:
    result = await db.execute(select(Item))
    return result.scalars().all()
```

### Sub-Dependencies

Dependencies can depend on other dependencies, forming a chain.

```python
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await authenticate_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return user


@router.get("/me")
async def read_me(
    user: User = Depends(get_current_active_user),
) -> UserResponse:
    return user
```

### Yield Dependencies (Cleanup Logic)

```python
from collections.abc import AsyncGenerator


async def get_http_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    async with httpx.AsyncClient(timeout=30) as client:
        yield client
    # cleanup runs after the route handler completes
```

### Class-Based Dependencies

```python
class Pagination:
    def __init__(
        self,
        skip: int = Query(0, ge=0),
        limit: int = Query(20, ge=1, le=100),
    ):
        self.skip = skip
        self.limit = limit


@router.get("/items")
async def list_items(
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
) -> list[ItemResponse]:
    query = select(Item).offset(pagination.skip).limit(pagination.limit)
    result = await db.execute(query)
    return result.scalars().all()
```

### Router-Level Dependencies

Apply dependencies to all routes in a router.

```python
router = APIRouter(
    prefix="/admin",
    dependencies=[Depends(require_admin_role)],
)
```

## Request and Response Models

### Separate Create/Update/Response Schemas

```python
from pydantic import BaseModel, Field, ConfigDict


class ItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None


class ItemCreate(ItemBase):
    price: float = Field(..., gt=0)


class ItemUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = Field(None, gt=0)


class ItemResponse(ItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    price: float
    created_at: datetime
```

### Paginated Response

```python
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    skip: int
    limit: int


@router.get("/items")
async def list_items(
    pagination: Pagination = Depends(),
) -> PaginatedResponse[ItemResponse]:
    ...
```

## Path Operation Configuration

```python
@router.post(
    "/items",
    response_model=ItemResponse,
    status_code=201,
    summary="Create a new item",
    description="Create a new item with the given properties.",
    response_description="The created item",
    responses={
        409: {"description": "Item already exists"},
    },
    tags=["items"],
    operation_id="create_item",
)
async def create_item(item: ItemCreate) -> ItemResponse:
    ...
```

### Excluding Fields from Response

```python
@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int) -> UserResponse:
    ...


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    hashed_password: str = Field(exclude=True)
```

## Middleware

### CORS Middleware

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://example.com", "https://app.example.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
    max_age=3600,
)
```

### Trusted Host Middleware

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["example.com", "*.example.com"],
)
```

### Custom Middleware

```python
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        response.headers["X-Process-Time"] = f"{duration:.4f}"
        logger.info(
            "⏱️ %s %s completed in %.4fs",
            request.method,
            request.url.path,
            duration,
        )
        return response


app.add_middleware(TimingMiddleware)
```

### Pure ASGI Middleware (Better Performance)

```python
from starlette.types import ASGIApp, Receive, Scope, Send


class RequestIDMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(
        self, scope: Scope, receive: Receive, send: Send,
    ) -> None:
        if scope["type"] == "http":
            request_id = str(uuid.uuid4())
            scope.setdefault("state", {})["request_id"] = request_id
        await self.app(scope, receive, send)


app.add_middleware(RequestIDMiddleware)
```

## Error Handling

### HTTPException

```python
from fastapi import HTTPException


@router.get("/items/{item_id}")
async def get_item(item_id: int) -> ItemResponse:
    item = await item_service.get(item_id)
    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Item {item_id} not found",
            headers={"X-Error": "item-not-found"},
        )
    return item
```

### Custom Exception Handlers

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ItemNotFoundError(Exception):
    def __init__(self, item_id: int):
        self.item_id = item_id


async def item_not_found_handler(
    request: Request, exc: ItemNotFoundError,
) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={
            "error": "item_not_found",
            "detail": f"Item {exc.item_id} not found",
        },
    )


app = FastAPI()
app.add_exception_handler(ItemNotFoundError, item_not_found_handler)
```

### Overriding Validation Error Responses

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


async def validation_error_handler(
    request: Request, exc: RequestValidationError,
) -> JSONResponse:
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        })
    return JSONResponse(
        status_code=422,
        content={"error": "validation_error", "details": errors},
    )


app.add_exception_handler(RequestValidationError, validation_error_handler)
```

## OpenAPI Customization

### Custom Operation IDs

```python
def generate_operation_id(route) -> str:
    return f"{route.tags[0]}_{route.name}" if route.tags else route.name


app = FastAPI()

for route in app.routes:
    if hasattr(route, "operation_id"):
        route.operation_id = generate_operation_id(route)
```

### Request/Response Examples

```python
class ItemCreate(BaseModel):
    name: str
    price: float

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"name": "Widget", "price": 9.99},
                {"name": "Gadget", "price": 24.99},
            ],
        },
    )
```

### Hiding Routes from Docs

```python
@router.get("/internal/health", include_in_schema=False)
async def health_check() -> dict:
    return {"status": "ok"}
```

## Lifespan Events

Use the lifespan context manager for startup/shutdown logic.

```python
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup: initialize resources
    logger.info("🚀 Starting up, initializing connection pool")
    app.state.db_pool = await create_pool()
    app.state.redis = await aioredis.from_url(settings.redis_url)
    yield
    # Shutdown: clean up resources
    logger.info("🛑 Shutting down, closing connections")
    await app.state.db_pool.close()
    await app.state.redis.close()


app = FastAPI(lifespan=lifespan)
```

### Accessing Lifespan State in Dependencies

```python
from fastapi import Request


def get_redis(request: Request):
    return request.app.state.redis


@router.get("/cached/{key}")
async def get_cached(
    key: str, redis=Depends(get_redis),
) -> dict:
    value = await redis.get(key)
    return {"key": key, "value": value}
```
