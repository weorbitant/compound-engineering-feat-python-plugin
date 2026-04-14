---
name: reproduce-bug
description: Reproduce and investigate a bug using logs, console inspection, and browser screenshots
argument-hint: "[GitHub issue number]"
disable-model-invocation: true
---

# Reproduce Bug Command

Look at github issue #$ARGUMENTS and read the issue description and comments.

## Phase 1: Log Investigation

Run the following research agents in parallel to investigate the bug:

1. Task compound-engineering:research:repo-research-analyst(issue_description)
2. Task compound-engineering:research:git-history-analyzer(issue_description)

Think about the places it could go wrong looking at the codebase. Look for logging output we can look for.

Run the agents again to find any logs that could help us reproduce the bug.

Keep running these agents until you have a good idea of what is going on.

## Phase 2: Visual Reproduction with agent-browser

If the bug is UI-related or involves user flows, use agent-browser CLI to visually reproduce it.

### Step 0: Verify agent-browser Installation

```bash
command -v agent-browser >/dev/null 2>&1 && echo "Ready" || (echo "Installing..." && npm install -g agent-browser && agent-browser install)
```

If installation fails, inform the user and skip to Phase 3.

### Step 1: Verify Server is Running

```bash
agent-browser open "http://localhost:8000"
agent-browser snapshot -i
```

If server not running, inform user to start it (`python manage.py runserver` for Django, `uvicorn` for FastAPI).

### Step 2: Navigate to Affected Area

Based on the issue description, navigate to the relevant page:

```bash
agent-browser open "http://localhost:8000/[affected_route]"
agent-browser snapshot -i
```

### Step 3: Capture Screenshots

Take screenshots at each step of reproducing the bug:

```bash
agent-browser screenshot "bug-[issue]-step-1.png"
```

### Step 4: Follow User Flow

Reproduce the exact steps from the issue:

1. **Read the issue's reproduction steps**
2. **Execute each step using agent-browser:**
   - `agent-browser click @ref` for clicking elements
   - `agent-browser fill @ref "text"` for filling forms
   - `agent-browser snapshot -i` to see the current state
   - `agent-browser screenshot filename.png` to capture evidence

3. **Check page for errors:**
   ```bash
   agent-browser snapshot -i
   ```
   Look for error messages, stack traces, or unexpected content in the snapshot output.

### Step 5: Capture Bug State

When you reproduce the bug:

1. Take a screenshot of the bug state
2. Document any visible errors in the snapshot
3. Document the exact steps that triggered it

```bash
agent-browser screenshot "bug-[issue]-reproduced.png"
```

## Phase 3: Document Findings

**Reference Collection:**

- [ ] Document all research findings with specific file paths (e.g., `src/apps/payments/views.py:42`)
- [ ] Include screenshots showing the bug reproduction
- [ ] List errors found in snapshots if any
- [ ] Document the exact reproduction steps

## Phase 4: Report Back

Add a comment to the issue with:

1. **Findings** - What you discovered about the cause
2. **Reproduction Steps** - Exact steps to reproduce (verified)
3. **Screenshots** - Visual evidence of the bug (upload captured screenshots)
4. **Relevant Code** - File paths and line numbers
5. **Suggested Fix** - If you have one
