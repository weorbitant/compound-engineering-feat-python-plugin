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

Read `compound-engineering.local.md` in the project root. If found, parse the YAML frontmatter for `workflow_skills.brainstorm`. If the key contains a non-empty list of skill names, load each listed skill now. These provide project-specific Python/Django/domain context.

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

The superpowers skill drives the rest of the conversation: clarifying questions, approach exploration, design presentation, spec writing.

## Step 4: Multi-service spec path override

`superpowers:brainstorming` writes its spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` by default.

If Step 2 returned a non-empty service list, write **one spec per focused service** at:

```
{service}/docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
```

Each per-service spec focuses on that service's role and decisions. Add a `## Services` section to each listing all focused services and their roles, so `/workflows:plan` can auto-detect scope on the next step.

Create the `{service}/docs/superpowers/specs/` directories with `mkdir -p` as needed before writing.

## Output

After the superpowers skill returns, summarize:

- Spec path(s) written.
- The focused services (if multi-service mode).
- Suggested next step: `/workflows:plan <spec-path>`.
