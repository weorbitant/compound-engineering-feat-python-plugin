---
name: slfg
description: "(DEPRECATED v3.0.0 — removed in v4.0.0) Swarm-mode autonomous pipeline"
argument-hint: "[feature description]"
---

# `/slfg` — Removed in v3.0.0

The `/slfg` swarm pipeline was removed in v3.0.0 along with the `orchestrating-swarms` skill it depended on.

For parallel agent work, use the `superpowers:dispatching-parallel-agents` skill directly within any stage (most useful inside `/workflows:work` for independent tasks).

For the rest of the pipeline, see `/lfg`'s migration message:

1. `/workflows:brainstorm "<idea>"`
2. `/workflows:plan <spec>`
3. `/workflows:work <plan>` — invoke `superpowers:dispatching-parallel-agents` inside this for parallelism.
4. `/workflows:review`

See `CHANGELOG.md` v3.0.0 for the full rationale.

This shim will be removed entirely in v4.0.0.
