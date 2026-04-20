---
name: commit
description: Analyze changes, group into logical units, and create conventional commits with gitmoji. Use when committing code changes.
model: sonnet
allowed-tools: Bash, Read, Grep, Glob, AskUserQuestion
user-invocable: true
---

# Commit Skill

Analyze all uncommitted changes, group them into logical commit units, and create conventional commits with gitmoji — balancing atomicity with density.

## Usage

```
/commit
```

## Commit Format

```
<type>(<scope>): <emoji> <description>

<optional body>
<emoji> <change description>
<emoji> <change description>
```

Breaking change: `feat(auth)!: 💥 remove legacy token format`

Full emoji table (subject + body): [references/emoji-table.md](./references/emoji-table.md).

## Body policy

- **Single file or self-explanatory change** → subject line only, no body.
- **Multi-file or non-obvious change** → bullet list, each line prefixed with an emoji.

## Procedure

### Step 1 — Scan

```bash
git status
git diff
git diff --cached
git log --oneline -5
```

If no changes, report `"No changes to commit."` and stop.

### Step 2 — Group into logical units

Priority rules:
1. **Same feature** — view + URL + serializer + tests = one commit.
2. **Same concern** — pure config together; pure tests together; migrations with models.
3. **File proximity** — same directory/module likely related.
4. **Import analysis** — A imports from B and both changed → probably together.

Edge cases: single file → one group, no prompt. All related → one commit. Can't decide → ask user.

Present groups and wait for confirmation:

```
Group 1 → feat(auth): ✨ add login endpoint
  - src/auth/views.py (new)
  - src/auth/urls.py (modified)
  - tests/auth/test_login.py (new)

Group 2 → chore: 🔧 update pre-commit config
  - .pre-commit-config.yaml (modified)

Commit group 1 first? [Y/n/edit]
```

### Step 3 — Scope per group

Auto-detect:
- `src/<app>/<module>/` → scope `<module>`
- Multiple dirs with common parent → use parent
- Unrelated dirs → ask user
- Root-level config files → no scope

### Step 4 — Type per group

- New business logic → `feat`
- Bug fix → `fix`
- Only tests → `test`
- Only docs → `docs`
- Restructuring → `refactor`
- Config/tooling → `chore`
- CI/CD → `ci`
- Dependencies → `build`
- Performance → `perf`
- Formatting only → `style`

Ambiguous → ask.

### Step 5 — Amend check

Propose `--amend` only if ALL:
- Last commit has **same type and scope**
- Last commit **NOT pushed** (`git log --oneline @{u}..HEAD` shows it)
- Changes **extend the same logical unit**

Ask: *"Last commit was `feat(auth): ✨ add login endpoint` — these changes extend it. Amend? [Y/n]"*

When amending, update the body to include new changes.

### Step 6 — Preview

Show full message + file list. Wait for confirm/edit/skip.

### Step 7 — Stage and commit

```bash
git add <file1> <file2> ...

git commit -m "$(cat <<'EOF'
feat(auth): ✨ add login endpoint

✅ add login view with JWT token generation
🔧 configure auth URLs in router
🧪 add tests for login success and failure
EOF
)"
```

Amend variant uses `git commit --amend -m "$(cat <<'EOF' ... EOF)"`.

### Step 8 — Pre-commit hooks

If the hook fails:
1. Read output, identify failure
2. Auto-stage any auto-fixes (formatting, imports)
3. Create a **new** commit with the same message — NOT amend (original commit didn't happen)
4. If it fails again, show errors and ask user

**NEVER** skip hooks with `--no-verify`.

### Step 9 — Next group or finish

More groups → back to Step 3. All done → summary:

```
Done! Created 2 commits:
  abc1234 feat(auth): ✨ add login endpoint
  def5678 chore: 🔧 update pre-commit config
```

## What this skill does NOT do

- Push to remote
- Create branches
- Run tests

## Balance Principle

- One commit per logical unit — not per file, not per keystroke.
- A "logical unit" is something you'd revert as a whole.
- Different verbs ("add X" and "fix Y") → separate commits.
- Described together ("add login with tests and config") → one commit.
- Prefer fewer meaningful commits over many tiny ones.
