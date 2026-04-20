# Complete Workflows

## Workflow 1: Full Code Review with Parallel Specialists

```javascript
// Setup
Teammate({ operation: "spawnTeam", team_name: "pr-review-123", description: "Reviewing PR #123" })

// Spawn reviewers in parallel — single message, multiple Task calls
Task({
  team_name: "pr-review-123",
  name: "security",
  subagent_type: "compound-engineering:review:security-sentinel",
  prompt: `Review PR #123 for security. Focus on: SQL injection, XSS, auth bypass, sensitive data exposure.
    Send findings via: Teammate({ operation: "write", target_agent_id: "team-lead", value: "..." })`,
  run_in_background: true
})

Task({
  team_name: "pr-review-123",
  name: "perf",
  subagent_type: "compound-engineering:review:performance-oracle",
  prompt: `Review PR #123 for performance. Focus on: N+1 queries, missing indexes, memory leaks, inefficient algorithms. Send findings.`,
  run_in_background: true
})

Task({
  team_name: "pr-review-123",
  name: "arch",
  subagent_type: "compound-engineering:review:architecture-strategist",
  prompt: `Review PR #123 for architecture. Focus on: design patterns, SOLID, separation of concerns, testability. Send findings.`,
  run_in_background: true
})

// Monitor inbox, synthesize, shutdown all, cleanup
```

## Workflow 2: Research → Plan → Implement → Test Pipeline

```javascript
Teammate({ operation: "spawnTeam", team_name: "feature-oauth" })

// Pipeline tasks
TaskCreate({ subject: "Research OAuth providers", description: "OAuth2 best practices, compare Google/GitHub/Auth0", activeForm: "Researching..." })
TaskCreate({ subject: "Create implementation plan", activeForm: "Planning..." })
TaskCreate({ subject: "Implement OAuth", activeForm: "Implementing..." })
TaskCreate({ subject: "Write tests", activeForm: "Writing tests..." })
TaskCreate({ subject: "Final review", activeForm: "Final review..." })

TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })
TaskUpdate({ taskId: "3", addBlockedBy: ["2"] })
TaskUpdate({ taskId: "4", addBlockedBy: ["3"] })
TaskUpdate({ taskId: "5", addBlockedBy: ["4"] })

// Specialized workers per stage
Task({ team_name: "feature-oauth", name: "researcher", subagent_type: "compound-engineering:research:best-practices-researcher",
       prompt: "Claim #1, research, complete, send summary.", run_in_background: true })
Task({ team_name: "feature-oauth", name: "planner", subagent_type: "Plan",
       prompt: "Wait for #2. Read #1's findings. Create plan. Send to team-lead.", run_in_background: true })
Task({ team_name: "feature-oauth", name: "implementer", subagent_type: "general-purpose",
       prompt: "Wait for #3. Read plan. Implement. Mark complete.", run_in_background: true })
Task({ team_name: "feature-oauth", name: "tester", subagent_type: "general-purpose",
       prompt: "Wait for #4. Write/run tests. Mark complete with results.", run_in_background: true })
Task({ team_name: "feature-oauth", name: "reviewer", subagent_type: "compound-engineering:review:security-sentinel",
       prompt: "Wait for #5. Final security review. Send assessment.", run_in_background: true })
```

## Workflow 3: Self-Organizing Code Review Swarm

```javascript
Teammate({ operation: "spawnTeam", team_name: "codebase-review" })

const files = [
  "src/users/models.py", "src/payments/models.py",
  "src/users/views.py", "src/payments/views.py",
  "src/payments/services.py", "src/notifications/services.py",
  "src/core/encryption.py"
]

for (const file of files) {
  TaskCreate({
    subject: `Review ${file}`,
    description: `Review ${file} for security, code quality, performance`,
    activeForm: `Reviewing ${file}...`
  })
}

const swarmPrompt = `
You are a swarm worker.

LOOP:
1. TaskList() → find task with status=pending, no owner, not blocked
2. If found:
   - TaskUpdate({ taskId, owner: $CLAUDE_CODE_AGENT_NAME })
   - TaskUpdate({ taskId, status: "in_progress" })
   - Do the review
   - TaskUpdate({ taskId, status: "completed" })
   - Send findings to team-lead via Teammate write
   - Go back to 1
3. If none available:
   - Send idle notification
   - Wait 30s, retry up to 3×
   - Exit
`

// Spawn 3 workers in parallel
Task({ team_name: "codebase-review", name: "worker-1", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })
Task({ team_name: "codebase-review", name: "worker-2", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })
Task({ team_name: "codebase-review", name: "worker-3", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })

// Workers self-organize, load-balance naturally
```
