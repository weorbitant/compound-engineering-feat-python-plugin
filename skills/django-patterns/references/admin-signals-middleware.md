<overview>
Django admin customization, signal patterns, middleware design, and management commands.
The admin is a powerful tool for internal users when properly configured. Signals should
be used sparingly for cross-app decoupling. Middleware handles cross-cutting concerns.
</overview>

<admin_customization>
## Admin Customization

### Basic ModelAdmin

```python
from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ["unit_price"]
    fields = ["product", "quantity", "unit_price"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "customer",
        "status",
        "total",
        "created_at",
    ]
    list_filter = ["status", "created_at"]
    search_fields = [
        "id",
        "customer__email",
        "customer__first_name",
        "customer__last_name",
    ]
    list_select_related = ["customer"]
    readonly_fields = ["created_at", "updated_at"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]
    inlines = [OrderItemInline]

    fieldsets = [
        (None, {
            "fields": ["customer", "status", "total"],
        }),
        ("Timestamps", {
            "fields": ["created_at", "updated_at"],
            "classes": ["collapse"],
        }),
    ]
```

### Custom Admin Actions

```python
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    actions = ["mark_as_shipped", "export_as_csv"]

    @admin.action(description="Mark selected orders as shipped")
    def mark_as_shipped(self, request, queryset):
        updated = queryset.filter(
            status=Order.Status.CONFIRMED,
        ).update(status=Order.Status.SHIPPED)
        self.message_user(request, f"✅ {updated} orders marked as shipped.")
        logger.info(
            "📦 %d orders marked shipped by admin %s",
            updated,
            request.user.email,
        )

    @admin.action(description="Export selected orders as CSV")
    def export_as_csv(self, request, queryset):
        import csv
        from django.http import HttpResponse

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="orders.csv"'
        writer = csv.writer(response)
        writer.writerow(["ID", "Customer", "Status", "Total", "Created"])
        for order in queryset.select_related("customer"):
            writer.writerow([
                order.id,
                order.customer.email,
                order.get_status_display(),
                order.total,
                order.created_at.isoformat(),
            ])
        return response
```

### Custom List Columns

```python
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["id", "customer_email", "status", "item_count", "total"]

    @admin.display(description="Customer Email", ordering="customer__email")
    def customer_email(self, obj):
        return obj.customer.email

    @admin.display(description="Items")
    def item_count(self, obj):
        return obj.items.count()
```

### Custom Admin Filters

```python
class HighValueOrderFilter(admin.SimpleListFilter):
    title = "order value"
    parameter_name = "value_tier"

    def lookups(self, request, model_admin):
        return [
            ("high", "High value (>$500)"),
            ("medium", "Medium value ($100-$500)"),
            ("low", "Low value (<$100)"),
        ]

    def queryset(self, request, queryset):
        if self.value() == "high":
            return queryset.filter(total__gt=500)
        if self.value() == "medium":
            return queryset.filter(total__gte=100, total__lte=500)
        if self.value() == "low":
            return queryset.filter(total__lt=100)
        return queryset


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_filter = ["status", HighValueOrderFilter, "created_at"]
```

### Admin Site Branding

```python
# config/admin.py or urls.py
admin.site.site_header = "My App Administration"
admin.site.site_title = "My App Admin"
admin.site.index_title = "Dashboard"
```

Override admin templates by creating files in `templates/admin/`:

```
templates/
└── admin/
    ├── base_site.html    # Override header/branding
    └── index.html        # Override dashboard
```
</admin_customization>

<signals>
## Signals

### Signal Types

| Signal         | Fired When                                  | Key Arguments              |
|----------------|---------------------------------------------|----------------------------|
| `pre_save`     | Before `model.save()`                       | `instance`, `raw`, `using` |
| `post_save`    | After `model.save()`                        | `instance`, `created`      |
| `pre_delete`   | Before `model.delete()`                     | `instance`, `using`        |
| `post_delete`  | After `model.delete()`                      | `instance`, `using`        |
| `m2m_changed`  | When a ManyToManyField is modified          | `action`, `pk_set`         |

### Proper Signal Usage

```python
from django.db.models.signals import post_save, post_delete, m2m_changed
from django.dispatch import receiver


@receiver(post_save, sender="orders.Order")
def notify_on_order_status_change(sender, instance, created, **kwargs):
    if created:
        return  # Skip initial creation
    # "tracker" requires FieldTracker from django-model-utils on the Order model
    if instance.tracker.has_changed("status"):
        send_status_notification.delay(instance.pk)
        logger.info(
            "📧 Status notification queued for order %s",
            instance.pk,
        )


@receiver(post_delete, sender="orders.Order")
def cleanup_order_files(sender, instance, **kwargs):
    if instance.invoice_file:
        instance.invoice_file.delete(save=False)
        logger.info("🗑️ Cleaned up invoice file for order %s", instance.pk)


@receiver(m2m_changed, sender="products.Product.categories.through")
def update_product_category_cache(sender, instance, action, **kwargs):
    if action in ("post_add", "post_remove", "post_clear"):
        cache.delete(f"product_categories_{instance.pk}")
```

### Signal Registration

Always register signals in `apps.py`:

```python
class OrdersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "orders"

    def ready(self):
        import orders.signals  # noqa: F401
```

### Signal Anti-Patterns

**Circular signals** -- Signal A triggers Signal B which triggers Signal A:

```python
# WRONG: post_save on Order triggers post_save on Invoice triggers Order update
@receiver(post_save, sender="orders.Order")
def create_invoice(sender, instance, created, **kwargs):
    if created:
        Invoice.objects.create(order=instance)  # This triggers Invoice post_save

@receiver(post_save, sender="invoices.Invoice")
def update_order_total(sender, instance, **kwargs):
    instance.order.save()  # This triggers Order post_save again!
```

Fix: Use `update_fields` and check for specific field changes, or use
`instance.save(update_fields=["total"])` which narrows the save scope.

**Heavy logic in signals** -- Signals run synchronously within the request:

```python
# WRONG: Expensive operation in signal blocks the response
@receiver(post_save, sender="orders.Order")
def process_order(sender, instance, created, **kwargs):
    if created:
        generate_pdf_invoice(instance)  # Slow!
        send_confirmation_email(instance)  # External API call!
        update_inventory(instance)  # Multiple DB queries!
```

Fix: Dispatch to a task queue:

```python
@receiver(post_save, sender="orders.Order")
def process_order_async(sender, instance, created, **kwargs):
    if created:
        process_new_order.delay(instance.pk)
```

**Signals as hidden API** -- When all business logic lives in signals, the codebase
becomes difficult to trace. Prefer explicit method calls on models or services.
</signals>

<middleware_patterns>
## Middleware Patterns

### Middleware Structure

Every middleware follows the same pattern:

```python
class ExampleMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        # One-time configuration here

    def __call__(self, request):
        # Code before the view (and later middleware) is called
        response = self.get_response(request)
        # Code after the view is called
        return response

    def process_exception(self, request, exception):
        # Called when a view raises an exception
        pass

    def process_view(self, request, view_func, view_args, view_kwargs):
        # Called just before the view
        pass
```

### Request ID Middleware

Attach a unique ID to every request for tracing:

```python
import uuid


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = str(uuid.uuid4())
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        return response
```

### Rate Limiting Middleware

```python
from django.core.cache import cache
from django.http import JsonResponse


class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.rate_limit = 100  # requests per minute
        self.window = 60  # seconds

    def __call__(self, request):
        if request.path.startswith("/api/"):
            ip = self._get_client_ip(request)
            cache_key = f"ratelimit:{ip}"
            count = cache.get(cache_key, 0)
            if count >= self.rate_limit:
                logger.warning(
                    "🚫 Rate limit exceeded for IP %s on %s",
                    ip,
                    request.path,
                )
                return JsonResponse(
                    {"error": "Rate limit exceeded"},
                    status=429,
                )
            cache.set(cache_key, count + 1, self.window)
        return self.get_response(request)

    def _get_client_ip(self, request) -> str:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "unknown")
```

### JSON Error Middleware

```python
import json
import traceback

from django.http import JsonResponse


class JSONErrorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        if request.path.startswith("/api/"):
            logger.error(
                "❌ Unhandled exception on %s: %s",
                request.path,
                exception,
                exc_info=True,
            )
            return JsonResponse(
                {"error": "Internal server error"},
                status=500,
            )
        return None
```

### Middleware Order

Order matters. Place middleware from outermost to innermost:

```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "config.middleware.RequestIDMiddleware",        # Early: adds request ID
    "config.middleware.RequestTimingMiddleware",     # Early: times full request
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "config.middleware.RateLimitMiddleware",        # After auth: can rate limit by user
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
```
</middleware_patterns>

<management_commands>
## Management Commands

### Basic Command

```python
# orders/management/commands/purge_stale_orders.py
from django.core.management.base import BaseCommand

from orders.models import Order


class Command(BaseCommand):
    help = "Purge orders stuck in pending status beyond the retention period"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Number of days after which pending orders are purged (default: 30)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting",
        )

    def handle(self, *args, **options):
        days = options["days"]
        dry_run = options["dry_run"]

        qs = Order.objects.filter(
            status=Order.Status.PENDING,
            created_at__lt=timezone.now() - timedelta(days=days),
        )
        count = qs.count()

        if dry_run:
            self.stdout.write(f"Would purge {count} stale orders (dry run)")
            return

        deleted, _ = qs.delete()
        self.stdout.write(
            self.style.SUCCESS(f"✅ Purged {deleted} stale orders older than {days} days")
        )
```

### Command with Progress Output

```python
class Command(BaseCommand):
    help = "Backfill slugs for all articles"

    def handle(self, *args, **options):
        articles = Article.objects.filter(slug="")
        total = articles.count()
        self.stdout.write(f"Backfilling {total} articles...")

        updated = 0
        for article in articles.iterator(chunk_size=500):
            article.slug = slugify(article.title)
            article.save(update_fields=["slug"])
            updated += 1
            if updated % 100 == 0:
                self.stdout.write(f"  Processed {updated}/{total}")

        self.stdout.write(
            self.style.SUCCESS(f"✅ Backfilled {updated} articles")
        )
```

### Running Commands

```bash
poetry run python src/manage.py purge_stale_orders --days=60
poetry run python src/manage.py purge_stale_orders --dry-run
```

### Command File Structure

```
orders/
└── management/
    ├── __init__.py
    └── commands/
        ├── __init__.py
        ├── purge_stale_orders.py
        └── send_order_reminders.py
```

Ensure both `management/` and `commands/` directories contain `__init__.py` files.
</management_commands>
