# Alembic Migration Management

## Setup with Async SQLAlchemy

### Initialize Alembic

```bash
alembic init -t async alembic
```

This creates the `alembic/` directory with an async-ready `env.py` template.

### env.py for Async

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.database import Base
from app.config import settings

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Key points:
- `pool.NullPool` prevents connection pool issues during migrations
- `target_metadata = Base.metadata` ensures autogenerate detects all models
- Import all models before setting `target_metadata` so they register with `Base`

### alembic.ini Essentials

```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql+asyncpg://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic

[logger_alembic]
level = INFO
handlers =
qualname = alembic
```

### Import All Models

Ensure all models are imported so autogenerate can detect them. Create a
`models/__init__.py` that imports everything:

```python
# app/models/__init__.py
from app.models.user import User
from app.models.order import Order
from app.models.product import Product

__all__ = ["User", "Order", "Product"]
```

Then in `env.py`:

```python
import app.models  # noqa: F401 -- register all models with Base.metadata
from app.database import Base

target_metadata = Base.metadata
```

## Migration Generation

### Autogenerate

```bash
alembic revision --autogenerate -m "add users table"
```

Autogenerate detects:
- New tables
- Removed tables
- Added / removed columns
- Changed column types (with limitations)
- Added / removed indexes and unique constraints
- Added / removed foreign keys

Autogenerate does NOT detect:
- Table or column renames (seen as drop + add)
- Changes to column `server_default`
- Changes to `CheckConstraint` text
- Changes to `Enum` values

### Empty Migration (Manual)

```bash
alembic revision -m "backfill user display names"
```

Creates a migration with empty `upgrade()` and `downgrade()` functions for manual
editing.

### Naming Convention for Constraints

Configure naming conventions so autogenerate creates deterministic constraint names:

```python
from sqlalchemy import MetaData

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=convention)
```

## Migration Scripts

### Standard Structure

```python
"""add users table

Revision ID: abc123def456
Revises: previous_revision
Create Date: 2025-01-15 10:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "abc123def456"
down_revision: str | None = "previous_revision"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
```

### Common Operations

```python
# Add column
op.add_column("users", sa.Column("phone", sa.String(20), nullable=True))

# Drop column
op.drop_column("users", "phone")

# Alter column type
op.alter_column(
    "users",
    "name",
    existing_type=sa.String(100),
    type_=sa.String(200),
)

# Alter column nullability
op.alter_column(
    "users",
    "phone",
    existing_type=sa.String(20),
    nullable=False,
    existing_server_default=None,
)

# Add index
op.create_index("ix_users_name", "users", ["name"])

# Add unique constraint
op.create_unique_constraint("uq_users_phone", "users", ["phone"])

# Add foreign key
op.create_foreign_key(
    "fk_orders_user_id_users",
    "orders",
    "users",
    ["user_id"],
    ["id"],
    ondelete="CASCADE",
)

# Add check constraint
op.create_check_constraint(
    "ck_orders_positive_total",
    "orders",
    "total >= 0",
)

# Rename column
op.alter_column("users", "name", new_column_name="display_name")

# Rename table
op.rename_table("users", "accounts")

# Create enum type (PostgreSQL)
status_enum = sa.Enum("pending", "active", "disabled", name="user_status")
status_enum.create(op.get_bind())
op.add_column("users", sa.Column("status", status_enum, nullable=True))
```

## Data Migrations

### Using op.execute

```python
def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(200)))

    op.execute(
        "UPDATE users SET display_name = name WHERE display_name IS NULL"
    )


def downgrade() -> None:
    op.drop_column("users", "display_name")
```

### Bulk Operations with SQLAlchemy Core

```python
from sqlalchemy import table, column, String, Integer

def upgrade() -> None:
    users = table(
        "users",
        column("id", Integer),
        column("email", String),
        column("domain", String),
    )

    op.add_column("users", sa.Column("domain", sa.String(255)))

    connection = op.get_bind()
    connection.execute(
        users.update().values(
            domain=sa.func.split_part(users.c.email, "@", 2)
        )
    )


def downgrade() -> None:
    op.drop_column("users", "domain")
```

Use `table()` and `column()` from `sqlalchemy` for ad-hoc table references in data
migrations. Never import application models -- they may change after the migration is
written.

### Batch Data Migration

For large tables, process in batches to avoid locking:

```python
from sqlalchemy import table, column, Integer, String, select

def upgrade() -> None:
    users = table(
        "users",
        column("id", Integer),
        column("name", String),
        column("name_lower", String),
    )

    op.add_column("users", sa.Column("name_lower", sa.String(100)))

    connection = op.get_bind()
    batch_size = 1000
    offset = 0

    while True:
        batch = connection.execute(
            select(users.c.id, users.c.name)
            .where(users.c.name_lower.is_(None))
            .limit(batch_size)
        ).fetchall()

        if not batch:
            break

        for row in batch:
            connection.execute(
                users.update()
                .where(users.c.id == row.id)
                .values(name_lower=row.name.lower())
            )

        offset += batch_size
```

## Branching and Merging

### View Current Heads

```bash
alembic heads
```

### Create a Merge Migration

When two developers create migrations from the same parent:

```bash
alembic merge -m "merge feature_a and feature_b" abc123 def456
```

This creates a migration with multiple `down_revision` values:

```python
down_revision = ("abc123", "def456")
```

### Resolve Conflicts

1. Run `alembic heads` to see divergent heads
2. Run `alembic merge` to create a merge point
3. Review the merge migration for conflicts (e.g., both adding the same column)
4. Test the full migration chain: `alembic upgrade head`

## Testing Migrations

### Up/Down Verification

```python
import pytest
from alembic import command
from alembic.config import Config


@pytest.fixture
def alembic_config() -> Config:
    config = Config("alembic.ini")
    return config


def test_migrations_up_down(alembic_config: Config) -> None:
    command.upgrade(alembic_config, "head")
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")
```

### Test Individual Migration

```python
def test_specific_migration(alembic_config: Config) -> None:
    command.upgrade(alembic_config, "abc123")
    # verify state after upgrade
    command.downgrade(alembic_config, "-1")
    # verify state after downgrade
```

### Verify No Pending Migrations

```python
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine


def test_no_pending_migrations() -> None:
    engine = create_engine(TEST_DATABASE_URL)
    with engine.connect() as connection:
        migration_context = MigrationContext.configure(connection)
        diff = compare_metadata(migration_context, Base.metadata)
        assert diff == [], f"Pending migrations detected: {diff}"
```

## CI/CD Integration

### Pre-Deployment Check

```bash
# Verify migration chain has no issues
alembic check

# Show current revision
alembic current

# Show pending migrations
alembic history --indicate-current
```

### Deployment Script

```bash
#!/bin/bash
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Verifying migration state..."
alembic current

echo "Starting application..."
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### GitHub Actions Example

```yaml
- name: Run migrations
  env:
    DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost/test_db
  run: |
    alembic upgrade head

- name: Check for pending migrations
  run: |
    alembic check
```

## Zero-Downtime Migration Strategies

### Adding a Non-Null Column

Never add a NOT NULL column without a default in a single step. Use three migrations:

**Migration 1: Add nullable column**

```python
def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("display_name", sa.String(200), nullable=True),
    )
```

**Migration 2: Backfill data**

```python
def upgrade() -> None:
    op.execute(
        "UPDATE users SET display_name = name WHERE display_name IS NULL"
    )
```

**Migration 3: Make non-null**

```python
def upgrade() -> None:
    op.alter_column(
        "users",
        "display_name",
        existing_type=sa.String(200),
        nullable=False,
    )
```

### Renaming a Column

Never rename directly -- it breaks running application code during deployment:

**Migration 1: Add new column, copy data**

```python
def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("display_name", sa.String(200)),
    )
    op.execute("UPDATE users SET display_name = name")
```

**Deploy code that reads from both columns, writes to both.**

**Migration 2: Drop old column**

```python
def upgrade() -> None:
    op.drop_column("users", "name")
```

### Adding an Index Concurrently (PostgreSQL)

Large tables can lock for minutes during index creation. Use `CONCURRENTLY`:

```python
from alembic import op

def upgrade() -> None:
    op.execute(
        "CREATE INDEX CONCURRENTLY ix_orders_created_at "
        "ON orders (created_at)"
    )


def downgrade() -> None:
    op.drop_index("ix_orders_created_at", table_name="orders")
```

Set `autocommit` in the migration since `CREATE INDEX CONCURRENTLY` cannot run
inside a transaction:

```python
from alembic import op


def upgrade() -> None:
    op.execute("COMMIT")
    op.execute(
        "CREATE INDEX CONCURRENTLY ix_orders_created_at "
        "ON orders (created_at)"
    )
```

### Removing a Column

**Step 1**: Deploy code that no longer reads/writes the column.
**Step 2**: Run migration to drop the column.

```python
def upgrade() -> None:
    op.drop_column("users", "legacy_field")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("legacy_field", sa.String(100), nullable=True),
    )
```

## Best Practices

- **One logical change per migration** -- Easier to review, test, and revert
- **Never modify a deployed migration** -- Create a new migration instead
- **No application model imports** -- Use `sa.table()` / `sa.column()` for data migrations
- **Always write downgrade** -- Enables rollback in emergencies
- **Test migrations against production-like data** -- Empty tables pass but large tables
  may timeout or lock
- **Use naming conventions** -- Deterministic constraint names prevent cross-environment
  diffs
- **Keep migrations fast** -- Long-running migrations lock tables and cause downtime
- **Review autogenerated code** -- Autogenerate is a starting point, not the final answer
- **Commit migrations with the code that needs them** -- Keep schema and code in sync
  in the same pull request
