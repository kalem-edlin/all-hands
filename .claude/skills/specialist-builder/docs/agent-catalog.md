# Agent Catalog Patterns

Read this when: designing new subagents, choosing agent responsibilities, structuring multi-agent workflows.

## Context Gathering Agents

| Agent | Purpose |
|-------|---------|
| codebase-analyzer | Understanding existing code structure |
| deep-research-agent | Comprehensive research before implementation |
| git-diff-analyzer | Branch summaries, change impact |

## Decision-Making Agents

| Agent | Purpose |
|-------|---------|
| pair-programmer | Comparing solution approaches |
| system-architect | Scalable design decisions |
| root-cause-analyst | Debugging, finding source of issues |
| code-reviewer | Unbiased review, quality gates |
| refactoring-expert | Clean code transformations |

## Agent Design Principles

- Single responsibility per agent
- Clear handoff boundaries
- Context flows up (findings), instructions flow down (tasks)
- Agents return findings, main agent implements
