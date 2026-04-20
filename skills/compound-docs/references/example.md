# Example Scenario

**User:** "That worked! The N+1 query is fixed."

Skill activates:

1. **Detect:** "That worked!" triggers auto-invoke.
2. **Gather:**
   - Module: Order Processing
   - Symptom: Order listing taking >5 seconds, N+1 query loading order items
   - Failed attempts: Added pagination (didn't help), checked Celery task performance
   - Solution: `select_related('customer')` + `prefetch_related('items')` on Order queryset
   - Root cause: Missing eager loading → separate DB query per order item
3. **Check existing:** None found.
4. **Filename:** `n-plus-one-order-listing-OrderProcessing-20260401.md`
5. **Validate YAML:**
   ```yaml
   module: Order Processing
   date: 2026-04-01
   problem_type: performance_issue
   component: django_queryset
   symptoms:
     - "N+1 query when loading order items"
     - "Order listing taking >5 seconds"
   root_cause: missing_prefetch
   severity: high
   tags: [n-plus-one, select-related, prefetch-related, performance]
   ```
6. **Create:** `docs/solutions/performance-issues/n-plus-one-order-listing-OrderProcessing-20260401.md`
7. **Cross-reference:** none needed.

**Output:**

```
✓ Solution documented

File created:
- docs/solutions/performance-issues/n-plus-one-order-listing-OrderProcessing-20260401.md

What's next?
1. Continue workflow (recommended)
2. Add to Required Reading
3. Link related issues
4. Add to existing skill
5. Create new skill
6. View documentation
7. Other
```

# Quality Guidelines

**Good docs have:**
- Exact error messages (copy-paste)
- Specific file:line references
- Observable symptoms (what you saw, not interpretations)
- Failed attempts documented
- Technical "why" not just "what"
- Before/after code examples
- Prevention guidance
- Cross-references

**Avoid:**
- Vague descriptions ("something was wrong")
- Missing technical details ("fixed the code")
- No version / file context
- Code dumps without explanation
- No prevention guidance
- No cross-references

# Error Handling

- **Missing context:** Ask user, don't proceed.
- **YAML validation failure:** Show errors, request corrected values, BLOCK until valid.
- **Similar issue ambiguity:** Present matches, let user pick new/update/link.
- **Module not documented:** Warn but don't block. Suggest adding to module docs.
