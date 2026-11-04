---
name: workflows:brainstorm
description: Explore requirements and approaches before planning, with Python/microservice context loaded for downstream sub-agents
argument-hint: "[feature idea or problem to explore] [--services svc-a,svc-b]"
---

# Brainstorm (Python)

This command is a thin wrapper that loads Python-specific context, runs the microservice focus gate, then delegates the brainstorming process to the `superpowers:brainstorming` skill.

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

If the feature description above is empty, ask the user: "What would you like to explore? Please describe the feature, problem, or improvement you're thinking about." Do not proceed without one.

## Prerequisites

If the `superpowers:brainstorming` skill is not available, halt and instruct the user:

> "This command requires the `superpowers` plugin. Install it with:
> `/plugin marketplace add anthropics/claude-plugins-official`
> `/plugin install superpowers@claude-plugins-official`"

## Step 1: Load Project Workflow Skills

Read `py-micro-superpowers.local.md` in the project root (if it doesn't exist but a legacy `compound-engineering.local.md` does, read that — same schema). If found, parse the YAML frontmatter for `workflow_skills.brainstorm`. If the key contains a non-empty list of skill names, load each listed skill now. These provide project-specific Python/Django/domain context.

If no config exists or no `workflow_skills` key is present, proceed without additional skills.

## Step 2: Microservice Focus

Invoke the `microservice-focus` skill. It will:

- Parse `--services` from `$ARGUMENTS` if present.
- Otherwise discover services via `Glob("*/pyproject.toml")` and prompt the user via `AskUserQuestion` if multiple services exist.
- Return the list of focused services + a `<focus_context>` block.

In single-service mode, the skill returns an empty service list and empty focus context. Skip Step 4.

## Step 3: Delegate to superpowers

Invoke the `superpowers:brainstorming` skill. Pass:

- The user's feature description from `<feature_description>` as the topic.
- The `<focus_context>` block returned from Step 2 (so the superpowers skill includes it in any sub-agent prompts it spawns).
- A note that any Python `workflow_skills` listed above are already loaded in the conversation as additional context.
- An instruction to include the `<focus_context>` block in the builder-check subagent prompt it dispatches.
- **An instruction to return control to this wrapper once the design is approved, instead of invoking `superpowers:writing-plans`.** This wrapper owns the plan handoff so `/workflows:plan` can run the focus gate and the per-service split.

The superpowers skill drives the rest of the conversation: it draws out intent, plays back what it heard, sizes the work, and (for a project) writes the design and runs the builder check. It returns once the user approves the description. Control then returns to this wrapper.

### Size outcome

`superpowers:brainstorming` (v7+) picks one of three sizes:

| Size | What exists afterwards | This wrapper then |
|------|------------------------|-------------------|
| Quick, clear task | Nothing written; the task is done | Skip Step 4. Report what was done. |
| Small change | Description agreed in chat | Skip Step 4. Restate the agreed description; the user builds it through the normal workflow. |
| Project | Approved spec at `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` | Run Step 4 (multi-service only), then suggest `/workflows:plan`. |

## Step 4: Multi-service spec post-processing (multi-service only)

`superpowers:brainstorming` always writes ONE spec to the default path: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. It does not know about per-service paths.

If Step 2 returned a non-empty service list **and** brainstorming wrote a spec, **after the superpowers skill returns**, this wrapper post-processes the spec:

1. Read the spec at `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
2. For each focused service, write a copy to `{service}/docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` (create the directory with `mkdir -p` first).
3. To each per-service copy, prepend a `## Services` section listing all focused services and their roles, so `/workflows:plan` can auto-detect scope on the next step. Example:

   ```markdown
   ## Services

   - **service-order**: Produces order events consumed by payment
   - **service-payment**: Handles payment processing triggered by orders
   - **lib-common**: Shared DTOs used by both services
   ```

4. **Delete** the original root-level `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` to avoid duplication. (In single-service mode, this deletion does NOT happen — the root spec stays.)

In single-service mode (Step 2 returned empty service list), this entire step is skipped — the root-level spec is the final artifact.

## Output

After the superpowers skill returns, summarize:

- The size brainstorming chose.
- Spec path(s) written (project size only).
- The focused services (if multi-service mode).
- Suggested next step for project size: `/workflows:plan <spec-path>`. For a small change, no plan step is needed.
