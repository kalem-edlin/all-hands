---
description: How envoy tracks command execution, API calls, and workflow metrics - enabling debugging and cost analysis for agent workflows.
---

# Observability System

Envoy maintains dual observability channels: detailed logs for debugging and structured metrics for analysis. Both enable understanding what agents are doing and why.

## Dual Channel Design

### envoy.log - Execution Traces

Detailed JSONL log of every command execution. Each entry includes:
- Timestamp
- Command name (e.g., "gemini.audit")
- Arguments
- Result (success/error)
- Duration
- Branch and plan context

Use for debugging specific executions. "Why did this command fail?" - grep the log.

### metrics.jsonl - Workflow Analytics

Structured events for workflow analysis. Event types include:
- `plan_created`, `plan_completed`
- `prompt_started`, `prompt_completed`
- `gate_completed`
- `gemini_call`
- `discovery_completed`
- `documentation_extracted`

Use for aggregate analysis. "How long do plans take?" - query metrics.

## Automatic Instrumentation

All commands extend `BaseCommand` which provides `executeWithLogging()`. This wrapper:

1. Logs command start (args)
2. Executes command
3. Logs command complete (result, duration)
4. Returns result

No manual logging required in command implementations.

## Plan Context

Both logs and metrics include plan context when available:
- `branch`: Current git branch
- `plan_name`: Derived from branch (strips `/implementation-*` suffix)

This enables filtering logs/metrics by plan for analysis.

## Metric Events

### plan_created

Emitted when `plan init` creates a new plan.

Fields:
- `mode`: Plan mode (structured, direct)
- `prompt_count`: Initial prompt count
- `has_variants`: Whether variants exist

### plan_completed

Emitted when `plan complete` finishes.

Fields:
- `duration_ms`: Total plan duration
- `prompt_count`: Final prompt count
- `total_iterations`: Sum of prompt iterations
- `gemini_calls`: Total Gemini API calls

### prompt_started / prompt_completed

Track individual prompt lifecycle.

Started fields:
- `prompt_num`, `variant`
- `specialist`: Assigned specialist
- `is_debug`: Debug prompt flag

Completed fields:
- `duration_ms`: Prompt duration
- `iterations`: Refinement iterations
- `review_passes`: Gemini review attempts

### gate_completed

Track human checkpoint duration.

Fields:
- `gate_type`: Which gate (findings, plan, testing, variants, logging)
- `duration_ms`: Time blocked waiting for user
- `user_refinements_count`: Number of feedback items

### gemini_call

Track Gemini API usage.

Fields:
- `endpoint`: Command (audit, review, ask)
- `duration_ms`: API call duration
- `success`: Boolean
- `retries`: Retry attempts
- `verdict`: Optional (passed/failed for review)

## File Locations

Both files live in `.claude/` at project root:
- `.claude/envoy.log`
- `.claude/metrics.jsonl`

These are gitignored - local to each developer's machine.

## Silent Failure

Observability should never break commands. All logging/metrics operations catch exceptions and fail silently. A logging error must not cause a command error.

## Usage Patterns

### Debug Failing Command

```bash
grep "gemini.review" .claude/envoy.log | tail -10
```

See recent review commands and their results.

### Analyze Plan Duration

```bash
grep "plan_completed" .claude/metrics.jsonl | jq '.duration_ms / 1000 / 60'
```

Plan durations in minutes.

### Count Gemini Calls

```bash
grep "gemini_call" .claude/metrics.jsonl | wc -l
```

Total Gemini API calls (for cost estimation).

### Gate Wait Times

```bash
grep "gate_completed" .claude/metrics.jsonl | jq '.duration_ms / 1000'
```

How long humans take to respond to gates.

## Design Decisions

### Why JSONL?

JSONL (newline-delimited JSON) allows:
- Append-only writes (no file corruption on crash)
- Stream processing (read line-by-line)
- Easy grep/jq analysis
- No schema migration needed (just add fields)

### Why Separate Log and Metrics?

Different consumers:
- Logs: Developers debugging specific issues
- Metrics: Analytics/dashboards for aggregate patterns

Metrics are more structured (typed events); logs are more verbose (full context).

### Why Git-Ignored?

Observability data is:
- Machine-specific (different developers, different runs)
- Large over time (unbounded growth)
- Not source code

Committing would pollute history and create merge conflicts.

### Why Derive Plan Name from Branch?

Branches follow patterns like `feat/foo/implementation-1-A`. The plan name is `feat/foo` (before `/implementation-*`).

This enables grouping metrics across worktree branches for the same plan.

## Extending Observability

To add new metric types:

1. Add type-specific function in `observability.ts`:
```typescript
export function recordMyEvent(data: { ... }): void {
  recordMetric({ type: "my_event", ...data });
}
```

2. Call from relevant command:
```typescript
recordMyEvent({ field: value });
```

No schema registration needed - just emit events with `type` field.
