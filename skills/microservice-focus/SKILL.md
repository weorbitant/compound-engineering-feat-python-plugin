---
name: microservice-focus
description: Use when a workflow command needs to detect multi-service monorepos, prompt for service scope, and propagate `<focus_context>` to sub-agents. Triggers when `--services` is passed, when focus context already exists in the conversation, or when multiple `pyproject.toml` files exist at the repo root.
---

# Microservice Focus

Consolidates the service-discovery and focus-context-propagation logic used by every Python workflow command in this plugin. Invoked once per command; returns the focused service list plus a `<focus_context>` block ready to inject into sub-agent prompts.

## When to invoke this skill

A workflow command should invoke this skill exactly once, near the top of its execution, before delegating to a `superpowers:*` skill.

## Inputs

The skill expects to find one of the following, in priority order:

1. A `--services service-a,service-b` argument parsed from the command's `$ARGUMENTS`.
2. An existing `<focus_context>` block in the conversation (set by a prior invocation).
3. Multiple `pyproject.toml` files at the repo root (multi-service repo).
4. None of the above → return single-service mode.

## What the skill does

1. **Parse `--services` if present.** Skip the interactive prompt and use those services as the focused set.
2. **Discover services on disk** when no explicit list was given. See [service-discovery.md](./references/service-discovery.md) for the exact glob and parsing rules.
3. **If multi-service and no explicit list:** use `AskUserQuestion` to prompt the user with the discovered services as multi-select options. See [focus-gate.md](./references/focus-gate.md) for the prompt format.
4. **Load each focused service's context:** `prompt.md` (preferred) or `README.md` (first 50 lines), `pyproject.toml`, and `src/` structure. Cross-reference internal dependencies to build the dependency map.
5. **Build the `<focus_context>` block.** See [focus-context-block.md](./references/focus-context-block.md) for the canonical template.
6. **Return** the service list + the `<focus_context>` block to the caller. The caller is responsible for injecting it into the prompts of any sub-agents or sub-skills it invokes.

## Output contract

The skill returns two pieces of information to the caller:

- `services`: a list like `["service-a", "service-b"]`, or an empty list in single-service mode.
- `focus_context`: a `<focus_context>...</focus_context>` block ready to splice into sub-agent prompts. Empty string in single-service mode.

## Single-service mode

If only one (or zero) `pyproject.toml` is found and no `--services` argument was passed, the skill returns immediately with an empty service list and an empty focus context. The caller proceeds without per-service path overrides.

## References

- [focus-gate.md](./references/focus-gate.md) — Discovery + interactive prompting protocol
- [focus-context-block.md](./references/focus-context-block.md) — `<focus_context>` template & propagation rules
- [service-discovery.md](./references/service-discovery.md) — Glob mechanics, dependency cross-reference algorithm
