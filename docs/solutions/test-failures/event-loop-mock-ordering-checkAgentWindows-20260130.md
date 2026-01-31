---
description: "Solution for event loop test failures caused by checkAgentWindows running before checkPromptLoop in each tick, requiring listWindows mock to return executor windows to prevent state reconciliation."
title: "Event loop tests fail due to checkAgentWindows reconciliation clearing spawn timestamps"
date: "2026-01-30"
milestone: "feature/unified-workflow-orchestration"
problem_type: test_failure
component: "event-loop"
symptoms:
  - "Cooldown timer tests fail unexpectedly"
  - "Spawn callback fires when cooldown should prevent it"
  - "lastExecutorSpawnTime reset between tick phases"
  - "Event loop tests pass individually but fail in sequence"
root_cause: timing_issue
severity: medium
tags:
  - event-loop-testing
  - vitest-mocking
  - checkAgentWindows
  - checkPromptLoop
  - spawn-cooldown
  - tick-ordering
  - listWindows-mock
---

## Problem

When writing unit tests for [ref:.allhands/harness/src/lib/event-loop.ts:checkPromptLoop], cooldown timer tests failed because `lastExecutorSpawnTime` was being cleared between test assertions. The root cause: each `forceTick()` call runs `checkAgentWindows()` before `checkPromptLoop()`. If `listWindows` mock returns no windows, `checkAgentWindows` reconciles by clearing `activeExecutorPrompts` and resetting spawn-related timestamps, invalidating cooldown state before `checkPromptLoop` can check it.

## Root Cause

The event loop tick has two phases executed sequentially:
1. `checkAgentWindows()` — reconciles tracked state against actual tmux windows
2. `checkPromptLoop()` — makes spawn decisions based on state

When `listWindows` returns an empty array (the default mock), phase 1 treats all tracked executors as departed and resets state. Phase 2 then sees clean state and makes incorrect spawn decisions.

## Solution

Configure `listWindows` mock to return executor window entries matching the expected active executors:

```typescript
vi.mocked(listWindows).mockResolvedValue([
  { name: 'executor-01', active: true }
]);
```

This prevents reconciliation from clearing state, allowing `checkPromptLoop` to see the correct timestamps and cooldown values.

## Prevention

When testing any event loop decision logic:
1. Always configure `listWindows` to return windows matching the expected active state
2. Remember tick ordering: agent window reconciliation runs first
3. For cooldown tests specifically, ensure executor windows persist across ticks

## Failed Approaches

- Mocking only `loadAllPrompts` without `listWindows` — reconciliation clears state
- Running cooldown tests without any active windows — timestamps reset each tick

## Related

None yet.
