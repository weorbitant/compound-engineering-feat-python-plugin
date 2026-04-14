---
name: workflows:brainstorm
description: Explore requirements and approaches through collaborative dialogue before planning implementation
argument-hint: "[feature idea or problem to explore]"
---

# Brainstorm a Feature or Improvement

**Note: The current year is 2026.** Use this when dating brainstorm documents.

Brainstorming helps answer **WHAT** to build through collaborative dialogue. It precedes `/workflows:plan`, which answers **HOW** to build it.

**Process knowledge:** Load the `brainstorming` skill for detailed question techniques, approach exploration patterns, and YAGNI principles.

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

**If the feature description above is empty, ask the user:** "What would you like to explore? Please describe the feature, problem, or improvement you're thinking about."

Do not proceed until you have a feature description from the user.

## Microservice Mode: Focus Gate

**Before proceeding, check if this is a multi-service monorepo:**

1. If the user provided `--services service-a,service-b` in the arguments, use those as the focused services (skip interactive prompting)
2. If focused services are already in conversation context, use them
3. If neither: check if multiple `pyproject.toml` files exist at root level (`Glob("*/pyproject.toml")`). If yes, prompt the user: "This appears to be a multi-service repo. Which services are relevant to this brainstorm?" List discovered services and let user pick.
4. If single `pyproject.toml` or none found: proceed in single-service mode (original behavior)

**When focused services are set:** Load full service context:

1. **Load each service's description:** Read `{service}/.claude/prompt.md` (preferred) or `{service}/README.md` (first 50 lines) to understand what the service does
2. **Load tech stack:** Read `{service}/pyproject.toml` to extract package name, Python version, key dependencies (Django, FastAPI, Celery, etc.)
3. **Detect internal dependencies:** Cross-reference `pyproject.toml` dependencies between focused services to build the service-map
4. **List structure:** List `{service}/src/` (1 level deep) to understand app organization

**Pass a rich `<focus_context>` block to all sub-agents:**
```
<focus_context>
  services: service-a (./service-a), service-b (./service-b)

  service-a:
    description: [from prompt.md/README — what this service does]
    stack: Django 5.0, Celery, PostgreSQL
    structure: src/orders/, src/pricing/, src/shared/

  service-b:
    description: [from prompt.md/README — what this service does]
    stack: FastAPI, SQLAlchemy 2.0, Redis
    structure: src/payments/, src/webhooks/

  dependencies:
    - service-b depends on service-a (event schema)
    - both depend on lib-common (shared DTOs)
</focus_context>
```

**Use the service context to inform brainstorming:** When exploring approaches, consider each service's stack, purpose, and how they interact. Don't propose patterns that conflict with a service's existing architecture.

## Project Workflow Skills

Read `compound-engineering.local.md` in the project root. If found, parse the YAML frontmatter for `workflow_skills.brainstorm`.

If the key contains a non-empty list of skill names, load each listed skill now. These provide project-specific knowledge (domain context, framework patterns, database conventions) that informs this workflow. They are additive — loaded alongside any skills this command already references (e.g., `brainstorming`, `document-review`).

If no config exists or no `workflow_skills` key is present, proceed without additional skills.

## Execution Flow

### Phase 0: Assess Requirements Clarity

Evaluate whether brainstorming is needed based on the feature description.

**Clear requirements indicators:**
- Specific acceptance criteria provided
- Referenced existing patterns to follow
- Described exact expected behavior
- Constrained, well-defined scope

**If requirements are already clear:**
Use **AskUserQuestion tool** to suggest: "Your requirements seem detailed enough to proceed directly to planning. Should I run `/workflows:plan` instead, or would you like to explore the idea further?"

### Phase 1: Understand the Idea

#### 1.1 Repository Research (Lightweight)

Run a quick repo scan to understand existing patterns:

- Task repo-research-analyst("Understand existing patterns related to: <feature_description>")

Focus on: similar features, established patterns, CLAUDE.md guidance.

#### 1.2 Collaborative Dialogue

Use the **AskUserQuestion tool** to ask questions **one at a time**.

**Guidelines (see `brainstorming` skill for detailed techniques):**
- Prefer multiple choice when natural options exist
- Start broad (purpose, users) then narrow (constraints, edge cases)
- Validate assumptions explicitly
- Ask about success criteria

**Exit condition:** Continue until the idea is clear OR user says "proceed"

### Phase 2: Explore Approaches

Propose **2-3 concrete approaches** based on research and conversation.

For each approach, provide:
- Brief description (2-3 sentences)
- Pros and cons
- When it's best suited

Lead with your recommendation and explain why. Apply YAGNI—prefer simpler solutions.

Use **AskUserQuestion tool** to ask which approach the user prefers.

### Phase 3: Capture the Design

**Single-service mode:** Write a brainstorm document to `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`.

**Microservice mode:** Write a brainstorm document **inside each focused service**:
- `{service}/docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md` for each affected service
- Each per-service document should focus on that service's role and decisions
- Add a `## Services` section listing all affected services and their roles, so `/workflows:plan` can auto-detect scope

```markdown
## Services

- **service-order**: Produces order events consumed by payment
- **service-payment**: Handles payment processing triggered by orders
- **lib-common**: Shared DTOs used by both services
```

**Document structure:** See the `brainstorming` skill for the template format. Key sections: What We're Building, Why This Approach, Key Decisions, Open Questions.

Ensure the target `docs/brainstorms/` directory exists before writing.

**IMPORTANT:** Before proceeding to Phase 4, check if there are any Open Questions listed in the brainstorm document. If there are open questions, YOU MUST ask the user about each one using AskUserQuestion before offering to proceed to planning. Move resolved questions to a "Resolved Questions" section.

### Phase 4: Handoff

Use **AskUserQuestion tool** to present next steps:

**Question:** "Brainstorm captured. What would you like to do next?"

**Options:**
1. **Review and refine** - Improve the document through structured self-review
2. **Proceed to planning** - Run `/workflows:plan` (will auto-detect this brainstorm)
3. **Ask more questions** - I have more questions to clarify before moving on
4. **Done for now** - Return later

**If user selects "Ask more questions":** YOU (Claude) return to Phase 1.2 (Collaborative Dialogue) and continue asking the USER questions one at a time to further refine the design. The user wants YOU to probe deeper - ask about edge cases, constraints, preferences, or areas not yet explored. Continue until the user is satisfied, then return to Phase 4.

**If user selects "Review and refine":**

Load the `document-review` skill and apply it to the brainstorm document.

When document-review returns "Review complete", present next steps:

1. **Move to planning** - Continue to `/workflows:plan` with this document
2. **Done for now** - Brainstorming complete. To start planning later: `/workflows:plan [document-path]`

## Output Summary

When complete, display:

```
Brainstorm complete!

Document(s): [docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md | {service}/docs/brainstorms/...]

Key decisions:
- [Decision 1]
- [Decision 2]

Next: Run `/workflows:plan` when ready to implement.
```

## Important Guidelines

- **Stay focused on WHAT, not HOW** - Implementation details belong in the plan
- **Ask one question at a time** - Don't overwhelm
- **Apply YAGNI** - Prefer simpler approaches
- **Keep outputs concise** - 200-300 words per section max

NEVER CODE! Just explore and document decisions.
