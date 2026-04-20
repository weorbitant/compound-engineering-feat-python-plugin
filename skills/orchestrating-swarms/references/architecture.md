# Core Architecture

## How Swarms Work

A swarm consists of:
- **Leader** (you) - Creates team, spawns workers, coordinates work
- **Teammates** (spawned agents) - Execute tasks, report back
- **Task List** - Shared work queue with dependencies
- **Inboxes** - JSON files for inter-agent messaging

## File Structure

```
~/.claude/teams/{team-name}/
├── config.json              # Team metadata and member list
└── inboxes/
    ├── team-lead.json       # Leader's inbox
    ├── worker-1.json        # Worker 1's inbox
    └── worker-2.json        # Worker 2's inbox

~/.claude/tasks/{team-name}/
├── 1.json                   # Task #1
├── 2.json                   # Task #2
└── 3.json                   # Task #3
```

## Team Config Structure

```json
{
  "name": "my-project",
  "description": "Working on feature X",
  "leadAgentId": "team-lead@my-project",
  "createdAt": 1706000000000,
  "members": [
    {
      "agentId": "team-lead@my-project",
      "name": "team-lead",
      "agentType": "team-lead",
      "color": "#4A90D9",
      "joinedAt": 1706000000000,
      "backendType": "in-process"
    },
    {
      "agentId": "worker-1@my-project",
      "name": "worker-1",
      "agentType": "Explore",
      "model": "haiku",
      "prompt": "Analyze the codebase structure...",
      "color": "#D94A4A",
      "planModeRequired": false,
      "joinedAt": 1706000001000,
      "tmuxPaneId": "in-process",
      "cwd": "/Users/me/project",
      "backendType": "in-process"
    }
  ]
}
```

## Environment Variables

Spawned teammates automatically receive:

```bash
CLAUDE_CODE_TEAM_NAME="my-project"
CLAUDE_CODE_AGENT_ID="worker-1@my-project"
CLAUDE_CODE_AGENT_NAME="worker-1"
CLAUDE_CODE_AGENT_TYPE="Explore"
CLAUDE_CODE_AGENT_COLOR="#4A90D9"
CLAUDE_CODE_PLAN_MODE_REQUIRED="false"
CLAUDE_CODE_PARENT_SESSION_ID="session-xyz"
```

Use in prompts with `$CLAUDE_CODE_AGENT_NAME` etc.
