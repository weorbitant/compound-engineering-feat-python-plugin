---
review_agents: [python-quality-reviewer, pytest-reviewer, python-lint, code-simplicity-reviewer, security-sentinel, performance-oracle, fastapi-reviewer]
plan_review_agents: [python-quality-reviewer, pytest-reviewer, python-lint, code-simplicity-reviewer]
frameworks: [fastapi, pydantic]
database: []
workflow_skills:
  brainstorm: [fastapi-patterns]
  plan: [fastapi-patterns]
  work: [fastapi-patterns, pytest-patterns]
  review: [fastapi-patterns, pytest-patterns]
---

# Review Context

Demo monorepo for testing py-micro-superpowers. Services keep state in memory on purpose; do not flag the missing database.
