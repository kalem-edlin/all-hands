---
description: "Solution for premature agent profile deletion breaking TUI compound action due to undetected tui_action field dependency between co-dependent agent profiles."
title: "Premature agent profile deletion breaks TUI action that depends on tui_action field"
date: "2026-01-30"
milestone: "feature/unified-workflow-orchestration"
problem_type: agentic_issue
component: "tui-actions"
symptoms:
  - "Compound TUI action spawns only one agent instead of two"
  - "Agent profile deleted during cleanup but still referenced by tui_action handler"
  - "Missing agent in multi-agent TUI action"
root_cause: agentic_miscommunication
severity: high
tags:
  - agent-profile-deletion
  - tui-action-dependency
  - compound-action
  - documentor-agent
  - workflow-cleanup
  - cross-file-dependency
---

## Problem

During workflow cleanup (Prompt 07), the agent deleted [ref:.allhands/agents/documentor.yaml] and [ref:.allhands/flows/DOCUMENTATION.md] as part of consolidating documentation orchestration into the hypothesis planner model. The compound TUI action relies on scanning all agent profiles with `tui_action: compound` to determine which agents to spawn. Both `compounder.yaml` and `documentor.yaml` had this field, so deleting `documentor.yaml` silently reduced the compound action to spawning only the compounder.

## Root Cause

The prompt's cleanup task ("Remove documentor.yaml agent profile and DOCUMENTATION.md flow") was scoped by architectural reasoning (documentation now handled by hypothesis planner) without verifying downstream references to the `tui_action` field. The `typescript-typecheck` validation suite and `ah validate agents` both passed because the deletion was structurally valid — no TypeScript imports referenced the YAML file, and the remaining agent profiles were individually valid.

## Solution

User-patch Prompt 17 restored both files with exact content from `main` branch using `git show main:<path>`.

## Prevention

Before deleting any agent profile:
1. Check the `tui_action` field value in the profile being deleted
2. Search for other profiles with the same `tui_action` value — if multiple profiles share a `tui_action`, they are co-dependencies for that TUI action
3. Verify the TUI action handler logic to understand if it expects multiple agents

## Failed Approaches

- Relying on `npx tsc --noEmit` — YAML files are not part of the TypeScript dependency graph
- Relying on `ah validate agents` — validates individual profiles, not cross-profile action dependencies

## Related

None yet.
