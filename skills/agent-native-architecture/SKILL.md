---
name: agent-native-architecture
description: Build applications where agents are first-class citizens. Use this skill when designing autonomous agents, creating MCP tools, implementing self-modifying systems, or building apps where features are outcomes achieved by agents operating in a loop.
model: opus
---

# Agent-Native Architecture

Software agents work reliably now. A really good coding agent is a really good general-purpose agent — the same loop that refactors a codebase can organize files, manage reading lists, or automate workflows. Features aren't code you write — they're outcomes an agent achieves with tools, operating in a loop until the outcome is reached.

## Core Principles (summary)

Full explanation in [references/core-principles.md](./references/core-principles.md).

1. **Parity** — Every UI action has an agent capability to achieve the same outcome.
2. **Granularity** — Atomic primitives. Features emerge from prompts + agent judgment.
3. **Composability** — New features = new prompts, no new code.
4. **Emergent Capability** — Agent solves problems you didn't explicitly design for.
5. **Improvement Over Time** — Accumulated context + prompt refinement → app gets better without shipping code.

## What aspect do you need help with?

1. **Design architecture** — Plan an agent-native system from scratch
2. **Files & workspace** — Files as universal interface, shared workspace
3. **Tool design** — Primitives, dynamic capability discovery, CRUD
4. **Domain tools** — When to graduate from primitives to domain tools
5. **Execution patterns** — Completion signals, partial completion, context limits
6. **System prompts** — Features in prose, judgment criteria
7. **Context injection** — Runtime app state into agent prompts
8. **Action parity** — Ensure full capability mapping
9. **Self-modification** — Safe evolution
10. **Product design** — Progressive disclosure, latent demand, approval
11. **Mobile** — iOS storage, background, checkpoint/resume
12. **Testing** — Outcome and parity tests
13. **Refactoring** — Make existing code agent-native

**Wait for response.**

## Routing

| Response | Read |
|----------|------|
| 1, design, architecture, plan | [architecture-patterns.md](./references/architecture-patterns.md) → apply checklist below |
| 2, files, workspace, filesystem | [files-universal-interface.md](./references/files-universal-interface.md), [shared-workspace-architecture.md](./references/shared-workspace-architecture.md) |
| 3, tool, mcp, primitive, crud | [mcp-tool-design.md](./references/mcp-tool-design.md) |
| 4, domain tool, when to add | [from-primitives-to-domain-tools.md](./references/from-primitives-to-domain-tools.md) |
| 5, execution, completion, loop | [agent-execution-patterns.md](./references/agent-execution-patterns.md) |
| 6, prompt, system prompt, behavior | [system-prompt-design.md](./references/system-prompt-design.md) |
| 7, context, inject, runtime, dynamic | [dynamic-context-injection.md](./references/dynamic-context-injection.md) |
| 8, parity, ui action, capability map | [action-parity-discipline.md](./references/action-parity-discipline.md) |
| 9, self-modify, evolve, git | [self-modification.md](./references/self-modification.md) |
| 10, product, progressive, approval, latent demand | [product-implications.md](./references/product-implications.md) |
| 11, mobile, ios, android, background, checkpoint | [mobile-patterns.md](./references/mobile-patterns.md) |
| 12, test, testing, verify, validate | [agent-native-testing.md](./references/agent-native-testing.md) |
| 13, review, refactor, existing | [refactoring-to-prompt-native.md](./references/refactoring-to-prompt-native.md) |

After reading the reference, apply those patterns to the user's specific context.

## Architecture Checklist

Verify **before implementation**.

**Core principles**
- [ ] Parity: every UI action has an agent capability
- [ ] Granularity: tools are primitives; features are prompts
- [ ] Composability: new features can be added via prompts alone
- [ ] Emergent capability: agent handles open-ended requests in your domain

**Tool design**
- [ ] Dynamic vs static: external APIs use Dynamic Capability Discovery
- [ ] CRUD completeness: create, read, update, delete for every entity
- [ ] Primitives not workflows
- [ ] API as validator: `z.string()` inputs when API validates, not `z.enum()`

**Files & workspace**
- [ ] Shared workspace — agent and user in same data space
- [ ] `context.md` pattern for accumulated knowledge
- [ ] Entity-scoped directories, consistent naming

**Agent execution**
- [ ] Explicit `complete_task` tool (not heuristic detection)
- [ ] Partial completion tracking for resume
- [ ] Designed for bounded context from the start

**Context injection**
- [ ] System prompt includes available resources (files, data, types)
- [ ] System prompt documents tools with user vocabulary
- [ ] Context refreshes for long sessions (or `refresh_context` tool)

**UI integration**
- [ ] Agent writes trigger UI updates immediately
- [ ] No silent actions
- [ ] Users can discover what agent can do

**Mobile (if applicable)**
- [ ] Checkpoint/resume on iOS suspension
- [ ] iCloud-first with local fallback
- [ ] Model tier selection (Haiku / Sonnet / Opus)

## Quick Start

**1. Atomic tools:**
```typescript
const tools = [
  tool("read_file", "Read any file", { path: z.string() }, ...),
  tool("write_file", "Write any file", { path: z.string(), content: z.string() }, ...),
  tool("list_files", "List directory", { path: z.string() }, ...),
  tool("complete_task", "Signal task completion", { summary: z.string() }, ...),
];
```

**2. Behavior in system prompt:**
```markdown
## Your Responsibilities
When asked to organize content:
1. Read existing files to understand structure
2. Analyze what organization makes sense
3. Create/move files using your tools
4. Use your judgment about layout and formatting
5. Call complete_task when done

You decide the structure. Make it good.
```

**3. Loop:**
```typescript
const result = await agent.run({
  prompt: userMessage,
  tools,
  systemPrompt,
  // loops until complete_task
});
```

## Reference Files

**Core patterns**
- [architecture-patterns.md](./references/architecture-patterns.md) — event-driven, unified orchestrator, agent-to-UI
- [files-universal-interface.md](./references/files-universal-interface.md) — why files, organization, context.md
- [mcp-tool-design.md](./references/mcp-tool-design.md) — tool design, dynamic capability discovery, CRUD
- [from-primitives-to-domain-tools.md](./references/from-primitives-to-domain-tools.md) — when to graduate
- [agent-execution-patterns.md](./references/agent-execution-patterns.md) — completion signals, partial completion, context limits
- [system-prompt-design.md](./references/system-prompt-design.md) — features as prompts, judgment criteria

**Disciplines**
- [dynamic-context-injection.md](./references/dynamic-context-injection.md) — runtime context
- [action-parity-discipline.md](./references/action-parity-discipline.md) — capability mapping
- [shared-workspace-architecture.md](./references/shared-workspace-architecture.md) — shared data space, UI integration
- [product-implications.md](./references/product-implications.md) — progressive disclosure, latent demand, approval
- [agent-native-testing.md](./references/agent-native-testing.md) — testing outcomes, parity tests

**Platform-specific**
- [mobile-patterns.md](./references/mobile-patterns.md) — iOS storage, checkpoint/resume, cost
- [self-modification.md](./references/self-modification.md) — git-based evolution, guardrails
- [refactoring-to-prompt-native.md](./references/refactoring-to-prompt-native.md) — migrating existing code

**Full treatments**
- [core-principles.md](./references/core-principles.md) — the 5 principles with rationale + tests
- [anti-patterns.md](./references/anti-patterns.md) — what to watch out for

## Success Criteria

**Architecture**
- [ ] Agent can achieve anything users can achieve through the UI (parity)
- [ ] Tools are atomic primitives; domain tools are shortcuts, not gates (granularity)
- [ ] New features can be added by writing new prompts (composability)
- [ ] Agent handles requests you didn't explicitly design for (emergent capability)
- [ ] Changing behavior means editing prompts, not refactoring code

**Implementation**
- [ ] System prompt includes dynamic app state
- [ ] Every UI action has a corresponding agent tool
- [ ] Agent tools documented in system prompt with user vocabulary
- [ ] Agent and user share the same data space
- [ ] Agent actions reflect in UI immediately
- [ ] Full CRUD for every entity
- [ ] Agents explicitly signal completion
- [ ] `context.md` or equivalent for accumulated knowledge

**Product**
- [ ] Simple requests work immediately, no learning curve
- [ ] Power users can push the system in unexpected directions
- [ ] You learn what users want by observing their agent requests
- [ ] Approval requirements match stakes and reversibility

### The ultimate test

Describe a domain-relevant outcome you didn't build a specific feature for. Can the agent accomplish it in a loop? If yes → agent-native. If "I don't have a feature for that" → architecture is still too constrained.
