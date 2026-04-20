# Task System Integration

## Core operations

```javascript
// Create
TaskCreate({
  subject: "Review authentication module",
  description: "Review all files in app/services/auth/ for security vulnerabilities",
  activeForm: "Reviewing auth module..."
})

// List
TaskList()
// → #1 [completed] ...
// → #2 [in_progress] ... (owner: security-reviewer)
// → #3 [pending] ... [blocked by #2]

// Get details
TaskGet({ taskId: "2" })

// Claim
TaskUpdate({ taskId: "2", owner: "security-reviewer" })

// Start / complete
TaskUpdate({ taskId: "2", status: "in_progress" })
TaskUpdate({ taskId: "2", status: "completed" })

// Dependencies
TaskUpdate({ taskId: "3", addBlockedBy: ["1", "2"] })
```

## Pipeline example

```javascript
TaskCreate({ subject: "Step 1: Research" })        // #1
TaskCreate({ subject: "Step 2: Implement" })       // #2
TaskCreate({ subject: "Step 3: Test" })            // #3
TaskCreate({ subject: "Step 4: Deploy" })          // #4

TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })
TaskUpdate({ taskId: "3", addBlockedBy: ["2"] })
TaskUpdate({ taskId: "4", addBlockedBy: ["3"] })
```

Blocked tasks auto-unblock when dependencies complete.

## Task file structure

`~/.claude/tasks/{team-name}/1.json`:

```json
{
  "id": "1",
  "subject": "Review authentication module",
  "description": "...",
  "status": "in_progress",
  "owner": "security-reviewer",
  "activeForm": "Reviewing auth module...",
  "blockedBy": [],
  "blocks": ["3"],
  "createdAt": 1706000000000,
  "updatedAt": 1706000001000
}
```
