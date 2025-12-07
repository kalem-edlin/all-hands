---
name: claude-code-patterns
description: Use when building agents, skills, hooks, or tool configs. Contains Claude Code native feature documentation and structure patterns.
---

# Claude Code Best Practices

Quick reference for curator agent. Use `envoy tavily extract "<url>"` for deeper research.

## Quick Reference

| Topic | Primary Docs |
|-------|-------------|
| Skills | [Official Docs](https://code.claude.com/docs/en/skills), [Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) |
| Agents | [Sub-agents](https://code.claude.com/docs/en/sub-agents), [Custom Agents](https://claudelog.com/mechanics/custom-agents/) |
| Hooks | [Hooks Guide](https://code.claude.com/docs/en/hooks-guide), [Reference](https://code.claude.com/docs/en/hooks) |
| MCP | [MCP Docs](https://code.claude.com/docs/en/mcp), [Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use) |
| Memory | [Memory Tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool), [AgentDB](https://agentdb.ruv.io/) |

## Skills

- [Official Docs](https://code.claude.com/docs/en/skills)
- [Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Real World Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Human-in-loop Example](https://github.com/alonw0/web-asset-generator/blob/main/skills/web-asset-generator/SKILL.md)
- [Skill Args PR](https://github.com/anthropics/claude-code/issues/12633) - watch for arg passing support

## Agents

- [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- [Sub-agent Patterns](https://claudelog.com/mechanics/sub-agents/)
- [Split-role Agents](https://claudelog.com/mechanics/split-role-sub-agents/) - ultra think mode
- [Custom Agents](https://claudelog.com/mechanics/custom-agents/) - community patterns
- [Agent Engineering](https://claudelog.com/mechanics/agent-engineering/)

## Hooks

- [Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Reference](https://code.claude.com/docs/en/hooks)

## MCP

- [MCP Docs](https://code.claude.com/docs/en/mcp)
- [Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)
- claude-envoy preferred over raw MCP - adapt from [claude-oracle pattern](https://github.com/n1ira/claude-oracle/tree/main)
- Platform MCPs: [Reddit](https://claudelog.com/claude-code-mcps/reddit-mcp/), [Twitter](https://claudelog.com/claude-code-mcps/twitter-mcp/)

## Memory

- [Memory Tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [AgentDB](https://agentdb.ruv.io/) - [Management IDE](https://agentdb.ruv.io/demo/management-ide)

## General

- [Poison Context Awareness](https://claudelog.com/mechanics/poison-context-awareness/)
- [CLAUDE.md Supremacy](https://claudelog.com/mechanics/claude-md-supremacy/)
- [Plugins](https://code.claude.com/docs/en/plugins) - packaging solutions
