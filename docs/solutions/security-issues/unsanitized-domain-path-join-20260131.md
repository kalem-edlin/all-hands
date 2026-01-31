---
title: "Unsanitized domain value used in path.join enables path traversal"
date: "2026-01-31"
milestone: feature/workflow-domain-configuration
problem_type: security_issue
component: harness-tui
symptoms:
  - "User-selected domain value passed directly to path.join()"
  - "No validation that domain value is a known domain"
  - "Path construction could resolve to arbitrary filesystem locations"
root_cause: missing_validation
severity: high
tags:
  - path-traversal
  - path-join
  - input-validation
  - domain-allowlist
  - template-variables
  - tui-actions
  - workflow-domain
source: review-fix
---

## Problem

Three path construction sites in the harness accepted domain values (from spec frontmatter and TUI modal selection) and used them directly in `path.join()` to resolve workflow domain config file paths:

- `buildTemplateContext()` in `tmux.ts`: `path.join(workflowsDir, domain + '.md')`
- `openNewInitiativeModal()` in `tui/index.ts`: similar path construction
- `openSteeringDomainModal()` in `tui/index.ts`: context override path

A crafted `initial_workflow_domain` value like `../../etc/passwd` in spec frontmatter could resolve to arbitrary filesystem paths. The initiative-steering context override path additionally lacked an `existsSync` guard, meaning it would pass a nonexistent path as a template variable.

## Investigation

Jury review's Security reviewer and 1 additional reviewer flagged this as P1 — the path traversal vector existed at all 3 sites and the `existsSync` guard was missing only on the steering override.

## Solution

Prompt 11 implemented:

1. **Domain allowlist** (`VALID_WORKFLOW_DOMAINS`): Constant array of valid domain values derived from the `SpecType` union type in `specs.ts`
2. **Shared utility** (`getWorkflowDomain()`): Centralized function that reads `initial_workflow_domain` from spec frontmatter via `parseFrontmatter()`, validates against the allowlist, and returns `milestone` as fallback for unknown values
3. **`existsSync` guard** on initiative-steering context override path: Only applies the override if the resolved path exists on disk
4. All 3 path construction sites now use the validated domain from `getWorkflowDomain()` or the TUI modal's constrained selection

## Prevention

- When constructing filesystem paths from user-controlled or file-controlled values, validate against an allowlist before `path.join()`
- Use centralized utility functions for domain-to-path resolution to ensure validation cannot be bypassed
- Add `existsSync` guards when resolved paths are passed to downstream consumers that assume validity
- The `VALID_WORKFLOW_DOMAINS` constant is derived from the TypeScript union type, ensuring schema and runtime validation stay in sync
