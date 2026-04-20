# Anti-Patterns

## Approaches that aren't fully agent-native

Not necessarily wrong for your use case — but different from this architecture.

- **Agent as router** — Agent figures out intent, then calls the right function. Using agent intelligence to route, not to act.
- **Build the app, then add agent** — Features built traditionally, then exposed to an agent. Agent can only do what features already do. No emergent capability.
- **Request/response thinking** — Agent gets input, does one thing, returns output. Misses the loop.
- **Defensive tool design** — Over-constrained inputs, strict enums, validation at every layer. Safe but prevents unanticipated use.
- **Happy path in code, agent just executes** — Code handles all edge cases. Agent is just a caller.

## Specific anti-patterns

### The cardinal sin: agent executes YOUR code

```typescript
// WRONG — you wrote the workflow
tool("process_feedback", async ({ message }) => {
  const category = categorize(message);
  const priority = calculatePriority(message);
  await store(message, category, priority);
  if (priority > 3) await notify();
});

// RIGHT — agent figures it out
tools: store_item, send_message
prompt: "Rate importance 1-5 based on actionability, store feedback, notify if >= 4"
```

### Workflow-shaped tools
`analyze_and_organize` bundles judgment. Break into primitives; let the agent compose.

### Context starvation
Agent doesn't know what exists.
```
User: "Write something about Catherine the Great in my feed"
Agent: "What feed?"
```
Fix: inject available resources, capabilities, vocabulary into system prompt.

### Orphan UI actions
User can do X in UI; agent can't. Fix: maintain parity.

### Silent actions
Agent changes state, UI doesn't update. Fix: shared data stores with reactive binding, or file system observation.

### Heuristic completion detection
Detecting completion via consecutive no-tool-call iterations or expected output files. Fragile. Fix: explicit `complete_task` tool.

### Static tool mapping for dynamic APIs
```typescript
// WRONG
tool("read_steps", ...)
tool("read_heart_rate", ...)
tool("read_sleep", ...)

// RIGHT — dynamic discovery
tool("list_available_types", ...)
tool("read_health_data", { dataType: z.string() }, ...)
```

### Incomplete CRUD
```typescript
tool("create_journal_entry", ...)  // missing update, delete
```
Fix: every entity needs full CRUD.

### Sandbox isolation
```
Documents/
├── user_files/      ← user's space
└── agent_output/    ← agent's space (isolated)
```
Fix: shared workspace.

### Gates without reason
Domain tool is the only path and you didn't mean to restrict. Default open. Keep primitives available.

### Artificial capability limits
Restricting based on vague safety concerns rather than specific risks. Be thoughtful; generally the agent should do what users can do.
