# Core Principles

## 1. Parity

**Whatever the user can do through the UI, the agent should be able to achieve through tools.**

Foundational. Without this, nothing else matters. Ensure the agent has tools (or combinations of tools) to accomplish any outcome achievable in the UI — not a 1:1 button-to-tool mapping, but **outcome parity**.

Capability map:

| User Action | How Agent Achieves It |
|-------------|----------------------|
| Create a note | `write_file` to notes dir, or `create_note` tool |
| Tag a note as urgent | `update_file` metadata, or `tag_note` tool |
| Search notes | `search_files` or `search_notes` |
| Delete a note | `delete_file` or `delete_note` |

**Test:** Pick any UI action. Describe it to the agent. Can it accomplish the outcome?

## 2. Granularity

**Prefer atomic primitives. Features are outcomes achieved by an agent operating in a loop.**

Less granular (limits agent): `classify_and_organize_files(files)` — you wrote the decision logic.

More granular (empowers agent): `read_file`, `write_file`, `move_file`, `list_directory`, `bash` + a prompt describing the outcome.

The agent pursues an outcome with judgment, not a choreographed sequence.

**Test:** To change how a feature behaves, do you edit prose or refactor code?

## 3. Composability

**With atomic tools and parity, new features are new prompts.**

"Weekly review" isn't code — it's a prompt:
```
Review files modified this week. Summarize key changes. Based on
incomplete items and approaching deadlines, suggest three priorities
for next week.
```

This works for developers and users. Users can extend the application with their own prompts.

**Test:** Can you add a new feature by writing a new prompt section, without adding new code?

## 4. Emergent Capability

**The agent can accomplish things you didn't explicitly design for.**

*"Cross-reference my meeting notes with my task list and tell me what I've committed to but haven't scheduled."*

You never built a "commitment tracker." But if the agent can read notes, read tasks, and reason about them in a loop, it figures it out.

**The flywheel:**
1. Build with atomic tools + parity
2. Users ask for unanticipated things
3. Agent composes tools (or fails, revealing a gap)
4. You observe patterns
5. Add domain tools or prompts where patterns are common
6. Repeat

**Test:** Give the agent an open-ended domain request. Can it find a reasonable approach? If it just says "I don't have a feature for that," the architecture is too constrained.

## 5. Improvement Over Time

**Agent-native apps get better without shipping code.**

- **Accumulated context:** `context.md` the agent reads and updates. More sophisticated: structured memory, learned preferences.
- **Prompt refinement:** developer-level (ship updated prompts), user-level (customize), agent-level (self-modification with guardrails).
- **Self-modification (advanced):** agents editing their own prompts / code. Needs approval gates, checkpoints, health checks.

**Test:** Does the application work better after a month of use than on day one, without code changes?
