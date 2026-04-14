<overview>
Django views, URL routing, forms, templates, middleware, and settings organization.
Keep views thin by delegating business logic to models and services. Prefer
function-based views for simple endpoints and class-based views when inheritance and
mixins reduce duplication.
</overview>

<function_based_views>
## Function-Based Views (FBV)

Use FBVs for simple, one-off endpoints where the logic is linear:

```python
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods


@login_required
@require_http_methods(["GET", "POST"])
def create_order(request):
    if request.method == "POST":
        form = OrderForm(request.POST)
        if form.is_valid():
            order = form.save(commit=False)
            order.customer = request.user
            order.save()
            logger.info("✅ Order %s created by user %s", order.id, request.user.id)
            return redirect("orders:detail", pk=order.pk)
    else:
        form = OrderForm()
    return render(request, "orders/create.html", {"form": form})


@login_required
def order_detail(request, pk):
    order = get_object_or_404(
        Order.objects.select_related("customer").prefetch_related("items__product"),
        pk=pk,
        customer=request.user,
    )
    return render(request, "orders/detail.html", {"order": order})
```
</function_based_views>

<class_based_views>
## Class-Based Views (CBV)

Use CBVs when multiple views share patterns (list, detail, create, update, delete) or
when mixins reduce repetition:

```python
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.views.generic import (
    CreateView,
    DeleteView,
    DetailView,
    ListView,
    UpdateView,
)
from django.urls import reverse_lazy


class OrderListView(LoginRequiredMixin, ListView):
    model = Order
    template_name = "orders/list.html"
    context_object_name = "orders"
    paginate_by = 25

    def get_queryset(self):
        return (
            Order.objects.filter(customer=self.request.user)
            .active()
            .select_related("customer")
            .order_by("-created_at")
        )


class OrderDetailView(LoginRequiredMixin, DetailView):
    model = Order
    template_name = "orders/detail.html"
    context_object_name = "order"

    def get_queryset(self):
        return Order.objects.filter(
            customer=self.request.user,
        ).prefetch_related("items__product")


class OrderCreateView(LoginRequiredMixin, CreateView):
    model = Order
    form_class = OrderForm
    template_name = "orders/form.html"
    success_url = reverse_lazy("orders:list")

    def form_valid(self, form):
        form.instance.customer = self.request.user
        logger.info(
            "✅ Order created by user %s",
            self.request.user.id,
        )
        return super().form_valid(form)


class OrderDeleteView(LoginRequiredMixin, PermissionRequiredMixin, DeleteView):
    model = Order
    permission_required = "orders.delete_order"
    success_url = reverse_lazy("orders:list")
```

### When to Use FBV vs CBV

| Scenario                      | Recommendation |
|-------------------------------|----------------|
| Simple form submission        | FBV            |
| Standard CRUD operations      | CBV            |
| Complex multi-step logic      | FBV            |
| Reusable patterns via mixins  | CBV            |
| API-style JSON responses      | Django Ninja   |
| Webhook handlers              | FBV            |
</class_based_views>

<url_routing>
## URL Routing

### App-Level URLs

```python
# orders/urls.py
from django.urls import path

from . import views

app_name = "orders"

urlpatterns = [
    path("", views.OrderListView.as_view(), name="list"),
    path("create/", views.OrderCreateView.as_view(), name="create"),
    path("<int:pk>/", views.OrderDetailView.as_view(), name="detail"),
    path("<int:pk>/edit/", views.OrderUpdateView.as_view(), name="edit"),
    path("<int:pk>/delete/", views.OrderDeleteView.as_view(), name="delete"),
    path("<int:pk>/cancel/", views.cancel_order, name="cancel"),
]
```

### Project-Level URLs

```python
# config/urls.py
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("orders/", include("orders.urls")),
    path("customers/", include("customers.urls")),
    path("api/", include("api.urls")),
]
```

### Naming Conventions

- Always set `app_name` in app-level `urls.py` for namespacing
- Use `name` on every `path()` -- reference URLs as `"orders:detail"` in templates
  and `reverse("orders:detail", kwargs={"pk": order.pk})` in code
- Use `<int:pk>` or `<uuid:pk>` for primary key parameters
- Use `<slug:slug>` for human-readable URL segments
</url_routing>

<forms>
## Forms

### ModelForm

```python
from django import forms


class OrderForm(forms.ModelForm):
    class Meta:
        model = Order
        fields = ["shipping_address", "notes"]
        widgets = {
            "notes": forms.Textarea(attrs={"rows": 3}),
        }

    def clean_shipping_address(self):
        address = self.cleaned_data["shipping_address"]
        if len(address) < 10:
            raise forms.ValidationError("Provide a complete shipping address.")
        return address
```

### Custom Validation

```python
class RegistrationForm(forms.Form):
    email = forms.EmailField()
    password = forms.CharField(widget=forms.PasswordInput)
    password_confirm = forms.CharField(widget=forms.PasswordInput)

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        confirm = cleaned_data.get("password_confirm")
        if password and confirm and password != confirm:
            raise forms.ValidationError("Passwords do not match.")
        return cleaned_data

    def clean_email(self):
        email = self.cleaned_data["email"].lower()
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("This email is already registered.")
        return email
```

### Formsets

```python
from django.forms import inlineformset_factory

OrderItemFormSet = inlineformset_factory(
    Order,
    OrderItem,
    fields=["product", "quantity"],
    extra=1,
    can_delete=True,
)

# In a view:
def edit_order_items(request, pk):
    order = get_object_or_404(Order, pk=pk, customer=request.user)
    if request.method == "POST":
        formset = OrderItemFormSet(request.POST, instance=order)
        if formset.is_valid():
            formset.save()
            return redirect("orders:detail", pk=order.pk)
    else:
        formset = OrderItemFormSet(instance=order)
    return render(request, "orders/edit_items.html", {
        "order": order,
        "formset": formset,
    })
```
</forms>

<templates>
## Template Patterns

### Template Inheritance

```html
{# templates/base.html #}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{% block title %}Site{% endblock %}</title>
    {% block extra_css %}{% endblock %}
</head>
<body>
    {% include "includes/navbar.html" %}
    <main>
        {% block content %}{% endblock %}
    </main>
    {% block extra_js %}{% endblock %}
</body>
</html>
```

```html
{# templates/orders/list.html #}
{% extends "base.html" %}
{% block title %}Orders{% endblock %}

{% block content %}
<h1>Orders</h1>
{% for order in orders %}
    <a href="{% url 'orders:detail' pk=order.pk %}">
        Order #{{ order.id }} -- {{ order.get_status_display }}
    </a>
{% empty %}
    <p>No orders found.</p>
{% endfor %}

{% include "includes/pagination.html" with page_obj=page_obj %}
{% endblock %}
```

### Context Processors

Register custom context processors in settings to inject data into every template:

```python
# context_processors.py
def site_settings(request):
    return {
        "SITE_NAME": settings.SITE_NAME,
        "SUPPORT_EMAIL": settings.SUPPORT_EMAIL,
    }
```

```python
# settings
TEMPLATES = [
    {
        "OPTIONS": {
            "context_processors": [
                # ...defaults...
                "config.context_processors.site_settings",
            ],
        },
    },
]
```
</templates>

<middleware>
## Middleware

### Request/Response Cycle

Middleware processes requests top-down and responses bottom-up:

```
Request  -> SecurityMiddleware -> SessionMiddleware -> ... -> View
Response <- SecurityMiddleware <- SessionMiddleware <- ... <- View
```

Order in `MIDDLEWARE` matters. Place authentication middleware after session middleware,
and custom middleware after Django's built-in middleware.

### Custom Middleware

```python
import time
import uuid

import structlog

logger = structlog.get_logger()


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = str(uuid.uuid4())
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        return response


class RequestTimingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        response = self.get_response(request)
        duration_ms = (time.monotonic() - start) * 1000
        logger.info(
            "⏱️ %s %s completed in %.1fms",
            request.method,
            request.path,
            duration_ms,
        )
        return response
```

Register in settings:

```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "config.middleware.RequestIDMiddleware",
    "config.middleware.RequestTimingMiddleware",
    # ...rest of middleware...
]
```
</middleware>

<settings_organization>
## Settings Organization

Split settings into environment-specific files:

```
config/
├── settings/
│   ├── __init__.py
│   ├── base.py        # Shared settings
│   ├── local.py       # Development overrides
│   ├── production.py  # Production overrides
│   └── test.py        # Test overrides
```

### base.py

```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
DEBUG = False
ALLOWED_HOSTS = []

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "django_extensions",
    # Local apps
    "orders",
    "customers",
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "app"),
        "USER": os.environ.get("DB_USER", "postgres"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
    },
}
```

### local.py

```python
from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ["*"]
```

### Selecting Settings

Use `ENVIRONMENT` to select the settings module:

```python
# config/settings/__init__.py
import os

environment = os.environ.get("ENVIRONMENT", "local")
if environment == "production":
    from .production import *  # noqa: F401, F403
elif environment == "test":
    from .test import *  # noqa: F401, F403
else:
    from .local import *  # noqa: F401, F403
```

Run locally with:

```bash
ENVIRONMENT=local poetry run python src/manage.py runserver 0.0.0.0:8000
```
</settings_organization>
