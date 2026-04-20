---
name: django-async
description: Implement async task queues with Celery and real-time WebSocket support with Django Channels. Use when a Django project includes celery or channels in its dependencies, or when implementing background processing, periodic tasks, WebSocket connections, or real-time features.
model: haiku
---

# Django Async Patterns

Patterns for background task processing with Celery and real-time communication with
Django Channels in Django projects.

## When to Use

- Project has `celery` in dependencies: background tasks, periodic scheduling, task chains
- Project has `channels` in dependencies: WebSockets, real-time updates, async consumers
- Need to offload long-running operations from request/response cycle
- Need real-time push notifications or live data streams
- Need periodic/scheduled task execution (cron-like)

## Overview

### Celery

Distributed task queue for executing work outside the request/response cycle. Core concepts:

- **Broker** (Redis/RabbitMQ) receives task messages from producers
- **Workers** consume tasks from the broker and execute them
- **Result backend** (Redis/database) stores task results
- **Beat** scheduler triggers periodic tasks on a crontab or interval

### Django Channels

Extends Django beyond HTTP to handle WebSockets, chat protocols, and other async protocols:

- **ASGI** replaces WSGI as the application server interface
- **Consumers** handle WebSocket lifecycle (connect, receive, disconnect)
- **Channel layers** (Redis) enable cross-process communication and group messaging
- **Routing** maps URL paths to consumers, similar to Django URL patterns

## Quick Start

### Celery Quick Start

```python
# proj/celery.py
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "proj.settings")

app = Celery("proj")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

```python
# proj/__init__.py
from .celery import app as celery_app

__all__ = ["celery_app"]
```

```python
# settings.py
CELERY_BROKER_URL = "redis://localhost:6379/0"
CELERY_RESULT_BACKEND = "redis://localhost:6379/0"
```

```python
# myapp/tasks.py
from celery import shared_task

@shared_task
def send_welcome_email(user_id: int) -> str:
    user = User.objects.get(id=user_id)
    # send email logic
    return f"Email sent to {user.email}"
```

### Channels Quick Start

```python
# settings.py
INSTALLED_APPS = [
    "daphne",
    "channels",
    # ...
]
ASGI_APPLICATION = "proj.asgi.application"
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [("127.0.0.1", 6379)]},
    },
}
```

```python
# proj/asgi.py
import os
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "proj.settings")
django_asgi_app = get_asgi_application()

from myapp.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
})
```

## Reference Documents

- [celery.md](./references/celery.md) - Celery task patterns, retry strategies, canvas
  primitives, beat scheduling, monitoring, and testing
- [channels.md](./references/channels.md) - Django Channels consumers, routing, channel
  layers, authentication, group management, and testing

## Decision Guide

| Scenario | Solution |
|----------|----------|
| Offload slow work from HTTP request | Celery task |
| Run something every hour/day | Celery Beat periodic task |
| Chain multiple async steps | Celery canvas (chain/group/chord) |
| Push live updates to browser | Channels WebSocket consumer |
| Notify user when Celery task completes | Celery task + Channels group_send |
| Chat or collaborative editing | Channels with group messaging |
| File processing pipeline | Celery chain with retry |

## Common Integration: Celery + Channels

Send real-time updates to the browser when a background task completes:

```python
# tasks.py
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from celery import shared_task

@shared_task
def process_report(report_id: int, user_id: int) -> dict:
    report = generate_report(report_id)
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {"type": "report.ready", "report_id": report_id, "url": report.url},
    )
    return {"status": "complete", "report_id": report_id}
```

```python
# consumers.py
from channels.generic.websocket import JsonWebsocketConsumer

class NotificationConsumer(JsonWebsocketConsumer):
    def connect(self):
        self.user_group = f"user_{self.scope['user'].id}"
        self.channel_layer.group_add(self.user_group, self.channel_name)
        self.accept()

    def disconnect(self, close_code):
        self.channel_layer.group_discard(self.user_group, self.channel_name)

    def report_ready(self, event):
        self.send_json({"type": "report_ready", "data": event})
```
