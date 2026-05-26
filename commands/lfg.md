---
name: lfg
description: "(DEPRECATED v3.0.0 — removed in v4.0.0) Full autonomous pipeline"
argument-hint: "[feature description]"
---

# `/lfg` — Removed in v3.0.0

The `/lfg` autonomous pipeline was removed in v3.0.0. Users now orchestrate the stages directly, which keeps each step interruptible and reviewable.

Run the stages in sequence:

1. `/workflows:brainstorm "<your idea>"` — explore and write a spec.
2. `/workflows:plan <spec-path>` — turn the spec into an implementation plan.
3. `/workflows:work <plan-path>` — execute the plan with the Python quality gate.
4. `/workflows:review` — multi-agent review of the resulting PR.

Each stage now delegates to a `superpowers:*` skill underneath. See `CHANGELOG.md` v3.0.0 for the full rationale.

This shim will be removed entirely in v4.0.0.
