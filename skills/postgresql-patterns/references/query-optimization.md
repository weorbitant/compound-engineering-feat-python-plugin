# Query Optimization

Comprehensive reference for PostgreSQL query analysis, optimization patterns, batch
operations, locking strategies, and ORM integration with Django and SQLAlchemy.

---

## EXPLAIN ANALYZE

Always use `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` to understand actual query execution.
Never optimize without measuring first.

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id, o.total_amount, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'pending'
  AND o.created_at > now() - INTERVAL '7 days'
ORDER BY o.created_at DESC
LIMIT 20;
```

### Scan Types

```
-- Sequential Scan: reads entire table, row by row
-- Use when: table is small, or query returns large fraction of rows
Seq Scan on orders  (cost=0.00..15420.00 rows=542 width=48)
  Filter: (status = 'pending')
  Rows Removed by Filter: 499458

-- Index Scan: traverses B-tree, fetches heap pages
-- Use when: query is selective (returns small fraction of rows)
Index Scan using idx_orders_status on orders  (cost=0.42..82.15 rows=542 width=48)
  Index Cond: (status = 'pending')

-- Index Only Scan: reads only from index, no heap access
-- Requires: all needed columns in index (covering index), visibility map up to date
Index Only Scan using idx_orders_covering on orders  (cost=0.42..28.35 rows=542 width=48)
  Index Cond: (status = 'pending')
  Heap Fetches: 0  -- ideal: 0 means all pages visible

-- Bitmap Index Scan + Bitmap Heap Scan: combines multiple indexes
-- Use when: moderate selectivity, or combining conditions from different indexes
Bitmap Heap Scan on orders  (cost=12.45..1820.30 rows=542 width=48)
  Recheck Cond: (status = 'pending')
  ->  Bitmap Index Scan on idx_orders_status  (cost=0.00..12.31 rows=542 width=0)
        Index Cond: (status = 'pending')
```

### Join Types

```
-- Nested Loop: for each outer row, scan inner relation
-- Best when: inner relation is small or has a fast index lookup
Nested Loop  (cost=0.42..842.15 rows=542 width=96)
  ->  Index Scan using idx_orders_status on orders o
  ->  Index Scan using customers_pkey on customers c
        Index Cond: (id = o.customer_id)

-- Hash Join: builds hash table from smaller relation, probes with larger
-- Best when: no useful index, join on equality, one relation fits in work_mem
Hash Join  (cost=125.00..16200.00 rows=542 width=96)
  Hash Cond: (o.customer_id = c.id)
  ->  Seq Scan on orders o
  ->  Hash
        ->  Seq Scan on customers c

-- Merge Join: sorts both relations, merges
-- Best when: both inputs already sorted (index), or large datasets
Merge Join  (cost=520.00..620.00 rows=542 width=96)
  Merge Cond: (o.customer_id = c.id)
  ->  Sort / Index Scan on orders
  ->  Sort / Index Scan on customers
```

---

## Cost Estimation

Key parameters that affect the planner's cost model:

```sql
-- View current settings
SHOW seq_page_cost;          -- default: 1.0 (cost of sequential page read)
SHOW random_page_cost;       -- default: 4.0 (cost of random page read)
SHOW cpu_tuple_cost;         -- default: 0.01
SHOW effective_cache_size;   -- hint for planner about OS + PG cache

-- For SSD storage, reduce random_page_cost
ALTER SYSTEM SET random_page_cost = 1.1;
SELECT pg_reload_conf();

-- Check row estimate accuracy
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'pending';
-- Compare "rows=X" (estimated) with "actual rows=Y"
-- Large discrepancies indicate stale statistics

-- Update statistics
ANALYZE orders;              -- single table
ANALYZE;                     -- entire database

-- Increase statistics target for skewed columns
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 1000;
ANALYZE orders;
```

---

## Anti-Patterns

### SELECT *

```sql
-- Bad: fetches all columns, prevents index-only scans
SELECT * FROM orders WHERE status = 'pending';

-- Good: fetch only needed columns
SELECT id, total_amount, created_at FROM orders WHERE status = 'pending';
```

### Missing Indexes on Filter/Join Columns

```sql
-- Bad: sequential scan on large table
SELECT * FROM orders WHERE customer_id = '550e8400-...';

-- Fix: add index
CREATE INDEX idx_orders_customer_id ON orders (customer_id);
```

### Implicit Type Casts

```sql
-- Bad: passing integer to text column prevents index usage
-- The column "code" is TEXT, but parameter is INTEGER
SELECT * FROM products WHERE code = 12345;
-- PostgreSQL casts every row: code::integer = 12345 -> seq scan

-- Good: match types exactly
SELECT * FROM products WHERE code = '12345';
```

### OR vs UNION

```sql
-- Bad: OR on different columns often prevents index usage
SELECT * FROM orders
WHERE customer_id = '550e8400-...' OR product_id = '7c9e6679-...';

-- Good: UNION ALL uses separate index scans
SELECT * FROM orders WHERE customer_id = '550e8400-...'
UNION ALL
SELECT * FROM orders WHERE product_id = '7c9e6679-...'
  AND customer_id != '550e8400-...';  -- avoid duplicates if needed
```

### Functions on Indexed Columns

```sql
-- Bad: function call prevents index usage
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';

-- Good: expression index
CREATE INDEX idx_users_email_lower ON users (LOWER(email));
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';

-- Better: use CITEXT column type (no LOWER needed)
```

---

## CTEs (Common Table Expressions)

### Materialized vs Inline

PostgreSQL 12+ inlines CTEs by default when they are referenced once and are not recursive.
Force materialization when the CTE result is expensive and reused, or when it acts as an
optimization fence.

```sql
-- Inlined by default (PostgreSQL 12+): optimizer can push filters into CTE
WITH recent_orders AS (
    SELECT * FROM orders WHERE created_at > now() - INTERVAL '30 days'
)
SELECT * FROM recent_orders WHERE status = 'pending';

-- Force materialization: compute once, reuse multiple times
WITH MATERIALIZED monthly_stats AS (
    SELECT
        date_trunc('month', created_at) AS month,
        COUNT(*) AS order_count,
        SUM(total_amount) AS revenue
    FROM orders
    GROUP BY 1
)
SELECT * FROM monthly_stats WHERE order_count > 100
UNION ALL
SELECT * FROM monthly_stats WHERE revenue > 50000;

-- Force inlining (explicit)
WITH NOT MATERIALIZED filtered AS (
    SELECT * FROM orders WHERE status = 'active'
)
SELECT * FROM filtered WHERE total_amount > 100;
```

### Recursive CTEs

```sql
-- Hierarchical data: org chart traversal
WITH RECURSIVE org_tree AS (
    -- Base case: top-level managers
    SELECT id, name, manager_id, 1 AS depth, ARRAY[id] AS path
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- Recursive case: subordinates
    SELECT e.id, e.name, e.manager_id, ot.depth + 1, ot.path || e.id
    FROM employees e
    JOIN org_tree ot ON ot.id = e.manager_id
    WHERE NOT e.id = ANY(ot.path)  -- prevent cycles
      AND ot.depth < 10           -- depth limit as safety net
)
SELECT * FROM org_tree ORDER BY path;

-- Graph traversal: find all connected nodes
WITH RECURSIVE connected AS (
    SELECT node_b AS node_id, 1 AS hops
    FROM edges
    WHERE node_a = 'start-node'

    UNION

    SELECT e.node_b, c.hops + 1
    FROM edges e
    JOIN connected c ON c.node_id = e.node_a
    WHERE c.hops < 5
)
SELECT DISTINCT node_id FROM connected;
```

---

## Window Functions

### ROW_NUMBER, RANK, DENSE_RANK

```sql
-- Deduplicate: keep latest record per group
SELECT * FROM (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY customer_id
            ORDER BY created_at DESC
        ) AS rn
    FROM orders
) sub
WHERE rn = 1;

-- Ranking with ties
SELECT
    name,
    score,
    RANK() OVER (ORDER BY score DESC) AS rank,        -- gaps after ties
    DENSE_RANK() OVER (ORDER BY score DESC) AS drank   -- no gaps
FROM leaderboard;
```

### LAG / LEAD

```sql
-- Compare each row with previous/next
SELECT
    date,
    revenue,
    LAG(revenue) OVER (ORDER BY date) AS prev_revenue,
    revenue - LAG(revenue) OVER (ORDER BY date) AS daily_change,
    LEAD(revenue) OVER (ORDER BY date) AS next_revenue
FROM daily_metrics;
```

### Running Totals and Moving Averages

```sql
-- Running total
SELECT
    date,
    amount,
    SUM(amount) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
        AS running_total
FROM transactions;

-- 7-day moving average
SELECT
    date,
    revenue,
    AVG(revenue) OVER (
        ORDER BY date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS moving_avg_7d
FROM daily_metrics;

-- Percentage of total
SELECT
    category,
    revenue,
    revenue::numeric / SUM(revenue) OVER () * 100 AS pct_of_total
FROM category_revenue;
```

---

## Batch Operations

### INSERT ON CONFLICT (Upsert)

```sql
-- Upsert: insert or update on conflict
INSERT INTO products (id, name, price, updated_at)
VALUES
    ('550e8400-...', 'Widget A', 19.99, now()),
    ('7c9e6679-...', 'Widget B', 29.99, now())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    updated_at = EXCLUDED.updated_at
WHERE products.price != EXCLUDED.price;  -- only update if price changed

-- Upsert with DO NOTHING (skip duplicates)
INSERT INTO user_events (user_id, event_type, created_at)
VALUES ($1, $2, now())
ON CONFLICT (user_id, event_type) DO NOTHING;
```

### COPY for Bulk Loading

```sql
-- Fastest bulk insert method
COPY products (name, price, category) FROM '/tmp/products.csv' WITH (FORMAT csv, HEADER);
```

```python
# Python with psycopg: use COPY for bulk inserts
import psycopg
from io import StringIO

def bulk_insert_products(conn: psycopg.Connection, products: list[dict]) -> None:
    buffer = StringIO()
    for p in products:
        buffer.write(f"{p['name']}\t{p['price']}\t{p['category']}\n")
    buffer.seek(0)

    with conn.cursor() as cur:
        with cur.copy("COPY products (name, price, category) FROM STDIN") as copy:
            while data := buffer.read(8192):
                copy.write(data)
    conn.commit()
```

### Batch Insert with unnest

```sql
-- Batch insert using unnest: faster than multi-row VALUES for large sets
INSERT INTO user_events (user_id, event_type, payload)
SELECT * FROM unnest(
    $1::uuid[],     -- user_ids
    $2::text[],     -- event_types
    $3::jsonb[]     -- payloads
);
```

```python
# asyncpg batch insert with unnest
import asyncpg

async def batch_insert_events(
    pool: asyncpg.Pool,
    user_ids: list[str],
    event_types: list[str],
    payloads: list[dict],
) -> None:
    import json

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO user_events (user_id, event_type, payload)
            SELECT * FROM unnest($1::uuid[], $2::text[], $3::jsonb[])
            """,
            user_ids,
            event_types,
            [json.dumps(p) for p in payloads],
        )
```

---

## Locking

### Row-Level Locks

```sql
-- SELECT FOR UPDATE: exclusive lock on selected rows
-- Blocks other SELECT FOR UPDATE and modifications
BEGIN;
SELECT * FROM inventory
WHERE product_id = $1 AND quantity >= $2
FOR UPDATE;

UPDATE inventory SET quantity = quantity - $2 WHERE product_id = $1;
COMMIT;

-- SELECT FOR UPDATE SKIP LOCKED: skip already-locked rows
-- Ideal for job queues and worker patterns
BEGIN;
SELECT * FROM job_queue
WHERE status = 'pending'
ORDER BY priority, created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;

UPDATE job_queue SET status = 'processing', worker_id = $1
WHERE id = $2;
COMMIT;

-- FOR NO KEY UPDATE: weaker lock, doesn't block foreign key checks
-- FOR SHARE: shared lock, blocks writes but allows concurrent reads
-- FOR KEY SHARE: weakest, only blocks key changes
```

### Table-Level Locks

```sql
-- Explicit lock for DDL-like operations
LOCK TABLE products IN SHARE MODE;         -- block writes, allow reads
LOCK TABLE products IN EXCLUSIVE MODE;     -- block everything except reads
LOCK TABLE products IN ACCESS EXCLUSIVE MODE; -- block everything (ALTER TABLE)
```

### Advisory Locks

Application-controlled locks not tied to any table or row. Useful for coordinating
distributed processes.

```sql
-- Session-level advisory lock (held until session ends or explicit unlock)
SELECT pg_advisory_lock(hashtext('process-payments'));
-- ... do exclusive work ...
SELECT pg_advisory_unlock(hashtext('process-payments'));

-- Transaction-level advisory lock (released at end of transaction)
SELECT pg_advisory_xact_lock(hashtext('daily-report'));

-- Try without blocking
SELECT pg_try_advisory_lock(hashtext('process-payments'));
-- Returns TRUE if acquired, FALSE if already held
```

```python
# Advisory lock in Python
import psycopg

def with_advisory_lock(conn: psycopg.Connection, lock_name: str):
    """Context manager for PostgreSQL advisory locks."""
    import hashlib

    lock_id = int(hashlib.md5(lock_name.encode()).hexdigest()[:8], 16)

    with conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_lock(%s)", (lock_id,))
        try:
            yield
        finally:
            cur.execute("SELECT pg_advisory_unlock(%s)", (lock_id,))
```

---

## Django ORM Integration

### select_related (SQL JOIN)

Use for ForeignKey and OneToOneField. Generates a single query with JOINs.

```python
# Bad: N+1 queries
orders = Order.objects.filter(status="pending")
for order in orders:
    print(order.customer.name)  # each access triggers a query

# Good: single query with JOIN
orders = Order.objects.select_related("customer").filter(status="pending")
for order in orders:
    print(order.customer.name)  # no extra query
```

### prefetch_related (Separate query with IN)

Use for ManyToManyField and reverse ForeignKey relations. Executes a separate query and
joins in Python.

```python
# Bad: N+1 queries on reverse relation
customers = Customer.objects.all()
for customer in customers:
    print(customer.order_set.count())  # query per customer

# Good: prefetch with Prefetch for control
from django.db.models import Prefetch

customers = Customer.objects.prefetch_related(
    Prefetch(
        "order_set",
        queryset=Order.objects.filter(status="pending").order_by("-created_at"),
        to_attr="pending_orders",
    )
)
for customer in customers:
    print(len(customer.pending_orders))  # no extra query
```

### .only() and .defer()

```python
# Load only specific columns (like SELECT id, name, email FROM ...)
users = User.objects.only("id", "name", "email").filter(is_active=True)

# Defer heavy columns (load everything except body)
articles = Article.objects.defer("body").filter(published=True)

# Combine with select_related
orders = (
    Order.objects
    .select_related("customer")
    .only("id", "total_amount", "customer__name")
    .filter(status="pending")
)
```

### Efficient Aggregation

```python
from django.db.models import Count, Sum, Q, F

# Conditional aggregation
stats = Order.objects.aggregate(
    total=Count("id"),
    pending=Count("id", filter=Q(status="pending")),
    revenue=Sum("total_amount", filter=Q(status="completed")),
)

# Annotate for per-row calculations
customers = Customer.objects.annotate(
    order_count=Count("order"),
    total_spent=Sum("order__total_amount"),
).filter(order_count__gt=5)

# F expressions: reference other columns without pulling into Python
Order.objects.filter(status="pending").update(
    total_amount=F("total_amount") * 1.1
)
```

### Raw SQL Escape Hatch

```python
from django.db import connection

def get_customer_stats(min_orders: int) -> list[dict]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT c.name, COUNT(o.id) AS order_count, SUM(o.total_amount) AS revenue
            FROM customers c
            JOIN orders o ON o.customer_id = c.id
            WHERE o.status = 'completed'
            GROUP BY c.id, c.name
            HAVING COUNT(o.id) >= %s
            ORDER BY revenue DESC
            """,
            [min_orders],
        )
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]
```

---

## SQLAlchemy Integration

### Eager Loading Strategies

```python
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload, contains_eager

# joinedload: single query with JOIN (like Django's select_related)
stmt = (
    select(Order)
    .options(joinedload(Order.customer))
    .where(Order.status == "pending")
)
orders = session.scalars(stmt).unique().all()

# selectinload: separate IN query (like Django's prefetch_related)
stmt = (
    select(Customer)
    .options(selectinload(Customer.orders))
)
customers = session.scalars(stmt).unique().all()

# contains_eager: use with explicit JOIN to control the joined data
stmt = (
    select(Order)
    .join(Order.customer)
    .options(contains_eager(Order.customer))
    .where(Customer.is_active.is_(True))
)
orders = session.scalars(stmt).unique().all()
```

### Efficient Batch Operations

```python
from sqlalchemy import insert, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

# Bulk insert
stmt = insert(Product).values([
    {"name": "Widget A", "price": 19.99},
    {"name": "Widget B", "price": 29.99},
])
session.execute(stmt)

# PostgreSQL upsert via on_conflict_do_update
stmt = pg_insert(Product).values(
    id=product_id,
    name="Widget A",
    price=19.99,
)
stmt = stmt.on_conflict_do_update(
    index_elements=["id"],
    set_={"name": stmt.excluded.name, "price": stmt.excluded.price},
)
session.execute(stmt)
session.commit()
```

### Query Compilation and Debugging

```python
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

# Print compiled SQL with parameters
stmt = select(Order).where(Order.status == "pending")
compiled = stmt.compile(
    dialect=postgresql.dialect(),
    compile_kwargs={"literal_binds": True},
)
print(str(compiled))

# Enable SQL logging
import logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
```
