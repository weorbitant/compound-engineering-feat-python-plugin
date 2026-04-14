---
name: workflows:work
description: Execute work plans efficiently while maintaining quality and finishing features
argument-hint: "[plan file, specification, or todo file path]"
---

# Work Plan Execution Command

Execute a work plan efficiently while maintaining quality and finishing features.

## Introduction

This command takes a work document (plan, specification, or todo file) and executes it systematically. The focus is on **shipping complete features** by understanding requirements quickly, following existing patterns, and maintaining quality throughout.

## Input Document

<input_document> #$ARGUMENTS </input_document>

## Project Workflow Skills

Read `compound-engineering.local.md` in the project root. If found, parse the YAML frontmatter for `workflow_skills.work`.

If the key contains a non-empty list of skill names, load each listed skill now. These provide project-specific knowledge (domain context, framework patterns, testing conventions) that informs implementation. They are additive — loaded alongside any skills this command already references (e.g., `git-worktree`, `commit`, `orchestrating-swarms`).

If no config exists or no `workflow_skills` key is present, proceed without additional skills.

## Execution Workflow

### Phase 1: Quick Start

1. **Read Plan and Clarify**

   - Read the work document completely
   - Review any references or links provided in the plan
   - If anything is unclear or ambiguous, ask clarifying questions now
   - Get user approval to proceed
   - **Do not skip this** - better to ask questions now than build the wrong thing

2. **Setup Environment**

   First, check the current branch:

   ```bash
   current_branch=$(git branch --show-current)
   default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')

   # Fallback if remote HEAD isn't set
   if [ -z "$default_branch" ]; then
     default_branch=$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo "main" || echo "master")
   fi
   ```

   **If already on a feature branch** (not the default branch):
   - Ask: "Continue working on `[current_branch]`, or create a new branch?"
   - If continuing, proceed to step 3
   - If creating new, follow Option A or B below

   **If on the default branch**, choose how to proceed:

   **Option A: Create a new branch**
   ```bash
   git pull origin [default_branch]
   git checkout -b feature-branch-name
   ```
   Use a meaningful name based on the work (e.g., `feat/user-authentication`, `fix/email-validation`).

   **Option B: Use a worktree (recommended for parallel development)**
   ```bash
   skill: git-worktree
   # The skill will create a new branch from the default branch in an isolated worktree
   ```

   **Option C: Continue on the default branch**
   - Requires explicit user confirmation
   - Only proceed after user explicitly says "yes, commit to [default_branch]"
   - Never commit directly to the default branch without explicit permission

   **Recommendation**: Use worktree if:
   - You want to work on multiple features simultaneously
   - You want to keep the default branch clean while experimenting
   - You plan to switch between branches frequently

3. **Create Todo List**
   - Use TodoWrite to break plan into actionable tasks
   - Include dependencies between tasks
   - Prioritize based on what needs to be done first
   - Include testing and quality check tasks
   - Keep tasks specific and completable

4. **Multi-Service Execution Planning** (only when `services:` YAML exists in plan frontmatter)

   If the plan frontmatter contains a `services:` section:

   a. **Load full service context** for each service in the YAML:
      - Read `{service}/.claude/prompt.md` (preferred) or `{service}/README.md` (first 50 lines) to understand what the service does
      - Read `{service}/pyproject.toml` to extract package name, Python version, key dependencies
      - List `{service}/src/` (1 level deep) to understand app organization
      - Cross-reference `pyproject.toml` dependencies between services to validate the declared dependency graph

   b. **Parse the dependency graph** from the YAML:
   ```yaml
   services:
     service-a:
       depends_on: []
     service-b:
       depends_on:
         - service: service-a
           reason: "Needs order.created event schema"
   ```

   c. **Build topological execution order** (wavefront pattern):
   - Group services into waves: Wave 1 = services with no dependencies, Wave 2 = services depending only on Wave 1, etc.
   - Detect circular dependencies: if found, report to user and treat all services in the cycle as independent

   d. **Show execution plan with service context and get confirmation:**
   ```
   Execution plan:
     Wave 1 (no deps):
       service-a — Order management (Django 5.0, Celery)
       lib-common — Shared DTOs and schemas
     Wave 2 (after wave 1):
       service-b — Payment processing (FastAPI, SQLAlchemy) — depends on service-a

   Default: sequential execution in topological order.
   Options: [Confirm] [Force parallel] [Force sequential] [Adjust order]
   ```

   **Pipeline mode:** Auto-confirm the execution order when invoked from an automated workflow.

   e. **Execute services in order, respecting each service's stack:**
   - **Sequential (default):** Execute all tasks for service-a, then lib-common, then service-b. Each service's tasks are a group in the todo list.
   - **Parallel (opt-in):** Use swarm mode — spawn one `general-purpose` worker agent per service with `run_in_background: true`. Use Task system with `addBlockedBy` to wire dependencies. Leader monitors progress via TaskList() and inbox. See the `orchestrating-swarms` skill for patterns.
   - **Stack-aware execution:** Use the loaded service context to choose the right patterns per service. Don't apply Django patterns in a FastAPI service or vice versa. Run each service's own test command (`cd {service} && poetry run pytest` or as defined in its CLAUDE.md).

   f. **Failure handling:**
   - **Sequential:** On failure, stop and ask user: retry, skip this service, or abort
   - **Parallel:** Independent services continue. Dependent services stay blocked (auto via Task system). Notify user with: which service failed, error details, which downstream services are blocked. User decides: retry, skip (force-complete to unblock dependents), or abort.

   g. **Commits:** One feature branch for the whole feature. Use per-service commit messages:
   ```
   feat(service-order): add order.created event publisher
   feat(service-payment): add payment confirmation handler
   ```

### Phase 2: Execute (Sonnet Sub-Agent)

Phase 2 runs as a **Sonnet sub-agent** to optimize token costs. Implementation/coding is Sonnet's sweet spot — it follows plans precisely and costs ~5x less than Opus. The parent (Opus) orchestrates, plans, and reviews; Sonnet executes.

**Spawn the implementation agent:**

```
Agent({
  description: "Implement plan tasks",
  model: "sonnet",
  mode: "auto",
  prompt: <see below>
})
```

**Build the prompt from Phase 1 context.** Include ALL of the following in the agent prompt:

1. The full plan content (read in Phase 1)
2. The todo list created in Phase 1 (copy the task breakdown)
3. The branch name and working directory
4. Any service context loaded during multi-service planning
5. Project coding standards from CLAUDE.md (summarize key rules)
6. The complete execution instructions below (copy them verbatim into the prompt)

**IMPORTANT**: The sub-agent starts with a blank context. It cannot see anything from Phase 1 unless you explicitly include it in the prompt. Be thorough — pass the plan, the task list, the branch, and the conventions.

---

<implementation_instructions>

These instructions are for the implementation sub-agent. Copy them into the agent prompt.

#### Task Execution Loop

For each task in priority order:

```
while (tasks remain):
  - Mark task as in_progress in TodoWrite
  - Read any referenced files from the plan
  - Look for similar patterns in codebase
  - Implement following existing conventions
  - Write tests for new functionality
  - Run System-Wide Test Check (see below)
  - Run tests after changes
  - Mark task as completed in TodoWrite
  - Mark off the corresponding checkbox in the plan file ([ ] → [x])
  - Evaluate for incremental commit (see below)
```

**System-Wide Test Check** — Before marking a task done, pause and ask:

| Question | What to do |
|----------|------------|
| **What fires when this runs?** Callbacks, middleware, observers, event handlers — trace two levels out from your change. | Read the actual code (not docs) for callbacks on models you touch, middleware in the request chain, `after_*` hooks. |
| **Do my tests exercise the real chain?** If every dependency is mocked, the test proves your logic works *in isolation* — it says nothing about the interaction. | Write at least one integration test that uses real objects through the full callback/middleware chain. No mocks for the layers that interact. |
| **Can failure leave orphaned state?** If your code persists state (DB row, cache, file) before calling an external service, what happens when the service fails? Does retry create duplicates? | Trace the failure path with real objects. If state is created before the risky call, test that failure cleans up or that retry is idempotent. |
| **What other interfaces expose this?** Mixins, DSLs, alternative entry points (Agent vs Chat vs ChatMethods). | Grep for the method/behavior in related classes. If parity is needed, add it now — not as a follow-up. |
| **Do error strategies align across layers?** Retry middleware + application fallback + framework error handling — do they conflict or create double execution? | List the specific error classes at each layer. Verify your rescue list matches what the lower layer actually raises. |

**When to skip:** Leaf-node changes with no callbacks, no state persistence, no parallel interfaces. If the change is purely additive (new helper method, new view partial), the check takes 10 seconds and the answer is "nothing fires, skip."

**When this matters most:** Any change that touches models with callbacks, error handling with fallback/retry, or functionality exposed through multiple interfaces.

**IMPORTANT**: Always update the original plan document by checking off completed items. Use the Edit tool to change `- [ ]` to `- [x]` for each task you finish. This keeps the plan as a living document showing progress and ensures no checkboxes are left unchecked.

#### Incremental Commits

After completing each task, evaluate whether to create an incremental commit:

| Commit when... | Don't commit when... |
|----------------|---------------------|
| Logical unit complete (model, service, component) | Small part of a larger unit |
| Tests pass + meaningful progress | Tests failing |
| About to switch contexts (backend → frontend) | Purely scaffolding with no behavior |
| About to attempt risky/uncertain changes | Would need a "WIP" commit message |

**Heuristic:** "Can I write a commit message that describes a complete, valuable change? If yes, commit. If the message would be 'WIP' or 'partial X', wait."

**Commit workflow — test-and-fix gate (REQUIRED before every commit):**

```
LOOP until clean:
  1. Run tests (poetry run pytest / project test command)
     → If tests fail: read failures, fix the code, re-run. Do NOT proceed to step 2.
  2. Stage files related to this logical unit (not `git add .`)
  3. Run `git commit` (this triggers pre-commit hooks)
     → If pre-commit hooks fail:
       a. Read the hook output to identify what failed
       b. Fix the issues (formatting, imports, linting, type errors)
       c. Auto-stage any auto-fixes the hooks applied
       d. Go back to step 1 (re-run tests — hook fixes may break things)
     → If pre-commit hooks pass: commit succeeds, move on
```

**Key rules:**
- NEVER commit with failing tests. Fix them first.
- NEVER skip pre-commit hooks with `--no-verify`.
- If a pre-commit hook auto-fixes files (black, isort, ruff), re-run tests after staging the fixes — auto-formatting can change behavior in rare cases.
- If stuck after 2 retry cycles, show the errors and ask the user.

**Handling merge conflicts:** If conflicts arise during rebasing or merging, resolve them immediately. Incremental commits make conflict resolution easier since each commit is small and focused.

**Note:** Incremental commits use clean conventional messages without attribution footers. The final Phase 4 commit/PR includes the full attribution.

#### Follow Existing Patterns

- The plan should reference similar code - read those files first
- Match naming conventions exactly
- Reuse existing components where possible
- Follow project coding standards (see CLAUDE.md)
- When in doubt, grep for similar implementations

#### Test Continuously

- Run relevant tests after each significant change
- Don't wait until the end to test
- Fix failures immediately
- Add new tests for new functionality
- **Unit tests with mocks prove logic in isolation. Integration tests with real objects prove the layers work together.** If your change touches callbacks, middleware, or error handling — you need both.

#### Figma Design Sync (if applicable)

For UI work with Figma designs:

- Implement components following design specs
- Use figma-design-sync agent iteratively to compare
- Fix visual differences identified
- Repeat until implementation matches design

#### Track Progress
- Keep TodoWrite updated as you complete tasks
- Note any blockers or unexpected discoveries
- Create new tasks if scope expands
- Keep user informed of major milestones

</implementation_instructions>

---

**After the sub-agent completes**, review its output before proceeding to Phase 3. If the agent reports blockers or unresolved issues, address them before moving on. If the agent failed or produced incomplete work, you may re-spawn it with additional context or handle the remaining tasks directly.

### Phase 3: Quality Gate (MANDATORY — blocks Phase 4)

Phase 4 CANNOT start until all checks in this phase pass. This is not advisory.

1. **Run Full Test-and-Fix Cycle**

   ```
   LOOP until all pass:
     1. Run full test suite (poetry run pytest / project test command)
        → If tests fail: fix the code, re-run. Do NOT proceed.
     2. Run linting (per CLAUDE.md / use python-lint agent)
        → If linting fails: fix the issues, re-run tests (lint fixes can break things).
     3. Run pre-commit hooks on all staged files: `git stash && git stash pop`
        or stage everything and do a dry run if the project supports it.
        → If hooks fail: fix issues, re-run from step 1.
   ```

   **Do not skip this cycle.** Every fix can introduce new failures — always re-run from the top after changes.

2. **Consider Reviewer Agents** (Optional)

   Use for complex, risky, or large changes. Read agents from `compound-engineering.local.md` frontmatter (`review_agents`). If no settings file, invoke the `setup` skill to create one.

   Run configured agents in parallel with Task tool. Present findings and address critical issues.

3. **Final Validation Checklist** (all must be true to proceed)
   - [ ] All TodoWrite tasks marked completed
   - [ ] Full test suite passes (not just the tests you wrote)
   - [ ] Linting passes with zero warnings
   - [ ] Pre-commit hooks pass on all changed files
   - [ ] Code follows existing patterns
   - [ ] Figma designs match (if applicable)
   - [ ] No console errors or warnings

   **If any check fails:** Fix the issue and re-run the full cycle. Do NOT proceed to Phase 4.

4. **Prepare Operational Validation Plan** (REQUIRED)
   - Add a `## Post-Deploy Monitoring & Validation` section to the PR description for every change.
   - Include concrete:
     - Log queries/search terms
     - Metrics or dashboards to watch
     - Expected healthy signals
     - Failure signals and rollback/mitigation trigger
     - Validation window and owner
   - If there is truly no production/runtime impact, still include the section with: `No additional operational monitoring required` and a one-line reason.

### Phase 4: Ship It

**Prerequisite:** Phase 3 Quality Gate MUST have passed. If tests, linting, or pre-commit hooks are failing, go back to Phase 3 and fix them first. Do NOT ship broken code.

1. **Create Commit**

   Use the `/commit` skill to analyze, group, and commit all changes with proper conventional + gitmoji format. This ensures changes are logically grouped and the commit message follows project conventions.

   ```
   /commit
   ```

   If the `/commit` skill's pre-commit hooks fail during commit:
   - Fix the issues (don't skip with `--no-verify`)
   - Re-run tests to ensure fixes didn't break anything
   - Retry the commit

2. **Capture and Upload Screenshots for UI Changes** (REQUIRED for any UI work)

   For **any** design changes, new views, or UI modifications, you MUST capture and upload screenshots:

   **Step 1: Start dev server** (if not running)
   ```bash
   # Django: python manage.py runserver
   # FastAPI: uvicorn main:app --reload
   ```

   **Step 2: Capture screenshots with agent-browser CLI**
   ```bash
   agent-browser open http://localhost:3000/[route]
   agent-browser snapshot -i
   agent-browser screenshot output.png
   ```
   See the `agent-browser` skill for detailed usage.

   **Step 3: Upload using imgup skill**
   ```bash
   skill: imgup
   # Then upload each screenshot:
   imgup -h pixhost screenshot.png  # pixhost works without API key
   # Alternative hosts: catbox, imagebin, beeimg
   ```

   **What to capture:**
   - **New screens**: Screenshot of the new UI
   - **Modified screens**: Before AND after screenshots
   - **Design implementation**: Screenshot showing Figma design match

   **IMPORTANT**: Always include uploaded image URLs in PR description. This provides visual context for reviewers and documents the change.

3. **Create Pull Request**

   ```bash
   git push -u origin feature-branch-name

   gh pr create --title "Feature: [Description]" --body "$(cat <<'EOF'
   ## Summary
   - What was built
   - Why it was needed
   - Key decisions made

   ## Testing
   - Tests added/modified
   - Manual testing performed

   ## Post-Deploy Monitoring & Validation
   - **What to monitor/search**
     - Logs:
     - Metrics/Dashboards:
   - **Validation checks (queries/commands)**
     - `command or query here`
   - **Expected healthy behavior**
     - Expected signal(s)
   - **Failure signal(s) / rollback trigger**
     - Trigger + immediate action
   - **Validation window & owner**
     - Window:
     - Owner:
   - **If no operational impact**
     - `No additional operational monitoring required: <reason>`

   ## Before / After Screenshots
   | Before | After |
   |--------|-------|
   | ![before](URL) | ![after](URL) |

   ## Figma Design
   [Link if applicable]

   ---

   [![Compound Engineered](https://img.shields.io/badge/Compound-Engineered-6366f1)](https://github.com/BaronVonSario/compound-engineering-feat-python) 🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

4. **Update Plan Status**

   If the input document has YAML frontmatter with a `status` field, update it to `completed`:
   ```
   status: active  →  status: completed
   ```

5. **Notify User**
   - Summarize what was completed
   - Link to PR
   - Note any follow-up work needed
   - Suggest next steps if applicable

---

## Swarm Mode (Optional)

For complex plans with multiple independent workstreams, enable swarm mode for parallel execution with coordinated agents.

### When to Use Swarm Mode

| Use Swarm Mode when... | Use Standard Mode when... |
|------------------------|---------------------------|
| Plan has 5+ independent tasks | Plan is linear/sequential |
| Multiple specialists needed (review + test + implement) | Single-focus work |
| Want maximum parallelism | Simpler mental model preferred |
| Large feature with clear phases | Small feature or bug fix |

### Enabling Swarm Mode

To trigger swarm execution, say:

> "Make a Task list and launch an army of agent swarm subagents to build the plan"

Or explicitly request: "Use swarm mode for this work"

### Swarm Workflow

When swarm mode is enabled, the workflow changes:

1. **Create Team**
   ```
   Teammate({ operation: "spawnTeam", team_name: "work-{timestamp}" })
   ```

2. **Create Task List with Dependencies**
   - Parse plan into TaskCreate items
   - Set up blockedBy relationships for sequential dependencies
   - Independent tasks have no blockers (can run in parallel)

3. **Spawn Specialized Teammates**
   ```
   Task({
     team_name: "work-{timestamp}",
     name: "implementer",
     subagent_type: "general-purpose",
     prompt: "Claim implementation tasks, execute, mark complete",
     run_in_background: true
   })

   Task({
     team_name: "work-{timestamp}",
     name: "tester",
     subagent_type: "general-purpose",
     prompt: "Claim testing tasks, run tests, mark complete",
     run_in_background: true
   })
   ```

4. **Coordinate and Monitor**
   - Team lead monitors task completion
   - Spawn additional workers as phases unblock
   - Handle plan approval if required

5. **Cleanup**
   ```
   Teammate({ operation: "requestShutdown", target_agent_id: "implementer" })
   Teammate({ operation: "requestShutdown", target_agent_id: "tester" })
   Teammate({ operation: "cleanup" })
   ```

See the `orchestrating-swarms` skill for detailed swarm patterns and best practices.

---

## Key Principles

### Start Fast, Execute Faster

- Get clarification once at the start, then execute
- Don't wait for perfect understanding - ask questions and move
- The goal is to **finish the feature**, not create perfect process

### The Plan is Your Guide

- Work documents should reference similar code and patterns
- Load those references and follow them
- Don't reinvent - match what exists

### Test As You Go

- Run tests after each change, not at the end
- Fix failures immediately
- Continuous testing prevents big surprises

### Quality is Built In

- Follow existing patterns
- Write tests for new code
- Run linting before pushing
- Use reviewer agents for complex/risky changes only

### Ship Complete Features

- Mark all tasks completed before moving on
- Don't leave features 80% done
- A finished feature that ships beats a perfect feature that doesn't

## Quality Checklist

Before creating PR, verify (Phase 3 Quality Gate must pass first):

- [ ] All clarifying questions asked and answered
- [ ] All TodoWrite tasks marked completed
- [ ] **Full test suite passes** (not just your tests — run project's test command)
- [ ] **Linting passes with zero warnings** (use linting-agent)
- [ ] **Pre-commit hooks pass on all changed files**
- [ ] Code follows existing patterns
- [ ] Figma designs match implementation (if applicable)
- [ ] Before/after screenshots captured and uploaded (for UI changes)
- [ ] Commit messages follow conventional format
- [ ] PR description includes Post-Deploy Monitoring & Validation section (or explicit no-impact rationale)
- [ ] PR description includes summary, testing notes, and screenshots
- [ ] PR description includes Compound Engineered badge

## When to Use Reviewer Agents

**Don't use by default.** Use reviewer agents only when:

- Large refactor affecting many files (10+)
- Security-sensitive changes (authentication, permissions, data access)
- Performance-critical code paths
- Complex algorithms or business logic
- User explicitly requests thorough review

For most features: tests + linting + following patterns is sufficient.

## Common Pitfalls to Avoid

- **Analysis paralysis** - Don't overthink, read the plan and execute
- **Skipping clarifying questions** - Ask now, not after building wrong thing
- **Ignoring plan references** - The plan has links for a reason
- **Testing at the end** - Test continuously or suffer later
- **Forgetting TodoWrite** - Track progress or lose track of what's done
- **80% done syndrome** - Finish the feature, don't move on early
- **Over-reviewing simple changes** - Save reviewer agents for complex work
