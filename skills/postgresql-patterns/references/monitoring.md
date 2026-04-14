# Monitoring and Maintenance

Comprehensive reference for PostgreSQL monitoring views, vacuum tuning, bloat detection,
replication monitoring, lock analysis, and query logging.

---

## pg_stat_user_tables

Track table-level statistics: sequential scans, index usage, dead tuples, and
auto-vacuum activity.

```sql
-- Table scan analysis: identify tables needing indexes
SELECT
    schemaname,
    relname AS table_name,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE
        WHEN seq_scan + idx_scan = 0 THEN 0
        ELSE ROUND(idx_scan::numeric / (seq_scan + idx_scan) * 100, 1)
    END AS index_usage_pct,
    n_tup_ins AS inserts,
    n_tup_upd AS updates,
    n_tup_del AS deletes,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    CASE
        WHEN n_live_tup = 0 THEN 0
        ELSE ROUND(n_dead_tup::numeric / n_live_tup * 100, 1)
    END AS dead_row_pct,
    last_autovacuum,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;

-- Tables with high sequential scan count (candidates for indexing)
SELECT relname, seq_scan, seq_tup_read,
       seq_tup_read / GREATEST(seq_scan, 1) AS avg_rows_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC
LIMIT 20;

-- Tables with high dead tuple ratio (need vacuum)
SELECT relname, n_live_tup, n_dead_tup,
       ROUND(n_dead_tup::numeric / GREATEST(n_live_tup, 1) * 100, 1) AS dead_pct,
       last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_pct DESC;
```

---

## pg_stat_user_indexes

Track index usage and identify unused indexes that waste disk space and slow writes.

```sql
-- Index usage statistics
SELECT
    s.schemaname,
    s.relname AS table_name,
    s.indexrelname AS index_name,
    s.idx_scan AS scans,
    s.idx_tup_read AS tuples_read,
    s.idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size
FROM pg_stat_user_indexes s
ORDER BY s.idx_scan ASC;

-- Unused indexes (zero scans, excluding unique constraints and PKs)
SELECT
    s.schemaname,
    s.relname AS table_name,
    s.indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
    s.idx_scan AS scans
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.idx_scan = 0
  AND NOT i.indisunique         -- keep unique constraints
  AND NOT i.indisprimary        -- keep primary keys
  AND s.schemaname = 'public'
ORDER BY pg_relation_size(s.indexrelid) DESC;

-- Duplicate indexes (same columns, same table)
SELECT
    a.indrelid::regclass AS table_name,
    a.indexrelid::regclass AS index_a,
    b.indexrelid::regclass AS index_b,
    pg_size_pretty(pg_relation_size(a.indexrelid)) AS size_a,
    pg_size_pretty(pg_relation_size(b.indexrelid)) AS size_b
FROM pg_index a
JOIN pg_index b ON a.indrelid = b.indrelid
    AND a.indexrelid < b.indexrelid
    AND a.indkey = b.indkey
WHERE a.indrelid::regclass::text NOT LIKE 'pg_%';
```

---

## pg_stat_statements

Track query execution statistics. Requires enabling the extension.

```sql
-- Enable pg_stat_statements (add to postgresql.conf)
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.track = all

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top queries by total execution time
SELECT
    queryid,
    LEFT(query, 100) AS query_preview,
    calls,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
    ROUND(stddev_exec_time::numeric, 2) AS stddev_time_ms,
    rows,
    ROUND((shared_blks_hit::numeric /
           GREATEST(shared_blks_hit + shared_blks_read, 1)) * 100, 1)
        AS cache_hit_pct
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 20;

-- Most frequently called queries
SELECT
    queryid,
    LEFT(query, 100) AS query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
    rows / GREATEST(calls, 1) AS avg_rows
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY calls DESC
LIMIT 20;

-- Queries with poor cache hit ratio
SELECT
    queryid,
    LEFT(query, 100) AS query_preview,
    calls,
    shared_blks_hit,
    shared_blks_read,
    ROUND((shared_blks_hit::numeric /
           GREATEST(shared_blks_hit + shared_blks_read, 1)) * 100, 1)
        AS cache_hit_pct
FROM pg_stat_statements
WHERE shared_blks_hit + shared_blks_read > 100
  AND dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY cache_hit_pct ASC
LIMIT 20;

-- Reset statistics (do periodically to get fresh data)
SELECT pg_stat_statements_reset();
```

---

## pg_stat_activity

Monitor active sessions, running queries, and idle connections.

```sql
-- Currently running queries
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    wait_event_type,
    wait_event,
    now() - query_start AS query_duration,
    now() - state_change AS state_duration,
    LEFT(query, 200) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND pid != pg_backend_pid()
ORDER BY query_start ASC;

-- Long-running queries (over 1 minute)
SELECT
    pid,
    usename,
    now() - query_start AS duration,
    state,
    LEFT(query, 200) AS query_preview
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > INTERVAL '1 minute'
  AND pid != pg_backend_pid()
ORDER BY query_start;

-- Idle connections by application
SELECT
    application_name,
    state,
    COUNT(*) AS connections,
    MAX(now() - state_change) AS longest_idle
FROM pg_stat_activity
WHERE pid != pg_backend_pid()
GROUP BY application_name, state
ORDER BY connections DESC;

-- Connection usage vs limits
SELECT
    max_conn,
    used,
    max_conn - used AS available,
    ROUND(used::numeric / max_conn * 100, 1) AS usage_pct
FROM (
    SELECT
        setting::int AS max_conn,
        (SELECT COUNT(*) FROM pg_stat_activity) AS used
    FROM pg_settings
    WHERE name = 'max_connections'
) t;

-- Cancel or terminate a query
SELECT pg_cancel_backend(pid);     -- send cancel signal (graceful)
SELECT pg_terminate_backend(pid);  -- terminate connection (forceful)
```

---

## Vacuum

### Autovacuum Tuning

```sql
-- View current autovacuum settings
SELECT name, setting, short_desc
FROM pg_settings
WHERE name LIKE 'autovacuum%'
ORDER BY name;

-- Key autovacuum parameters
-- autovacuum_vacuum_threshold = 50         (base dead tuple count)
-- autovacuum_vacuum_scale_factor = 0.2     (fraction of table)
-- Trigger: dead_tuples > threshold + scale_factor * n_live_tup

-- Per-table autovacuum tuning for high-write tables
ALTER TABLE events SET (
    autovacuum_vacuum_threshold = 100,
    autovacuum_vacuum_scale_factor = 0.05,    -- vacuum at 5% dead instead of 20%
    autovacuum_analyze_threshold = 100,
    autovacuum_analyze_scale_factor = 0.02,   -- analyze at 2% change
    autovacuum_vacuum_cost_delay = 2          -- faster vacuum (default: 2ms)
);

-- For very large tables (100M+ rows), use absolute thresholds
ALTER TABLE huge_events SET (
    autovacuum_vacuum_scale_factor = 0,
    autovacuum_vacuum_threshold = 100000,     -- vacuum after 100k dead tuples
    autovacuum_analyze_scale_factor = 0,
    autovacuum_analyze_threshold = 50000
);
```

### Manual VACUUM Operations

```sql
-- Regular vacuum: reclaims dead tuple space for reuse (non-blocking)
VACUUM orders;

-- Vacuum with analyze: also updates planner statistics
VACUUM ANALYZE orders;

-- Vacuum verbose: shows detailed progress
VACUUM (VERBOSE, ANALYZE) orders;

-- Vacuum full: rewrites entire table, reclaims disk space
-- WARNING: takes ACCESS EXCLUSIVE lock, table is offline during operation
VACUUM FULL orders;

-- Check vacuum progress (PostgreSQL 12+)
SELECT
    relid::regclass AS table_name,
    phase,
    heap_blks_total,
    heap_blks_scanned,
    heap_blks_vacuumed,
    ROUND(heap_blks_vacuumed::numeric / GREATEST(heap_blks_total, 1) * 100, 1)
        AS pct_complete
FROM pg_stat_progress_vacuum;
```

---

## Bloat Detection

### Table Bloat

```sql
-- Estimate table bloat using pg_stat_user_tables
SELECT
    schemaname,
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid))
        AS index_size,
    n_live_tup,
    n_dead_tup,
    CASE
        WHEN n_live_tup = 0 THEN 0
        ELSE ROUND(n_dead_tup::numeric / n_live_tup * 100, 1)
    END AS dead_pct
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- Detailed bloat estimation (requires pgstattuple extension)
CREATE EXTENSION IF NOT EXISTS pgstattuple;

SELECT
    table_len,
    tuple_count,
    tuple_len,
    dead_tuple_count,
    dead_tuple_len,
    free_space,
    ROUND(dead_tuple_len::numeric / GREATEST(table_len, 1) * 100, 1)
        AS dead_pct,
    ROUND(free_space::numeric / GREATEST(table_len, 1) * 100, 1)
        AS free_pct
FROM pgstattuple('orders');
```

### Index Bloat

```sql
-- Index bloat estimation with pgstattuple
SELECT
    indexrelid::regclass AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS scans,
    (pgstatindex(indexrelid::regclass::text)).avg_leaf_density AS leaf_density,
    (pgstatindex(indexrelid::regclass::text)).leaf_fragmentation AS fragmentation
FROM pg_stat_user_indexes
WHERE pg_relation_size(indexrelid) > 1024 * 1024  -- > 1MB
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- Rebuild bloated indexes concurrently (non-blocking)
REINDEX INDEX CONCURRENTLY idx_orders_status;

-- Rebuild all indexes on a table concurrently
REINDEX TABLE CONCURRENTLY orders;
```

---

## Replication Monitoring

### Replication Lag

```sql
-- On primary: check replication slots and lag
SELECT
    slot_name,
    slot_type,
    active,
    pg_size_pretty(
        pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)
    ) AS replication_lag
FROM pg_replication_slots;

-- On primary: check connected replicas
SELECT
    client_addr,
    application_name,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    pg_size_pretty(pg_wal_lsn_diff(sent_lsn, replay_lsn)) AS replay_lag,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn)) AS send_lag
FROM pg_stat_replication;

-- On replica: check how far behind
SELECT
    now() - pg_last_xact_replay_timestamp() AS replay_delay,
    pg_is_in_recovery() AS is_replica,
    pg_last_wal_receive_lsn() AS received_lsn,
    pg_last_wal_replay_lsn() AS replayed_lsn
FROM pg_stat_wal_receiver;
```

### Replication Slot Management

```sql
-- List all replication slots
SELECT slot_name, slot_type, active, restart_lsn,
       pg_size_pretty(
           pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)
       ) AS retained_wal
FROM pg_replication_slots;

-- Drop inactive slot (WARNING: data loss if replica needs it)
SELECT pg_drop_replication_slot('old_replica_slot');

-- Monitor WAL retention caused by inactive slots
SELECT slot_name, active,
       pg_size_pretty(
           pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)
       ) AS retained_wal
FROM pg_replication_slots
WHERE NOT active
ORDER BY pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) DESC;
```

---

## Lock Monitoring

### Lock Waits

```sql
-- Active lock waits: who is blocking whom
SELECT
    blocked.pid AS blocked_pid,
    blocked.usename AS blocked_user,
    LEFT(blocked.query, 100) AS blocked_query,
    now() - blocked.query_start AS blocked_duration,
    blocking.pid AS blocking_pid,
    blocking.usename AS blocking_user,
    LEFT(blocking.query, 100) AS blocking_query,
    blocking.state AS blocking_state
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid AND NOT bl.granted
JOIN pg_locks kl ON kl.transactionid = bl.transactionid AND kl.granted
JOIN pg_stat_activity blocking ON blocking.pid = kl.pid
WHERE blocked.pid != blocking.pid;

-- Detailed lock information
SELECT
    l.locktype,
    l.relation::regclass AS table_name,
    l.mode,
    l.granted,
    l.pid,
    a.usename,
    a.state,
    now() - a.query_start AS duration,
    LEFT(a.query, 100) AS query
FROM pg_locks l
JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.relation IS NOT NULL
  AND a.pid != pg_backend_pid()
ORDER BY l.relation, l.pid;
```

### Deadlock Detection

```sql
-- Enable deadlock logging (postgresql.conf)
-- log_lock_waits = on
-- deadlock_timeout = 1s

-- Check for recent deadlocks in logs
-- Search PostgreSQL logs for "deadlock detected"

-- Monitor lock wait timeout
SHOW deadlock_timeout;          -- default: 1s
SHOW lock_timeout;              -- default: 0 (wait forever)

-- Set lock timeout per session to avoid indefinite waits
SET lock_timeout = '5s';

-- Set statement timeout as safety net
SET statement_timeout = '30s';
```

```python
# Handle lock timeouts in Python
import psycopg
from psycopg import errors

def update_with_lock_timeout(
    conn: psycopg.Connection,
    order_id: str,
    new_status: str,
) -> bool:
    try:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL lock_timeout = '5s'")
            cur.execute(
                "UPDATE orders SET status = %s WHERE id = %s",
                (new_status, order_id),
            )
            conn.commit()
            return True
    except errors.LockNotAvailable:
        conn.rollback()
        return False
```

---

## Performance Baselines and Alerting

### Key Metrics to Track

```sql
-- Database-level cache hit ratio (should be > 99%)
SELECT
    datname,
    ROUND(
        blks_hit::numeric / GREATEST(blks_hit + blks_read, 1) * 100, 2
    ) AS cache_hit_pct
FROM pg_stat_database
WHERE datname = current_database();

-- Table cache hit ratio
SELECT
    relname,
    ROUND(
        heap_blks_hit::numeric /
        GREATEST(heap_blks_hit + heap_blks_read, 1) * 100, 2
    ) AS cache_hit_pct
FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 100
ORDER BY cache_hit_pct ASC
LIMIT 10;

-- Index cache hit ratio
SELECT
    indexrelname,
    ROUND(
        idx_blks_hit::numeric /
        GREATEST(idx_blks_hit + idx_blks_read, 1) * 100, 2
    ) AS cache_hit_pct
FROM pg_statio_user_indexes
WHERE idx_blks_hit + idx_blks_read > 100
ORDER BY cache_hit_pct ASC
LIMIT 10;

-- Transaction commit/rollback ratio
SELECT
    datname,
    xact_commit,
    xact_rollback,
    ROUND(
        xact_commit::numeric / GREATEST(xact_commit + xact_rollback, 1) * 100, 2
    ) AS commit_pct
FROM pg_stat_database
WHERE datname = current_database();

-- Temporary file usage (indicates work_mem too low)
SELECT
    datname,
    temp_files,
    pg_size_pretty(temp_bytes) AS temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
```

### Alert Thresholds

| Metric | Warning | Critical |
|---|---|---|
| Cache hit ratio | < 99% | < 95% |
| Dead tuple ratio | > 10% | > 20% |
| Replication lag | > 10s | > 60s |
| Connection usage | > 80% | > 95% |
| Long-running queries | > 5min | > 30min |
| Idle in transaction | > 1min | > 10min |
| Temp file usage | > 100MB/day | > 1GB/day |
| Unused indexes | any | -- |

---

## Query Logging

### log_min_duration_statement

Log queries exceeding a time threshold. The primary tool for finding slow queries.

```sql
-- Log queries taking more than 500ms
ALTER SYSTEM SET log_min_duration_statement = 500;
SELECT pg_reload_conf();

-- Log all queries (WARNING: high I/O on busy systems)
ALTER SYSTEM SET log_min_duration_statement = 0;

-- Disable query logging
ALTER SYSTEM SET log_min_duration_statement = -1;

-- Check current setting
SHOW log_min_duration_statement;
```

### auto_explain

Automatically log EXPLAIN output for slow queries. Invaluable for debugging intermittent
performance issues.

```sql
-- Enable auto_explain (add to postgresql.conf)
-- shared_preload_libraries = 'auto_explain'

-- Or load per-session for debugging
LOAD 'auto_explain';

-- Configure auto_explain
ALTER SYSTEM SET auto_explain.log_min_duration = 1000;    -- log plans > 1s
ALTER SYSTEM SET auto_explain.log_analyze = on;            -- include ANALYZE
ALTER SYSTEM SET auto_explain.log_buffers = on;            -- include buffer stats
ALTER SYSTEM SET auto_explain.log_timing = on;             -- include timing
ALTER SYSTEM SET auto_explain.log_nested_statements = on;  -- log inside functions
ALTER SYSTEM SET auto_explain.log_format = 'text';         -- or json
SELECT pg_reload_conf();

-- Per-session auto_explain for debugging
SET auto_explain.log_min_duration = 0;  -- log all queries
SET auto_explain.log_analyze = on;
```

### Query Log Format

```sql
-- Configure log output format
ALTER SYSTEM SET log_line_prefix = '%t [%p] %u@%d ';
-- %t = timestamp, %p = PID, %u = user, %d = database

-- Log query parameters (security consideration: may log sensitive data)
ALTER SYSTEM SET log_statement = 'ddl';  -- none, ddl, mod, all
SELECT pg_reload_conf();

-- Log connection events
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
SELECT pg_reload_conf();
```

### Monitoring with Python

```python
import psycopg

def get_database_health(conn: psycopg.Connection) -> dict:
    """Collect key database health metrics."""
    with conn.cursor() as cur:
        # Cache hit ratio
        cur.execute("""
            SELECT ROUND(
                blks_hit::numeric / GREATEST(blks_hit + blks_read, 1) * 100, 2
            ) FROM pg_stat_database WHERE datname = current_database()
        """)
        cache_hit = cur.fetchone()[0]

        # Connection count
        cur.execute("SELECT COUNT(*) FROM pg_stat_activity")
        connections = cur.fetchone()[0]

        # Long-running queries
        cur.execute("""
            SELECT COUNT(*) FROM pg_stat_activity
            WHERE state = 'active'
              AND now() - query_start > INTERVAL '5 minutes'
              AND pid != pg_backend_pid()
        """)
        long_queries = cur.fetchone()[0]

        # Dead tuple ratio (worst table)
        cur.execute("""
            SELECT relname,
                   ROUND(n_dead_tup::numeric / GREATEST(n_live_tup, 1) * 100, 1)
            FROM pg_stat_user_tables
            WHERE n_live_tup > 1000
            ORDER BY n_dead_tup::numeric / GREATEST(n_live_tup, 1) DESC
            LIMIT 1
        """)
        worst_bloat = cur.fetchone()

        return {
            "cache_hit_pct": float(cache_hit),
            "connections": connections,
            "long_running_queries": long_queries,
            "worst_bloat_table": worst_bloat[0] if worst_bloat else None,
            "worst_bloat_pct": float(worst_bloat[1]) if worst_bloat else 0,
        }
```
