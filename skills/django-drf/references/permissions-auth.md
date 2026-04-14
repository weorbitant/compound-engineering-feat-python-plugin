# Permissions and Authentication

## Authentication Classes

### TokenAuthentication

Built-in token auth. Each user gets a single persistent token.

```python
# settings.py
INSTALLED_APPS = [
    ...
    "rest_framework.authtoken",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
}
```

```bash
# Create token for a user
python manage.py drf_create_token username
```

```python
# Programmatic token creation
from rest_framework.authtoken.models import Token

token, created = Token.objects.get_or_create(user=user)
```

Request header: `Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b`

### Token Obtain View

```python
from rest_framework.authtoken.views import obtain_auth_token

urlpatterns = [
    path("api/auth/token/", obtain_auth_token),
]
```

POST with `username` and `password` to receive the token.

### SessionAuthentication

Uses Django's session framework. Suitable for browser-based API consumers
(same-origin AJAX requests).

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
}
```

Requires CSRF token for unsafe methods (POST, PUT, PATCH, DELETE).

### JWT Authentication (SimpleJWT)

```bash
pip install djangorestframework-simplejwt
```

```python
# settings.py
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
}

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}
```

```python
# urls.py
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    path("api/auth/token/", TokenObtainPairView.as_view()),
    path("api/auth/token/refresh/", TokenRefreshView.as_view()),
    path("api/auth/token/verify/", TokenVerifyView.as_view()),
]
```

Request header: `Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...`

### Custom JWT Claims

```python
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["email"] = user.email
        token["is_staff"] = user.is_staff
        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
```

## Multiple Authentication Classes

Combine multiple authentication methods. DRF tries each class in order and uses
the first one that succeeds.

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ],
}
```

## Permission Classes

### Built-in Permissions

```python
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
    IsAdminUser,
    IsAuthenticatedOrReadOnly,
    DjangoModelPermissions,
    DjangoObjectPermissions,
)
```

| Class | Behavior |
|-------|----------|
| `AllowAny` | No restrictions |
| `IsAuthenticated` | Authenticated users only |
| `IsAdminUser` | `user.is_staff == True` only |
| `IsAuthenticatedOrReadOnly` | Auth for writes, anyone can read |
| `DjangoModelPermissions` | Maps to Django's model permission system |
| `DjangoObjectPermissions` | Per-object permissions via Django's auth backend |

### Setting Default Permissions

```python
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}
```

### Per-ViewSet Permissions

```python
from rest_framework.permissions import IsAuthenticated, AllowAny


class ArticleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ArticleSerializer
    queryset = Article.objects.all()
```

### Per-Action Permissions

```python
class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer
    queryset = Article.objects.all()

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        if self.action == "create":
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOwnerPermission()]
```

## Custom Permission Classes

### Simple Custom Permission

```python
from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Allow access only to the object owner."""

    def has_object_permission(self, request, view, obj):
        return obj.author_id == request.user.id
```

### Read-Only for Non-Owners

```python
from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.author_id == request.user.id
```

### Role-Based Permission

```python
class IsEditor(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.groups.filter(name="editors").exists()
        )
```

### Permission with Custom Error Message

```python
class IsPremiumUser(BasePermission):
    message = "This feature requires a premium subscription."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and hasattr(request.user, "subscription")
            and request.user.subscription.is_active
        )
```

## Object-Level Permissions

Object-level permissions are checked in `has_object_permission()` and apply to
detail views (`retrieve`, `update`, `partial_update`, `destroy`).

DRF calls `self.check_object_permissions(request, obj)` automatically when using
`self.get_object()`.

```python
class DocumentPermission(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return (
                obj.is_public
                or obj.owner_id == request.user.id
                or obj.shared_with.filter(id=request.user.id).exists()
            )
        return obj.owner_id == request.user.id
```

### Filtering QuerySets by Permission

`has_object_permission` runs per-object on detail views. For list views, filter
the queryset instead to avoid exposing objects the user cannot access.

```python
class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [DocumentPermission]
    serializer_class = DocumentSerializer

    def get_queryset(self):
        user = self.request.user
        return Document.objects.filter(
            models.Q(owner=user)
            | models.Q(is_public=True)
            | models.Q(shared_with=user)
        ).distinct()
```

## Composing Permissions

### AND Composition (all must pass)

Pass multiple permission classes in a list. All must return `True`.

```python
class ArticleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwner]
```

### OR Composition (any must pass)

Use the `|` operator (DRF 3.9+).

```python
class ArticleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser | IsOwner]
```

### NOT Composition

Use the `~` operator.

```python
class ArticleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, ~IsBlacklisted]
```

### Complex Composition

```python
class ArticleViewSet(viewsets.ModelViewSet):
    permission_classes = [
        IsAuthenticated & (IsAdminUser | IsOwner)
    ]
```

## API Key Authentication

Custom authentication backend for service-to-service communication.

```python
# models.py
import secrets
from django.db import models


class APIKey(models.Model):
    name = models.CharField(max_length=100)
    key = models.CharField(max_length=64, unique=True, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.key:
            self.key = secrets.token_urlsafe(48)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name
```

```python
# authentication.py
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from myapp.models import APIKey


class APIKeyAuthentication(BaseAuthentication):
    keyword = "Api-Key"

    def authenticate(self, request):
        api_key = request.headers.get("X-API-Key")
        if not api_key:
            return None

        try:
            key_obj = APIKey.objects.get(key=api_key, is_active=True)
        except APIKey.DoesNotExist:
            raise AuthenticationFailed("Invalid or inactive API key.")

        return (None, key_obj)

    def authenticate_header(self, request):
        return self.keyword
```

```python
# Per-view usage
class WebhookViewSet(viewsets.ViewSet):
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [AllowAny]  # Auth handled by API key

    def create(self, request):
        # request.auth is the APIKey instance
        return Response({"received": True})
```

Request header: `X-API-Key: abc123...`

## OAuth2 Integration (django-oauth-toolkit)

```bash
pip install django-oauth-toolkit
```

```python
# settings.py
INSTALLED_APPS = [
    ...
    "oauth2_provider",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "oauth2_provider.contrib.rest_framework.OAuth2Authentication",
    ],
}
```

```python
# urls.py
urlpatterns = [
    path("o/", include("oauth2_provider.urls", namespace="oauth2_provider")),
    path("api/v1/", include(router.urls)),
]
```

### Scoped Permissions with OAuth2

```python
from oauth2_provider.contrib.rest_framework import (
    TokenHasReadWriteScope,
    TokenHasScope,
)


class ArticleViewSet(viewsets.ModelViewSet):
    permission_classes = [TokenHasReadWriteScope]
    required_scopes = ["articles"]
    serializer_class = ArticleSerializer
    queryset = Article.objects.all()
```

## Rate Limiting Per User and Endpoint

### Per-User Rate Limiting

```python
from rest_framework.throttling import UserRateThrottle


class StandardUserThrottle(UserRateThrottle):
    rate = "100/hour"


class PremiumUserThrottle(UserRateThrottle):
    rate = "1000/hour"


class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer
    queryset = Article.objects.all()

    def get_throttles(self):
        if (
            self.request.user.is_authenticated
            and hasattr(self.request.user, "subscription")
            and self.request.user.subscription.tier == "premium"
        ):
            return [PremiumUserThrottle()]
        return [StandardUserThrottle()]
```

### Per-Endpoint Rate Limiting

```python
from rest_framework.throttling import ScopedRateThrottle


class LoginView(ObtainAuthToken):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class PasswordResetView(GenericAPIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"
```

```python
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_RATES": {
        "login": "5/minute",
        "password_reset": "3/hour",
    },
}
```

### Custom Throttle with Dynamic Rate

```python
from rest_framework.throttling import SimpleRateThrottle


class DynamicUserThrottle(SimpleRateThrottle):
    scope = "dynamic_user"

    def get_cache_key(self, request, view):
        if not request.user.is_authenticated:
            return self.get_ident(request)
        return f"throttle_user_{request.user.pk}"

    def get_rate(self):
        # Override to pull rate from user profile or subscription
        if hasattr(self, "_request") and self._request.user.is_authenticated:
            user = self._request.user
            if hasattr(user, "api_rate_limit"):
                return user.api_rate_limit
        return "100/hour"

    def allow_request(self, request, view):
        self._request = request
        return super().allow_request(request, view)
```

## Full Example: Combining Auth, Permissions, and Throttling

```python
# settings.py
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "50/hour",
        "user": "500/hour",
        "upload": "20/hour",
    },
}
```

```python
# permissions.py
from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.author_id == request.user.id


class CanPublish(BasePermission):
    message = "Publishing requires editor role."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and (
                request.user.is_staff
                or request.user.groups.filter(name="editors").exists()
            )
        )
```

```python
# views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from myapp.models import Article
from myapp.permissions import IsOwnerOrReadOnly, CanPublish
from myapp.serializers import (
    ArticleListSerializer,
    ArticleDetailSerializer,
    ArticleWriteSerializer,
)


class ArticleViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        qs = Article.objects.select_related("author", "category")
        if self.action == "list":
            return qs.filter(status="published")
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return ArticleListSerializer
        if self.action == "retrieve":
            return ArticleDetailSerializer
        return ArticleWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsOwnerOrReadOnly()]
        if self.action == "publish":
            return [IsAuthenticated(), CanPublish()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(
        detail=True,
        methods=["post"],
        throttle_classes=[ScopedRateThrottle],
        throttle_scope="upload",
    )
    def publish(self, request, pk=None):
        article = self.get_object()
        article.status = "published"
        article.save(update_fields=["status"])
        return Response(
            ArticleDetailSerializer(article).data,
            status=status.HTTP_200_OK,
        )
```
