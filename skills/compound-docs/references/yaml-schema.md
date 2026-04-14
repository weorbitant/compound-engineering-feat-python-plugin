# YAML Frontmatter Schema

**See `schema.yaml` in the skill root for the complete schema specification.**

## Required Fields

- **module** (string): Module name (e.g., "OrderProcessing") or "System" for system-wide issues
- **date** (string): ISO 8601 date (YYYY-MM-DD)
- **problem_type** (enum): One of [build_error, test_failure, runtime_error, performance_issue, database_issue, security_issue, ui_bug, integration_issue, logic_error, developer_experience, workflow_issue, best_practice, documentation_gap]
- **component** (enum): One of [django_model, django_view, django_serializer, django_template, fastapi_endpoint, sqlalchemy_model, pydantic_model, service_layer, celery_task, database, middleware, api_client, authentication, payments, development_workflow, testing_framework, documentation, tooling]
- **symptoms** (array): 1-5 specific observable symptoms
- **root_cause** (enum): One of [missing_relationship, missing_prefetch, missing_index, wrong_api, queryset_issue, async_issue, task_timing, memory_leak, config_error, logic_error, test_isolation, missing_validation, missing_permission, missing_workflow_step, inadequate_documentation, missing_tooling, incomplete_setup]
- **resolution_type** (enum): One of [code_fix, migration, config_change, test_fix, dependency_update, environment_setup, workflow_improvement, documentation_update, tooling_addition, fixture_update]
- **severity** (enum): One of [critical, high, medium, low]

## Optional Fields

- **python_version** (string): Python version in X.Y or X.Y.Z format
- **framework_version** (string): Framework version (e.g., "Django 5.0.2")
- **tags** (array): Searchable keywords (lowercase, hyphen-separated)

## Validation Rules

1. All required fields must be present
2. Enum fields must match allowed values exactly (case-sensitive)
3. symptoms must be YAML array with 1-5 items
4. date must match YYYY-MM-DD format
5. python_version (if provided) must match X.Y or X.Y.Z format
6. tags should be lowercase, hyphen-separated

## Example

```yaml
---
module: Order Processing
date: 2026-04-01
problem_type: performance_issue
component: django_model
symptoms:
  - "N+1 query when loading order items"
  - "Order listing taking >5 seconds"
root_cause: missing_prefetch
python_version: 3.12
framework_version: Django 5.0.2
resolution_type: code_fix
severity: high
tags: [n-plus-one, select-related, prefetch-related, performance]
---
```

## Category Mapping

Based on `problem_type`, documentation is filed in:

- **build_error** → `docs/solutions/build-errors/`
- **test_failure** → `docs/solutions/test-failures/`
- **runtime_error** → `docs/solutions/runtime-errors/`
- **performance_issue** → `docs/solutions/performance-issues/`
- **database_issue** → `docs/solutions/database-issues/`
- **security_issue** → `docs/solutions/security-issues/`
- **ui_bug** → `docs/solutions/ui-bugs/`
- **integration_issue** → `docs/solutions/integration-issues/`
- **logic_error** → `docs/solutions/logic-errors/`
- **developer_experience** → `docs/solutions/developer-experience/`
- **workflow_issue** → `docs/solutions/workflow-issues/`
- **best_practice** → `docs/solutions/best-practices/`
- **documentation_gap** → `docs/solutions/documentation-gaps/`
