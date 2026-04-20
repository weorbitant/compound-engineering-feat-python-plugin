---
name: git-worktree
description: This skill manages Git worktrees for isolated parallel development. It handles creating, listing, switching, and cleaning up worktrees with a simple interactive interface, following KISS principles.
model: sonnet
---

# Git Worktree Manager

Unified interface for Git worktrees — isolated parallel development via a single manager script.

## What this skill does

- Create worktrees from a base branch (default `main`)
- List, switch, cleanup
- Auto-manages `.gitignore` for `.worktrees/`
- Auto-copies `.env*` files from main repo

## CRITICAL: Always use the manager script

**NEVER call `git worktree add` directly.** The script handles setup raw git doesn't:

1. Copies `.env`, `.env.local`, `.env.test`, etc.
2. Ensures `.worktrees` is in `.gitignore`
3. Creates consistent directory structure

```bash
# ✅ CORRECT
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh create feature-name

# ❌ WRONG
git worktree add .worktrees/feature-name -b feature-name main
```

## When to use

1. **Code review (`/workflows:review`)** — if not on target branch, offer worktree for isolated review
2. **Feature work (`/workflows:work`)** — always ask: new branch or parallel worktree
3. **Parallel development** — multiple features simultaneously
4. **Cleanup** — after completing work

## Quick Reference

```bash
# Create (copies .env files)
worktree-manager.sh create feature-login

# List
worktree-manager.sh list

# Switch
worktree-manager.sh switch feature-login

# Copy env to existing
worktree-manager.sh copy-env feature-login

# Cleanup (interactive)
worktree-manager.sh cleanup
```

Prefix all with `bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/`.

Full command reference, troubleshooting, and technical details → [references/commands.md](./references/commands.md).

Script: [scripts/worktree-manager.sh](./scripts/worktree-manager.sh)

## Workflow integration

### `/workflows:review`
1. Check current branch
2. If already on target → stay, no worktree
3. If different → offer worktree: `"Use worktree for isolated review? (y/n)"`

### `/workflows:work`
Always ask:
```
1. New branch on current worktree (live work)
2. Worktree (parallel work)
```

## Design Principles

**KISS** — one manager script, sensible defaults, interactive prompts, clear naming.

**Opinionated defaults** — always from `main` unless specified; stored in `.worktrees/`; branch name = worktree name; `.gitignore` auto-managed.

**Safety first** — confirms before creating and before cleanup; won't remove current worktree; clear error messages.
