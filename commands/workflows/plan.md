---
name: workflows:plan
description: Transform a spec into a Python-flavored implementation plan, delegating plan-writing to superpowers
argument-hint: "[spec path, feature description, or bug report] [--services svc-a,svc-b]"
---

# Plan (Python)

This command is a thin wrapper that loads Python-specific context, runs the microservice focus gate, then delegates plan writing to the `superpowers:writing-plans` skill.

## Input

<input> #$ARGUMENTS </input>

If the input is empty, ask the user: "What would you like to plan? Provide a spec path (typically under `docs/superpowers/specs/`) or a feature description." Do not proceed without one.

## Prerequisites

If the `superpowers:writing-plans` skill is not available, halt and instruct the user:

> "This command requires the `superpowers` plugin. Install it with:
> `/plugin marketplace add anthropics/claude-plugins-official`
> `/plugin install superpowers@claude-plugins-official`"

## Step 1: Load Project Workflow Skills

Read `py-micro-superpowers.local.md` in the project root (if it doesn't exist but a legacy `compound-engineering.local.md` does, read that — same schema). If `workflow_skills.plan` is set, load each listed skill now. They inform the plan with Python/Django/domain-specific patterns.

## Step 2: Microservice Focus

Invoke the `microservice-focus` skill. It will:

- Parse `--services` from `$ARGUMENTS` if present.
- Otherwise discover services via `Glob("*/pyproject.toml")` and prompt the user via `AskUserQuestion` if multiple services exist.
- Return the list of focused services + a `<focus_context>` block.

In single-service mode, the skill returns an empty service list and empty focus context. Skip Step 4.

If the input was a spec path, **also** check the spec for a `## Services` section. If present, merge those services into the focused list (the spec may have established scope during brainstorm).

## Step 3: Delegate to superpowers

Invoke the `superpowers:writing-plans` skill. Pass:

- The input (spec path or feature description) as the planning topic.
- The `<focus_context>` block from Step 2.
- A note that loaded Python `workflow_skills` are available in conversation.

The superpowers skill drives plan writing: file structure, task decomposition, bite-sized steps, self-review. It returns when the plan is written to its default path `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`. Control then returns to this wrapper for Step 4.

## Step 4: Multi-service plan post-processing (multi-service only)

`superpowers:writing-plans` always writes ONE plan to the default root path. It does not know about per-service paths or the `services:` YAML frontmatter convention.

If Step 2 returned a non-empty service list, **after the superpowers skill returns**, this wrapper post-processes the plan:

1. Read the plan at `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`.
2. Add or update the YAML frontmatter to include a `services:` section so `/workflows:work` can execute in dependency order:

   ```yaml
   services:
     service-a:
       depends_on: []
     service-b:
       depends_on:
         - service: service-a
           reason: "<inferred from focus context or asked>"
   ```

   Determine dependencies from the `<focus_context>` block's `dependencies:` section. Ask the user to confirm or adjust the graph before writing the final plan.

3. **Per-service plan files** — for each focused service, write a copy of the plan to `{service}/docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` (create the directory with `mkdir -p` first). Each per-service plan contains the tasks scoped to that service, the acceptance criteria, and the file changes for that service only. Copy the plan header — including the `## Global Constraints` section and each task's `**Interfaces:**` block (both part of the superpowers plan format) — verbatim into every per-service plan; task implementers only ever see their own plan file, so cross-service signatures must not be lost in the split.

4. **Root overview** — keep the root-level plan at `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`. **Rewrite** its body to contain only: the dependency graph, execution order, links to the per-service plans (from sub-step 3), and any cross-cutting concerns. The detailed per-service tasks now live in the per-service files — they should NOT be duplicated in the root.

In single-service mode (Step 2 returned empty service list), this entire step is skipped — the root plan is the final artifact.

## Output

Confirm: "Plan written to `<path>`" (and per-service locations if applicable). Suggest next step: `/workflows:work <plan-path>`.
