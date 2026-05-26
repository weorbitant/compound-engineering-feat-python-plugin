# Compounding Engineering Plugin Development

## Versioning Requirements

**IMPORTANT**: Every change to this plugin MUST include updates to all three files:

1. **`.claude-plugin/plugin.json`** - Bump version using semver
2. **`CHANGELOG.md`** - Document changes using Keep a Changelog format
3. **`README.md`** - Verify/update component counts and tables

### Version Bumping Rules

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, major reorganization
- **MINOR** (1.0.0 → 1.1.0): New agents, commands, or skills
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, doc updates, minor improvements

### Pre-Commit Checklist

Before committing ANY changes:

- [ ] Version bumped in `.claude-plugin/plugin.json`
- [ ] CHANGELOG.md updated with changes
- [ ] README.md component counts verified
- [ ] README.md tables accurate (agents, commands, skills)
- [ ] plugin.json description matches current counts

### Directory Structure

```
agents/
├── review/     # Code review agents
├── research/   # Research and analysis agents
├── design/     # Design and UI agents
├── workflow/   # Workflow automation agents
└── docs/       # Documentation agents

commands/
├── workflows/  # Core workflow commands (workflows:plan, workflows:review, etc.)
└── *.md        # Utility commands

skills/
└── *.md        # All skills at root level
```

## Command Naming Convention

**Workflow commands** use `workflows:` prefix to avoid collisions with built-in commands:
- `/workflows:plan` - Create implementation plans
- `/workflows:review` - Run comprehensive code reviews
- `/workflows:work` - Execute work items systematically

**Why `workflows:`?** Claude Code has built-in `/plan` and `/review` commands. Using `name: workflows:plan` in frontmatter creates a unique `/workflows:plan` command with no collision.

## Skill Compliance Checklist

When adding or modifying skills, verify compliance with skill-creator spec:

### YAML Frontmatter (Required)

- [ ] `name:` present and matches directory name (lowercase-with-hyphens)
- [ ] `description:` present and describes **what it does and when to use it** (per official spec: "Explains code with diagrams. Use when exploring how code works.")

### Reference Links (Required if references/ exists)

- [ ] All files in `references/` are linked as `[filename.md](./references/filename.md)`
- [ ] All files in `assets/` are linked as `[filename](./assets/filename)`
- [ ] All files in `scripts/` are linked as `[filename](./scripts/filename)`
- [ ] No bare backtick references like `` `references/file.md` `` - use proper markdown links

### Writing Style

- [ ] Use imperative/infinitive form (verb-first instructions)
- [ ] Avoid second person ("you should") - use objective language ("To accomplish X, do Y")

### Quick Validation Command

```bash
# Check for unlinked references in a skill
grep -E '`(references|assets|scripts)/[^`]+`' skills/*/SKILL.md
# Should return nothing if all refs are properly linked

# Check description format - should describe what + when
grep -E '^description:' skills/*/SKILL.md
```

## Microservice Mode

This plugin supports multi-service monorepos via an opt-in microservice mode.

### Activation

1. Pass `--services service-a,service-b` to any workflow command, OR let the Focus Gate auto-detect services via `Glob("*/pyproject.toml")`
2. Include `services:` YAML in plan frontmatter for dependency-aware execution

Without these, all workflows behave identically to single-service mode.

### Focus Context Propagation

When spawning sub-agents via Task tool, include a standardized `<focus_context>` block:

```
<focus_context>
  services: service-a (./service-a), service-b (./service-b)
  dependencies:
    - service-a depends on lib-common (shared DTOs)
</focus_context>
```

All commands and skills MUST include this block when spawning sub-agents to prevent focus loss in nested delegation chains. The full Focus Gate protocol and `<focus_context>` template now live in the `microservice-focus` skill. Workflow commands invoke that skill once instead of inlining the logic.

### Pipeline Mode

All workflow commands accept `--services` argument for automated invocation:
- `/workflows:brainstorm --services service-a,service-b "feature description"`
- When services are provided as arguments, skip the focus gate entirely
- When invoked from an automated workflow, skip all AskUserQuestion calls

### Doc Output in Multi-Service Mode

| Doc Type | Single Service | Cross-Service |
|----------|---------------|---------------|
| Specs | `docs/superpowers/specs/...` | `{service}/docs/superpowers/specs/...` per service |
| Plans | `docs/superpowers/plans/...` (or `{service}/docs/superpowers/plans/...`) | Root overview at `docs/superpowers/plans/...` + per-service plan files |

## Workflow Skills Configuration

Projects can inject additional skills into any workflow command via `compound-engineering.local.md`. Add a `workflow_skills` key to the YAML frontmatter:

```yaml
---
workflow_skills:
  brainstorm: [django-patterns, holafly-domain]
  plan: [django-patterns]
  work: [django-patterns, pytest-patterns]
  review: [django-patterns, pytest-patterns]
---
```

Skills are **additive** — loaded alongside each command's built-in skills. Missing keys or empty lists mean no additional skills for that workflow. Run `/setup` to configure interactively, or edit the YAML directly.

Project-local skills in `.claude/skills/` can also be listed here by name.

## Interaction Style

- Do NOT be a yes-man. If the user's idea is wrong, say so clearly and explain why.
- Challenge assumptions — propose better alternatives when you see them.
- If the user asks for something that will cause problems (bad architecture, wrong pattern, fragile code), push back before implementing.
- Be direct and honest, even if it means disagreeing. A wrong decision caught early saves hours of rework.

