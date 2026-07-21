<overview>
Django ORM patterns covering model field design, querysets, managers, abstract models,
database constraints, and migration best practices. Place business logic in models and
managers to keep views thin.
</overview>

<model_field_design>
## Model Field Design

### Field Choices

Define choices as `TextChoices` or `IntegerChoices` enums on the model class:

```python
class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
```

Reference choices via `Order.Status.PENDING` rather than raw strings.

### Meta Options

```python
class Order(models.Model):
    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "orders"
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["customer", "-created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["customer", "external_id"],
                name="unique_customer_external_id",
            ),
            models.CheckConstraint(
                condition=models.Q(total__gte=0),  # "check=" deprecated since Django 5.1
                name="order_total_non_negative",
            ),
        ]
```

### Field Best Practices

- Set `db_index=True` on fields used in filters and ordering
- Use `help_text` for admin UI clarity, not as documentation
- Prefer `TextField` over `CharField` when maximum length is uncertain
- Use `DecimalField` for monetary values, never `FloatField`
- Always set `on_delete` explicitly on `ForeignKey` and `OneToOneField`
- Use `related_name` on foreign keys to clarify reverse relations

```python
class OrderItem(models.Model):
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
```
</model_field_design>

<querysets_and_managers>
## QuerySets and Managers

### Custom Manager and QuerySet

Define a custom queryset class and attach it as a manager to keep query logic reusable
and chainable:

```python
class OrderQuerySet(models.QuerySet):
    def active(self):
        return self.exclude(status=Order.Status.CANCELLED)

    def for_customer(self, customer):
        return self.filter(customer=customer)

    def with_items(self):
        return self.prefetch_related(
            Prefetch(
                "items",
                queryset=OrderItem.objects.select_related("product"),
            )
        )

    def total_revenue(self):
        return self.aggregate(total=Sum("total"))["total"] or Decimal("0")


class OrderManager(models.Manager):
    def get_queryset(self):
        return OrderQuerySet(self.model, using=self._db)

    def active(self):
        return self.get_queryset().active()

    def create_order(self, *, customer, items_data):
        order = self.create(customer=customer, total=Decimal("0"))
        total = Decimal("0")
        for item_data in items_data:
            item = OrderItem.objects.create(
                order=order,
                product=item_data["product"],
                quantity=item_data["quantity"],
                unit_price=item_data["product"].price,
            )
            total += item.unit_price * item.quantity
        order.total = total
        order.save(update_fields=["total"])
        logger.info("✅ Order %s created for customer %s", order.id, customer.id)
        return order


class Order(models.Model):
    objects = OrderManager()
    # ...
```

### select_related and prefetch_related

Use `select_related` for foreign key / one-to-one relationships (SQL JOIN):

```python
orders = Order.objects.select_related("customer", "customer__profile")
```

Use `prefetch_related` for reverse foreign keys and many-to-many (separate query):

```python
orders = Order.objects.prefetch_related("items", "items__product")
```

Use `Prefetch` for custom querysets in prefetch:

```python
from django.db.models import Prefetch

orders = Order.objects.prefetch_related(
    Prefetch(
        "items",
        queryset=OrderItem.objects.filter(quantity__gt=0).select_related("product"),
    )
)
```

### Q Objects and F Expressions

Combine filters with `Q` for complex lookups:

```python
from django.db.models import Q

results = Order.objects.filter(
    Q(status=Order.Status.PENDING) | Q(status=Order.Status.CONFIRMED),
    Q(total__gte=100) | Q(customer__is_vip=True),
)
```

Use `F` expressions for database-level field references and atomic updates:

```python
from django.db.models import F

Order.objects.filter(status=Order.Status.PENDING).update(
    total=F("total") * Decimal("1.1")
)

Product.objects.filter(id=product_id).update(stock=F("stock") - quantity)
```

### Aggregation and Annotation

```python
from django.db.models import Count, Sum, Avg

stats = Order.objects.active().aggregate(
    order_count=Count("id"),
    total_revenue=Sum("total"),
    avg_order_value=Avg("total"),
)

customers_with_order_count = Customer.objects.annotate(
    order_count=Count("orders"),
    total_spent=Sum("orders__total"),
).filter(order_count__gt=5)
```

### Subqueries

```python
from django.db.models import OuterRef, Subquery

latest_order = Order.objects.filter(
    customer=OuterRef("pk"),
).order_by("-created_at")

customers = Customer.objects.annotate(
    latest_order_date=Subquery(latest_order.values("created_at")[:1]),
    latest_order_total=Subquery(latest_order.values("total")[:1]),
)
```
</querysets_and_managers>

<model_methods>
## Model Methods vs Manager Methods vs QuerySet Methods

### Model Methods

Place logic that operates on a single instance as model methods:

```python
class Order(models.Model):
    def can_cancel(self) -> bool:
        return self.status in (self.Status.PENDING, self.Status.CONFIRMED)

    def cancel(self):
        if not self.can_cancel():
            raise ValueError(f"Cannot cancel order in status {self.status}")
        self.status = self.Status.CANCELLED
        self.save(update_fields=["status"])
        logger.info("✅ Order %s cancelled", self.id)

    def get_total_items(self) -> int:
        return self.items.aggregate(total=Sum("quantity"))["total"] or 0

    @property
    def is_fulfilled(self) -> bool:
        return self.status == self.Status.DELIVERED

    def __str__(self) -> str:
        return f"Order #{self.id} ({self.status})"
```

### Manager Methods

Use manager methods for operations that create objects or need access to the full table:

```python
class OrderManager(models.Manager):
    def create_order(self, *, customer, items_data):
        """Multi-step creation logic belongs in the manager."""
        ...

    def purge_stale(self, *, days=30):
        cutoff = timezone.now() - timedelta(days=days)
        count, _ = self.filter(
            status=Order.Status.PENDING,
            created_at__lt=cutoff,
        ).delete()
        logger.info("🗑️ Purged %d stale orders", count)
        return count
```

### QuerySet Methods

Use queryset methods for chainable filters and annotations:

```python
class OrderQuerySet(models.QuerySet):
    def active(self):
        return self.exclude(status=Order.Status.CANCELLED)

    def placed_after(self, date):
        return self.filter(created_at__gte=date)

    def high_value(self, threshold=Decimal("500")):
        return self.filter(total__gte=threshold)
```

Chain them: `Order.objects.active().placed_after(last_month).high_value()`
</model_methods>

<abstract_models_and_mixins>
## Abstract Models and Mixins

### TimeStampedModel

Every project should have a base timestamped model:

```python
class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
```

### SoftDeleteModel

```python
class SoftDeleteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def dead(self):
        return self.filter(deleted_at__isnull=False)


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()


class SoftDeleteModel(models.Model):
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at"])

    def restore(self):
        self.deleted_at = None
        self.save(update_fields=["deleted_at"])
```

### UUIDModel

```python
import uuid

class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True
```

### Combining Mixins

```python
class Order(UUIDModel, TimeStampedModel, SoftDeleteModel):
    customer = models.ForeignKey("customers.Customer", on_delete=models.CASCADE)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    # ...
```

MRO (method resolution order) applies -- list more specific mixins first.
</abstract_models_and_mixins>

<database_constraints>
## Database Constraints

### UniqueConstraint

```python
class Meta:
    constraints = [
        models.UniqueConstraint(
            fields=["user", "email_type"],
            name="unique_user_email_type",
        ),
        models.UniqueConstraint(
            fields=["slug"],
            condition=models.Q(is_active=True),
            name="unique_active_slug",
        ),
    ]
```

### CheckConstraint

```python
class Meta:
    constraints = [
        models.CheckConstraint(
            condition=models.Q(price__gte=0),
            name="price_non_negative",
        ),
        models.CheckConstraint(
            condition=models.Q(start_date__lt=models.F("end_date")),
            name="start_before_end",
        ),
    ]
```

### Naming Convention

Name constraints as `{table}_{description}` or `{description}` to make migration
errors readable: `unique_customer_external_id`, `order_total_non_negative`.
</database_constraints>

<migrations>
## Migration Best Practices

### Data Migrations

Use `RunPython` for data migrations. Always provide a reverse function:

```python
from django.db import migrations


def populate_slug(apps, schema_editor):
    Article = apps.get_model("articles", "Article")
    for article in Article.objects.filter(slug=""):
        article.slug = slugify(article.title)
        article.save(update_fields=["slug"])


def reverse_populate_slug(apps, schema_editor):
    pass  # No meaningful reverse for slug population


class Migration(migrations.Migration):
    dependencies = [
        ("articles", "0005_add_slug_field"),
    ]

    operations = [
        migrations.RunPython(populate_slug, reverse_populate_slug),
    ]
```

### Backwards Compatibility

When adding a required field to an existing table:

1. Add the field as nullable first: `models.CharField(null=True)`
2. Create a data migration to populate existing rows
3. Alter the field to non-nullable: `models.CharField(null=False, default=...)`

### Large Table Migrations

- Avoid adding indexes with `db_index=True` on large tables in a single migration;
  use `AddIndexConcurrently` from `django.contrib.postgres.operations` in a migration
  with `atomic = False` (PostgreSQL)
- Split schema changes and data changes into separate migrations
- Never run `RunPython` that iterates millions of rows without batching:

```python
def backfill_in_batches(apps, schema_editor):
    Model = apps.get_model("app", "Model")
    batch_size = 1000
    qs = Model.objects.filter(new_field__isnull=True)
    while True:
        batch_ids = list(qs.values_list("id", flat=True)[:batch_size])
        if not batch_ids:
            break
        Model.objects.filter(id__in=batch_ids).update(new_field="default_value")
```

### Migration Commands

```bash
poetry run python src/manage.py makemigrations
poetry run python src/manage.py migrate
poetry run python src/manage.py showmigrations
poetry run python src/manage.py sqlmigrate app_name 0001
```
</migrations>

<signals_on_models>
## Signals on Models

Use signals sparingly. Prefer model methods or manager methods for most logic. Signals
are appropriate for cross-app decoupling where the sender should not know about the
receiver.

### When to Use Signals

- Cross-app side effects (e.g., audit log app recording changes in any other app)
- Third-party app integration where modifying the model is not possible
- Cache invalidation across app boundaries

### When NOT to Use Signals

- Logic that belongs in the model's `save()` method or a manager
- Anything that should be explicit and traceable in the call chain
- Heavy processing (use a task queue instead)

### Example: Audit Log Signal

```python
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from audit.models import AuditLog


@receiver(post_save, sender="orders.Order")
def log_order_save(sender, instance, created, **kwargs):
    action = "created" if created else "updated"
    AuditLog.objects.create(
        content_type=ContentType.objects.get_for_model(instance),
        object_id=str(instance.pk),
        action=action,
    )
    logger.info("📝 Audit: order %s %s", instance.pk, action)
```

### Signal Registration

Register signals in `apps.py` using the `ready()` method:

```python
class OrdersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "orders"

    def ready(self):
        import orders.signals  # noqa: F401
```
</signals_on_models>
