# Async/Await Patterns

## async def vs def Routes

FastAPI runs `async def` routes directly on the event loop and runs plain `def` routes
in a thread pool. Choose based on the I/O driver.

### When to Use async def

Use `async def` when the route performs I/O with an async-native library (asyncpg,
aiohttp, httpx, aioredis, motor).

```python
@router.get("/users/{user_id}")
async def get_user(
    user_id: int, db: AsyncSession = Depends(get_db),
) -> UserResponse:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

### When to Use def

Use plain `def` when the route calls synchronous blocking libraries (psycopg2,
requests, file I/O without aiofiles). FastAPI runs these in a thread pool automatically.

```python
@router.get("/report")
def generate_report(db: Session = Depends(get_sync_db)) -> ReportResponse:
    # Sync ORM calls -- FastAPI runs this in a thread pool
    data = db.query(SalesData).filter_by(year=2025).all()
    return build_report(data)
```

### Common Mistake: Blocking in async def

Never call blocking code inside `async def` -- it blocks the entire event loop.

```python
# BAD: blocks the event loop
@router.get("/bad")
async def bad_route():
    time.sleep(5)  # blocks all concurrent requests
    return {"status": "done"}

# GOOD: use asyncio.sleep or run in executor
@router.get("/good")
async def good_route():
    await asyncio.sleep(5)
    return {"status": "done"}
```

## Running Sync Code in Async Context

### run_in_executor

Offload CPU-bound or blocking sync code to a thread/process pool.

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial

executor = ThreadPoolExecutor(max_workers=4)


@router.post("/process")
async def process_data(data: DataInput) -> ProcessResult:
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        executor, partial(heavy_computation, data.payload),
    )
    return ProcessResult(output=result)
```

### asyncio.to_thread (Python 3.9+)

```python
import asyncio


@router.get("/file/{filename}")
async def read_file(filename: str) -> dict:
    content = await asyncio.to_thread(Path(filename).read_text)
    return {"content": content}
```

## Background Tasks

Use `BackgroundTasks` for work that should happen after the response is sent.

### Basic Background Task

```python
from fastapi import BackgroundTasks


def send_notification_email(email: str, subject: str, body: str) -> None:
    logger.info("📧 Sending email to %s: %s", email, subject)
    email_client.send(to=email, subject=subject, body=body)


@router.post("/users", status_code=201)
async def create_user(
    user: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    new_user = await user_service.create(db, user)
    background_tasks.add_task(
        send_notification_email,
        email=new_user.email,
        subject="Welcome!",
        body="Your account has been created.",
    )
    return new_user
```

### Multiple Background Tasks

Tasks execute sequentially in the order they were added.

```python
@router.post("/orders")
async def create_order(
    order: OrderCreate,
    background_tasks: BackgroundTasks,
) -> OrderResponse:
    new_order = await order_service.create(order)
    background_tasks.add_task(send_order_confirmation, new_order)
    background_tasks.add_task(update_inventory, new_order.items)
    background_tasks.add_task(notify_warehouse, new_order)
    return new_order
```

### Background Tasks in Dependencies

```python
async def log_request(
    request: Request, background_tasks: BackgroundTasks,
) -> None:
    background_tasks.add_task(
        write_audit_log,
        method=request.method,
        path=request.url.path,
        timestamp=datetime.now(UTC),
    )


@router.get("/items", dependencies=[Depends(log_request)])
async def list_items() -> list[ItemResponse]:
    ...
```

## WebSocket Endpoints

### Basic WebSocket

```python
from fastapi import WebSocket, WebSocketDisconnect


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        logger.info("🔌 Client disconnected")
```

### Connection Manager for Broadcasting

```python
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str) -> None:
        for connection in self.active_connections:
            await connection.send_text(message)

    async def send_personal(
        self, message: str, websocket: WebSocket,
    ) -> None:
        await websocket.send_text(message)


manager = ConnectionManager()


@app.websocket("/ws/{room_id}")
async def websocket_room(websocket: WebSocket, room_id: str) -> None:
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(f"[{room_id}] {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(f"Client left room {room_id}")
```

### WebSocket with Authentication

```python
from fastapi import WebSocket, WebSocketDisconnect, Query


@app.websocket("/ws")
async def authenticated_ws(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    user = await verify_token(token)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            await handle_message(user, data)
    except WebSocketDisconnect:
        logger.info("🔌 User %s disconnected", user.id)
```

## Streaming Responses

### StreamingResponse

```python
from fastapi.responses import StreamingResponse


async def generate_csv(query_params: dict):
    yield "id,name,value\n"
    async for row in fetch_rows(query_params):
        yield f"{row.id},{row.name},{row.value}\n"


@router.get("/export")
async def export_data() -> StreamingResponse:
    return StreamingResponse(
        generate_csv({"status": "active"}),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"},
    )
```

### Server-Sent Events (SSE)

```python
import asyncio
import json

from fastapi.responses import StreamingResponse


async def event_stream(user_id: int):
    while True:
        event = await get_next_event(user_id)
        if event:
            data = json.dumps(event)
            yield f"event: {event['type']}\ndata: {data}\n\n"
        await asyncio.sleep(1)


@router.get("/events/{user_id}")
async def sse_endpoint(user_id: int) -> StreamingResponse:
    return StreamingResponse(
        event_stream(user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
```

### Streaming File Upload Processing

```python
from fastapi import UploadFile


@router.post("/upload/large")
async def upload_large_file(file: UploadFile) -> dict:
    total_size = 0
    async with aiofiles.open(f"/tmp/{file.filename}", "wb") as out:
        while chunk := await file.read(1024 * 64):  # 64KB chunks
            await out.write(chunk)
            total_size += len(chunk)
    return {"filename": file.filename, "size": total_size}
```

## asyncio Patterns

### gather for Concurrent Requests

```python
import asyncio


@router.get("/dashboard")
async def dashboard(
    user_id: int, db: AsyncSession = Depends(get_db),
) -> DashboardResponse:
    profile, orders, notifications = await asyncio.gather(
        user_service.get_profile(db, user_id),
        order_service.get_recent(db, user_id),
        notification_service.get_unread(db, user_id),
    )
    return DashboardResponse(
        profile=profile,
        recent_orders=orders,
        notifications=notifications,
    )
```

### gather with Error Handling

```python
results = await asyncio.gather(
    fetch_service_a(),
    fetch_service_b(),
    fetch_service_c(),
    return_exceptions=True,
)

valid = []
for result in results:
    if isinstance(result, Exception):
        logger.error("❌ Service call failed: %s", result)
    else:
        valid.append(result)
```

### Semaphore for Concurrency Limiting

```python
import asyncio

semaphore = asyncio.Semaphore(10)  # max 10 concurrent operations


async def rate_limited_fetch(url: str) -> dict:
    async with semaphore:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            return response.json()


@router.post("/batch-fetch")
async def batch_fetch(urls: list[str]) -> list[dict]:
    tasks = [rate_limited_fetch(url) for url in urls]
    return await asyncio.gather(*tasks)
```

### create_task for Fire-and-Forget

```python
import asyncio


@router.post("/ingest")
async def ingest_data(data: DataPayload) -> dict:
    # Start processing without waiting
    task = asyncio.create_task(process_ingestion(data))
    task.add_done_callback(handle_task_result)
    return {"status": "accepted", "message": "Processing started"}


def handle_task_result(task: asyncio.Task) -> None:
    if task.exception():
        logger.error("❌ Ingestion failed: %s", task.exception())
    else:
        logger.info("✅ Ingestion completed")
```

## Connection Pooling

### asyncpg with SQLAlchemy

```python
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/db",
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
```

### Redis with aioredis

```python
import redis.asyncio as aioredis


async def get_redis_pool() -> aioredis.Redis:
    return aioredis.from_url(
        "redis://localhost:6379",
        max_connections=20,
        decode_responses=True,
    )
```

### httpx Connection Pool

```python
import httpx

# Reuse client across requests for connection pooling
http_client = httpx.AsyncClient(
    timeout=30,
    limits=httpx.Limits(
        max_connections=100,
        max_keepalive_connections=20,
    ),
)


async def get_http_client() -> httpx.AsyncClient:
    return http_client
```

## Testing Async Code

### pytest-asyncio with httpx.AsyncClient

```python
import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test",
    ) as ac:
        yield ac


@pytest.mark.anyio
async def test_list_items(client: AsyncClient):
    response = await client.get("/api/v1/items")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
```

### Overriding Dependencies in Tests

```python
from fastapi.testclient import TestClient

from dependencies import get_db
from main import app


async def override_get_db():
    async with test_async_session() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
```

### Testing WebSockets

```python
from fastapi.testclient import TestClient

from main import app


def test_websocket():
    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_text("hello")
        data = ws.receive_text()
        assert data == "Echo: hello"
```

### Testing Background Tasks

```python
from unittest.mock import AsyncMock, patch


@pytest.mark.anyio
async def test_create_user_sends_email(client: AsyncClient):
    with patch(
        "services.email.send_notification_email",
    ) as mock_send:
        response = await client.post(
            "/api/v1/users",
            json={"email": "test@example.com", "name": "Test"},
        )
        assert response.status_code == 201
        mock_send.assert_called_once_with(
            email="test@example.com",
            subject="Welcome!",
            body="Your account has been created.",
        )
```
