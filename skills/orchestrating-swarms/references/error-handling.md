# Error Handling

## Common errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot cleanup with active members" | Teammates still running | `requestShutdown` all first, wait for approval |
| "Already leading a team" | Team already exists | `cleanup` first, or use different name |
| "Agent not found" | Wrong teammate name | Check `config.json` for actual names |
| "Team does not exist" | No team created | Call `spawnTeam` first |
| "team_name is required" | Missing team context | Provide `team_name` parameter |
| "Agent type not found" | Invalid subagent_type | Check available agents with proper prefix |

## Graceful shutdown sequence

```javascript
// 1. Request shutdown
Teammate({ operation: "requestShutdown", target_agent_id: "worker-1" })
Teammate({ operation: "requestShutdown", target_agent_id: "worker-2" })

// 2. Wait for {"type": "shutdown_approved", ...} in inbox

// 3. Verify no active members (check config.json)

// 4. Cleanup
Teammate({ operation: "cleanup" })
```

## Crashed teammates

Teammates have a 5-minute heartbeat timeout. If one crashes:
1. Auto-marked inactive after timeout
2. Their tasks remain in the task list
3. Another teammate can claim their tasks
4. Cleanup works after timeout expires

## Debugging

```bash
# Team config
cat ~/.claude/teams/{team}/config.json | jq '.members[] | {name, agentType, backendType}'

# Inbox
cat ~/.claude/teams/{team}/inboxes/{agent}.json | jq '.'

# All teams
ls ~/.claude/teams/

# Task states
cat ~/.claude/tasks/{team}/*.json | jq '{id, subject, status, owner, blockedBy}'

# Tail new messages
tail -f ~/.claude/teams/{team}/inboxes/team-lead.json
```
