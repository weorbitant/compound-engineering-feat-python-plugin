# Django Channels Patterns

## ASGI Setup

### Installation

```bash
pip install channels channels-redis daphne
```

### Configuration

```python
# settings.py
INSTALLED_APPS = [
    "daphne",  # must be before django.contrib.staticfiles
    "channels",
    # ...
]

ASGI_APPLICATION = "proj.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("127.0.0.1", 6379)],
            "capacity": 1500,          # max messages in a channel
            "expiry": 10,              # message expiry in seconds
        },
    },
}
```

### ASGI Application

```python
# proj/asgi.py
import os
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "proj.settings")
django_asgi_app = get_asgi_application()

from myapp.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    ),
})
```

### Running the ASGI Server

```bash
# development
daphne -b 0.0.0.0 -p 8000 proj.asgi:application

# or with uvicorn
uvicorn proj.asgi:application --host 0.0.0.0 --port 8000 --reload

# production: use daphne behind nginx/caddy
```

## Consumer Types

### WebsocketConsumer (synchronous)

Runs in a thread pool. Use for simple cases or when calling synchronous Django ORM code:

```python
import json
from channels.generic.websocket import WebsocketConsumer

class ChatConsumer(WebsocketConsumer):
    def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group = f"chat_{self.room_name}"

        # join room group
        self.channel_layer.group_add(self.room_group, self.channel_name)
        self.accept()

        # send recent messages on connect
        messages = Message.objects.filter(
            room__name=self.room_name,
        ).order_by("-created_at")[:50]
        self.send(text_data=json.dumps({
            "type": "history",
            "messages": [
                {"user": m.user.username, "text": m.text}
                for m in reversed(messages)
            ],
        }))

    def disconnect(self, close_code):
        self.channel_layer.group_discard(self.room_group, self.channel_name)

    def receive(self, text_data):
        data = json.loads(text_data)
        message = data["message"]
        user = self.scope["user"]

        # persist to database
        Message.objects.create(
            room_id=self.room_name,
            user=user,
            text=message,
        )

        # broadcast to room group
        self.channel_layer.group_send(
            self.room_group,
            {
                "type": "chat.message",
                "message": message,
                "username": user.username,
            },
        )

    def chat_message(self, event):
        """Handler for chat.message type. Method name derived from type with dots
        replaced by underscores."""
        self.send(text_data=json.dumps({
            "type": "message",
            "message": event["message"],
            "username": event["username"],
        }))
```

### AsyncWebsocketConsumer

Native async. Use for high-concurrency scenarios or when calling async-compatible code:

```python
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
import json

class AsyncChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group = f"chat_{self.room_name}"

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group, self.channel_name,
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        user = self.scope["user"]

        await self.save_message(user, data["message"])

        await self.channel_layer.group_send(
            self.room_group,
            {
                "type": "chat.message",
                "message": data["message"],
                "username": user.username,
            },
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "message",
            "message": event["message"],
            "username": event["username"],
        }))

    @database_sync_to_async
    def save_message(self, user, text):
        return Message.objects.create(
            room_id=self.room_name, user=user, text=text,
        )
```

### JsonWebsocketConsumer

Handles JSON serialization/deserialization automatically:

```python
from channels.generic.websocket import JsonWebsocketConsumer

class DashboardConsumer(JsonWebsocketConsumer):
    def connect(self):
        self.user_group = f"dashboard_{self.scope['user'].id}"
        self.channel_layer.group_add(self.user_group, self.channel_name)
        self.accept()

    def disconnect(self, close_code):
        self.channel_layer.group_discard(self.user_group, self.channel_name)

    def receive_json(self, content):
        """Called with parsed JSON content instead of raw text."""
        action = content.get("action")
        if action == "subscribe":
            metric = content["metric"]
            self.channel_layer.group_add(
                f"metric_{metric}", self.channel_name,
            )
        elif action == "unsubscribe":
            metric = content["metric"]
            self.channel_layer.group_discard(
                f"metric_{metric}", self.channel_name,
            )

    def metric_update(self, event):
        """Push metric updates to subscribed clients."""
        self.send_json({
            "type": "metric_update",
            "metric": event["metric"],
            "value": event["value"],
            "timestamp": event["timestamp"],
        })
```

## Routing

### URL Routing

```python
# myapp/routing.py
from django.urls import re_path, path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/chat/(?P<room_name>\w+)/$", consumers.ChatConsumer.as_asgi()),
    path("ws/notifications/", consumers.NotificationConsumer.as_asgi()),
    path("ws/dashboard/", consumers.DashboardConsumer.as_asgi()),
]
```

### Protocol-Based Routing

```python
# proj/asgi.py
from channels.routing import ProtocolTypeRouter, URLRouter

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns),
    ),
})
```

## Authentication

### Session-Based Auth (default with AuthMiddlewareStack)

`AuthMiddlewareStack` populates `self.scope["user"]` from the Django session cookie:

```python
class PrivateConsumer(WebsocketConsumer):
    def connect(self):
        user = self.scope["user"]
        if user.is_anonymous:
            self.close()
            return
        self.accept()
```

### Token-Based Auth (JWT or DRF tokens)

For APIs using token auth instead of session cookies, create custom middleware:

```python
# middleware.py
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token
from urllib.parse import parse_qs

@database_sync_to_async
def get_user_from_token(token_key):
    try:
        token = Token.objects.select_related("user").get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_params = parse_qs(scope.get("query_string", b"").decode())
        token_key = query_params.get("token", [None])[0]
        if token_key:
            scope["user"] = await get_user_from_token(token_key)
        else:
            scope["user"] = AnonymousUser()
        return await super().__call__(scope, receive, send)
```

```python
# asgi.py
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        TokenAuthMiddleware(URLRouter(websocket_urlpatterns)),
    ),
})
```

Client connects with: `ws://localhost:8000/ws/chat/room1/?token=abc123`

## Channel Layers and Group Messaging

### Core Operations

```python
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

channel_layer = get_channel_layer()

# send to a specific channel
async_to_sync(channel_layer.send)(
    "specific-channel-name",
    {"type": "task.update", "status": "complete"},
)

# send to a group (broadcast)
async_to_sync(channel_layer.group_send)(
    "chat_room1",
    {"type": "chat.message", "message": "Hello everyone"},
)

# add a channel to a group
async_to_sync(channel_layer.group_add)("chat_room1", channel_name)

# remove a channel from a group
async_to_sync(channel_layer.group_discard)("chat_room1", channel_name)
```

### Sending from Django Views

Push updates from standard HTTP views to WebSocket clients:

```python
# views.py
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from rest_framework.views import APIView
from rest_framework.response import Response

class OrderStatusView(APIView):
    def patch(self, request, order_id):
        order = Order.objects.get(id=order_id)
        order.status = request.data["status"]
        order.save()

        # notify connected WebSocket clients
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"order_{order_id}",
            {
                "type": "order.update",
                "order_id": order_id,
                "status": order.status,
            },
        )
        return Response({"status": order.status})
```

### Sending from Celery Tasks

```python
# tasks.py
from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

@shared_task
def process_upload(upload_id: int, user_id: int) -> dict:
    upload = Upload.objects.get(id=upload_id)
    channel_layer = get_channel_layer()

    # send progress updates
    for progress in do_processing(upload):
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}",
            {
                "type": "upload.progress",
                "upload_id": upload_id,
                "progress": progress,
            },
        )

    # send completion
    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {
            "type": "upload.complete",
            "upload_id": upload_id,
            "url": upload.result_url,
        },
    )
    return {"status": "complete", "upload_id": upload_id}
```

## Group Management Patterns

### User-Scoped Groups

Each user gets their own notification group:

```python
class UserNotificationConsumer(JsonWebsocketConsumer):
    def connect(self):
        user = self.scope["user"]
        if user.is_anonymous:
            self.close()
            return

        self.user_group = f"user_{user.id}"
        self.channel_layer.group_add(self.user_group, self.channel_name)
        self.accept()

    def disconnect(self, close_code):
        if hasattr(self, "user_group"):
            self.channel_layer.group_discard(
                self.user_group, self.channel_name,
            )
```

### Multi-Group Subscriptions

Subscribe to multiple groups based on user permissions:

```python
class ProjectConsumer(JsonWebsocketConsumer):
    def connect(self):
        user = self.scope["user"]
        if user.is_anonymous:
            self.close()
            return

        self.groups_joined = []
        # join user-specific group
        self.join_group(f"user_{user.id}")

        # join groups for each project the user belongs to
        project_ids = user.projects.values_list("id", flat=True)
        for pid in project_ids:
            self.join_group(f"project_{pid}")

        self.accept()

    def join_group(self, group_name):
        self.channel_layer.group_add(group_name, self.channel_name)
        self.groups_joined.append(group_name)

    def disconnect(self, close_code):
        for group_name in self.groups_joined:
            self.channel_layer.group_discard(group_name, self.channel_name)
```

### Presence Tracking

Track which users are currently connected:

```python
from django.core.cache import cache

class PresenceConsumer(JsonWebsocketConsumer):
    def connect(self):
        user = self.scope["user"]
        self.room = self.scope["url_route"]["kwargs"]["room"]
        self.room_group = f"room_{self.room}"

        self.channel_layer.group_add(self.room_group, self.channel_name)
        self.accept()

        # track presence in cache
        presence_key = f"presence:{self.room}"
        members = cache.get(presence_key, set())
        members.add(user.username)
        cache.set(presence_key, members, timeout=None)

        # broadcast updated member list
        self.channel_layer.group_send(
            self.room_group,
            {"type": "presence.update", "members": list(members)},
        )

    def disconnect(self, close_code):
        user = self.scope["user"]
        presence_key = f"presence:{self.room}"
        members = cache.get(presence_key, set())
        members.discard(user.username)
        cache.set(presence_key, members, timeout=None)

        self.channel_layer.group_discard(self.room_group, self.channel_name)
        self.channel_layer.group_send(
            self.room_group,
            {"type": "presence.update", "members": list(members)},
        )

    def presence_update(self, event):
        self.send_json({"type": "presence", "members": event["members"]})
```

## Testing

### WebsocketCommunicator

```python
import pytest
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
from proj.asgi import application


@pytest.mark.asyncio
async def test_chat_consumer_connect():
    communicator = WebsocketCommunicator(application, "/ws/chat/testroom/")
    # set authenticated user in scope
    communicator.scope["user"] = await create_test_user()

    connected, _ = await communicator.connect()
    assert connected

    await communicator.disconnect()


@pytest.mark.asyncio
async def test_chat_message_broadcast():
    user = await create_test_user()

    comm1 = WebsocketCommunicator(application, "/ws/chat/testroom/")
    comm1.scope["user"] = user
    await comm1.connect()

    comm2 = WebsocketCommunicator(application, "/ws/chat/testroom/")
    comm2.scope["user"] = user
    await comm2.connect()

    # send message from comm1
    await comm1.send_json_to({"message": "hello"})

    # both should receive the broadcast
    response1 = await comm1.receive_json_from(timeout=5)
    response2 = await comm2.receive_json_from(timeout=5)
    assert response1["message"] == "hello"
    assert response2["message"] == "hello"

    await comm1.disconnect()
    await comm2.disconnect()


@pytest.mark.asyncio
async def test_unauthenticated_rejected():
    communicator = WebsocketCommunicator(application, "/ws/notifications/")
    communicator.scope["user"] = AnonymousUser()

    connected, code = await communicator.connect()
    assert not connected


@database_sync_to_async
def create_test_user():
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(username="testuser", password="testpass")
```

### Testing Channel Layer in Isolation

```python
# conftest.py
@pytest.fixture
def channel_layer():
    """Use in-memory channel layer for tests."""
    from channels.layers import get_channel_layer
    from channels.testing import InMemoryChannelLayer

    layer = InMemoryChannelLayer()
    return layer
```

### Settings for Tests

```python
# conftest.py or settings/test.py
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}
```

## Integration: Celery + Channels

### Pattern: Background Task with Live Progress

```python
# tasks.py
from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

@shared_task(bind=True)
def generate_export(self, export_id: int, user_id: int) -> dict:
    export = Export.objects.get(id=export_id)
    channel_layer = get_channel_layer()
    total = export.get_row_count()

    for i, chunk in enumerate(export.iter_chunks()):
        process_chunk(chunk)
        progress = int((i + 1) / total * 100)
        self.update_state(state="PROCESSING", meta={"progress": progress})

        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}",
            {
                "type": "export.progress",
                "export_id": export_id,
                "progress": progress,
            },
        )

    url = finalize_export(export)
    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {
            "type": "export.complete",
            "export_id": export_id,
            "download_url": url,
        },
    )
    return {"status": "complete", "url": url}
```

```python
# consumers.py
from channels.generic.websocket import JsonWebsocketConsumer

class ExportConsumer(JsonWebsocketConsumer):
    def connect(self):
        user = self.scope["user"]
        if user.is_anonymous:
            self.close()
            return
        self.user_group = f"user_{user.id}"
        self.channel_layer.group_add(self.user_group, self.channel_name)
        self.accept()

    def disconnect(self, close_code):
        if hasattr(self, "user_group"):
            self.channel_layer.group_discard(
                self.user_group, self.channel_name,
            )

    def receive_json(self, content):
        if content.get("action") == "start_export":
            from myapp.tasks import generate_export
            export = Export.objects.create(
                user=self.scope["user"],
                params=content.get("params", {}),
            )
            generate_export.delay(export.id, self.scope["user"].id)
            self.send_json({
                "type": "export_started",
                "export_id": export.id,
            })

    def export_progress(self, event):
        self.send_json({
            "type": "export_progress",
            "export_id": event["export_id"],
            "progress": event["progress"],
        })

    def export_complete(self, event):
        self.send_json({
            "type": "export_complete",
            "export_id": event["export_id"],
            "download_url": event["download_url"],
        })
```

## Production Checklist

- [ ] `AllowedHostsOriginValidator` wraps WebSocket routing
- [ ] Authentication middleware applied (session or token)
- [ ] Anonymous users rejected in connect() for private consumers
- [ ] `CHANNEL_LAYERS` uses Redis (not `InMemoryChannelLayer`) in production
- [ ] Channel layer `capacity` and `expiry` tuned for expected load
- [ ] Groups cleaned up in `disconnect()` for every `group_add` in `connect()`
- [ ] ASGI server (daphne/uvicorn) behind reverse proxy with WebSocket support
- [ ] nginx/caddy configured with `proxy_set_header Upgrade` for WebSocket upgrade
- [ ] `InMemoryChannelLayer` used in test settings
- [ ] Graceful handling of `channel_layer` being None (when layer is unavailable)
