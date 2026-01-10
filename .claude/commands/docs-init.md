---
description: Initialize documentation for codebase (full documentation generation)
argument-hint: [...optional paths] [optional context]
---

<objective>
Create comprehensive documentation for the codebase from scratch. Uses taxonomy-based approach with parallel documentation writers working in worktree isolation.
</objective>

<context>
Current branch: !`git branch --show-current`
Base branch: !`envoy git get-base-branch`
</context>

<process>
<step name="setup_branch">
Check if current branch equals base branch:

**If on base branch:**
1. Create docs branch: `docs/init-<timestamp>`
2. Document from fresh docs branch

**If on feature branch:**
1. Stay on current branch
2. Document from feature branch state (no branch switching)
</step>

<step name="parse_arguments">
Parse $ARGUMENTS:
- Extract paths (directories to document)
- Extract optional user context

If no paths provided:
- Document entire codebase
- Focus on: src/, lib/, packages/, app/ directories
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
Delegate to **documentation-taxonomist agent** with init-workflow:

**INPUTS:**
```yaml
mode: "init"
scope_paths: [<parsed_paths or defaults>]
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
```
</step>

<step name="parallel_writers">
For each segment from taxonomist, delegate to **documentation-writer agent** in parallel:

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

All writers run in parallel using worktree isolation.

**Parallel Worker Monitoring:**

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
After all writers complete:

1. For each worktree branch, merge to main docs branch:
   ```bash
   git merge <worktree_branch> --no-ff -m "docs: merge <domain> documentation"
   ```

2. Clean up worktrees:
   ```bash
   git worktree remove .trees/docs-<domain>
   git branch -d <worktree_branch>
   ```
</step>

<step name="validate_docs">
Run validation: `envoy docs validate`

If stale/invalid refs found:
- Present findings to user
- Delegate single writer with fix-workflow if user approves
</step>

<step name="create_pr">
Create PR:
```bash
envoy git create-pr --title "docs: initialize codebase documentation" --body "<summary>"
```

Report completion with PR link.
</step>
</process>

<success_criteria>
- Branch setup complete (docs branch from base OR stay on feature)
- Taxonomist segmented codebase
- Writers created docs in parallel (worktrees)
- Worktrees merged to docs branch
- Validation passed
- PR created
</success_criteria>

<constraints>
- MUST verify clean git state before documentation (ensure_committed_state step)
- MUST only create docs branch if already on base branch
- MUST use taxonomist for segmentation
- MUST run writers in parallel with worktrees
- MUST monitor parallel workers for stuck/blocked state
- MUST report lagging workers to user after reasonable timeout
- MUST provide options to investigate, retry, or cancel stuck workers
- MUST merge all worktrees back
- MUST validate before PR
- MUST clean up worktrees after merge
- All delegations MUST follow INPUTS/OUTPUTS format
</constraints>
