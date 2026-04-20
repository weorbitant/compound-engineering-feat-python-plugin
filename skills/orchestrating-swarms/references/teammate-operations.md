# TeammateTool Operations

## 1. spawnTeam

```javascript
Teammate({
  operation: "spawnTeam",
  team_name: "feature-auth",
  description: "Implementing OAuth2 authentication"
})
```

Creates `~/.claude/teams/feature-auth/config.json` and task dir. You become leader.

## 2. discoverTeams

```javascript
Teammate({ operation: "discoverTeams" })
```

Lists teams you can join.

## 3. requestJoin

```javascript
Teammate({
  operation: "requestJoin",
  team_name: "feature-auth",
  proposed_name: "helper",
  capabilities: "Code review and testing"
})
```

## 4. approveJoin (Leader)

```javascript
Teammate({
  operation: "approveJoin",
  target_agent_id: "helper",
  request_id: "join-123"
})
```

## 5. rejectJoin (Leader)

```javascript
Teammate({
  operation: "rejectJoin",
  target_agent_id: "helper",
  request_id: "join-123",
  reason: "Team is at capacity"
})
```

## 6. write — Message one teammate

```javascript
Teammate({
  operation: "write",
  target_agent_id: "security-reviewer",
  value: "Please prioritize the auth module."
})
```

**Teammates:** Your text output is NOT visible to the team. Use `write` to communicate.

## 7. broadcast — Message ALL teammates

```javascript
Teammate({
  operation: "broadcast",
  name: "team-lead",
  value: "Status check: report your progress"
})
```

**WARNING:** Sends N messages for N teammates. Prefer `write`.

Use only for critical issues or major announcements affecting everyone.

## 8. requestShutdown (Leader)

```javascript
Teammate({
  operation: "requestShutdown",
  target_agent_id: "security-reviewer",
  reason: "All tasks complete"
})
```

## 9. approveShutdown (Teammate)

On receiving `{"type": "shutdown_request", "requestId": "shutdown-123", ...}`, MUST call:

```javascript
Teammate({
  operation: "approveShutdown",
  request_id: "shutdown-123"
})
```

Sends confirmation and terminates the process.

## 10. rejectShutdown (Teammate)

```javascript
Teammate({
  operation: "rejectShutdown",
  request_id: "shutdown-123",
  reason: "Still working on task #3, need 5 more minutes"
})
```

## 11. approvePlan (Leader)

On receiving `{"type": "plan_approval_request", "from": "architect", "requestId": "plan-456", ...}`:

```javascript
Teammate({
  operation: "approvePlan",
  target_agent_id: "architect",
  request_id: "plan-456"
})
```

## 12. rejectPlan (Leader)

```javascript
Teammate({
  operation: "rejectPlan",
  target_agent_id: "architect",
  request_id: "plan-456",
  feedback: "Please add error handling and rate limiting"
})
```

## 13. cleanup

```javascript
Teammate({ operation: "cleanup" })
```

Removes team and task directories. Fails if teammates are still active — `requestShutdown` first.
