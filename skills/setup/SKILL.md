---
name: setup
description: Configure which review agents and workflow skills run for a project by auto-detecting the Python stack and writing compound-engineering.local.md. Use when setting up the plugin in a new project or reconfiguring review agents and workflow skills.
model: sonnet
disable-model-invocation: true
---

# Compound Engineering Setup

Interactive setup for `compound-engineering.local.md` — configures which agents run during `/workflows:review` and `/workflows:work`.

Detection rules, agent computation, workflow skill mapping, and output template: [references/stack-detection.md](./references/stack-detection.md).

## Step 1: Check Existing Config

Read `compound-engineering.local.md` in project root. If it exists, show current settings and AskUserQuestion:

```
question: "Settings file already exists. What would you like to do?"
header: "Config"
options:
  - Reconfigure — run interactive setup again
  - View current — show file contents, then stop
  - Cancel — keep current settings
```

View current → display file, stop. Cancel → stop.

## Step 2: Detect Python Stack

Scan dependency files (see references for full rules). Then AskUserQuestion:

```
question: "Detected Python project with: {detected_frameworks}. How would you like to configure?"
header: "Setup"
options:
  - Auto-configure (Recommended) — smart defaults for your stack
  - Customize — choose frameworks, focus areas, and depth
```

**Auto-configure** → skip to Step 4 using defaults (see references).
**Customize** → Step 3.

## Step 3: Customize (5 questions)

### 3a. Frameworks (multiSelect)

Django / DRF / Celery / FastAPI — override detected set.

### 3b. Database (multiSelect)

PostgreSQL / PostGIS / SQLAlchemy.

### 3c. Focus areas (multiSelect)

Security / Performance / Architecture / Code simplicity — maps to focus-area agents.

### 3d. Depth

```
- Thorough (Recommended) — stack reviewers + all selected focus agents
- Fast — stack reviewers + code simplicity only
- Comprehensive — thorough + git history, data integrity, agent-native
```

### 3e. Workflow Skills

```
- Auto-configure (Recommended) — load detected stack skills into all workflows
- Customize per workflow — multiSelect for each of 4 workflows
- Skip — omit workflow_skills entirely
```

If **Customize per workflow**, for each of `brainstorm`, `plan`, `work`, `review`, present multiSelect of available skills (`django-patterns`, `django-drf`, `django-async`, `fastapi-patterns`, `fastapi-sqlalchemy`, `pytest-patterns`, `postgresql-patterns`, `postgis-patterns`) plus any local `.claude/skills/`.

## Step 4: Build Agent List and Write File

Compute `review_agents` and `plan_review_agents` from selections (algorithm in [references/stack-detection.md](./references/stack-detection.md)).

Write `compound-engineering.local.md` using the template in references. Omit `workflow_skills` block if user chose Skip in 3e.

## Step 5: Confirm

```
Saved to compound-engineering.local.md

Stack:        Python
Frameworks:   {framework list}
Database:     {database list}
Review depth: {depth}
Agents:       {count} configured
              {agent list, one per line}
Workflow skills: {count} skills across {count} workflows
              brainstorm: {skill list or "none"}
              plan:       {skill list or "none"}
              work:       {skill list or "none"}
              review:     {skill list or "none"}

Tip: Edit the "Review Context" section for project-specific instructions.
     Edit workflow_skills in the YAML frontmatter to customize per-workflow.
     Re-run this setup anytime.
```
