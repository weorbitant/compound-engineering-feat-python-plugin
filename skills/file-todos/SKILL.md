---
name: file-todos
description: This skill should be used when managing the file-based todo tracking system in the todos/ directory. It provides workflows for creating todos, managing status and dependencies, conducting triage, and integrating with slash commands and code review processes.
model: sonnet
disable-model-invocation: true
---

# File-Based Todo Tracking

Markdown files in `todos/` with YAML frontmatter. Each todo is one markdown file. Detailed workflows and commands: [references/workflows.md](./references/workflows.md).

## When to use

- Creating new todos from findings or feedback
- Managing lifecycle (pending → ready → complete)
- Triaging pending items
- Checking or managing dependencies
- Converting PR comments or code findings into tracked work
- Updating work logs during execution

## File Naming

```
{issue_id}-{status}-{priority}-{description}.md
```

- `issue_id` — sequential `001`, `002`… never reused
- `status` — `pending` (needs triage), `ready` (approved), `complete` (done)
- `priority` — `p1` (critical), `p2` (important), `p3` (nice-to-have)
- `description` — kebab-case

Examples:
```
001-pending-p1-mailer-test.md
002-ready-p1-fix-n-plus-1.md
005-complete-p2-refactor-csv.md
```

## File Structure

Use [assets/todo-template.md](./assets/todo-template.md) as the starting point.

**Required sections:** Problem Statement, Findings, Proposed Solutions, Recommended Action (filled during triage), Acceptance Criteria, Work Log.

**Optional:** Technical Details, Resources, Notes.

**Frontmatter:**
```yaml
---
status: ready              # pending | ready | complete
priority: p1               # p1 | p2 | p3
issue_id: "002"
tags: [django, performance, database]
dependencies: ["001"]      # issue IDs blocking this
---
```

## Common Workflows

Full detail in [references/workflows.md](./references/workflows.md):
- Creating a new todo (when to create vs act immediately)
- Triaging pending items
- Managing dependencies
- Updating work logs
- Completing a todo

## Quick Reference

```bash
# Highest priority unblocked
grep -l 'dependencies: \[\]' todos/*-ready-p1-*.md

# Pending items needing triage
ls todos/*-pending-*.md

# Next issue ID
ls todos/ | grep -o '^[0-9]\+' | sort -n | tail -1 | awk '{printf "%03d", $1+1}'

# What blocks this todo?
grep "^dependencies:" todos/003-*.md
```

More in [references/workflows.md](./references/workflows.md).

## Integration

| Trigger | Flow | Tool |
|---------|------|------|
| Code review | `/workflows:review` → findings → `/triage` → todos | Review agent + skill |
| PR comments | `/resolve-pr-parallel` → individual fixes → todos | gh CLI + skill |
| Code TODOs | `/resolve_todo_parallel` → fixes + complex todos | Agent + skill |
| Planning | Brainstorm → create todo → work → complete | Skill |
| Feedback | Discussion → create → triage → work | Skill + slash |

## Key Distinctions

- **File-todos (this skill):** markdown files in `todos/`, project tracking, used by humans and agents.
- **Application Todo model:** database model (Django/SQLAlchemy), user-facing app feature, ORM CRUD.
- **TodoWrite tool:** in-memory, single conversation, not persisted.

Don't confuse them.
