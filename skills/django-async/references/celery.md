# Celery Task Patterns

## App Configuration

### Standard Django Setup

```python
# proj/celery.py
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "proj.settings")

app = Celery("proj")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
```

```python
# proj/__init__.py
from .celery import app as celery_app

__all__ = ["celery_app"]
```

### Settings

```python
# settings.py
CELERY_BROKER_URL = "redis://localhost:6379/0"
CELERY_RESULT_BACKEND = "redis://localhost:6379/0"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes hard limit
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes soft limit
CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # for fair task distribution
CELERY_TASK_ACKS_LATE = True  # ack after execution, not before
```

## Task Definition

### Basic Task with @shared_task

`@shared_task` does not require a concrete Celery app instance, making it portable across
Django apps:

```python
from celery import shared_task

@shared_task
def add(x: int, y: int) -> int:
    return x + y
```

### Bound Tasks (access to self)

Use `bind=True` to access the task instance for retries, request info, and state updates:

```python
@shared_task(bind=True)
def import_data(self, file_path: str) -> dict:
    self.update_state(state="PROCESSING", meta={"progress": 0})
    rows = process_file(file_path)
    for i, row in enumerate(rows):
        handle_row(row)
        self.update_state(
            state="PROCESSING",
            meta={"progress": (i + 1) / len(rows) * 100},
        )
    return {"rows_processed": len(rows)}
```

### Base Task Classes

Create reusable base classes for cross-cutting concerns:

```python
from celery import Task

class DatabaseTask(Task):
    """Base task that ensures database connections are properly closed."""

    def after_return(self, status, retval, task_id, args, kwargs, einfo):
        from django.db import connection
        connection.close()


class LoggedTask(Task):
    """Base task with structured logging on lifecycle events."""

    def on_success(self, retval, task_id, args, kwargs):
        logger.info("✅ Task %s completed: %s", self.name, retval)

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error("❌ Task %s failed: %s", self.name, exc)

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        logger.warning("🔄 Task %s retrying: %s", self.name, exc)


@shared_task(base=LoggedTask)
def send_notification(user_id: int, message: str) -> bool:
    # task logic
    return True
```

### Task Naming

Explicit names prevent issues when refactoring module paths:

```python
@shared_task(name="users.send_welcome_email")
def send_welcome_email(user_id: int) -> str:
    # ...
    pass
```

## Retry Strategies

### Automatic Retry with Exponential Backoff

```python
@shared_task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,       # exponential backoff: 1s, 2s, 4s, 8s...
    retry_backoff_max=600,    # cap at 10 minutes
    retry_jitter=True,        # add randomness to prevent thundering herd
    max_retries=5,
)
def call_external_api(self, endpoint: str, payload: dict) -> dict:
    response = requests.post(endpoint, json=payload, timeout=30)
    response.raise_for_status()
    return response.json()
```

### Manual Retry with Custom Logic

```python
@shared_task(bind=True, max_retries=3)
def process_payment(self, order_id: int) -> dict:
    try:
        order = Order.objects.get(id=order_id)
        result = payment_gateway.charge(order)
        return {"status": "charged", "transaction_id": result.id}
    except PaymentDeclinedError:
        # don't retry declined payments
        order.mark_failed()
        raise
    except PaymentGatewayError as exc:
        # retry with increasing countdown
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)
```

### Idempotency

Design tasks to be safely re-executed. Use database constraints or idempotency keys:

```python
@shared_task(bind=True, max_retries=3)
def charge_subscription(self, subscription_id: int, period: str) -> dict:
    # idempotency: check if already processed
    if Payment.objects.filter(
        subscription_id=subscription_id,
        period=period,
        status="completed",
    ).exists():
        return {"status": "already_processed"}

    payment = Payment.objects.create(
        subscription_id=subscription_id,
        period=period,
        status="pending",
        idempotency_key=f"{subscription_id}:{period}",
    )
    try:
        result = gateway.charge(payment)
        payment.status = "completed"
        payment.transaction_id = result.id
        payment.save()
        return {"status": "charged", "payment_id": payment.id}
    except GatewayError as exc:
        payment.status = "failed"
        payment.save()
        raise self.retry(exc=exc)
```

## Beat Scheduling (Periodic Tasks)

### Configuration in Settings

```python
# settings.py
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    "cleanup-expired-sessions": {
        "task": "accounts.tasks.cleanup_expired_sessions",
        "schedule": crontab(hour=2, minute=0),  # daily at 2 AM
    },
    "send-daily-digest": {
        "task": "notifications.tasks.send_daily_digest",
        "schedule": crontab(hour=8, minute=0, day_of_week="1-5"),  # weekdays 8 AM
    },
    "sync-inventory": {
        "task": "inventory.tasks.sync_from_warehouse",
        "schedule": 300.0,  # every 5 minutes
        "kwargs": {"full_sync": False},
    },
    "monthly-report": {
        "task": "reports.tasks.generate_monthly_report",
        "schedule": crontab(day_of_month=1, hour=6, minute=0),  # 1st of month
    },
}
```

### Database-Backed Scheduling with django-celery-beat

For dynamic schedules managed via Django admin:

```python
# settings.py
INSTALLED_APPS = [
    # ...
    "django_celery_beat",
]
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
```

```python
# create schedules programmatically
from django_celery_beat.models import PeriodicTask, CrontabSchedule
import json

schedule, _ = CrontabSchedule.objects.get_or_create(
    hour=9,
    minute=0,
    day_of_week="1-5",
)
PeriodicTask.objects.create(
    crontab=schedule,
    name="Send morning briefing",
    task="notifications.tasks.send_briefing",
    kwargs=json.dumps({"channel": "email"}),
)
```

### Running Beat

```bash
# separate process alongside worker
celery -A proj beat --loglevel=info

# or embed beat in worker (development only)
celery -A proj worker --beat --loglevel=info
```

## Result Backends

### Redis (recommended for most cases)

```python
CELERY_RESULT_BACKEND = "redis://localhost:6379/1"
CELERY_RESULT_EXPIRES = 3600  # results expire after 1 hour
```

### Django Database

```python
INSTALLED_APPS = ["django_celery_results"]
CELERY_RESULT_BACKEND = "django-db"
```

### Accessing Results

```python
result = send_welcome_email.delay(user_id=42)

# non-blocking check
if result.ready():
    value = result.get()

# blocking wait with timeout
try:
    value = result.get(timeout=10)
except TimeoutError:
    pass

# check state
print(result.state)   # PENDING, STARTED, SUCCESS, FAILURE, RETRY
print(result.info)    # return value or exception info
```

### Ignoring Results

For fire-and-forget tasks, disable result storage to reduce overhead:

```python
@shared_task(ignore_result=True)
def log_page_view(page: str, user_id: int | None = None) -> None:
    PageView.objects.create(page=page, user_id=user_id)
```

## Task Routing and Queues

Route tasks to specific queues for priority and resource isolation:

```python
# settings.py
from kombu import Queue

CELERY_TASK_QUEUES = [
    Queue("default", routing_key="default"),
    Queue("high_priority", routing_key="high"),
    Queue("bulk", routing_key="bulk"),
    Queue("emails", routing_key="emails"),
]

CELERY_TASK_ROUTES = {
    "payments.tasks.*": {"queue": "high_priority"},
    "reports.tasks.*": {"queue": "bulk"},
    "notifications.tasks.send_email": {"queue": "emails"},
}

CELERY_TASK_DEFAULT_QUEUE = "default"
```

```bash
# start workers for specific queues
celery -A proj worker -Q high_priority --concurrency=4
celery -A proj worker -Q bulk --concurrency=2
celery -A proj worker -Q default,emails --concurrency=8
```

### Per-Call Routing

```python
send_email.apply_async(
    args=["user@example.com", "Welcome"],
    queue="high_priority",
    priority=0,  # Redis transport: 0 = highest; RabbitMQ: higher number = higher priority
)
```

## Canvas: Composing Tasks

### Chains (sequential execution)

```python
from celery import chain

# each task receives the result of the previous task
workflow = chain(
    fetch_data.s(url),
    parse_data.s(),
    store_results.s(report_id=42),
)
result = workflow.apply_async()
```

### Groups (parallel execution)

```python
from celery import group

# execute all tasks in parallel, collect results
batch = group(
    process_image.s(image_id) for image_id in image_ids
)
result = batch.apply_async()
results = result.get()  # list of individual results
```

### Chords (parallel + callback)

```python
from celery import chord

# run tasks in parallel, then call the callback with all results
workflow = chord(
    [analyze_segment.s(seg) for seg in segments],
    combine_analysis.s(report_id=report_id),
)
result = workflow.apply_async()
```

### Practical Example: ETL Pipeline

```python
from celery import chain, group, chord

def run_etl_pipeline(source_ids: list[int], report_id: int):
    """Extract from multiple sources in parallel, transform, then load."""
    workflow = chord(
        group(extract_source.s(sid) for sid in source_ids),
        chain(
            merge_extracts.s(),
            transform_data.s(rules=get_transform_rules()),
            load_to_warehouse.s(report_id=report_id),
            notify_completion.si(report_id=report_id),
        ),
    )
    return workflow.apply_async()
```

Note: `.si()` (immutable signature) ignores the result of the previous task. Use when
a task in a chain does not need the upstream return value.

## Error Handling

### on_failure and on_retry Hooks

```python
class AlertingTask(Task):
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        if isinstance(exc, CriticalError):
            send_pagerduty_alert(
                summary=f"Task {self.name} failed: {exc}",
                task_id=task_id,
            )
        logger.error(
            "❌ Task %s[%s] failed: %s", self.name, task_id, exc,
            exc_info=einfo,
        )

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        logger.warning(
            "🔄 Task %s[%s] retry #%d: %s",
            self.name, task_id, self.request.retries, exc,
        )
```

### Dead Letter Handling

Tasks that exceed max_retries raise `MaxRetriesExceededError`. Handle gracefully:

```python
@shared_task(bind=True, max_retries=3)
def process_webhook(self, webhook_id: int) -> dict:
    try:
        return do_process(webhook_id)
    except ExternalServiceError as exc:
        try:
            raise self.retry(exc=exc, countdown=60)
        except self.MaxRetriesExceededError:
            Webhook.objects.filter(id=webhook_id).update(
                status="dead_letter",
                error_message=str(exc),
            )
            logger.error(
                "💀 Webhook %d moved to dead letter after %d retries",
                webhook_id, self.max_retries,
            )
            return {"status": "dead_letter", "webhook_id": webhook_id}
```

### Soft Time Limits

```python
from celery.exceptions import SoftTimeLimitExceeded

@shared_task(soft_time_limit=300, time_limit=360)
def generate_report(report_id: int) -> dict:
    try:
        return build_full_report(report_id)
    except SoftTimeLimitExceeded:
        # save partial progress before hard kill
        save_partial_report(report_id)
        return {"status": "partial", "report_id": report_id}
```

## Monitoring

### Flower (web-based monitoring)

```bash
pip install flower
celery -A proj flower --port=5555
```

Provides: active/completed/failed task counts, worker status, task details, rate limiting
controls, and broker stats.

### Custom Signals

```python
from celery.signals import task_prerun, task_postrun, task_failure

@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, **kwargs):
    logger.info("🚀 Starting task %s[%s]", sender.name, task_id)

@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, retval=None, state=None, **kwargs):
    logger.info("🏁 Task %s[%s] finished: state=%s", sender.name, task_id, state)

@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, **kwargs):
    metrics.increment("celery.task.failure", tags={"task": sender.name})
```

### Django Admin Integration

```python
# settings.py
INSTALLED_APPS = [
    "django_celery_results",  # task results in admin
    "django_celery_beat",     # periodic tasks in admin
]
```

## Testing

### Eager Mode (synchronous execution)

Execute tasks synchronously in tests without a broker or worker:

```python
# conftest.py
import pytest

@pytest.fixture(autouse=True)
def celery_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
```

### Testing Task Logic Directly

Call the underlying function without Celery machinery:

```python
def test_send_welcome_email(user_factory):
    user = user_factory(email="test@example.com")
    result = send_welcome_email(user.id)
    assert result == f"Email sent to test@example.com"
    assert mail.outbox[0].to == ["test@example.com"]
```

### Testing Retries

```python
def test_retry_on_connection_error(mocker):
    mocker.patch(
        "myapp.tasks.requests.post",
        side_effect=ConnectionError("timeout"),
    )
    with pytest.raises(ConnectionError):
        call_external_api("https://api.example.com", {"key": "val"})
```

### Testing with Real Broker (integration tests)

```python
# conftest.py
@pytest.fixture
def celery_config():
    return {
        "broker_url": "redis://localhost:6379/15",
        "result_backend": "redis://localhost:6379/15",
    }

def test_async_task_completes(celery_worker):
    result = add.delay(2, 3)
    assert result.get(timeout=10) == 5
```

## Production Checklist

- [ ] `CELERY_TASK_ACKS_LATE = True` for at-least-once delivery
- [ ] `CELERY_WORKER_PREFETCH_MULTIPLIER = 1` for fair distribution
- [ ] `CELERY_TASK_TIME_LIMIT` and `CELERY_TASK_SOFT_TIME_LIMIT` set
- [ ] `CELERY_RESULT_EXPIRES` set to avoid unbounded storage growth
- [ ] Tasks are idempotent (safe to re-execute)
- [ ] Sensitive data not passed as task arguments (pass IDs, fetch in task)
- [ ] Dead letter handling for tasks exceeding max retries
- [ ] Monitoring with Flower or custom signals
- [ ] Separate queues for different priority levels
- [ ] Beat scheduler runs as a single instance (use database scheduler for HA)
