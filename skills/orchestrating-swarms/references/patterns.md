# Orchestration Patterns

## Pattern 1: Parallel Specialists (Leader Pattern)

Multiple specialists review code simultaneously.

```javascript
Teammate({ operation: "spawnTeam", team_name: "code-review" })

// Spawn in parallel — single message, multiple Task calls
Task({
  team_name: "code-review",
  name: "security",
  subagent_type: "compound-engineering:review:security-sentinel",
  prompt: "Review PR for SQL injection, XSS, auth bypass. Send findings to team-lead.",
  run_in_background: true
})
Task({
  team_name: "code-review",
  name: "performance",
  subagent_type: "compound-engineering:review:performance-oracle",
  prompt: "Review PR for N+1 queries, memory leaks, slow algorithms. Send findings.",
  run_in_background: true
})
Task({
  team_name: "code-review",
  name: "simplicity",
  subagent_type: "compound-engineering:review:code-simplicity-reviewer",
  prompt: "Review PR for over-engineering, YAGNI violations. Send findings.",
  run_in_background: true
})

// Wait, synthesize, then shutdown each + cleanup
```

## Pattern 2: Pipeline (Sequential Dependencies)

Each stage depends on the previous.

```javascript
Teammate({ operation: "spawnTeam", team_name: "feature-pipeline" })

TaskCreate({ subject: "Research", ... })           // #1
TaskCreate({ subject: "Plan", ... })               // #2
TaskCreate({ subject: "Implement", ... })          // #3
TaskCreate({ subject: "Test", ... })               // #4
TaskCreate({ subject: "Review", ... })             // #5

TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })
TaskUpdate({ taskId: "3", addBlockedBy: ["2"] })
TaskUpdate({ taskId: "4", addBlockedBy: ["3"] })
TaskUpdate({ taskId: "5", addBlockedBy: ["4"] })

Task({
  team_name: "feature-pipeline",
  name: "researcher",
  subagent_type: "compound-engineering:research:best-practices-researcher",
  prompt: "Claim #1, research, complete, send findings. Then check for more work.",
  run_in_background: true
})
// Tasks auto-unblock as dependencies complete
```

## Pattern 3: Swarm (Self-Organizing)

Workers grab available tasks from a pool.

```javascript
Teammate({ operation: "spawnTeam", team_name: "file-review-swarm" })

for (const file of ["auth.py", "users/models.py", "api/views.py"]) {
  TaskCreate({ subject: `Review ${file}`, description: `Review ${file} for issues`, activeForm: `Reviewing ${file}...` })
}

const swarmPrompt = `
  You are a swarm worker:
  1. Call TaskList
  2. Find a pending, unowned, unblocked task
  3. Claim it (TaskUpdate owner=your-name)
  4. Do the work
  5. Mark completed
  6. Send findings to team-lead via Teammate write
  7. Repeat until no tasks remain
`

Task({ team_name: "file-review-swarm", name: "worker-1", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })
Task({ team_name: "file-review-swarm", name: "worker-2", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })
Task({ team_name: "file-review-swarm", name: "worker-3", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })
```

Workers race to claim tasks, naturally load-balance.

## Pattern 4: Research + Implementation

Research synchronously, then use results in implementation.

```javascript
const research = await Task({
  subagent_type: "compound-engineering:research:best-practices-researcher",
  description: "Research caching patterns",
  prompt: "Research caching for Django/FastAPI: invalidation, Redis vs Memcached, key design."
})

Task({
  subagent_type: "general-purpose",
  description: "Implement caching",
  prompt: `Implement API caching based on this research:\n\n${research.content}\n\nFocus on users/views.py.`
})
```

## Pattern 5: Plan Approval Workflow

Require plan approval before implementation.

```javascript
Teammate({ operation: "spawnTeam", team_name: "careful-work" })

Task({
  team_name: "careful-work",
  name: "architect",
  subagent_type: "Plan",
  prompt: "Design implementation plan for OAuth2",
  mode: "plan",              // Requires plan approval
  run_in_background: true
})

// On {"type": "plan_approval_request", "from": "architect", "requestId": "plan-xxx", ...}:
Teammate({ operation: "approvePlan", target_agent_id: "architect", request_id: "plan-xxx" })
// OR
Teammate({ operation: "rejectPlan", target_agent_id: "architect", request_id: "plan-xxx", feedback: "Add rate limiting" })
```

## Pattern 6: Coordinated Multi-File Refactoring

```javascript
Teammate({ operation: "spawnTeam", team_name: "refactor-auth" })

TaskCreate({ subject: "Refactor User model", ... })           // #1
TaskCreate({ subject: "Refactor Session controller", ... })   // #2
TaskCreate({ subject: "Update specs", ... })                  // #3

TaskUpdate({ taskId: "3", addBlockedBy: ["1", "2"] })  // specs wait for both

Task({ team_name: "refactor-auth", name: "model-worker", subagent_type: "general-purpose", prompt: "Claim #1, refactor User model", run_in_background: true })
Task({ team_name: "refactor-auth", name: "controller-worker", subagent_type: "general-purpose", prompt: "Claim #2, refactor Session controller", run_in_background: true })
Task({ team_name: "refactor-auth", name: "spec-worker", subagent_type: "general-purpose", prompt: "Wait for #3 to unblock, then update specs", run_in_background: true })
```
