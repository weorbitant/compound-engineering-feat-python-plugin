---
name: workflows:review
description: Multi-agent Python code review, delegating review orchestration to superpowers and supplying Python-specific reviewer agents from project config
argument-hint: "[PR number, GitHub URL, branch name, or empty for current branch]"
---

# Review (Python)

This command is a thin wrapper around `superpowers:requesting-code-review`. It loads the Python reviewer agent roster from `compound-engineering.local.md`, supplies them to the superpowers orchestration, and adds Python-specific conditional agents for migrations.

## Review Target

<review_target> #$ARGUMENTS </review_target>

If empty, default to the current branch's diff against the project default branch.

## Prerequisites

If the `superpowers:requesting-code-review` skill is not available, halt and instruct the user:

> "This command requires the `superpowers` plugin. Install it with:
> `/plugin marketplace add anthropics/claude-plugins-official`
> `/plugin install superpowers@claude-plugins-official`"

## Step 1: Determine target & checkout

1. Determine the review target type:
   - Numeric → PR number; use `gh pr view --json` to fetch metadata.
   - GitHub URL → extract PR number, then as above.
   - File path ending in `.md` → document review; pass through to superpowers as a doc target.
   - Empty → current branch.
2. If the target is a PR and the current branch differs, switch via `gh pr checkout <num>` or use the `superpowers:using-git-worktrees` skill for an isolated worktree.

## Step 2: Microservice Detection

Auto-detect changed services from the diff:

```bash
git diff --name-only origin/<default-branch>...HEAD | cut -d'/' -f1 | sort -u
```

Cross-reference the top-level directories against discovered services (`Glob("*/pyproject.toml")`). The intersection is the list of changed services.

If multiple services are changed, invoke the `microservice-focus` skill to build a `<focus_context>` block scoped to those services. Per-service agent roster loading happens in Step 3.

## Step 3: Load Reviewer Roster

**Single-service or non-microservice mode:**
Read `compound-engineering.local.md` in the project root. Use `review_agents` from the YAML frontmatter.

**Multi-service mode:**
For each changed service, check `{service}/compound-engineering.local.md` first (allows per-service agent rosters — e.g., Django agents for one, FastAPI for another). Fall back to root-level `compound-engineering.local.md`.

If no settings file exists, invoke the `setup` skill to create one. Read the new file and continue.

## Step 4: Load Project Workflow Skills

From the same `compound-engineering.local.md`, parse `workflow_skills.review`. Load each listed skill now. They provide Python-specific context that helps interpret review findings.

## Step 5: Identify Conditional Agents

Some agents only run when the PR matches specific criteria:

**Migration agents** — run if the PR contains any of:
- `*/migrations/*.py` (Django migrations)
- `alembic/versions/*.py` (Alembic migrations)
- Files modifying ID/enum/mapping columns
- Data migration scripts or management commands
- Title/body mentioning: migration, backfill, data transformation, ID mapping

If matched, add to the agent roster:
- `data-migration-expert` — validates data migrations, swapped IDs, rollback safety
- `deployment-verification-agent` — Go/No-Go checklist with SQL verification queries

## Step 6: Protected Artifacts

When synthesizing findings, **discard any recommendations to delete or gitignore** files matching:

- `docs/plans/*.md`, `docs/superpowers/plans/*.md`
- `docs/superpowers/specs/*.md`
- `{service}/docs/plans/*.md`, `{service}/docs/superpowers/plans/*.md`
- `{service}/docs/superpowers/specs/*.md`

These are living pipeline artifacts. Do not create todos for their removal.

## Step 7: Delegate to superpowers

Invoke the `superpowers:requesting-code-review` skill. Pass:

- The review target (PR number, branch, or doc path).
- The full agent roster from Step 3 (so superpowers spawns each in parallel).
- The conditional migration agents from Step 5 (if applicable).
- The `<focus_context>` block from Step 2 (multi-service mode).
- The "protected artifacts" rule from Step 6 (so superpowers filters discardable findings).
- Always-on agents to include alongside the roster:
  - `agent-native-reviewer` — verifies new features are agent-accessible

Note: this command does **NOT** spawn `learnings-researcher` (deleted in v3.0.0) and does NOT read `docs/solutions/` (knowledge-compounding pattern dropped).

## Step 8: Synthesis & Todos

The superpowers skill handles parallel agent execution and findings collection. After it returns, use the `file-todos` skill to create one todo file per finding under `todos/`, using the standard naming `{issue_id}-pending-{priority}-{description}.md`.

If the user prefers an inline summary instead of todo files, surface findings in a categorized list (P1/P2/P3) without writing files.

## Step 9: Browser Test Offer (Optional)

After synthesis, offer browser testing via `AskUserQuestion`:

> "Want to run browser tests on the affected pages?"
> 1. Yes — run `/test-browser`
> 2. No — skip

If the user accepts, spawn a sub-agent to run `/test-browser` for the PR. The sub-agent uses the `agent-browser` skill to capture snapshots and check for console errors.

## Output

Summarize:
- PR/branch reviewed.
- Number of P1/P2/P3 findings.
- Path to todos/ (if file-todos was used).
- Next-step recommendation (e.g., "Address P1 findings before merging").
