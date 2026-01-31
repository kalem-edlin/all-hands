---
name: git-spec-lifecycle-management
domain_name: infrastructure
type: milestone
status: roadmap
dependencies: []
branch: feature/git-spec-lifecycle-management
initial_workflow_domain: milestone
---

## Motivation

Git lifecycle management is the harness's primary pain point. The current implementation is fragile, inconsistent, and too complex. The CLI and TUI disagree on completion behavior (CLI moves specs to `specs/`, TUI moves to `specs/completed/`). There are zero `git fetch` or `git pull` operations anywhere in the codebase, so branches start stale and stay stale. The `switch-spec` action has no uncommitted changes guard. The `mark-completed` action runs destructive `git checkout -- . && git clean -fd` automatically — even if the preceding commit failed. `commitFilesToBranch` uses temp worktree tricks that introduce race conditions. `ah specs persist` bundles two distinct concerns (commit spec to main + create feature branch) into one command. Multiple worktrees create ambiguity about where a spec is actively being worked on, with no cross-worktree detection.

The engineer desires a model where the harness performs minimal, predictable git operations and the developer is responsible for being in the right state. Zero git errors from the harness. A mental model that fits on an index card.

## Goals

### Guiding Principles

1. **Developer preparedness over harness magic** — the harness does minimal, predictable git ops. The developer is responsible for being in the right state (on main, conflicts resolved).
2. **Forward-only lifecycle** — specs move from roadmap to completed. No resurrection, no clearing, no going backwards.
3. **Sync at critical junctures** — remote main is pulled at activation, PR creation, and completion. Not continuously, not silently.
4. **Errors are signals, not failures** — merge conflicts surface to the user (TUI modal or CLI error for agents). The system doesn't try to be clever about resolution yet.
5. **Kill what's unnecessary** — if it adds complexity without value, it goes.

### Spec Creation

- Engineer expects to be on the base branch (main) when creating specs. The harness enforces this — error if not on main.
- The spec file is written to `specs/roadmap/{name}.spec.md`, committed directly on main, and pushed to remote main.
- Only the newly added spec file is committed and pushed — not a blanket push of main.
- Spec creation no longer creates a feature branch. Branch creation happens at activation time.

### Spec Activation (Switching To)

- Activation pulls `origin main` first.
- If the spec's feature branch does not exist, it is created from the updated main.
- If the spec's feature branch already exists, main is merged into it to keep it current.
- If merge conflicts arise, the error is propagated: TUI shows a blocking warning modal describing the conflicts; CLI returns an error for agents to handle autonomously.
- Before activating, the harness checks all local git worktrees for an existing `.planning/` directory corresponding to this spec.
  - If found in another worktree: TUI shows a warning modal with the worktree path, suggesting the user switch to that directory. CLI returns an error with the path for agents to handle.
  - If not found elsewhere: proceeds with activation, creating `.planning/` in the current project if needed.
- The developer is checked out onto the feature branch after successful activation.

### Spec Completion

- Pulls `origin main` into the current feature branch.
- If merge conflicts exist: surfaces the conflicts to the user (TUI modal / CLI error) and aborts. The user must resolve conflicts and push to remote themselves, then retry completion.
- If no conflicts: moves the spec file from `specs/roadmap/{name}.spec.md` to `specs/{name}.spec.md` on the feature branch, updates frontmatter `status` to `completed`, commits, and pushes to remote.
- Assumes the feature branch will be merged back to main via PR, at which point main reflects the spec's completed status and all dependent branches see it.
- Engineer expects that no branch cleanup or `.planning/` cleanup occurs — that is the developer's responsibility.

### Ideation on Active Milestone

- When ideation detects a current milestone is selected (on a feature branch with an active spec), it enters a mode that builds upon the existing spec.
- The existing spec file is revised/appended with new ideation content.
- Any existing planning content (alignment docs, prompts) is treated as stale — the planner re-plans from the updated spec on the next planning run.

### Removals

- **Kill `specs/completed/` directory** — two directories only: `specs/roadmap/` for planned, `specs/` for completed. `loadAllSpecs` category logic simplifies accordingly.
- **Kill `ah specs persist` as a standalone command** — its responsibilities are split between creation (commit + push to main) and activation (branch creation + checkout + sync).
- **Kill `commitFilesToBranch`** — no more temp worktree commit tricks. Spec creation is a direct commit on main.
- **Kill `ah specs resurrect`** — specs move forward only. Once completed, they're done.
- **Kill TUI `clear-spec` action** — no deactivation concept. Developer manually checks out main if needed.
- **Kill destructive auto-cleanup** — no `git checkout -- . && git clean -fd` on completion. No `git stash` tricks.

## Technical Considerations

### Current Git Audit Findings (Grounded in Codebase Exploration)

- **Zero `git fetch`/`git pull` in the entire codebase** — the harness only pushes, never syncs from remote. This is a root cause of stale branches.
- **Raw `execSync` with string interpolation** — all git commands use unescaped string interpolation. Branch names from spec frontmatter could break commands. Shell escaping approach is an open question for the planner.
- **`hasUncommittedChanges` returns false on git failure** (`git.ts:155`) — if git itself fails, the function claims no uncommitted changes, potentially enabling destructive operations. This false-negative pattern needs fixing.
- **`switch-spec` has no uncommitted changes guard** — unlike other TUI actions, it does `git checkout` without checking dirty state first.
- **TUI `mark-completed` runs `git add -A specs/`** — stages all changes under `specs/`, not just the moved file. The new model should stage only the specific file.
- **Stash pop order bug in compaction.ts** — stashes files in forward order but pops LIFO, causing incorrect restoration order. Tangential to this milestone but worth noting.
- **No command injection protection** — branch names, spec IDs, and file paths are interpolated directly into shell commands without escaping.

### Remote Sync Points

The new model introduces `git fetch`/`git pull` at three junctures:
1. **Activation** — pull origin main into the feature branch
2. **PR creation** — pull origin main into the feature branch (Assuming PR submission workflow exists)
3. **Completion** — pull origin main into the feature branch, abort on conflicts

### Directory Structure Simplification

Current (three directories with confused semantics):
```
specs/roadmap/   -> planned specs
specs/           -> ambiguous (CLI completion target)
specs/completed/ -> TUI completion target
```

New (two directories with clear semantics):
```
specs/roadmap/   -> planned/in-progress specs
specs/           -> completed specs
```

### Conflict Resolution (Future TODO)

Engineer desires future agentic conflict resolution (potentially using open-code SDK with task context). For this milestone, merge conflicts are surfaced to the developer via TUI modals or CLI errors. This is explicitly marked as a future capability, not in scope for this milestone.

## Open Questions

- What shell escaping approach should be used for git command arguments? (e.g., `shell-escape` library, argument arrays with `spawnSync`, or manual escaping)
- Should the `git push` after spec creation be a `git push origin main` targeting just the spec commit, or a regular `git push`?
- How should the TUI modal for worktree detection be structured? (blocking vs dismissible, what information to show beyond the worktree path)
- When ideation revises an active spec, should it explicitly mark planning content as stale (e.g., a frontmatter flag), or does the planner infer staleness from spec file modification timestamps?
- How does the removal of `persist` affect the `CREATE_SPEC.md` flow and any other flows that call it?
- What happens if the developer is on main but main has uncommitted changes unrelated to the spec? Should spec creation refuse to commit, or only commit the spec file?
