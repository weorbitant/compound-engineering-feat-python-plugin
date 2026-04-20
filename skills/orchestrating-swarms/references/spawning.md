# Spawning Agents

## Two Ways to Spawn

### Method 1: Task Tool (Subagents)

For **short-lived, focused work** that returns a result:

```javascript
Task({
  subagent_type: "Explore",
  description: "Find auth files",
  prompt: "Find all authentication-related files in this codebase",
  model: "haiku"
})
```

Runs synchronously (or async with `run_in_background: true`), returns result directly, no team membership.

### Method 2: Task Tool + team_name + name (Teammates)

For **persistent teammates** in a team:

```javascript
Teammate({ operation: "spawnTeam", team_name: "my-project" })

Task({
  team_name: "my-project",
  name: "security-reviewer",
  subagent_type: "security-sentinel",
  prompt: "Review all authentication code. Send findings to team-lead via Teammate write.",
  run_in_background: true
})
```

Joins team, communicates via inbox, can claim tasks, persists until shutdown.

### Comparison

| Aspect | Task (subagent) | Task + team_name + name (teammate) |
|--------|-----------------|-----------------------------------|
| Lifespan | Until task complete | Until shutdown requested |
| Communication | Return value | Inbox messages |
| Task access | None | Shared task list |
| Team membership | No | Yes |
| Coordination | One-off | Ongoing |

## Built-in Agent Types

| Type | Tools | Model | Best For |
|------|-------|-------|----------|
| `Bash` | Bash only | Inherit | Git operations, shell tasks |
| `Explore` | Read-only (no Edit/Write/Task) | Haiku | Codebase exploration, searches. Thoroughness: "quick", "medium", "very thorough" |
| `Plan` | Read-only | Inherit | Architecture planning |
| `general-purpose` | All (*) | Inherit | Multi-step tasks |
| `claude-code-guide` | Read-only + WebFetch/WebSearch | Inherit | Claude Code / API questions |
| `statusline-setup` | Read, Edit | Sonnet | Status line config |

Example:
```javascript
Task({ subagent_type: "Explore", description: "Find API endpoints", prompt: "...", model: "haiku" })
```

## Plugin Agent Types (compound-engineering)

### Review agents
`agent-native-reviewer`, `architecture-strategist`, `code-simplicity-reviewer`, `data-integrity-guardian`, `data-migration-expert`, `deployment-verification-agent`, `python-style-reviewer`, `python-typing-reviewer`, `pattern-recognition-specialist`, `performance-oracle`, `security-sentinel`

### Research agents
`best-practices-researcher`, `framework-docs-researcher`, `git-history-analyzer`, `learnings-researcher`, `repo-research-analyst`

### Design / Workflow
`figma-design-sync`, `bug-reproduction-validator`

Invoke with full namespaced prefix:
```javascript
Task({
  subagent_type: "compound-engineering:review:security-sentinel",
  description: "Security audit",
  prompt: "Audit this PR for security vulnerabilities"
})
```
