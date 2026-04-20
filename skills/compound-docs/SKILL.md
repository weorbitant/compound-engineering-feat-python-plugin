---
name: compound-docs
description: Capture solved problems as categorized documentation with YAML frontmatter for fast lookup
model: opus
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
preconditions:
  - Problem has been solved (not in-progress)
  - Solution has been verified working
---

# compound-docs

**Purpose:** Capture solved problems as one markdown file per problem in `docs/solutions/{category}/` with validated YAML frontmatter for search.

## When to Use

Triggers on confirmation phrases: "that worked", "it's fixed", "working now", "problem solved", "that did it". Or `/compound`.

**Only for non-trivial problems.** Skip typos, obvious syntax errors, trivial fixes.

## Process (7 steps)

Full detail in [references/process.md](./references/process.md). Summary:

1. **Detect confirmation** — user signals the problem is solved
2. **Gather context** — module, symptom, attempts, root cause, solution, prevention. If critical info missing, ASK and WAIT.
3. **Check existing docs** — `grep -r` in `docs/solutions/`. If match, present options (new + xref / update / other), WAIT.
4. **Generate filename** — `[symptom]-[module]-[YYYYMMDD].md`
5. **Validate YAML schema** — against [references/yaml-schema.md](./references/yaml-schema.md). BLOCKING: do not proceed if invalid.
6. **Create doc** — from [assets/resolution-template.md](./assets/resolution-template.md). Microservice-aware path: `{service}/docs/solutions/{category}/` or root `docs/solutions/{category}/`.
7. **Cross-reference & pattern detection** — link related docs, flag critical patterns in decision menu (never auto-promote).

## Decision Menu After Capture

Present and WAIT:

```
✓ Solution documented
File: docs/solutions/[category]/[filename].md

What's next?
1. Continue workflow (recommended)
2. Add to Required Reading (critical-patterns.md)
3. Link related issues
4. Add to existing skill (e.g., django-patterns)
5. Create new skill
6. View documentation
7. Other
```

**Option 2 (Required Reading):** extract pattern as `❌ WRONG` vs `✅ CORRECT`, append to `docs/solutions/patterns/critical-patterns.md` using [assets/critical-pattern-template.md](./assets/critical-pattern-template.md), add cross-ref back. Confirm: "✓ Added to Required Reading. All subagents will see this pattern before code generation."

**Option 3 (Link related):** prompt for target doc, add xref to both.

**Option 4 (Add to existing skill):** prompt for skill, update appropriate reference file (resources.md / patterns.md / examples.md).

**Option 5 (Create new skill):** prompt for name, run `python3 .claude/skills/skill-creator/scripts/init_skill.py [name]`, seed with this solution.

## Success Criteria

- YAML validated against schema (enums exact)
- File at `docs/solutions/[category]/[filename].md`
- Code examples included
- Cross-references added where applicable
- Decision menu presented and action confirmed

## Execution Guardrails

**MUST:** validate YAML (blocking), extract exact error messages, include code examples, `mkdir -p` before write, ask and wait when critical context is missing.

**MUST NOT:** skip YAML validation, use vague descriptions, omit code or cross-references.

## Reference files

- [references/process.md](./references/process.md) — full 7-step detail with validation gates
- [references/yaml-schema.md](./references/yaml-schema.md) — frontmatter enums, category mapping
- [references/example.md](./references/example.md) — walkthrough + quality guidelines + error handling
- [assets/resolution-template.md](./assets/resolution-template.md) — doc body template
- [assets/critical-pattern-template.md](./assets/critical-pattern-template.md) — critical-pattern entry template
- [schema.yaml](./schema.yaml) — validation schema

## Integration

**Invoked by:** `/compound` command; manual after a fix is confirmed; auto-trigger on confirmation phrases.
**Invokes:** none (terminal skill).
**Handoff:** all context must be in conversation history before invocation.
