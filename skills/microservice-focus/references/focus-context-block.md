# `<focus_context>` Block — Template and Propagation Rules

## Canonical template

```
<focus_context>
  services: <name-1> (./<name-1>), <name-2> (./<name-2>)

  <name-1>:
    description: [from prompt.md/README — what this service does]
    stack: [e.g., Django 5.0, Celery, PostgreSQL — derived from pyproject.toml]
    structure: [e.g., src/orders/, src/pricing/, src/shared/]

  <name-2>:
    description: [from prompt.md/README — what this service does]
    stack: [e.g., FastAPI, SQLAlchemy 2.0, Redis]
    structure: [e.g., src/payments/, src/webhooks/]

  dependencies:
    - <name-2> depends on <name-1> (event schema)
    - both depend on lib-common (shared DTOs)
</focus_context>
```

## Construction rules

1. **`services:` line** lists all focused services with their paths in the format `<name> (./<name>)`.
2. **Per-service block** for each focused service includes `description`, `stack`, and `structure`. Pull these from the per-service context loaded in [focus-gate.md](./focus-gate.md).
3. **`dependencies:` section** lists internal dependencies cross-referenced from `pyproject.toml` files. Format each as a single line stating "X depends on Y (reason)". See [service-discovery.md](./service-discovery.md) for cross-reference logic.
4. **Omit any section** for which there is no data. An empty repo description, empty stack, or no detected dependencies = omit the line.

## Propagation rules

The caller (a workflow command) **must inject the full `<focus_context>` block into the prompt of every sub-agent or sub-skill it invokes**. This includes:

- `superpowers:brainstorming` (via the wrapper's delegate step)
- `superpowers:writing-plans`
- `superpowers:executing-plans`
- `superpowers:requesting-code-review`
- Any Python review agent spawned by `/workflows:review`
- Any sub-task spawned by `Agent` or `Task` calls inside the command body

The block is inserted near the top of the sub-agent prompt, before any task description, so the sub-agent reads the constraint up front.

## Stack-aware behavior expectation

Sub-agents that read this block should:

- Apply Django patterns only in services whose stack lists Django.
- Apply FastAPI patterns only in services whose stack lists FastAPI.
- Respect each service's test/lint command (often visible in its `pyproject.toml` scripts or `CLAUDE.md`).
- Use the dependency map to choose execution order in multi-step operations.

The wrapper command is not responsible for enforcing these — sub-agents act on the block.
