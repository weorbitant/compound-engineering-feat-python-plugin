# Focus Gate Protocol

This file documents the interactive prompting protocol when multiple services exist but the user has not specified `--services`.

## Step 0: Detect existing `<focus_context>`

Check the conversation history for an existing `<focus_context>...</focus_context>` block set by a prior invocation of this skill.

If `--services` was also provided in the current invocation, that takes precedence — skip this step and use Step 1 instead.

If a `<focus_context>` block is found (and no `--services` override is present):

1. Parse the `services:` line to extract the focused service names.
2. Treat those names as the focused set; skip Steps 1-3 (no rediscovery, no interactive prompt).
3. Proceed to Step 4 only if any per-service context (description, stack, or structure) appears stale or missing from the prior block; otherwise reuse the prior `<focus_context>` contents and return immediately.

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
