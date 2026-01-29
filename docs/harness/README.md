---
description: "Harness domain documentation covering the ah CLI commands, hook system, TUI, event loop, agent profiles, CLI daemon, and test infrastructure."
---

# Harness

The `ah` CLI is the core tool for agent orchestration. It provides commands, hooks, a terminal UI, and supporting systems.

## CLI Commands

Commands registered via filesystem auto-discovery. See [ref:docs/harness/cli/README.md::bc59166] for the full list.

## Hooks

Pre/post tool hooks that inject context, validate schemas, enforce rules, and manage agent lifecycle. See [ref:docs/harness/hooks/README.md::bc59166].

## Systems

- **TUI** — Blessed-based terminal interface with three-pane layout, modal system, and vim-style navigation: [ref:docs/harness/tui.md::bc59166]
- **Event Loop** — Background polling for prompt dispatch, agent monitoring, PR review detection, and branch state: [ref:docs/harness/event-loop.md::bc59166]
- **Agent Profiles** — YAML profile loading, template resolution, and invocation building: [ref:docs/harness/agent-profiles.md::bc59166]
- **CLI Daemon** — Unix socket server for fast hook execution, bypassing CLI startup overhead: [ref:docs/harness/cli-daemon.md::bc59166]
- **Test Harness** — E2E test infrastructure with fixtures, runners, and assertions: [ref:docs/harness/test-harness.md::bc59166]
