---
name: create-agent-skills
description: Expert guidance for creating Claude Code skills and slash commands. Use when working with SKILL.md files, authoring new skills, improving existing skills, creating slash commands, or understanding skill structure and best practices.
model: opus
---

# Creating Skills & Commands

Authoring guide for Claude Code skills following the [official spec](https://code.claude.com/docs/en/skills).

## Commands and Skills Are The Same Thing

Custom slash commands have been merged into skills. `.claude/commands/review.md` and `.claude/skills/review/SKILL.md` both create `/review`. If both exist with the same name, the **skill takes precedence**.

**Command file** (`commands/name.md`): simple, single-file workflow, no supporting files, task-oriented (deploy, commit, triage).

**Skill directory** (`skills/name/SKILL.md`): supporting files (references/scripts/assets), background knowledge Claude should auto-load, complex enough for progressive disclosure.

Both use the same YAML frontmatter and markdown format.

## Frontmatter Reference

All fields optional; only `description` is recommended.

| Field | Description |
|-------|-------------|
| `name` | Display name. Lowercase letters, numbers, hyphens (max 64). Defaults to dir name. |
| `description` | What + when. Used for auto-discovery. Max 1024 chars. |
| `argument-hint` | Autocomplete hint. Ex: `[issue-number]` |
| `disable-model-invocation` | `true` → only user can invoke. Use for side-effect workflows (`/deploy`, `/commit`). |
| `user-invocable` | `false` → hidden from `/` menu. Use for background knowledge. |
| `allowed-tools` | Pre-approved tools. Ex: `Read, Bash(git *)` |
| `model` | `haiku` / `sonnet` / `opus` |
| `effort` | `low` / `medium` / `high` / `xhigh` / `max` |
| `context` | `fork` → run in isolated subagent context |
| `agent` | Subagent type when `context: fork` (`Explore`, `Plan`, `general-purpose`, custom) |
| `paths` | Glob(s) that gate auto-activation |
| `hooks` | Skill-scoped lifecycle hooks |

### Invocation control

| Frontmatter | User | Claude | Loaded when |
|-------------|------|--------|-------------|
| (default) | Yes | Yes | Description always in context; body on invocation |
| `disable-model-invocation: true` | Yes | No | Only when user invokes |
| `user-invocable: false` | No | Yes | Description always in context; body when relevant |

## Dynamic Features

- **Arguments:** `$ARGUMENTS`, `$ARGUMENTS[N]`, shorthand `$0`, `$1`. If `$ARGUMENTS` not in content, args appended automatically.
- **Dynamic context injection:** `` !`command` `` runs the shell command before Claude sees content, and the output is inserted inline (e.g. `!\`gh pr diff\``).
- **Fork context:** `context: fork` + `agent: Explore` runs the skill as a subagent prompt — no conversation history.

## Progressive Disclosure

Keep SKILL.md under 500 lines. Split detailed content:

```
my-skill/
├── SKILL.md           # Entry (required): overview + navigation
├── references/
│   └── spec.md        # Detailed docs (loaded when needed)
├── assets/
│   └── template.md    # Templates / examples
└── scripts/
    └── helper.py      # Executed, not loaded
```

Link from SKILL.md: `See [references/spec.md](./references/spec.md).` Keep references **one level deep**.

## What Would You Like To Do?

1. **Create new skill** → [workflows/create-new-skill.md](./workflows/create-new-skill.md)
2. **Create new command** → [workflows/simple-skill.md](./workflows/simple-skill.md)
3. **Create router skill (delegates to sub-workflows)** → [workflows/router-skill.md](./workflows/router-skill.md)
4. **Audit existing skill** → [workflows/audit-skill.md](./workflows/audit-skill.md)
5. **Add component** — reference / script / template / workflow:
   - [workflows/add-reference.md](./workflows/add-reference.md)
   - [workflows/add-script.md](./workflows/add-script.md)
   - [workflows/add-template.md](./workflows/add-template.md)
   - [workflows/add-workflow.md](./workflows/add-workflow.md)
6. **Upgrade to router** → [workflows/upgrade-to-router.md](./workflows/upgrade-to-router.md)
7. **Verify a skill works** → [workflows/verify-skill.md](./workflows/verify-skill.md)
8. **Get guidance** → [workflows/get-guidance.md](./workflows/get-guidance.md)
9. **Create domain expertise skill** → [workflows/create-domain-expertise-skill.md](./workflows/create-domain-expertise-skill.md)

## Effective Descriptions

Include both **what** and **when**.

Good: `Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDFs, forms, or document extraction.`

Bad: `Helps with documents.`

## Audit Checklist

- [ ] YAML frontmatter (name + description)
- [ ] Description includes trigger keywords and is specific
- [ ] Standard markdown headings (not XML tags)
- [ ] SKILL.md under 500 lines
- [ ] `disable-model-invocation: true` if it has side effects
- [ ] `allowed-tools` set if specific tools needed
- [ ] References one level deep, properly linked
- [ ] Examples are concrete, not abstract
- [ ] `model` set (haiku / sonnet / opus)
- [ ] Tested with real usage

## Anti-Patterns

- **XML tags in body** — use standard markdown headings
- **Vague descriptions** — be specific with trigger keywords
- **Deep nesting** — keep references one level from SKILL.md
- **Missing invocation control** — side-effect workflows need `disable-model-invocation: true`
- **Too many options** — provide a default with escape hatch
- **Punting to Claude** — scripts should handle errors explicitly

## Reference Files

**Spec & fundamentals**
- [references/official-spec.md](./references/official-spec.md)
- [references/best-practices.md](./references/best-practices.md)
- [references/core-principles.md](./references/core-principles.md)
- [references/skill-structure.md](./references/skill-structure.md)
- [references/recommended-structure.md](./references/recommended-structure.md)
- [references/be-clear-and-direct.md](./references/be-clear-and-direct.md)

**Patterns & techniques**
- [references/common-patterns.md](./references/common-patterns.md)
- [references/iteration-and-testing.md](./references/iteration-and-testing.md)
- [references/workflows-and-validation.md](./references/workflows-and-validation.md)
- [references/executable-code.md](./references/executable-code.md)
- [references/using-scripts.md](./references/using-scripts.md)
- [references/using-templates.md](./references/using-templates.md)
- [references/api-security.md](./references/api-security.md)

## Sources

- [Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [anthropics/skills](https://github.com/anthropics/skills)
