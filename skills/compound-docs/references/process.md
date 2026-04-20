# 7-Step Documentation Process

## Step 1 — Detect Confirmation

Auto-invoke on: "that worked", "it's fixed", "working now", "problem solved", "that did it".
Manual: `/doc-fix`.

**Only for non-trivial problems:**
- Multiple investigation attempts needed
- Tricky debugging
- Non-obvious solution
- Future sessions would benefit

**Skip:** typos, obvious syntax errors, trivial fixes.

## Step 2 — Gather Context

**Required:**
- Module name
- Symptom (exact error messages)
- Investigation attempts (what didn't work and why)
- Root cause (technical explanation)
- Solution (code/config changes)
- Prevention (how to avoid)

**Environment:** Python/framework version, environment (local/staging/production), OS, file:line refs.

**BLOCKING:** If critical context is missing (module, exact error, stage, resolution), ask user and WAIT before Step 3:

```
I need a few details to document this properly:
1. Which module had this issue?
2. What was the exact error message or symptom?
3. What environment was this in?
```

## Step 3 — Check Existing Docs

```bash
grep -r "exact error phrase" docs/solutions/
ls docs/solutions/[category]/
```

If similar issue found, present:
```
Found similar issue: docs/solutions/[path]
1. Create new doc with cross-reference (recommended)
2. Update existing doc (only if same root cause)
3. Other
```

WAIT for user response. Otherwise proceed to Step 4.

## Step 4 — Generate Filename

Format: `[sanitized-symptom]-[module]-[YYYYMMDD].md`

Rules: lowercase, hyphens for spaces, strip specials, < 80 chars.

Examples:
- `missing-prefetch-OrderProcessing-20260401.md`
- `parameter-not-saving-state-EmailProcessing-20260401.md`

## Step 5 — Validate YAML Schema (BLOCKING)

Validate frontmatter against enums in [yaml-schema.md](./yaml-schema.md).

On failure:
```
❌ YAML validation failed
- problem_type: must be one of schema enums
- severity: must be one of [critical, high, medium, low]
- symptoms: must be array with 1-5 items
```

Do NOT proceed to Step 6 until valid.

## Step 6 — Create Documentation

Determine `category` from `problem_type` (mapping in [yaml-schema.md](./yaml-schema.md)).

**Path rules (microservice mode):**
- Single service: `{service}/docs/solutions/${CATEGORY}/${FILENAME}` — add `service: [name]` to frontmatter
- Cross-service or no service context: `docs/solutions/${CATEGORY}/${FILENAME}` — add `services: [service-a, service-b]`

```bash
mkdir -p "$(dirname ${DOC_PATH})"
# Populate using assets/resolution-template.md + context + validated YAML
```

## Step 7 — Cross-Reference & Pattern Detection

If similar issues found in Step 3, add "See also" links to both docs.

If pattern seen 3+ times, append to `docs/solutions/patterns/common-solutions.md`:
```markdown
## [Pattern Name]
**Common symptom:** ...
**Root cause:** ...
**Solution pattern:** ...
**Examples:** [docs...]
```

**Critical pattern indicators** (severity critical, affects multiple modules or foundational components, non-obvious solution): note in decision menu Option 2 — never auto-promote.

When user selects Option 2, use [critical-pattern-template.md](../assets/critical-pattern-template.md).
