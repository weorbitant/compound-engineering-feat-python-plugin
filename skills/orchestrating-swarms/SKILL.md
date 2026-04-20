---
name: orchestrating-swarms
description: This skill should be used when orchestrating multi-agent swarms using Claude Code's TeammateTool and Task system. It applies when coordinating multiple agents, running parallel code reviews, creating pipeline workflows with dependencies, building self-organizing task queues, or any task benefiting from divide-and-conquer patterns.
model: opus
disable-model-invocation: true
---

# Claude Code Swarm Orchestration

Master multi-agent orchestration using Claude Code's `TeammateTool` and `Task` system.

## Primitives

| Primitive | What It Is | File Location |
|-----------|-----------|---------------|
| **Agent** | A Claude instance that can use tools. You are an agent. | N/A (process) |
| **Team** | Named group of agents. One leader, multiple teammates. | `~/.claude/teams/{name}/config.json` |
| **Teammate** | Agent that joined a team. Has a name, color, inbox. | Listed in team config |
| **Leader** | Agent that created the team. Approves plans/shutdowns. | First member |
| **Task** | Work item with subject, status, owner, dependencies. | `~/.claude/tasks/{team}/N.json` |
| **Inbox** | JSON file where an agent receives messages. | `~/.claude/teams/{name}/inboxes/{agent}.json` |
| **Message** | JSON object sent between agents — text or structured (shutdown, idle, join, plan approval). | Inside inboxes |
| **Backend** | How teammates run. Auto-detected: `in-process`, `tmux`, `iterm2`. | Per-member in config |

## Lifecycle

```
1. Create Team → 2. Create Tasks → 3. Spawn Teammates → 4. Work → 5. Coordinate → 6. Shutdown → 7. Cleanup
```

Messages flow Leader ↔ Teammates via inbox files. Tasks auto-unblock when dependencies complete.

## When to use which pattern

| Need | Pattern | File |
|------|---------|------|
| Multiple specialists review same artifact | Parallel Specialists | [references/patterns.md](./references/patterns.md) |
| Sequential stages with dependencies | Pipeline | [references/patterns.md](./references/patterns.md) |
| Many independent tasks, self-balancing | Swarm | [references/patterns.md](./references/patterns.md) |
| Research result drives implementation | Research + Implementation | [references/patterns.md](./references/patterns.md) |
| Require approval before implementation | Plan Approval | [references/patterns.md](./references/patterns.md) |
| Coordinated multi-file refactor | Coordinated Refactoring | [references/patterns.md](./references/patterns.md) |

## Reference files

- [references/architecture.md](./references/architecture.md) — File layout, config schema, env vars
- [references/spawning.md](./references/spawning.md) — Task vs Teammate spawning, built-in & plugin agent types
- [references/teammate-operations.md](./references/teammate-operations.md) — All 13 `Teammate()` operations
- [references/task-system.md](./references/task-system.md) — `TaskCreate`, `TaskUpdate`, dependencies, pipelines
- [references/message-formats.md](./references/message-formats.md) — Structured message JSON (shutdown, idle, plan, join, permission)
- [references/patterns.md](./references/patterns.md) — Six orchestration patterns with code
- [references/workflows.md](./references/workflows.md) — Three complete end-to-end workflows
- [references/backends.md](./references/backends.md) — in-process vs tmux vs iterm2, auto-detection, forcing, troubleshooting
- [references/error-handling.md](./references/error-handling.md) — Common errors, graceful shutdown, crash recovery, debugging

## Best Practices

1. **Always cleanup.** Don't leave orphaned teams. Call `cleanup` when done.
2. **Meaningful names.** `security-reviewer` over `worker-1`.
3. **Clear prompts.** Spell out steps: read X, do Y, send findings via `Teammate write`.
4. **Use dependencies.** `addBlockedBy` beats manual polling.
5. **Check inboxes.** `cat ~/.claude/teams/{team}/inboxes/team-lead.json | jq`.
6. **Handle failures.** 5-min heartbeat timeout; build retry logic in worker prompts.
7. **Prefer `write` over `broadcast`.** Broadcast sends N messages for N teammates.
8. **Match agent type to task.** `Explore` for search, `Plan` for design, `general-purpose` for implementation, specialized reviewers for review.

## Quick Reference

```javascript
// Subagent (no team)
Task({ subagent_type: "Explore", description: "Find files", prompt: "..." })

// Team + teammate
Teammate({ operation: "spawnTeam", team_name: "my-team" })
Task({ team_name: "my-team", name: "worker", subagent_type: "general-purpose", prompt: "...", run_in_background: true })

// Message
Teammate({ operation: "write", target_agent_id: "worker-1", value: "..." })

// Task pipeline
TaskCreate({ subject: "Step 1", description: "..." })
TaskCreate({ subject: "Step 2", description: "..." })
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })

// Shutdown
Teammate({ operation: "requestShutdown", target_agent_id: "worker-1" })
// Wait for approval...
Teammate({ operation: "cleanup" })
```

*Based on Claude Code v2.1.19.*
