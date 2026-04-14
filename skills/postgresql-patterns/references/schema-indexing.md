# Schema Design and Indexing

Comprehensive reference for PostgreSQL schema design, data type selection, index strategies,
partitioning, and connection pooling.

---

## Data Types

### Choosing the Right Type

Prefer the most specific type available. Narrower types improve storage, cache efficiency,
and query performance.

```sql
-- Bad: using TEXT for everything
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    event_date TEXT,
    quantity TEXT,
    price TEXT,
    is_active TEXT
);

-- Good: specific types with constraints
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date DATE NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
```

### UUID Primary Keys

Use `gen_random_uuid()` (PostgreSQL 13+) for distributed-safe primary keys. Avoid
`uuid_generate_v4()` which requires the `uuid-ossp` extension.

```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number BIGINT GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

When using UUIDs as primary keys, consider a sequential UUID variant (UUIDv7) to reduce
B-tree index fragmentation:

```python
import uuid
from uuid import UUID

def uuid7() -> UUID:
    """Generate a UUIDv7 with millisecond precision for better index locality."""
    import time
    import os

    timestamp_ms = int(time.time() * 1000)
    rand_bytes = os.urandom(10)

    uuid_bytes = (
        timestamp_ms.to_bytes(6, "big")
        + rand_bytes[:2]
        + rand_bytes[2:]
    )
    uuid_bytes = bytearray(uuid_bytes)
    uuid_bytes[6] = (uuid_bytes[6] & 0x0F) | 0x70  # version 7
    uuid_bytes[8] = (uuid_bytes[8] & 0x3F) | 0x80  # variant 2
    return UUID(bytes=bytes(uuid_bytes))
```

### JSONB

Use JSONB for semi-structured data that varies between rows. Do not use it as a substitute
for proper relational modeling.

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- Good: attributes that vary by product category
    attributes JSONB NOT NULL DEFAULT '{}',
    -- Bad: storing structured data that should be columns
    -- metadata JSONB  -- if it always has "price", "status", "category", use columns
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validate JSONB shape with CHECK constraints
ALTER TABLE products ADD CONSTRAINT valid_attributes
    CHECK (jsonb_typeof(attributes) = 'object');
```

### ARRAY Types

Use arrays for small, fixed-purpose collections. Prefer junction tables for large or
queryable sets.

```sql
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    -- Good: small set of labels, queried with @> or &&
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query examples
SELECT * FROM articles WHERE tags @> ARRAY['python'];          -- contains
SELECT * FROM articles WHERE tags && ARRAY['python', 'rust'];  -- overlaps
SELECT * FROM articles WHERE 'python' = ANY(tags);             -- element check
```

### CITEXT

Use `citext` for case-insensitive text fields like emails to avoid `LOWER()` in every query:

```sql
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL UNIQUE,
    username CITEXT NOT NULL UNIQUE
);

-- Queries are case-insensitive without LOWER()
SELECT * FROM users WHERE email = 'User@Example.COM';
```

---

## Index Types

### B-tree (Default)

The default index type. Supports equality and range queries. Optimal for high-cardinality
columns.

```sql
-- Equality lookups
CREATE INDEX idx_orders_status ON orders (status);

-- Range queries
CREATE INDEX idx_orders_created ON orders (created_at);

-- Multi-column: place equality columns first, range columns last
CREATE INDEX idx_orders_status_created ON orders (status, created_at);
```

### GIN (Generalized Inverted Index)

Best for JSONB, full-text search, and array containment queries.

```sql
-- JSONB: supports @>, ?, ?|, ?& operators
CREATE INDEX idx_products_attrs ON products USING GIN (attributes);

-- Query with GIN
SELECT * FROM products WHERE attributes @> '{"color": "red"}';
SELECT * FROM products WHERE attributes ? 'weight';

-- JSONB path ops: smaller index, supports only @>
CREATE INDEX idx_products_attrs_path ON products
    USING GIN (attributes jsonb_path_ops);

-- Full-text search
ALTER TABLE articles ADD COLUMN search_vector TSVECTOR;

CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);

-- Maintain search vector with trigger
CREATE OR REPLACE FUNCTION articles_search_trigger() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', NEW.title || ' ' || NEW.body);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_articles_search
    BEFORE INSERT OR UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION articles_search_trigger();

-- Full-text query
SELECT * FROM articles
WHERE search_vector @@ to_tsquery('english', 'python & async');

-- Array containment
CREATE INDEX idx_articles_tags ON articles USING GIN (tags);
SELECT * FROM articles WHERE tags @> ARRAY['python', 'database'];
```

### GiST (Generalized Search Tree)

Best for spatial data, range types, and nearest-neighbor queries.

```sql
-- Range types
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id INTEGER NOT NULL,
    during TSTZRANGE NOT NULL,
    EXCLUDE USING GIST (room_id WITH =, during WITH &&)
);

-- Prevents overlapping reservations for the same room
INSERT INTO reservations (room_id, during)
VALUES (1, '[2024-03-01 14:00, 2024-03-01 16:00)');

-- Nearest-neighbor with pg_trgm for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_name_trgm ON products USING GIST (name gist_trgm_ops);

SELECT name, similarity(name, 'postgre') AS sim
FROM products
WHERE name % 'postgre'
ORDER BY name <-> 'postgre'
LIMIT 10;
```

### Hash Index

Supports only equality comparisons. Smaller than B-tree for very high cardinality equality
lookups. WAL-logged since PostgreSQL 10.

```sql
CREATE INDEX idx_sessions_token ON sessions USING HASH (session_token);
```

### BRIN (Block Range Index)

Extremely compact index for naturally ordered data (timestamps, sequential IDs). Works
by storing min/max values per block range.

```sql
-- Ideal for append-only time-series tables
CREATE INDEX idx_events_created ON events USING BRIN (created_at)
    WITH (pages_per_range = 32);

-- BRIN is tiny compared to B-tree on large tables
-- 100M row table: B-tree ~2GB, BRIN ~100KB
```

---

## Partial Indexes

Create indexes that cover only a subset of rows. Reduces index size and maintenance cost.

```sql
-- Index only active orders (if 90% are completed)
CREATE INDEX idx_orders_active ON orders (created_at)
    WHERE status = 'active';

-- Index only non-null values
CREATE INDEX idx_users_phone ON users (phone)
    WHERE phone IS NOT NULL;

-- Index for soft-deleted records queries
CREATE INDEX idx_items_not_deleted ON items (updated_at)
    WHERE deleted_at IS NULL;

-- Unique constraint on subset
CREATE UNIQUE INDEX idx_users_active_email ON users (email)
    WHERE is_active = TRUE;
```

---

## Composite Indexes

### Column Order

Place columns in this order: equality filters, range filters, sort columns.

```sql
-- Query: WHERE status = 'active' AND created_at > '2024-01-01' ORDER BY priority
CREATE INDEX idx_tasks_status_created_priority
    ON tasks (status, created_at, priority);

-- The index supports these queries efficiently:
-- WHERE status = 'active'
-- WHERE status = 'active' AND created_at > X
-- WHERE status = 'active' AND created_at > X ORDER BY priority
-- It does NOT efficiently support:
-- WHERE created_at > X  (skips leading column)
-- WHERE priority = 1    (skips leading columns)
```

### Covering Indexes (INCLUDE)

Add non-key columns to enable index-only scans without bloating the B-tree structure.

```sql
-- Index-only scan: no heap fetch needed for these queries
CREATE INDEX idx_orders_status_covering ON orders (status)
    INCLUDE (customer_id, total_amount, created_at);

-- Query satisfied entirely from index
SELECT customer_id, total_amount, created_at
FROM orders
WHERE status = 'pending';

-- Verify with EXPLAIN: look for "Index Only Scan"
EXPLAIN ANALYZE
SELECT customer_id, total_amount FROM orders WHERE status = 'pending';
```

---

## Unique Constraints vs Unique Indexes

Both enforce uniqueness. Constraints are declarative and referenced by foreign keys;
indexes offer more flexibility (partial, expression-based).

```sql
-- Constraint: preferred for simple uniqueness
ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);

-- Unique index: needed for partial or expression-based uniqueness
CREATE UNIQUE INDEX idx_users_active_email ON users (LOWER(email))
    WHERE is_active = TRUE;

-- Multi-column unique constraint
ALTER TABLE order_items ADD CONSTRAINT uq_order_product
    UNIQUE (order_id, product_id);
```

---

## Foreign Key Design

### Cascading Actions

```sql
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id)
        ON DELETE CASCADE,        -- delete items when order is deleted
    product_id UUID NOT NULL REFERENCES products(id)
        ON DELETE RESTRICT,       -- prevent deleting products with order items
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);
```

### Deferrable Constraints

Allow constraint checking at transaction commit rather than at each statement. Useful for
circular references or bulk inserts.

```sql
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    manager_id UUID REFERENCES employees(id)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id)
        DEFERRABLE INITIALLY DEFERRED
);

-- Both can be inserted in same transaction
BEGIN;
SET CONSTRAINTS ALL DEFERRED;
INSERT INTO departments (id, name, manager_id) VALUES (...);
INSERT INTO employees (id, name, department_id) VALUES (...);
COMMIT;
```

### Index Foreign Keys

PostgreSQL does not automatically index foreign key columns. Always add indexes for
columns used in JOINs and cascading deletes.

```sql
-- Always index FK columns
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);
```

---

## Partitioning

### Range Partitioning

Best for time-series data where queries always filter on the partition key.

```sql
CREATE TABLE events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE events_2024_01 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE events_2024_02 PARTITION OF events
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automate partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition(
    table_name TEXT,
    start_date DATE
) RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    end_date DATE;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + INTERVAL '1 month';

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;
```

### List Partitioning

Best for categorical data with a known set of values.

```sql
CREATE TABLE logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY LIST (level);

CREATE TABLE logs_info PARTITION OF logs FOR VALUES IN ('INFO');
CREATE TABLE logs_warning PARTITION OF logs FOR VALUES IN ('WARNING');
CREATE TABLE logs_error PARTITION OF logs FOR VALUES IN ('ERROR', 'CRITICAL');
```

### Hash Partitioning

Best for even distribution when there is no natural range or list key.

```sql
CREATE TABLE sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY HASH (user_id);

CREATE TABLE sessions_0 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE sessions_1 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE sessions_2 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE sessions_3 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

### Partition Pruning

PostgreSQL automatically eliminates partitions that cannot contain matching rows. Verify
with EXPLAIN.

```sql
-- Partition pruning in action
EXPLAIN ANALYZE
SELECT * FROM events
WHERE created_at >= '2024-03-01' AND created_at < '2024-04-01';
-- Should show scanning only events_2024_03

-- Ensure partition pruning is enabled (default: on)
SHOW enable_partition_pruning;
```

---

## JSONB Operators and Indexing

### JSONB Operators

```sql
-- Arrow operators: navigation
SELECT attributes->'dimensions' FROM products;          -- JSONB result
SELECT attributes->>'color' FROM products;              -- TEXT result
SELECT attributes->'dimensions'->>'height' FROM products; -- nested TEXT
SELECT attributes#>'{dimensions,height}' FROM products; -- path JSONB
SELECT attributes#>>'{dimensions,height}' FROM products; -- path TEXT

-- Containment: @>
SELECT * FROM products WHERE attributes @> '{"color": "red"}';

-- Existence: ?, ?|, ?&
SELECT * FROM products WHERE attributes ? 'weight';           -- key exists
SELECT * FROM products WHERE attributes ?| ARRAY['color','size']; -- any key
SELECT * FROM products WHERE attributes ?& ARRAY['color','size']; -- all keys

-- JSONB path queries (PostgreSQL 12+)
SELECT * FROM products
WHERE jsonb_path_exists(attributes, '$.dimensions ? (@.height > 10)');
```

### JSONB GIN Indexing Strategies

```sql
-- Default ops: supports @>, ?, ?|, ?& operators
CREATE INDEX idx_products_attrs ON products USING GIN (attributes);

-- Path ops: smaller index, only supports @>
CREATE INDEX idx_products_attrs_path ON products
    USING GIN (attributes jsonb_path_ops);

-- Expression index on specific JSONB key (B-tree, for equality/range)
CREATE INDEX idx_products_color ON products ((attributes->>'color'));

-- Expression index for sorting/filtering on nested value
CREATE INDEX idx_products_height ON products
    (((attributes->'dimensions'->>'height')::numeric));
```

---

## Connection Pooling

### PgBouncer Configuration

Application-side connection pools (SQLAlchemy, Django) manage connections per process.
PgBouncer sits between all application processes and PostgreSQL, limiting total connections.

```ini
; pgbouncer.ini
[databases]
mydb = host=localhost port=5432 dbname=mydb

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Pool settings
pool_mode = transaction          ; release connection after each transaction
default_pool_size = 25           ; connections per user/database pair
max_client_conn = 200            ; total client connections
max_db_connections = 50          ; max connections to PostgreSQL
reserve_pool_size = 5            ; extra connections for burst
reserve_pool_timeout = 3         ; seconds before using reserve pool

; Timeouts
server_idle_timeout = 300        ; close idle server connections after 5 min
client_idle_timeout = 0          ; disable client idle timeout
query_timeout = 0                ; disable query timeout (handle in app)
```

### Transaction vs Session Mode

- **Transaction mode** (recommended): Connections are returned to the pool after each
  transaction. Cannot use prepared statements, LISTEN/NOTIFY, or session-level settings.
- **Session mode**: Connection held for entire client session. Supports all PostgreSQL
  features but reduces pooling efficiency.

```python
# Python with psycopg and PgBouncer in transaction mode
import psycopg

# Connect to PgBouncer, not directly to PostgreSQL
conn = psycopg.connect(
    "host=localhost port=6432 dbname=mydb user=app password=secret",
    prepare_threshold=0,  # disable prepared statements for transaction mode
)
```

### Application-Level Pooling

```python
# asyncpg connection pool
import asyncpg

pool = await asyncpg.create_pool(
    dsn="postgresql://user:pass@localhost:5432/mydb",
    min_size=5,
    max_size=20,
    max_inactive_connection_lifetime=300,
    command_timeout=30,
)

async with pool.acquire() as conn:
    rows = await conn.fetch("SELECT * FROM users WHERE is_active = $1", True)

# psycopg async connection pool
from psycopg_pool import AsyncConnectionPool

pool = AsyncConnectionPool(
    conninfo="host=localhost port=5432 dbname=mydb user=app",
    min_size=5,
    max_size=20,
    max_idle=300,
)

async with pool.connection() as conn:
    async with conn.cursor() as cur:
        await cur.execute("SELECT * FROM users WHERE is_active = %s", (True,))
        rows = await cur.fetchall()
```
