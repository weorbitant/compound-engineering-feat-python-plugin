# Demo monorepo

Three tiny FastAPI services for trying py-micro-superpowers end to end. They keep all state in memory, so no database is needed.

| Service | Role | Depends on |
|---------|------|------------|
| `lib-common` | Shared Pydantic models (`Money`, `OrderDTO`, `OrderStatus`) | — |
| `orders` | Create and read orders, mark them paid | `lib-common` |
| `payments` | Capture a payment for an order (calls `orders` over HTTP) | `lib-common`, `orders` |

## Setup

Don't work in this folder directly. The workflow commands create branches and commits, and here they would land in the plugin's own repository. Make a throwaway copy instead:

```bash
./scripts/sandbox.sh --install          # from the plugin repo root
cd <printed path> && claude --plugin-dir <plugin repo root>
```

Requirements: Poetry 2.x, Python 3.12+, `pre-commit`, and the `superpowers` plugin (v7.0.0 or later) installed in Claude Code.

## Walkthrough

The suggested feature touches all three services: **"Add refunds: payments can refund a captured payment, and the order moves to a `refunded` status."**

| # | Run | Check |
|---|-----|-------|
| 1 | `/workflows:brainstorm add refunds across orders and payments` | The focus gate lists all three services. Brainstorming sizes it as a project, then hands control back instead of starting plan writing. Spec copies land in `{service}/docs/superpowers/specs/`, and the root copy is deleted. |
| 2 | `/workflows:plan <spec path>` | Per-service plans under `{service}/docs/superpowers/plans/`, each with its own `**Spec:**` link and its own Review Focus items. A `services:` dependency graph sits in the root plan's frontmatter. It stops at the Subagent-driven / Native question without executing. |
| 3 | `/workflows:work <root plan> --method native` | Waves run in order (`lib-common` first). It stops before superpowers' finishing step, then runs the Python quality gate (pytest, ruff, mypy, pre-commit). |
| 4 | `/workflows:review` | The roster from `py-micro-superpowers.local.md` runs, and "Declined to judge" items come to you rather than to `todos/`. |

For a quicker check of the size outcomes, try `/workflows:brainstorm rename OrderDTO.item to OrderDTO.sku`. It should be sized as a small change and write no spec.

## Checks by hand

```bash
for s in lib-common orders payments; do (cd $s && poetry run pytest -q && poetry run ruff check . && poetry run mypy .); done
```
