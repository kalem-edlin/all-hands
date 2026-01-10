---
description: How envoy orchestrates multi-prompt implementation plans - lifecycle management, blocking gates, and the findings-to-prompts pipeline.
---

# Plan Workflow Orchestration

Envoy's plan commands orchestrate complex implementation workflows. Understanding this system is essential for building agents that collaborate on multi-step features.

## Core Concepts

### Plan

A plan represents a feature implementation. It lives in `.claude/plan/<branch-name>/` and contains:
- `plan.md`: Overview with front-matter tracking stage and reviews
- `prompts/`: Individual implementation steps
- `findings/`: Discovery phase outputs (pre-planning)
- `user_input.md`: Accumulated user feedback and clarifications

### Prompt

A prompt is a single implementation unit with:
- Description and success criteria
- Dependencies on other prompts
- Status tracking (draft -> in_progress -> implemented -> tested -> merged)
- Optional variants (A, B) for parallel exploration

### Gate

A gate is a human checkpoint. The agent blocks until the user sets `done: true` in a YAML feedback file. Gates ensure humans review critical decisions.

### Finding

A finding captures specialist discovery. Before planning, specialists explore the codebase and propose approaches. Findings aggregate these proposals for user review.

## Lifecycle Flow

```
1. init           -> Create plan directory structure
2. write-finding  -> Specialists record discovery
3. write-approach -> Attach proposed approaches to findings
4. block-findings-gate -> User reviews approaches
5. write-plan     -> Create plan overview
6. write-prompt   -> Create implementation prompts
7. block-plan-gate -> User approves plan
8. next           -> Get available prompts (deps satisfied)
9. start-prompt   -> Mark prompt in_progress
10. [implementation by specialist]
11. record-implementation -> Save walkthrough
12. block-prompt-testing-gate -> User tests
13. complete-prompt -> Mark merged
14. complete       -> Generate PR summary
```

## Gate System

Gates are the key orchestration mechanism. When an agent calls a `block-*-gate` command:

1. Envoy creates a YAML feedback file with template structure
2. Command blocks (via file watcher) waiting for `done: true`
3. User edits file, adds feedback, sets `done: true`
4. Command resumes, processes feedback, returns result

### Gate Types

| Gate | Purpose | Feedback Structure |
|------|---------|-------------------|
| `block-findings-gate` | Review specialist approaches | Per-approach changes, rejections, Q&A |
| `block-plan-gate` | Approve plan before implementation | Plan changes, per-prompt changes |
| `block-prompt-testing-gate` | Manual testing checkpoint | Pass/fail, logs, required changes |
| `block-prompt-variants-gate` | Choose between variant implementations | Accept/reject/feature-flag per variant |
| `block-debugging-logging-gate` | Capture debug output | Logs for debug prompts |

### Gate Timeout

Gates timeout after 12 hours (configurable via `BLOCKING_GATE_TIMEOUT_MS`). This prevents indefinitely blocked agents while allowing reasonable human response time.

### Feedback Processing

Gate feedback flows into the plan:
1. `thoughts` field appended to `user_input.md` for audit trail
2. Per-item feedback updates relevant artifacts (approaches, prompts)
3. Rejected items are deleted (variants) or marked (approaches)

## Dependency Management

Prompts declare dependencies via `depends_on: [1, 2]` in front-matter. The `next` command respects these:

1. Find all non-merged, non-in_progress prompts
2. Filter to those whose dependencies are all merged
3. Sort: debug prompts first, then by number, then by variant
4. Return up to N independent prompts

This enables parallel execution - prompts without shared dependencies can run simultaneously.

## Variant System

When approaches have alternatives, prompts can be created as variants (1_A, 1_B). The workflow:

1. Create variant prompts with same number, different letters
2. Implement each variant independently
3. Test each variant
4. `block-prompt-variants-gate` lets user choose
5. Rejected variants deleted; accepted variants proceed

Variants solve the "which approach is better?" problem by implementing both and letting the user decide post-testing.

## Prompt Status Flow

```
draft          -> Initial state after write-prompt
in_progress    -> start-prompt called, specialist working
implemented    -> record-implementation saved walkthrough
tested         -> block-prompt-testing-gate passed
reviewed       -> gemini review passed
merged         -> complete-prompt called
```

Status transitions are idempotent - calling complete-prompt on an already-merged prompt is a no-op.

## Plan I/O

Plan commands use helpers in `.claude/envoy/src/lib/plan-io.ts`:

- `readPlan()` / `writePlan()`: Front-matter + content for plan.md
- `readPrompt()` / `writePrompt()`: Individual prompt files
- `appendUserInput()`: Timestamped additions to user_input.md

All plan files use gray-matter format (YAML front-matter + markdown content).

## Observability Integration

Plan commands emit metrics to `.claude/metrics.jsonl`:

- `plan_created`: Mode, prompt count, has variants
- `prompt_started`: Prompt ID, specialist, is debug
- `prompt_completed`: Duration, iterations, review passes
- `gate_completed`: Gate type, duration, refinement count
- `plan_completed`: Total duration, prompt count, gemini calls

These metrics enable analyzing workflow efficiency across plans.

## Design Decisions

### Why File-Based Gates (Not WebSockets)?

File watching is simpler and works offline:
- No server to run
- Works in any terminal environment
- User can edit with any tool
- Git-friendly for audit trail

### Why YAML Feedback Files?

YAML is human-editable:
- No JSON syntax errors from missing commas
- Comments allowed for notes
- Multi-line strings natural

### Why Append-Only User Input?

`user_input.md` is append-only because:
- Full history visible for audit
- Gemini can see all clarifications
- No accidental overwrites

### Why Block (Not Poll)?

Blocking with file watcher is simpler than polling:
- No busy-wait CPU usage
- Instant response when `done` changes
- Timeout handled at watcher level

## Common Patterns

### Get Next Available Work

```bash
envoy plan next -n 3
```

Returns up to 3 prompts with satisfied dependencies. Useful for parallel specialist dispatch.

### Check Plan Health

```bash
envoy plan status
```

Shows plan stage, prompt statuses, pending gates. Quick overview for orchestration decisions.

### Force-Release Stuck Prompts

```bash
envoy plan release-all-prompts
```

Clears `in_progress` on all prompts. Use when specialists crashed mid-work.
