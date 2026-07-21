# File-Todos Workflows

## Creating a New Todo

1. Determine next issue ID: `ls todos/ | grep -o '^[0-9]\+' | sort -n | tail -1`
2. Copy template: `cp assets/todo-template.md todos/{NEXT_ID}-pending-{priority}-{description}.md`
3. Fill required sections: Problem Statement, Findings, Proposed Solutions, Acceptance Criteria, initial Work Log entry.
4. Status: `pending` (needs triage) or `ready` (pre-approved).
5. Add tags for filtering.

**When to create a todo:**
- More than 15-20 minutes of work
- Needs research / planning / multiple approaches
- Has dependencies on other work
- Needs manager approval or prioritization
- Part of a larger feature or refactor
- Technical debt needing documentation

**When to act immediately:**
- Trivial (< 15 minutes)
- Full context available now
- No planning needed
- User explicitly requests immediate action
- Simple bug fix with obvious solution

## Triaging Pending Items

1. List pending: `ls todos/*-pending-*.md`
2. For each: read Problem Statement + Findings + Proposed Solutions; decide approve/defer/modify priority
3. For approved:
   - Rename: `mv {id}-pending-{pri}-{desc}.md {id}-ready-{pri}-{desc}.md`
   - Frontmatter: `status: pending` → `status: ready`
   - Fill "Recommended Action"
   - Adjust priority if needed
4. Deferred stay `pending`.

Use `/triage` for interactive approval.

## Managing Dependencies

```yaml
dependencies: ["002", "005"]  # blocked by 002 and 005
dependencies: []               # no blockers
```

Commands:
```bash
# What blocks a todo?
grep "^dependencies:" todos/003-*.md

# What does this todo block?
grep -l 'dependencies:.*"002"' todos/*.md

# Verify blockers before starting
for dep in 001 002 003; do
  ls todos/${dep}-complete-*.md >/dev/null 2>&1 || echo "Issue $dep not complete"
done
```

## Updating Work Logs

```markdown
### YYYY-MM-DD - Session Title

**By:** Claude Code / Developer Name

**Actions:**
- Specific changes (file:line references)
- Commands executed
- Tests run
- Results of investigation

**Learnings:**
- What worked / didn't
- Patterns discovered
- Key insights for future work
```

Work logs serve as: historical record, documentation of attempts, knowledge sharing, future context.

## Completing a Todo

1. Verify all acceptance criteria checked
2. Add final Work Log entry with results
3. Rename: `mv {id}-ready-{pri}-{desc}.md {id}-complete-{pri}-{desc}.md`
4. Frontmatter: `status: ready` → `status: complete`
5. Check for unblocked work: `grep -l 'dependencies:.*"002"' todos/*-ready-*.md`
6. Commit: `feat: resolve issue 002`

## Quick Reference Commands

**Finding work:**
```bash
# Highest priority unblocked
grep -l 'dependencies: \[\]' todos/*-ready-p1-*.md

# Pending items
ls todos/*-pending-*.md

# Next issue ID
ls todos/ | grep -o '^[0-9]\+' | sort -n | tail -1 | awk '{printf "%03d", $1+1}'

# Count by status
for s in pending ready complete; do
  echo "$s: $(ls -1 todos/*-$s-*.md 2>/dev/null | wc -l)"
done
```

**Search:**
```bash
grep -l "tags:.*django" todos/*.md   # by tag
ls todos/*-p1-*.md                    # by priority
grep -r "payment" todos/              # full-text
```
