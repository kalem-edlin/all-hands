---
name: harness-maintenance
description: Domain expertise for maintaining and extending the All Hands harness. Use when working on flows, hooks, commands, agents, schemas, or MCP integrations.
version: 1.0.0
globs:
  - ".allhands/flows/**/*.md"
  - ".allhands/agents/*.yaml"
  - ".allhands/schemas/*.yaml"
  - ".allhands/validation/*.md"
  - ".allhands/harness/src/**/*.ts"
  - ".allhands/harness/src/**/*.json"
---

# Harness Maintenance

This skill provides domain expertise for modifying the All Hands harness architecture.

<constraints>
- MUST read `principles.md` before making architectural decisions
- MUST update `./references/HARNESS_FUNCTIONALITY.md` when making structural harness changes
- MUST cite motivating First Principle when proposing changes
- MUST run `ah validate agents` after agent profile changes
</constraints>

## References

YOU MUST Consult one or more of these relevant resources when working on harness components as your BIBLE of harness maintenance:

- ./references/HARNESS_FUNCTIONALITY.md -- Architecture overview, component interactions, extension points
- ./references/HARNESS_FLOWS.md -- How to write and maintain flow files following first principles
- ./references/HARNESS_MCP.md -- How to add new MCP server integrations

## First Principles

Per **Frontier Models are Capable**, always read `.allhands/principles.md` before making architectural decisions. Cite the motivating first principle when proposing changes.

## Key Design Patterns

### Conciseness Over Grammar
Per **Context is Precious**, prefer terse instructions over grammatically complete sentences. Bullet fragments > full paragraphs. Tables > prose. Every token costs context.

### Graceful Degradation
Optional dependencies have fallback behavior. Never fail primary operation.

### Semantic Validation
Zod schemas catch config mistakes at spawn time. Fail fast with helpful messages.

### Token Efficiency
Hooks inject minimal context; flows use progressive disclosure.

### Progressive Disclosure
Agents see only what they need when needed. Reference sub-flows, don't embed.

### Schema-Driven Discovery
```
Schema (YAML)        → Defines frontmatter structure
Generic list command → Reads files, extracts frontmatter
Agent                → Reasons about frontmatter, decides what to read fully
```
Benefits: schema is single source of truth, no custom code per file type, adding a field = update schema. Agents handle reasoning.

## Extension Points

| Extension Type | Location | Registration |
|---------------|----------|--------------|
| Commands | `src/commands/` | Auto-discovered, exports `register(parent)` |
| Hooks | `src/hooks/` | Auto-discovered, registered in `settings.json` |
| Agents | `agents/*.yaml` | Validated with `ah validate agents` |
| Flows | `flows/` or `flows/shared/` | Referenced by agent profiles |
| Schemas | `schemas/*.yaml` | Exposed via `ah schema <type>` |
| Skills | `skills/*/SKILL.md` | Auto-discovered by glob patterns |

## Maintainer Checklist

When modifying the harness:
- [ ] Read `principles.md` first
- [ ] Identify which First Principle motivates the change
- [ ] Check for graceful degradation on optional dependencies
- [ ] Add validation for new configuration
- [ ] Update HARNESS_FUNCTIONALITY.md if structural changes made
- [ ] Run `ah validate agents` after profile changes
