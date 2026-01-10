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

<process>
<step name="parse_arguments">
Parse $ARGUMENTS:
- `--diff` flag: use git diff to find changed files
- Paths: specific directories/files to document
- Context: user-provided guidance

Determine mode:
- If `--diff`: get changed files from git
- If paths: use provided paths
- If neither: ask user for scope
</step>

<step name="get_changed_files">
If `--diff` mode:
```bash
envoy git diff-base --summary
```
Extract file paths from `changed_files[].path` in the response.

Filter to source files only (exclude tests, configs, etc. unless explicitly requested).
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
Delegate to **documentation-taxonomist agent** with adjust-workflow:

**INPUTS:**
```yaml
mode: "adjust"
changed_files: [<list from git diff or user paths>]
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
- MUST verify clean git state before documentation (ensure_committed_state step)
- MUST use taxonomist for intelligent segmentation
- MUST support --diff flag for git-based changes
- MUST work both standalone and in workflow context
- MUST monitor parallel workers for stuck/blocked state (if multiple segments)
- MUST report lagging workers to user after reasonable timeout
- MUST provide options to investigate, retry, or cancel stuck workers
- MUST validate after documentation
- MUST clean up worktrees
- All delegations MUST follow INPUTS/OUTPUTS format
</constraints>
