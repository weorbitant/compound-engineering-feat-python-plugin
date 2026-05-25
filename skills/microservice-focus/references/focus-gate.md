# Focus Gate Protocol

This file documents the interactive prompting protocol when multiple services exist but the user has not specified `--services`.

## Step 1: Discovery

Run `Glob("*/pyproject.toml")` from the repo root. Each match represents a candidate service. Strip the trailing `/pyproject.toml` to get the service name (e.g., `service-a/pyproject.toml` → `service-a`).

If the glob returns 0 or 1 results, the repo is single-service. Return without prompting.

## Step 2: Prompt

If 2 or more services are discovered, use `AskUserQuestion` with `multiSelect: true`. Phrase the question to match the command context:

- `/workflows:brainstorm` → "Which services are relevant to this brainstorm?"
- `/workflows:plan` → "Which services are involved in this plan?"
- `/workflows:work` → "Which services does this work touch?"
- `/workflows:review` → "Which services should be reviewed?"

List discovered services as options. Each option's `label` is the service name; the `description` is a one-line summary read from `{service}/.claude/prompt.md` (first line) or `{service}/README.md` (first heading), or "Python service" as a fallback.

## Step 3: Validate the user's selection

If the user selects nothing or hits cancel, halt with: "No services selected. Re-invoke the command with `--services <list>` or pick services when prompted."

If the user selects a subset, treat those as the focused services and proceed.

## Step 4: Load per-service context

For each focused service, in parallel where possible:

1. Read `{service}/.claude/prompt.md` (preferred) — first 30 lines.
2. If not present, read `{service}/README.md` — first 50 lines.
3. Read `{service}/pyproject.toml` — extract `name`, Python version requirement, and the `dependencies`/`tool.poetry.dependencies` list.
4. Run `Glob("{service}/src/*/")` to enumerate top-level packages (apps, modules).

Cache these loads — the same focused service may be referenced multiple times in the focus-context block.

## Pipeline mode

If the command was invoked from an automated workflow (e.g., orchestrating script passes a flag, or a `disable-model-invocation` context is detected), **skip the interactive prompt entirely**. Default behavior in pipeline mode without `--services`: treat the repo as single-service.
