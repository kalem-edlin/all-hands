---
description: Update documentation incrementally based on code changes
argument-hint: [--diff] [optional paths or context]
---

<objective>
Update documentation incrementally based on recent code changes or user-specified scope. Uses taxonomy-based approach for targeted documentation updates.
</objective>

<context>
Current branch: !`git branch --show-current`
Base branch: !`envoy git get-base-branch`
</context>

<main_agent_role>
Main agent is ORCHESTRATOR ONLY. Do NOT perform any codebase discovery, file analysis, or documentation planning. All discovery work is delegated to the taxonomist agent.

Main agent responsibilities:
1. Parse arguments (paths, flags, context)
2. Verify clean git state
3. Delegate to taxonomist with raw inputs
4. Orchestrate writers based on taxonomist output
5. Handle merging, validation, and PR creation
</main_agent_role>

<process>
<step name="parse_arguments">
Parse $ARGUMENTS:
- `--diff` flag: pass to taxonomist for git-based discovery
- Paths: pass to taxonomist as scope
- Context: pass to taxonomist as user guidance

Do NOT run discovery commands - pass raw inputs to taxonomist.
</step>

<step name="ensure_committed_state">
Before delegating to taxonomist, verify clean git state:

1. Check for uncommitted changes:
   ```bash
   git status --porcelain
   ```

2. If changes exist:
   - Use AskUserQuestion: "Uncommitted changes detected. Documentation requires committed state for valid reference hashes."
   - Options:
     - "Commit now" - propose message, gate for approval
     - "Stash and continue" - `git stash`
     - "Cancel" - abort workflow

3. If "Commit now":
   - Run `git diff --cached --stat` for context
   - Propose commit message based on staged changes
   - Gate for user approval
   - Execute: `git add -A && git commit -m "<approved message>"`

4. If "Stash and continue":
   - Execute: `git stash push -m "pre-docs stash"`
   - Note: remind user to `git stash pop` after docs complete

5. Verify clean state before proceeding:
   ```bash
   git status --porcelain
   ```
   Must return empty.
</step>

<step name="delegate_to_taxonomist">
Delegate to **documentation-taxonomist agent** with adjust-workflow.

Taxonomist handles ALL discovery: analyzing codebase, checking existing docs, identifying affected domains, creating directory structure.

**INPUTS:**
```yaml
mode: "adjust"
use_diff: true | false  # from --diff flag
scope_paths: [<paths from arguments, if any>]
user_request: "<optional context from user>"
feature_branch: "<current_branch>"
```

**OUTPUTS:**
```yaml
success: true
segments:
  - domain: "<domain-name>"
    files: ["<glob-patterns>"]
    output_path: "docs/<domain>/"
    worktree_branch: "<branch>/docs-<domain>"
    depth: "overview" | "detailed" | "comprehensive"
    notes: "<guidance>"
    action: "create" | "update"
```
</step>

<step name="parallel_writers">
If multiple segments, delegate to **documentation-writer agents** in parallel.

If single segment, delegate to single writer.

**INPUTS (per writer):**
```yaml
mode: "write"
domain: "<segment.domain>"
files: <segment.files>
output_path: "<segment.output_path>"
worktree_branch: "<segment.worktree_branch>"
depth: "<segment.depth>"
notes: "<segment.notes>"
```

**OUTPUTS:**
```yaml
success: true
```

**Parallel Worker Monitoring (if multiple segments):**

1. Launch all writers as background tasks, track task IDs and output files
2. Set monitoring interval (every 60 seconds while tasks running)
3. On each interval:
   - Check task completion status for all workers
   - If some workers completed but others still running after 2+ intervals:
     a. Read output file of lagging worker(s): `tail -100 <output_file>`
     b. Check for patterns indicating issues:
        - "permission" / "denied" / "blocked" → permission issue
        - "AskUserQuestion" / "waiting" → blocked on user input
        - "error" / "failed" / "timeout" → execution error
        - No recent output (>2 min) → possible hang
     c. Report findings to user via AskUserQuestion:
        - "Writer for <domain> appears stuck. Issue: <detected_issue>"
        - Options: ["Investigate output", "Kill and retry", "Wait longer", "Cancel all"]
4. If user selects "Investigate output":
   - Show last 50 lines of worker output
   - Ask for next action
5. If user selects "Kill and retry":
   - Kill stuck task
   - Re-launch single writer (not parallel)
   - Continue monitoring

**Completion handling:**
- Wait for all workers OR user cancellation
- Collect success/failure status per worker
- Report summary before proceeding to merge
</step>

<step name="merge_worktrees">
For each worktree branch:
1. Merge to feature branch
2. Clean up worktree and branch
</step>

<step name="validate_and_report">
Run validation: `envoy docs validate`

If in workflow context (called from /continue):
- Return success without creating PR
- Let parent workflow handle PR

If standalone:
- Create PR if changes made
- Report completion
</step>
</process>

<workflow_integration>
When called from `/continue` or implementation workflow:
- Skip PR creation
- Return `{ success: true }` for workflow to continue
- Validation warnings go to workflow orchestrator

When called standalone:
- Create PR with changes
- Present validation results to user
</workflow_integration>

<success_criteria>
- Changed files identified (if --diff)
- Taxonomist created targeted segments
- Writers updated relevant docs
- Worktrees merged
- Validation run
- PR created (if standalone)
</success_criteria>

<constraints>
- MUST NOT perform codebase discovery - delegate ALL discovery to taxonomist
- MUST NOT run envoy docs tree, envoy docs complexity, or envoy knowledge search
- MUST verify clean git state before documentation (ensure_committed_state step)
- MUST delegate to taxonomist for all segmentation and discovery
- MUST pass --diff flag to taxonomist (not process it directly)
- MUST work both standalone and in workflow context
- MUST monitor parallel workers for stuck/blocked state (if multiple segments)
- MUST report lagging workers to user after reasonable timeout
- MUST provide options to investigate, retry, or cancel stuck workers
- MUST validate after documentation
- MUST clean up worktrees
- All delegations MUST follow INPUTS/OUTPUTS format
</constraints>
