# Async Testing

Comprehensive reference for testing asynchronous Python code with pytest, covering
pytest-asyncio, async fixtures, framework-specific patterns, and event loop configuration.

---

## pytest-asyncio Setup

### Installation

```bash
poetry add --group dev pytest-asyncio
```

### Auto Mode Configuration

Set `asyncio_mode = "auto"` to avoid decorating every async test with
`@pytest.mark.asyncio`.

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

With auto mode, any `async def test_*` function is automatically treated as an async test:

```python
async def test_async_fetch():
    result = await fetch_data("https://api.example.com/status")
    assert result["status"] == "ok"
```

Without auto mode, each test needs the marker explicitly:

```python
import pytest


@pytest.mark.asyncio
async def test_async_fetch():
    result = await fetch_data("https://api.example.com/status")
    assert result["status"] == "ok"
```

---

## Async Fixtures

Use `@pytest_asyncio.fixture` for fixtures that need `await`.

```python
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession


@pytest_asyncio.fixture
async def async_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def async_session(async_engine):
    async with AsyncSession(async_engine) as session:
        yield session
        await session.rollback()
```

### Async Fixture Scopes

```python
@pytest_asyncio.fixture(scope="session")
async def shared_async_resource():
    resource = await create_expensive_resource()
    yield resource
    await resource.cleanup()


@pytest_asyncio.fixture(scope="module")
async def module_client():
    client = AsyncHTTPClient()
    await client.connect()
    yield client
    await client.close()
```

---

## Testing Async FastAPI with httpx

Use `httpx.AsyncClient` with `ASGITransport` for async endpoint testing.

```python
import pytest
import httpx
from httpx import ASGITransport
from myapp.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def test_get_items(async_client):
    response = await async_client.get("/items/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_create_item(async_client):
    response = await async_client.post(
        "/items/",
        json={"name": "Widget", "price": 9.99},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Widget"
```

### Dependency Override in Async Tests

```python
from myapp.dependencies import get_db_session


@pytest.fixture
async def async_client(async_session):
    async def override_get_db():
        yield async_session

    app.dependency_overrides[get_db_session] = override_get_db
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


async def test_create_user(async_client, async_session):
    response = await async_client.post(
        "/users/",
        json={"username": "alice", "email": "alice@example.com"},
    )
    assert response.status_code == 201

    # Verify directly in database
    result = await async_session.execute(select(User).where(User.username == "alice"))
    user = result.scalar_one()
    assert user.email == "alice@example.com"
```

---

## Testing Celery Tasks

### Eager Task Execution (`task_always_eager`)

Force tasks to run synchronously in tests.

```python
import pytest


@pytest.fixture(autouse=True)
def celery_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True


@pytest.mark.django_db
def test_send_welcome_email_task():
    send_welcome_email.delay(user_id=1)
    # Task runs synchronously -- check side effects directly
    assert Email.objects.filter(to="user@example.com").exists()
```

### Mocking Task.delay()

For tests that should not execute the task at all.

```python
def test_order_triggers_notification(mocker):
    mock_task = mocker.patch("myapp.tasks.send_notification.delay")
    create_order(user_id=1, items=["widget"])
    mock_task.assert_called_once_with(
        user_id=1,
        event="order_created",
    )
```

### Mocking Task.apply_async()

```python
def test_scheduled_task(mocker):
    mock_apply = mocker.patch("myapp.tasks.process_report.apply_async")
    schedule_report(report_id=42, eta_minutes=30)
    mock_apply.assert_called_once()
    call_kwargs = mock_apply.call_args.kwargs
    assert call_kwargs["args"] == (42,)
    assert "eta" in call_kwargs
```

### Testing Task Retry Logic

```python
from celery.exceptions import Retry


def test_task_retries_on_failure(mocker):
    mocker.patch(
        "myapp.services.external_api.call",
        side_effect=ConnectionError("timeout"),
    )
    mock_retry = mocker.patch.object(process_webhook, "retry", side_effect=Retry())
    with pytest.raises(Retry):
        process_webhook(payload={"event": "payment"})
    mock_retry.assert_called_once()
```

---

## Testing Django Async Views

### Async View Testing with Django 4.1+

```python
import pytest
from django.test import AsyncClient


@pytest.fixture
def async_django_client():
    return AsyncClient()


@pytest.mark.django_db
async def test_async_view(async_django_client):
    response = await async_django_client.get("/api/async-data/")
    assert response.status_code == 200


@pytest.mark.django_db
async def test_async_create(async_django_client):
    response = await async_django_client.post(
        "/api/items/",
        data={"name": "Widget"},
        content_type="application/json",
    )
    assert response.status_code == 201
```

### Mixing Sync ORM in Async Tests

Django ORM calls must go through `sync_to_async` in async contexts.

```python
from asgiref.sync import sync_to_async


@pytest.mark.django_db
async def test_async_view_creates_record(async_django_client):
    response = await async_django_client.post(
        "/api/items/",
        data={"name": "Widget"},
        content_type="application/json",
    )
    assert response.status_code == 201

    # Wrap synchronous ORM call
    item = await sync_to_async(Item.objects.get)(name="Widget")
    assert item.name == "Widget"
```

---

## Testing WebSockets

### Django Channels: WebsocketCommunicator

```python
import pytest
from channels.testing import WebsocketCommunicator
from myapp.consumers import ChatConsumer


@pytest.mark.asyncio
async def test_websocket_connect():
    communicator = WebsocketCommunicator(ChatConsumer.as_asgi(), "/ws/chat/room1/")
    connected, _ = await communicator.connect()
    assert connected

    await communicator.send_json_to({"message": "hello"})
    response = await communicator.receive_json_from(timeout=5)
    assert response["message"] == "hello"

    await communicator.disconnect()


@pytest.mark.asyncio
async def test_websocket_auth_required():
    communicator = WebsocketCommunicator(ChatConsumer.as_asgi(), "/ws/chat/private/")
    connected, code = await communicator.connect()
    assert not connected
    assert code == 4001  # Custom close code for unauthenticated
```

### FastAPI WebSocket Testing

```python
from fastapi.testclient import TestClient
from myapp.main import app


def test_websocket_echo():
    client = TestClient(app)
    with client.websocket_connect("/ws/echo") as websocket:
        websocket.send_text("hello")
        data = websocket.receive_text()
        assert data == "hello"


def test_websocket_json():
    client = TestClient(app)
    with client.websocket_connect("/ws/data") as websocket:
        websocket.send_json({"action": "subscribe", "channel": "updates"})
        response = websocket.receive_json()
        assert response["status"] == "subscribed"
```

---

## anyio for Backend-Agnostic Tests

`anyio` provides a backend-agnostic async testing interface that works with both `asyncio`
and `trio`. It ships with its own pytest plugin -- no separate plugin package is needed.

```bash
poetry add --group dev anyio
```

```python
import anyio
import pytest


@pytest.fixture(params=["asyncio", "trio"])
def anyio_backend(request):
    return request.param


async def test_concurrent_tasks(anyio_backend):
    results = []

    async def worker(name: str):
        await anyio.sleep(0.01)
        results.append(name)

    async with anyio.create_task_group() as tg:
        tg.start_soon(worker, "a")
        tg.start_soon(worker, "b")

    assert sorted(results) == ["a", "b"]


async def test_timeout(anyio_backend):
    with pytest.raises(TimeoutError):
        with anyio.fail_after(0.01):
            await anyio.sleep(10)
```

---

## Event Loop Configuration and Isolation

### Custom Event Loop Policy

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

```python
# conftest.py
import asyncio
import pytest


@pytest.fixture(scope="session")
def event_loop_policy():
    # Use uvloop for faster async tests if available
    try:
        import uvloop
        return uvloop.EventLoopPolicy()
    except ImportError:
        return asyncio.DefaultEventLoopPolicy()
```

### Event Loop Scope

By default, pytest-asyncio creates a new event loop per test function. For session-scoped
async fixtures, configure the default fixture loop scope (pytest-asyncio 0.23+; overriding
the `event_loop` fixture is deprecated and removed in pytest-asyncio 1.0):

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_default_fixture_loop_scope = "session"
```

Override the loop scope per fixture or per test when needed:

```python
@pytest_asyncio.fixture(loop_scope="session")
async def shared_resource(): ...


@pytest.mark.asyncio(loop_scope="session")
async def test_uses_session_loop(): ...
```

### Isolation Between Tests

Each test should have a clean async state. Avoid sharing mutable state through
session-scoped async fixtures. If session-scoped fixtures are necessary, ensure they are
read-only or use proper synchronization:

```python
@pytest_asyncio.fixture
async def isolated_session(async_engine):
    async with async_engine.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(bind=conn)
        yield session
        await trans.rollback()
```

---

## Database Fixtures for Async Tests

### SQLAlchemy Async Session with Transaction Rollback

```python
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker


@pytest_asyncio.fixture(scope="session")
async def async_engine():
    engine = create_async_engine(
        "postgresql+asyncpg://test:test@localhost:5432/test_db",
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def async_session(async_engine):
    async with async_engine.connect() as conn:
        trans = await conn.begin()
        session_factory = async_sessionmaker(bind=conn, class_=AsyncSession)
        async with session_factory() as session:
            yield session
        await trans.rollback()
```

### Django Async Database Access

```python
import pytest
from django.test import AsyncClient


@pytest.fixture
def async_client():
    return AsyncClient()


@pytest.mark.django_db(transaction=True)
async def test_async_create_and_read(async_client):
    create_response = await async_client.post(
        "/api/items/",
        data={"name": "Async Widget"},
        content_type="application/json",
    )
    assert create_response.status_code == 201
    item_id = create_response.json()["id"]

    get_response = await async_client.get(f"/api/items/{item_id}/")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "Async Widget"
```

### Tortoise ORM Async Fixtures

```python
import pytest_asyncio
from tortoise import Tortoise


@pytest_asyncio.fixture(scope="session")
async def init_db():
    await Tortoise.init(
        db_url="sqlite://:memory:",
        modules={"models": ["myapp.models"]},
    )
    await Tortoise.generate_schemas()
    yield
    await Tortoise.close_connections()


@pytest_asyncio.fixture
async def clean_db(init_db):
    yield
    # Truncate all tables after each test
    for model in Tortoise.apps.get("models").values():
        await model.all().delete()
```
