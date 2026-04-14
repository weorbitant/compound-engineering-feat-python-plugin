---
name: django-drf
description: Django REST Framework patterns for serializers, viewsets, routers, permissions, and authentication. Use when building or reviewing projects with djangorestframework in dependencies.
---

# Django REST Framework Patterns

This skill provides reference patterns for building APIs with Django REST Framework (DRF).
It covers serializer design, viewset architecture, routing, filtering, pagination,
authentication, and permissions.

## When to Use

- Project has `djangorestframework` in its dependencies
- Building or modifying REST API endpoints
- Designing serializer validation or nested write logic
- Configuring authentication, permissions, or throttling
- Reviewing DRF code for performance or correctness issues

## Style Conventions

- Use `| None` instead of `Optional` for type hints
- Maximum line length: 100 characters
- Prefer `select_related` / `prefetch_related` in viewset `get_queryset()`, not in serializers
- Keep serializers thin -- move complex logic to model methods or services

## Reference Files

- [serializers.md](./references/serializers.md) - Serializer patterns: ModelSerializer vs
  Serializer, nested writes, validation, field customization, performance
- [viewsets.md](./references/viewsets.md) - ViewSet patterns: ModelViewSet vs GenericViewSet,
  routers, custom actions, filtering, pagination, throttling
- [permissions-auth.md](./references/permissions-auth.md) - Authentication and permissions:
  token/JWT/session auth, permission classes, object-level permissions, rate limiting

## Quick Reference

### Common Settings

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
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

### Typical File Layout

```
app/
    serializers.py      # All serializers for this app
    views.py            # ViewSets and API views
    urls.py             # Router registration
    permissions.py      # Custom permission classes
    filters.py          # Custom filter classes
    pagination.py       # Custom pagination classes
    throttling.py       # Custom throttle classes
    tests/
        test_api.py     # API endpoint tests
```
