# ViewSet Patterns

## ViewSet Types

### ModelViewSet

Provides full CRUD: `list`, `create`, `retrieve`, `update`, `partial_update`, `destroy`.
Use when exposing a standard resource endpoint.

```python
from rest_framework import viewsets
from myapp.models import Article
from myapp.serializers import ArticleSerializer


class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer
    queryset = Article.objects.all()
```

### GenericViewSet

Mix in only the actions needed. Use when a resource does not need full CRUD.

```python
from rest_framework import viewsets, mixins
from myapp.models import AuditLog
from myapp.serializers import AuditLogSerializer


class AuditLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Read-only endpoint -- no create, update, or delete."""

    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all()
```

### ViewSet (bare)

No model binding. Use for non-model actions (health checks, aggregation endpoints,
third-party proxies).

```python
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response


class HealthViewSet(viewsets.ViewSet):
    def list(self, request):
        return Response({"status": "ok"})
```

## Router Registration and URL Patterns

### DefaultRouter

Provides an API root view that lists all registered endpoints.

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from myapp.views import ArticleViewSet, CommentViewSet

router = DefaultRouter()
router.register("articles", ArticleViewSet, basename="article")
router.register("comments", CommentViewSet, basename="comment")

urlpatterns = [
    path("api/v1/", include(router.urls)),
]
```

### SimpleRouter

Same as `DefaultRouter` but without the API root view. Slightly leaner.

```python
from rest_framework.routers import SimpleRouter

router = SimpleRouter()
router.register("articles", ArticleViewSet, basename="article")
```

### Nested Routers (drf-nested-routers)

For URLs like `/articles/{article_pk}/comments/`.

```python
from rest_framework_nested.routers import NestedDefaultRouter

router = DefaultRouter()
router.register("articles", ArticleViewSet, basename="article")

articles_router = NestedDefaultRouter(
    router, "articles", lookup="article"
)
articles_router.register(
    "comments", CommentViewSet, basename="article-comment"
)

urlpatterns = [
    path("api/v1/", include(router.urls)),
    path("api/v1/", include(articles_router.urls)),
]
```

In the nested viewset, filter by the parent:

```python
class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer

    def get_queryset(self):
        return Comment.objects.filter(
            article_id=self.kwargs["article_pk"]
        )

    def perform_create(self, serializer):
        serializer.save(article_id=self.kwargs["article_pk"])
```

## Custom Actions

Use `@action` to add non-CRUD endpoints to a viewset.

```python
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status


class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer
    queryset = Article.objects.all()

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """POST /articles/{pk}/publish/"""
        article = self.get_object()
        article.status = "published"
        article.published_at = timezone.now()
        article.save(update_fields=["status", "published_at"])
        return Response(
            ArticleSerializer(article).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"])
    def recent(self, request):
        """GET /articles/recent/"""
        recent = self.get_queryset().order_by("-created_at")[:10]
        serializer = self.get_serializer(recent, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="add-tag",
        url_name="add-tag",
    )
    def add_tag(self, request, pk=None):
        """POST /articles/{pk}/add-tag/"""
        article = self.get_object()
        tag_name = request.data.get("tag")
        if not tag_name:
            return Response(
                {"tag": "This field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tag, _ = Tag.objects.get_or_create(name=tag_name)
        article.tags.add(tag)
        return Response(
            ArticleSerializer(article).data,
            status=status.HTTP_200_OK,
        )
```

### Custom Action with Different Serializer

```python
class ArticleViewSet(viewsets.ModelViewSet):
    @action(
        detail=True,
        methods=["post"],
        serializer_class=PublishSerializer,
    )
    def publish(self, request, pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        article = self.get_object()
        article.publish(**serializer.validated_data)
        return Response(ArticleSerializer(article).data)
```

## Filtering

### django-filter Integration

```python
import django_filters
from myapp.models import Article


class ArticleFilter(django_filters.FilterSet):
    title = django_filters.CharFilter(lookup_expr="icontains")
    created_after = django_filters.DateFilter(
        field_name="created_at", lookup_expr="gte"
    )
    created_before = django_filters.DateFilter(
        field_name="created_at", lookup_expr="lte"
    )
    status = django_filters.ChoiceFilter(choices=Article.STATUS_CHOICES)
    tags = django_filters.CharFilter(
        field_name="tags__name", lookup_expr="icontains"
    )

    class Meta:
        model = Article
        fields = ["title", "status", "author", "tags"]
```

```python
class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer
    filterset_class = ArticleFilter

    def get_queryset(self):
        return Article.objects.select_related("author")
```

### SearchFilter

Full-text search across multiple fields.

```python
from rest_framework.filters import SearchFilter


class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer
    queryset = Article.objects.all()
    filter_backends = [SearchFilter]
    search_fields = [
        "title",          # Partial match (icontains)
        "=author__username",  # Exact match
        "^title",         # Starts-with
        "@body",          # Full-text search (PostgreSQL)
    ]
```

Request: `GET /articles/?search=django`

### OrderingFilter

```python
from rest_framework.filters import OrderingFilter


class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer
    queryset = Article.objects.all()
    filter_backends = [OrderingFilter]
    ordering_fields = ["created_at", "title", "author__username"]
    ordering = ["-created_at"]  # Default ordering
```

Request: `GET /articles/?ordering=-created_at,title`

### Combining Filter Backends

```python
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter


class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ArticleFilter
    search_fields = ["title", "body"]
    ordering_fields = ["created_at", "title"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return (
            Article.objects
            .select_related("author", "category")
            .prefetch_related("tags")
        )
```

## Pagination

### PageNumberPagination

```python
from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
```

Request: `GET /articles/?page=2&page_size=50`

### CursorPagination

Stable pagination for real-time data where items may be inserted between page fetches.
Requires an ordering field.

```python
from rest_framework.pagination import CursorPagination


class CreatedAtCursorPagination(CursorPagination):
    page_size = 20
    ordering = "-created_at"
    cursor_query_param = "cursor"
```

### LimitOffsetPagination

```python
from rest_framework.pagination import LimitOffsetPagination


class StandardLimitOffsetPagination(LimitOffsetPagination):
    default_limit = 20
    max_limit = 100
```

Request: `GET /articles/?limit=10&offset=30`

### Per-ViewSet Pagination

```python
class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer
    queryset = Article.objects.all()
    pagination_class = CreatedAtCursorPagination
```

### Custom Pagination Response

```python
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class CustomPagination(PageNumberPagination):
    page_size = 20

    def get_paginated_response(self, data):
        return Response({
            "meta": {
                "total": self.page.paginator.count,
                "page": self.page.number,
                "page_size": self.page_size,
                "total_pages": self.page.paginator.num_pages,
            },
            "results": data,
        })
```

## Throttling

### Built-in Throttle Classes

```python
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
    },
}
```

### Per-ViewSet Throttling

```python
from rest_framework.throttling import UserRateThrottle


class BurstRateThrottle(UserRateThrottle):
    rate = "60/minute"


class SustainedRateThrottle(UserRateThrottle):
    rate = "1000/day"


class ArticleViewSet(viewsets.ModelViewSet):
    throttle_classes = [BurstRateThrottle, SustainedRateThrottle]
    serializer_class = ArticleSerializer
    queryset = Article.objects.all()
```

### Scoped Throttling

Apply different rates to different actions.

```python
from rest_framework.throttling import ScopedRateThrottle


class ArticleViewSet(viewsets.ModelViewSet):
    throttle_classes = [ScopedRateThrottle]
    serializer_class = ArticleSerializer
    queryset = Article.objects.all()

    def get_throttles(self):
        if self.action == "create":
            self.throttle_scope = "article_create"
        else:
            self.throttle_scope = "article_read"
        return super().get_throttles()
```

```python
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_RATES": {
        "article_create": "10/hour",
        "article_read": "100/hour",
    },
}
```

## Content Negotiation and Versioning

### Content Negotiation

DRF selects the renderer based on the `Accept` header.

```python
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
}
```

Remove `BrowsableAPIRenderer` in production to disable the browsable API.

### URL-Based Versioning

```python
REST_FRAMEWORK = {
    "DEFAULT_VERSIONING_CLASS": (
        "rest_framework.versioning.URLPathVersioning"
    ),
    "ALLOWED_VERSIONS": ["v1", "v2"],
    "DEFAULT_VERSION": "v1",
}
```

```python
urlpatterns = [
    path("api/<version>/", include(router.urls)),
]
```

Access the version in views:

```python
class ArticleViewSet(viewsets.ModelViewSet):
    def get_serializer_class(self):
        if self.request.version == "v2":
            return ArticleV2Serializer
        return ArticleSerializer
```

### Header-Based Versioning

```python
REST_FRAMEWORK = {
    "DEFAULT_VERSIONING_CLASS": (
        "rest_framework.versioning.AcceptHeaderVersioning"
    ),
    "DEFAULT_VERSION": "1.0",
    "ALLOWED_VERSIONS": ["1.0", "2.0"],
}
```

Request: `Accept: application/json; version=2.0`

## get_queryset() Patterns

### Scoping to Current User

```python
class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer

    def get_queryset(self):
        return (
            Article.objects
            .filter(author=self.request.user)
            .select_related("category")
            .prefetch_related("tags")
        )
```

### Conditional QuerySet by Action

```python
class ArticleViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        qs = Article.objects.select_related("author")
        if self.action == "list":
            return qs.filter(status="published")
        return qs  # retrieve/update/delete can see all statuses
```

### Annotated QuerySets

```python
from django.db.models import Count, Avg


class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer

    def get_queryset(self):
        return (
            Article.objects
            .select_related("author")
            .prefetch_related("tags")
            .annotate(
                comment_count=Count("comments"),
                avg_rating=Avg("ratings__score"),
            )
        )
```

Then expose annotations in the serializer:

```python
class ArticleSerializer(serializers.ModelSerializer):
    comment_count = serializers.IntegerField(read_only=True)
    avg_rating = serializers.FloatField(read_only=True)

    class Meta:
        model = Article
        fields = [
            "id", "title", "author", "comment_count", "avg_rating",
        ]
```

## get_serializer_class() Patterns

### Different Serializers Per Action

```python
class ArticleViewSet(viewsets.ModelViewSet):
    queryset = Article.objects.all()

    def get_serializer_class(self):
        if self.action == "list":
            return ArticleListSerializer
        if self.action == "retrieve":
            return ArticleDetailSerializer
        return ArticleWriteSerializer
```

### Different Serializers by Permission

```python
class ArticleViewSet(viewsets.ModelViewSet):
    queryset = Article.objects.all()

    def get_serializer_class(self):
        if self.request.user.is_staff:
            return ArticleAdminSerializer
        return ArticleSerializer
```

## perform_create / perform_update

Inject extra data before saving.

```python
class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer

    def get_queryset(self):
        return Article.objects.filter(author=self.request.user)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        serializer.save(last_edited_by=self.request.user)
```

## Error Handling

### Custom Exception Handler

```python
from rest_framework.views import exception_handler
from rest_framework.response import Response
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        logger.exception(
            "🔥 Unhandled exception in %s",
            context["view"].__class__.__name__,
        )
        return Response(
            {"detail": "An unexpected error occurred."},
            status=500,
        )

    if isinstance(response.data, dict):
        response.data = {
            "errors": response.data,
            "status_code": response.status_code,
        }

    return response
```

```python
REST_FRAMEWORK = {
    "EXCEPTION_HANDLER": "myapp.exceptions.custom_exception_handler",
}
```
