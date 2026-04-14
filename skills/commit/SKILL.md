---
name: commit
description: Analyze changes, group into logical units, and create conventional commits with gitmoji. Use when committing code changes.
allowed-tools: Bash, Read, Grep, Glob, AskUserQuestion
user-invocable: true
---

# Commit Skill

Analyze all uncommitted changes, group them into logical commit units, and create conventional
commits with gitmoji emojis — balancing atomicity with density.

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

Breaking changes: `feat(auth)!: 💥 remove legacy token format`

### Subject Line — Type-to-Emoji Mapping

Use EXACTLY one emoji per subject line, determined by the commit type:

| Type       | Emoji | When to use                            |
|------------|-------|----------------------------------------|
| `feat`     | ✨    | New feature or functionality           |
| `fix`      | 🐛    | Bug fix                                |
| `fix`      | 🚑️   | Critical hotfix                        |
| `refactor` | ♻️    | Code restructuring, no behavior change |
| `test`     | ✅    | Add or update tests                    |
| `docs`     | 📝    | Documentation changes                  |
| `style`    | 🎨    | Formatting, structure improvements     |
| `perf`     | ⚡️   | Performance improvement                |
| `chore`    | 🔧    | Config, tooling, maintenance           |
| `ci`       | 👷    | CI/CD changes                          |
| `build`    | 📦️   | Build system or dependencies           |
| `revert`   | ⏪️   | Revert a previous commit               |

### Body Line Emojis

Body lines are NOT limited to the table above. Pick any emoji that best describes the change:

| Emoji | Meaning                            |
|-------|------------------------------------|
| 🔥    | Remove code or files               |
| ➕    | Add a dependency                   |
| ➖    | Remove a dependency                |
| ⬆️    | Upgrade dependency                 |
| ⬇️    | Downgrade dependency               |
| 📌    | Pin dependency version             |
| 🚚    | Move or rename files               |
| 🏷️    | Add or update types                |
| 💡    | Add comments                       |
| ⚰️    | Remove dead code                   |
| 🥅    | Catch errors                       |
| 🗃️    | Database changes                   |
| 🔊    | Add logs                           |
| 🔇    | Remove logs                        |
| 🙈    | Update .gitignore                  |
| 🩹    | Simple non-critical fix            |
| 👔    | Business logic                     |
| 🦺    | Validation code                    |
| 🧱    | Infrastructure                     |
| 🔒️   | Security fix                       |
| 🛂    | Auth/permissions                   |
| 🌱    | Seed files                         |
| 🔨    | Development scripts                |
| 🚨    | Fix linter warnings                |
| 💚    | Fix CI build                       |
| 🧪    | Add a failing test                 |
| 🩺    | Healthcheck                        |
| 🤡    | Mock things                        |
| 👽️   | Update due to external API changes |
| 🧵    | Threading/concurrency              |
| 💥    | Breaking change                    |
| 🚀    | Deploy                             |
| 💄    | UI and style                       |
| 🔐    | Secrets                            |
| 📈    | Analytics/tracking                 |
| 🌐    | Internationalization               |
| ✏️    | Fix typos                          |

Any other emoji that clearly describes the change is also valid.

### Body Policy

- **Single file or self-explanatory change** — subject line only, no body.
- **Multi-file or non-obvious change** — bullet list in body, each line prefixed with an emoji.

## Step-by-step Procedure

Follow these steps exactly in order. Do NOT skip steps.

### Step 1: Scan all changes

Run these commands to understand the current state:

```bash
git status
```

```bash
git diff
```

```bash
git diff --cached
```

```bash
git log --oneline -5
```

Collect:
- All modified, added, deleted, and untracked files
- The content of each change (diff)
- The last few commits (for amend decisions)

If there are no changes at all, report:
> "No changes to commit."
and stop.

### Step 2: Group changes into logical commit units

Analyze all changes and group them using these rules (in priority order):

1. **Same feature** — Files that belong to the same feature go together. A new view, its URL
   config, its serializer, and its tests are one commit.
2. **Same concern** — Pure config changes group together. Pure test additions group together.
   Migrations group with their model changes.
3. **File proximity** — Files in the same directory/module are likely related.
4. **Import analysis** — If file A imports from file B and both changed, they probably belong
   together.

**Edge cases:**
- Single file changed → skip to step 3 with one group, no grouping prompt needed.
- All files clearly related → propose one commit, no splitting.
- Can't determine grouping → ask the user.

Present the groups to the user:

```
Group 1 → feat(auth): ✨ add login endpoint
  - src/auth/views.py (new)
  - src/auth/urls.py (modified)
  - tests/auth/test_login.py (new)

Group 2 → chore: 🔧 update pre-commit config
  - .pre-commit-config.yaml (modified)

Commit group 1 first? [Y/n/edit]
```

Wait for confirmation before proceeding.

### Step 3: For each group, determine scope

Auto-detect the scope from file paths:

- Changes in `src/<app>/<module>/` → scope is `<module>`.
- Changes spanning multiple directories with a clear common parent → use the parent.
- Changes spanning unrelated directories → **ask the user**.
- Config/root-level files (pyproject.toml, .pre-commit-config.yaml, etc.) → no scope.

### Step 4: For each group, determine type

Infer the commit type from the nature of the changes:

- New files with business logic → `feat`
- Modified files fixing a bug → `fix`
- Only test files → `test`
- Only documentation → `docs`
- Restructuring without behavior change → `refactor`
- Config/tooling files → `chore`
- CI/CD files → `ci`
- Dependency changes → `build`
- Performance-focused changes → `perf`
- Formatting only → `style`

If ambiguous, ask the user.

### Step 5: Check for amend opportunity

Compare against the last commit. Propose amending if ALL of these are true:

- The last commit has the **same type and scope** as the current group.
- The last commit has **NOT been pushed** to remote (`git log --oneline @{u}..HEAD` shows it).
- The new changes **extend the same logical unit** (e.g., forgot a file, fixed a typo).

If amending, tell the user:
> "Last commit was `feat(auth): ✨ add login endpoint` — these changes extend it. Amend? [Y/n]"

When amending, update the body to include the new changes.

If any condition is not met, create a new commit.

### Step 6: Preview the commit message

Show the full commit message and file list:

```
feat(auth): ✨ add login endpoint

✅ add login view with JWT token generation
🔧 configure auth URLs in router
🧪 add tests for login success and failure

Files:
  - src/auth/views.py
  - src/auth/urls.py
  - tests/auth/test_login.py
```

Wait for the user to confirm, edit, or skip.

### Step 7: Stage and commit

Stage only the files in this group:

```bash
git add <file1> <file2> ...
```

Commit (or amend) using a HEREDOC for the message:

```bash
git commit -m "$(cat <<'EOF'
feat(auth): ✨ add login endpoint

✅ add login view with JWT token generation
🔧 configure auth URLs in router
🧪 add tests for login success and failure
EOF
)"
```

Or if amending:

```bash
git commit --amend -m "$(cat <<'EOF'
<updated message>
EOF
)"
```

### Step 8: Handle pre-commit hooks

If a pre-commit hook runs during `git commit`:

- **If the commit succeeds** → move on.
- **If the commit fails due to pre-commit hook** →
  1. Read the output to identify what failed.
  2. Auto-stage any auto-fixes (formatting, imports, etc.).
  3. Create a **new** commit with the same message (NOT amend — the original commit didn't
     happen, so there's nothing to amend).
  4. If it fails again, show the errors and ask the user what to do.

IMPORTANT: Never skip pre-commit hooks with `--no-verify`.

### Step 9: Next group or finish

If there are more groups, go back to step 3 for the next group.

If all groups are committed, show a summary:

```
Done! Created 2 commits:
  abc1234 feat(auth): ✨ add login endpoint
  def5678 chore: 🔧 update pre-commit config
```

## What This Skill Does NOT Do

- Push to remote
- Create branches
- Run tests

## Balance Principle

- One commit per logical unit of work — not per file, not per keystroke.
- A "logical unit" is something you'd want to revert as a whole.
- If two changes need different verbs ("add X" and "fix Y"), they're separate commits.
- If they're described together ("add login with tests and config"), one commit.
- Prefer fewer meaningful commits over many tiny ones.
