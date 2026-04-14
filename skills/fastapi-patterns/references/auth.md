# Authentication and Authorization

## OAuth2 Password Flow

### Setup OAuth2PasswordBearer

```python
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
```

The `tokenUrl` tells the OpenAPI docs where the login endpoint is. The scheme extracts
the Bearer token from the `Authorization` header automatically.

### Login Endpoint

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/token")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": str(user.id), "scopes": user.scopes},
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )
```

### Token Response Schema

```python
from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
```

## JWT Tokens

### Token Creation

```python
from datetime import UTC, datetime, timedelta

import jwt

SECRET_KEY = "use-a-real-secret-loaded-from-env"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7


def create_access_token(
    data: dict, expires_delta: timedelta | None = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

### Token Validation

```python
import jwt
from pydantic import BaseModel


class TokenPayload(BaseModel):
    sub: str
    scopes: list[str] = []
    type: str
    exp: datetime


def decode_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenPayload(**payload)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### Refresh Token Endpoint

```python
@router.post("/refresh")
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    token_data = decode_token(refresh_token)
    if token_data.type != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user = await db.get(User, int(token_data.sub))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return TokenResponse(
        access_token=create_access_token(
            data={"sub": str(user.id), "scopes": user.scopes},
        ),
        refresh_token=create_refresh_token(data={"sub": str(user.id)}),
    )
```

## API Key Authentication

### Header-Based API Key

```python
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key")


async def verify_api_key(
    api_key: str = Depends(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> APIClient:
    client = await db.execute(
        select(APIClient).where(APIClient.key == api_key, APIClient.is_active),
    )
    client = client.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return client


@router.get("/data", dependencies=[Depends(verify_api_key)])
async def get_data() -> dict:
    ...
```

### Query Parameter API Key

```python
from fastapi.security import APIKeyQuery

api_key_query = APIKeyQuery(name="api_key")


async def verify_api_key_query(
    api_key: str = Depends(api_key_query),
) -> APIClient:
    ...
```

### Combined Auth (Bearer OR API Key)

```python
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_current_client(
    bearer: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    api_key: str | None = Depends(api_key_header),
    db: AsyncSession = Depends(get_db),
):
    if bearer:
        return await authenticate_bearer(db, bearer.credentials)
    if api_key:
        return await authenticate_api_key(db, api_key)
    raise HTTPException(status_code=401, detail="No credentials provided")
```

## Dependency-Based Auth

### get_current_user Pattern

```python
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token_data = decode_token(token)
    if token_data.type != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = await db.get(User, int(token_data.sub))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return user
```

### Layered Auth Dependencies

```python
async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return user


async def get_current_superuser(
    user: User = Depends(get_current_active_user),
) -> User:
    if not user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser required")
    return user


@router.get("/admin/users")
async def admin_list_users(
    user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[UserResponse]:
    ...
```

## Role-Based Access Control (RBAC)

### Role Checker Dependency

```python
from enum import StrEnum


class Role(StrEnum):
    VIEWER = "viewer"
    EDITOR = "editor"
    ADMIN = "admin"
    OWNER = "owner"


class RoleChecker:
    def __init__(self, allowed_roles: list[Role]):
        self.allowed_roles = allowed_roles

    async def __call__(
        self, user: User = Depends(get_current_active_user),
    ) -> User:
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{user.role}' not authorized",
            )
        return user


require_admin = RoleChecker([Role.ADMIN, Role.OWNER])
require_editor = RoleChecker([Role.EDITOR, Role.ADMIN, Role.OWNER])


@router.delete("/items/{item_id}", dependencies=[Depends(require_admin)])
async def delete_item(item_id: int) -> dict:
    ...


@router.put("/items/{item_id}")
async def update_item(
    item_id: int,
    item: ItemUpdate,
    user: User = Depends(require_editor),
) -> ItemResponse:
    ...
```

### Resource-Level Permissions

```python
async def get_owned_item(
    item_id: int,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Item:
    item = await db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.owner_id != user.id and user.role not in (Role.ADMIN, Role.OWNER):
        raise HTTPException(status_code=403, detail="Not authorized")
    return item


@router.put("/items/{item_id}")
async def update_item(
    item: ItemUpdate,
    existing: Item = Depends(get_owned_item),
    db: AsyncSession = Depends(get_db),
) -> ItemResponse:
    ...
```

## Scopes and Permission Levels

### OAuth2 Scopes

```python
from fastapi.security import OAuth2PasswordBearer, SecurityScopes

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/token",
    scopes={
        "items:read": "Read items",
        "items:write": "Create and update items",
        "items:delete": "Delete items",
        "admin": "Full admin access",
    },
)


async def get_current_user_with_scopes(
    security_scopes: SecurityScopes,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token_data = decode_token(token)
    user = await db.get(User, int(token_data.sub))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    for scope in security_scopes.scopes:
        if scope not in token_data.scopes:
            raise HTTPException(
                status_code=403,
                detail=f"Missing required scope: {scope}",
                headers={
                    "WWW-Authenticate": (
                        f'Bearer scope="{security_scopes.scope_str}"'
                    ),
                },
            )
    return user
```

### Using Scopes in Routes

```python
from fastapi import Security


@router.get("/items")
async def list_items(
    user: User = Security(
        get_current_user_with_scopes, scopes=["items:read"],
    ),
) -> list[ItemResponse]:
    ...


@router.post("/items")
async def create_item(
    item: ItemCreate,
    user: User = Security(
        get_current_user_with_scopes, scopes=["items:write"],
    ),
) -> ItemResponse:
    ...


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: int,
    user: User = Security(
        get_current_user_with_scopes, scopes=["items:delete"],
    ),
) -> dict:
    ...
```

## Security Utilities

### Password Hashing with passlib

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


async def authenticate_user(
    db: AsyncSession, username: str, password: str,
) -> User | None:
    result = await db.execute(
        select(User).where(User.username == username),
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user
```

### Secure Token Generation

```python
import secrets


def generate_api_key(prefix: str = "sk") -> str:
    token = secrets.token_urlsafe(32)
    return f"{prefix}_{token}"


def generate_verification_token() -> str:
    return secrets.token_urlsafe(64)
```

### Password Validation

```python
import re

from pydantic import BaseModel, field_validator


class UserCreate(BaseModel):
    username: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a digit")
        return v
```

## Cookie-Based Sessions

### Setting and Reading Cookies

```python
from fastapi import Cookie, Response


@router.post("/auth/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    response: Response = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    session_token = create_session_token(user)
    response.set_cookie(
        key="session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=3600 * 24,  # 24 hours
        path="/",
    )
    return {"message": "Login successful"}


@router.get("/me")
async def get_me(
    session: str | None = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await validate_session(db, session)
    return user
```

### Session Logout

```python
@router.post("/auth/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(
        key="session",
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return {"message": "Logged out"}
```

### Server-Side Session Storage

```python
import redis.asyncio as aioredis


async def create_session(
    redis: aioredis.Redis, user_id: int,
) -> str:
    session_id = secrets.token_urlsafe(32)
    await redis.setex(
        f"session:{session_id}",
        3600 * 24,
        str(user_id),
    )
    return session_id


async def get_session_user(
    session: str | None = Cookie(None),
    redis: aioredis.Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = await redis.get(f"session:{session}")
    if not user_id:
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.get(User, int(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

## CORS Configuration for Auth

### Standard Auth CORS Setup

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.example.com",
        "https://admin.example.com",
    ],
    allow_credentials=True,  # required for cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-API-Key",
        "X-Request-ID",
    ],
    expose_headers=["X-Total-Count", "X-Request-ID"],
    max_age=3600,
)
```

### Environment-Based CORS

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cors_origins: list[str] = ["http://localhost:3000"]
    environment: str = "local"


settings = Settings()

if settings.environment == "local":
    origins = ["http://localhost:3000", "http://localhost:5173"]
else:
    origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### CORS Preflight Notes

When `allow_credentials=True`:
- `allow_origins` cannot be `["*"]` -- list specific origins explicitly
- The browser sends a preflight `OPTIONS` request for non-simple requests
- Credentials include cookies, authorization headers, and TLS client certificates

When using API keys in custom headers:
- Add the header name to `allow_headers` (e.g., `X-API-Key`)
- The browser preflight will verify the header is allowed before sending the request
