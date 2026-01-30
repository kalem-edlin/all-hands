---
name: harness-maintenance
description: Domain expertise for maintaining and extending the All Hands harness. Use when working on flows, hooks, commands, agents, schemas, or MCP integrations.
version: 2.0.0
globs:
  - ".allhands/flows/**/*.md"
  - ".allhands/agents/*.yaml"
  - ".allhands/schemas/*.yaml"
  - ".allhands/skills/**/*.md"
  - ".allhands/validation/*.md"
  - ".allhands/workflows/**/*.yaml"
  - ".allhands/harness/src/**/*.ts"
  - ".allhands/harness/src/**/*.json"
---

# Harness Maintenance

<goal>
Route maintainers to domain-specific harness knowledge. Per **Context is Precious**, agents load only the reference matching their scenario — not the full architecture.
</goal>

<constraints>
- MUST read `.allhands/principles.md` before any harness modification
- MUST cite First Principles by name when adding features or changing behavior
- MUST validate changes with `ah validate agents` after profile modifications
- NEVER add complexity without clear first principle justification
</constraints>

## Start Here

Read `.allhands/principles.md` first. Every harness change should be motivated by a named principle.

## Reference Routing

| Scenario | Reference | When to Use |
|----------|-----------|-------------|
| Writing or editing flows | [`references/writing-flows.md`](references/writing-flows.md) | Authoring flow files, XML tags, progressive disclosure, structure conventions |
| Hooks, commands, or MCP | [`references/tools-commands-mcp-hooks.md`](references/tools-commands-mcp-hooks.md) | Adding/modifying hooks, CLI commands, MCP servers, extension points |
| Architecture & schemas | [`references/core-architecture.md`](references/core-architecture.md) | Directory structure, TUI lifecycle, schema system, agent profiles, settings, platform integration |
| Skills system | [`references/harness_skills.md`](references/harness_skills.md) | Creating/extending skills, hub-and-spoke pattern, skill schema, discovery mechanism |
| Validation tooling | [`references/validation-tooling.md`](references/validation-tooling.md) | Creating validation suites, crystallization lifecycle, suite writing philosophy |
| Knowledge & docs | [`references/knowledge-compounding.md`](references/knowledge-compounding.md) | Documentation schemas, solutions, memories, knowledge indexes, compounding patterns |

## Cross-Cutting Patterns

### Key Design Patterns
- **Graceful Degradation**: Every optional dependency (TLDR, pyright, Greptile) has fallback behavior. Never fail the primary operation.
- **Semantic Validation**: Zod schemas catch config mistakes at spawn time, not runtime. Fail fast with helpful messages.
- **In-Memory State**: Registry patterns (spawned agents, search contexts) keep TUI in sync without polling.
- **Motivation-Driven Documentation**: Per **Frontier Models are Capable**, teach agents HOW TO THINK about using a tool — not command catalogs. Commands are discoverable via `--help`; documentation value is in motivations and thinking models.
- **Token Efficiency**: Read enforcer + context injection + TLDR layers save ~95% on large files.
- **Iterative Refinement**: Compaction summaries make incomplete work resumable. Per **Prompt Files as Units of Work**, same prompt can be re-run with accumulated learnings.

### Maintainer Checklist
- [ ] Read `principles.md` first
- [ ] Identify which First Principle motivates the change
- [ ] Check for graceful degradation on optional dependencies
- [ ] Add validation for new configuration
- [ ] Update relevant reference doc if structural changes made
- [ ] Run `ah validate agents` after profile changes
- [ ] Test hook behavior with Claude Code runner
