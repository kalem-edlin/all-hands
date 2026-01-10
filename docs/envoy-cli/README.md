---
description: Core knowledge for the envoy CLI - the command gateway enabling Claude agents to access external services, semantic search, and plan orchestration.
---

# Envoy CLI

Envoy is the tool gateway for Claude agents. It provides structured access to external APIs, semantic search over documentation, and plan workflow orchestration - all through a consistent command interface with JSON output.

## Design Philosophy

Envoy exists because Claude agents need controlled access to external services. Rather than giving agents raw API access, envoy provides:

1. **Structured input/output**: Every command returns JSON with consistent `status: "success" | "error"` shape
2. **Scoped capabilities**: Commands are domain-organized (gemini, tavily, knowledge, plan)
3. **Observability baked in**: All command executions log to `.claude/envoy.log` and metrics to `.claude/metrics.jsonl`
4. **Timeout protection**: Default 120s timeout prevents runaway API calls

The key insight: agents work better with tools that have clear contracts than with raw shell access.

## Architecture

### Command Discovery Pattern

Commands are auto-discovered from the `commands/` directory. Each module exports a `COMMANDS` object mapping subcommand names to classes extending `BaseCommand`. This enables adding new capabilities without touching core CLI code.

The discovery logic in `.claude/envoy/src/commands/index.ts` supports both single-file modules (e.g., `tavily.ts`) and directory modules with `index.ts` (e.g., `plan/index.ts`). This pattern matters because plan commands grew complex enough to warrant splitting across multiple files.

### BaseCommand Contract

All commands extend `BaseCommand` from `.claude/envoy/src/commands/base.ts`. This base class provides:

- **Automatic logging**: `executeWithLogging()` wraps execution with timing and observability
- **Response helpers**: `success()` and `error()` ensure consistent output shape
- **Empty value stripping**: Output JSON automatically removes null, undefined, empty strings, and empty arrays to reduce context noise for consuming agents

The `stripEmpty()` method is a deliberate choice - agents parsing envoy output shouldn't need to handle absent vs empty distinctions.

### Lib vs Commands Separation

The `lib/` directory contains reusable logic; `commands/` contains command classes that use lib functions. This separation matters for:

- Testing lib functions independently
- Reusing logic across commands (e.g., `plan-io.ts` used by multiple plan commands)
- Keeping command files focused on argument handling and response formatting

## Key Decisions

### Why JSON Output Everywhere

Agents parse output programmatically. Human-readable text would require fragile parsing. JSON ensures:
- Type-safe extraction of fields
- Clear success/error distinction
- Metadata attachment without cluttering primary output

### Why Commander.js

Commander provides argument parsing, help generation, and subcommand routing. The alternative (manual arg parsing) would be error-prone and require maintaining help text separately.

### Why Lazy Loading

Parser initialization (tree-sitter grammars, embedding models) is deferred until first use. Cold start for `envoy info` is under 100ms; loading the embedding model adds ~2-3s on first semantic search.

## Command Groups

| Group | Purpose | Key Commands |
|-------|---------|--------------|
| `knowledge` | Semantic search | `search`, `reindex-all` |
| `docs` | Reference formatting | `format-reference`, `validate` |
| `plan` | Workflow orchestration | `next`, `block-*-gate`, `complete` |
| `gemini` | Vertex AI inference | `audit`, `review`, `architect` |
| `tavily` | Web search/extract | `search`, `extract` |
| `perplexity` | Deep research | `research` |
| `xai` | X/Grok search | `search` |

## Related Documentation

- Knowledge system details: `docs/envoy-cli/Knowledge.md`
- External API rationale: `docs/envoy-cli/ExternalAPIs.md`
- Plan workflow orchestration: `docs/envoy-cli/PlanWorkflow.md`
- AST analysis patterns: `docs/envoy-cli/ASTAnalysis.md`
