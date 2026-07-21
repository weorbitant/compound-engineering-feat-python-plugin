# SQLAlchemy 2.0 Async Patterns

## Declarative Models

### DeclarativeBase

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass
```

All models inherit from `Base`. The `DeclarativeBase` class replaces the legacy
`declarative_base()` function and provides full type inference.

### Mapped Columns

```python
from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    is_available: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))

    category: Mapped["Category"] = relationship(back_populates="products")
    tags: Mapped[list["Tag"]] = relationship(
        secondary="product_tags", back_populates="products"
    )
```

Type mapping rules:
- `Mapped[str]` -- NOT NULL column, inferred as `String`
- `Mapped[str | None]` -- nullable column
- `Mapped[int]` -- `Integer`
- `Mapped[bool]` -- `Boolean`
- `Mapped[Decimal]` -- requires explicit `Numeric(precision, scale)`
- `Mapped[datetime]` -- `DateTime`

### Table Arguments and Constraints

```python
from sqlalchemy import CheckConstraint, Index, UniqueConstraint


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("user_id", "reference_number"),
        CheckConstraint("total >= 0", name="positive_total"),
        Index("ix_orders_user_status", "user_id", "status"),
        {"schema": "sales"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    reference_number: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
```

### Mixins and Abstract Models

```python
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(default=None)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class User(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
```

### Hybrid Properties

```python
from sqlalchemy.ext.hybrid import hybrid_property


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)

    @hybrid_property
    def discounted_price(self) -> Decimal:
        return self.price * (1 - self.discount_pct / 100)

    @discounted_price.inplace.expression
    @classmethod
    def _discounted_price_expression(cls):
        return cls.price * (1 - cls.discount_pct / 100)
```

Hybrid properties work both at the Python instance level and in SQL queries:

```python
# Python level
product.discounted_price  # computed in Python

# SQL level -- generates SQL expression
stmt = select(Product).where(Product.discounted_price < 50)
```

## Async Engine and Session

### Engine Configuration

```python
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost:5432/dbname",
    pool_size=20,
    max_overflow=10,
    pool_recycle=3600,
    pool_pre_ping=True,
    echo=False,
)
```

Connection pool parameters:
- `pool_size` -- Number of persistent connections (default 5)
- `max_overflow` -- Additional connections allowed beyond pool_size (default 10)
- `pool_recycle` -- Seconds before a connection is recycled (prevents stale connections)
- `pool_pre_ping` -- Test connection liveness before checkout (adds small overhead)
- `pool_timeout` -- Seconds to wait for a connection from the pool (default 30)

### Session Factory

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
```

Set `expire_on_commit=False` to prevent lazy-load attempts on committed objects, which
would fail in async context.

### Application Lifecycle

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(lifespan=lifespan)
```

Always dispose the engine on shutdown to close all pooled connections cleanly.

## Session Lifecycle in FastAPI

### Dependency Injection

```python
from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
```

The session is created when the dependency is resolved and closed after the response
is sent. Each request gets its own session (request-scoped).

### Session with Auto-Commit on Success

```python
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

This variant auto-commits if the route completes without exception and rolls back
on any error. Choose this when most routes perform writes.

### Nested Session Dependency for Services

```python
class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_user(self, email: str, name: str) -> User:
        user = User(email=email, name=name)
        self.session.add(user)
        await self.session.flush()
        return user


async def get_user_service(
    session: AsyncSession = Depends(get_session),
) -> UserService:
    return UserService(session)


@app.post("/users")
async def create_user(
    payload: CreateUserRequest,
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    user = await service.create_user(payload.email, payload.name)
    return UserResponse.model_validate(user)
```

## Query Patterns

### Select with Filtering

```python
from sqlalchemy import select

stmt = select(User).where(User.is_active == True)
result = await session.execute(stmt)
users = result.scalars().all()
```

### Single Result

```python
stmt = select(User).where(User.id == user_id)
result = await session.execute(stmt)

user = result.scalar_one()           # raises if not exactly one
user = result.scalar_one_or_none()   # returns None if not found
```

### Compound Filters

```python
from sqlalchemy import and_, or_

stmt = select(User).where(
    and_(
        User.is_active == True,
        or_(
            User.email.contains("@company.com"),
            User.role == "admin",
        ),
    )
)
```

### Ordering and Pagination

```python
stmt = (
    select(User)
    .where(User.is_active == True)
    .order_by(User.created_at.desc())
    .offset(offset)
    .limit(limit)
)
result = await session.execute(stmt)
users = result.scalars().all()
```

### Aggregation

```python
from sqlalchemy import func

stmt = select(func.count()).select_from(User).where(User.is_active == True)
result = await session.execute(stmt)
total = result.scalar_one()
```

### Joins

```python
stmt = (
    select(Order, User)
    .join(User, Order.user_id == User.id)
    .where(Order.status == "completed")
)
result = await session.execute(stmt)
rows = result.all()  # list of (Order, User) tuples
```

### Subqueries

```python
subq = (
    select(func.count(Order.id))
    .where(Order.user_id == User.id)
    .correlate(User)
    .scalar_subquery()
)

stmt = select(User, subq.label("order_count")).where(subq > 5)
```

### Exists

```python
from sqlalchemy import exists

has_orders = exists().where(Order.user_id == User.id)
stmt = select(User).where(has_orders)
```

### Bulk Insert

```python
from sqlalchemy import insert

await session.execute(
    insert(User),
    [
        {"email": "a@example.com", "name": "Alice"},
        {"email": "b@example.com", "name": "Bob"},
    ],
)
await session.commit()
```

### Bulk Update

```python
from sqlalchemy import update

stmt = (
    update(User)
    .where(User.last_login < cutoff_date)
    .values(is_active=False)
)
await session.execute(stmt)
await session.commit()
```

### Bulk Delete

```python
from sqlalchemy import delete

stmt = delete(User).where(User.is_active == False)
await session.execute(stmt)
await session.commit()
```

## Relationship Loading Strategies

### selectinload (Recommended for Collections)

Executes a second SELECT with `IN` clause. Best for loading collections:

```python
from sqlalchemy.orm import selectinload

stmt = (
    select(User)
    .options(selectinload(User.orders))
    .where(User.is_active == True)
)
```

### joinedload (Best for Scalars / Many-to-One)

Uses a JOIN to load related objects in the same query:

```python
from sqlalchemy.orm import joinedload

stmt = (
    select(Order)
    .options(joinedload(Order.user))
    .where(Order.id == order_id)
)
```

Avoid `joinedload` for collections -- it duplicates parent rows and can create
cartesian products.

### subqueryload

Executes a separate subquery. Use when `selectinload` would produce an `IN`
clause that is too large:

```python
from sqlalchemy.orm import subqueryload

stmt = select(Category).options(subqueryload(Category.products))
```

### Chained Loading

Load nested relationships:

```python
stmt = (
    select(User)
    .options(
        selectinload(User.orders).selectinload(Order.items),
        selectinload(User.addresses),
    )
)
```

### contains_eager (With Explicit Joins)

When the join is already in the query, use `contains_eager` to tell SQLAlchemy
to populate the relationship from the join result:

```python
from sqlalchemy.orm import contains_eager

stmt = (
    select(Order)
    .join(Order.user)
    .options(contains_eager(Order.user))
    .where(User.is_active == True)
)
```

### Loading Strategy Decision Table

| Relationship | Strategy | Why |
|-------------|----------|-----|
| Many-to-one (e.g., order.user) | `joinedload` | Single query, no extra round trip |
| One-to-many (e.g., user.orders) | `selectinload` | Avoids row duplication |
| Many-to-many | `selectinload` | Avoids cartesian product |
| Large collections (>1000) | `subqueryload` | Avoids large IN clause |
| Already joined in query | `contains_eager` | Reuses existing join |

## Repository Pattern

```python
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: int) -> User | None:
        stmt = select(User).where(User.id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_active(
        self, *, limit: int = 20, offset: int = 0
    ) -> list[User]:
        stmt = (
            select(User)
            .where(User.is_active == True)
            .order_by(User.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_with_orders(self, user_ids: list[int]) -> list[User]:
        stmt = (
            select(User)
            .options(selectinload(User.orders))
            .where(User.id.in_(user_ids))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.session.add(user)
        await self.session.flush()
        return user

    async def update(self, user: User, **kwargs) -> User:
        for key, value in kwargs.items():
            setattr(user, key, value)
        await self.session.flush()
        return user

    async def delete(self, user: User) -> None:
        await self.session.delete(user)
        await self.session.flush()

    async def count_active(self) -> int:
        stmt = (
            select(func.count())
            .select_from(User)
            .where(User.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()
```

### Wiring Repository into FastAPI

```python
from fastapi import Depends


async def get_user_repo(
    session: AsyncSession = Depends(get_session),
) -> UserRepository:
    return UserRepository(session)


@app.get("/users/{user_id}")
async def get_user(
    user_id: int,
    repo: UserRepository = Depends(get_user_repo),
) -> UserResponse:
    user = await repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.model_validate(user)
```

### Generic Repository Base

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase


class BaseRepository[ModelT: DeclarativeBase]:
    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, entity_id: int) -> ModelT | None:
        stmt = select(self.model).where(self.model.id == entity_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(
        self, *, limit: int = 20, offset: int = 0
    ) -> list[ModelT]:
        stmt = select(self.model).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, **kwargs) -> ModelT:
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        return instance

    async def delete(self, instance: ModelT) -> None:
        await self.session.delete(instance)
        await self.session.flush()


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
```

## Transaction Management

### Implicit Transactions

By default, `AsyncSession` operates in an implicit transaction. Call `commit()` to
persist changes:

```python
async with async_session_factory() as session:
    user = User(email="new@example.com", name="New User")
    session.add(user)
    await session.commit()
```

### Explicit Transaction Block

Use `session.begin()` for explicit transaction boundaries:

```python
async with async_session_factory() as session:
    async with session.begin():
        user = User(email="new@example.com", name="New User")
        session.add(user)
        order = Order(user=user, total=Decimal("99.99"))
        session.add(order)
    # auto-commits on successful exit, auto-rolls-back on exception
```

### Savepoints (Nested Transactions)

```python
async with async_session_factory() as session:
    async with session.begin():
        session.add(User(email="a@example.com", name="A"))

        try:
            async with session.begin_nested():
                session.add(User(email="duplicate@example.com", name="Dup"))
                # if this violates unique constraint, only the savepoint rolls back
        except IntegrityError:
            logger.warning("⚠️ Duplicate user skipped")

        # outer transaction continues
        session.add(User(email="b@example.com", name="B"))
```

### Manual Rollback

```python
async with async_session_factory() as session:
    try:
        user = User(email="test@example.com", name="Test")
        session.add(user)
        await session.flush()

        if some_validation_fails(user):
            await session.rollback()
            return

        await session.commit()
    except Exception:
        await session.rollback()
        raise
```

## Connection Pooling

### Production Configuration

```python
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_recycle=3600,
    pool_pre_ping=True,
    pool_timeout=30,
    echo=False,
    connect_args={
        "server_settings": {
            "statement_timeout": "30000",    # 30s query timeout
            "idle_in_transaction_session_timeout": "60000",  # 60s idle tx
        }
    },
)
```

### Sizing Guidelines

- **pool_size**: Set to expected concurrent database-accessing requests. Start with
  `number_of_workers * 2` and adjust based on monitoring
- **max_overflow**: Allow temporary burst capacity. Set to `pool_size / 2`
- **pool_recycle**: Set lower than the database's `wait_timeout`. 3600 (1 hour)
  is a safe default for PostgreSQL
- **pool_pre_ping**: Enable in production to detect stale connections. Adds ~1ms overhead
  per checkout

### Multiple Engines (Read Replicas)

```python
write_engine = create_async_engine(PRIMARY_DB_URL, pool_size=10)
read_engine = create_async_engine(REPLICA_DB_URL, pool_size=30)

write_session_factory = async_sessionmaker(write_engine, expire_on_commit=False)
read_session_factory = async_sessionmaker(read_engine, expire_on_commit=False)


async def get_write_session() -> AsyncGenerator[AsyncSession, None]:
    async with write_session_factory() as session:
        yield session


async def get_read_session() -> AsyncGenerator[AsyncSession, None]:
    async with read_session_factory() as session:
        yield session
```

## Common Anti-Patterns

### Lazy Loading in Async Context

Accessing an unloaded relationship on a detached object raises
`MissingGreenlet`. Always use eager loading:

```python
# Wrong -- will raise MissingGreenlet
user = await session.get(User, 1)
await session.close()
print(user.orders)  # MissingGreenlet error

# Correct -- eager load before closing
stmt = select(User).options(selectinload(User.orders)).where(User.id == 1)
result = await session.execute(stmt)
user = result.scalar_one()
print(user.orders)  # works
```

### Sharing Sessions Across Requests

Never reuse a session between requests. Each request must get its own session
via the dependency injection system.

### N+1 Queries

```python
# Wrong -- executes N+1 queries
users = (await session.execute(select(User))).scalars().all()
for user in users:
    print(user.orders)  # triggers lazy load per user

# Correct -- single query with eager loading
stmt = select(User).options(selectinload(User.orders))
users = (await session.execute(stmt)).scalars().all()
for user in users:
    print(user.orders)  # already loaded
```

### expire_on_commit=True (Default)

With the default `expire_on_commit=True`, accessing attributes after commit
triggers a lazy load, which fails in async:

```python
# Wrong
session_factory = async_sessionmaker(engine)  # expire_on_commit defaults True
async with session_factory() as session:
    user = User(email="test@example.com", name="Test")
    session.add(user)
    await session.commit()
    print(user.name)  # MissingGreenlet

# Correct
session_factory = async_sessionmaker(engine, expire_on_commit=False)
```
