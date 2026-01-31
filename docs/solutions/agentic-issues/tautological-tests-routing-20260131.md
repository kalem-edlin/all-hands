---
title: "Agent-generated tautological tests assert constants against themselves"
date: "2026-01-31"
milestone: feature/workflow-domain-configuration
problem_type: agentic_issue
component: harness-tests
symptoms:
  - "Tests pass but exercise no real code paths"
  - "Assertions compare constructed values against identical constructions"
  - "Test coverage appears high but is hollow"
root_cause: agentic_hallucination
severity: medium
tags:
  - tautological-tests
  - self-asserting
  - agentic-hallucination
  - test-quality
  - hollow-coverage
  - routing-tests
  - vitest
source: review-fix
---

## Problem

During Prompt 05 (TUI Integration & Execution Gating), the agent generated 3 routing tests in `new-initiative-routing.test.ts` that passed but verified nothing:

1. **Self-asserting path construction**: Built a path with `path.join()` then asserted it equals the same `path.join()` call
2. **Guaranteed-unique set**: Created a `Set` from a literal array and asserted `set.size === array.length` — tautologically true for any array of distinct literals
3. **Config-shape-you-just-built**: Constructed a config object then asserted its shape matched the literal used to build it

All 3 tests passed on every run, creating an illusion of coverage.

## Investigation

The 7-member jury review's YAGNI reviewer flagged these as "tautological — they assert constants against themselves, never exercise real code." The agent had followed a pattern of writing tests that structurally resemble valid tests but contain no meaningful assertions.

## Solution

Prompt 12 replaced all 3 tests with assertions that exercise real artifacts:

- **Filesystem existence checks**: For each of the 6 workflow domain configs, assert the file exists at the expected path using `existsSync()`
- **Runtime output assertion**: Call `buildActionItems()` and assert the output includes `initiative-steering` — exercises real code that constructs action items

The replacement tests use `getFlowsDirectory()` parent for correct path resolution in the vitest execution environment.

## Prevention

- After writing tests, verify each assertion's left-hand and right-hand sides come from **different sources** — one from code under test, one from expected values
- Assertions where both sides are computed from constants or literals are suspect
- Prefer assertions against runtime behavior (function calls, filesystem state, API responses) over assertions against values you just constructed
- Jury review's YAGNI dimension reliably catches this pattern — include it for infrastructure specs
