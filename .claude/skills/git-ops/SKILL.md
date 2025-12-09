---
name: git-ops
description: Use when performing git operations (commits, PRs, conflicts, branch mgmt). Planner auto-derives from plan context. Main agent (direct mode) may prompt user.
---

# Git Operations Skill

## Usage Context

**Planner Agent (plan mode)**: Auto-generate all commit/PR content from plan context
**Main Agent (direct mode)**: Prompt user if insufficient context

## Commit Message Generation

Conventional Commits: `<type>(<scope>): <description>`

Types: feat, fix, chore, refactor, docs, test, style, perf, ci, build

### Process (Planner - Auto)
1. Read current plan step context
2. `git diff --cached` for changes
3. Generate: `<type>(<scope>): <plan step summary>`

### Process (Main - Direct Mode)
1. `git diff --cached` for changes
2. If clear context: auto-generate
3. If ambiguous: AskUserQuestion for message

## PR Creation

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<derived from plan specs>

## Changes
<from git log main..<branch> --oneline>

## Plan Reference
`.claude/plans/<branch>/plan.md`

## Test Plan
<from plan testing requirements>
EOF
)"
```

### Planner Auto-Derive
1. Title: Plan name or branch description
2. Body: Specs summary, commits, plan ref, test plan from plan file

### Main Agent Direct Mode
- If plan exists: derive from plan
- If no plan: AskUserQuestion for PR details

## Merge Conflict Resolution

### Detection
```bash
git status
git diff --name-only --diff-filter=U
```

### Analysis
```bash
git log --oneline -5 -- <file>
git blame <file>
git show :1:<file>  # base
git show :2:<file>  # ours
git show :3:<file>  # theirs
```

### Resolution Pattern
1. Identify conflict type (content vs structural)
2. Determine intent from commit history
3. Propose resolution with explanation
4. Apply fix, stage, continue rebase/merge

## Branch Management

### Prefixes (enforced)
feat/, fix/, chore/, refactor/, exp/, docs/, quick/

### Create Branch
```bash
git checkout -b <prefix>/<description>
git push -u origin <branch>
```

### Cleanup
```bash
git branch --merged main  # list candidates
# AskUserQuestion before deletion
git branch -d <branch>
```

## Safety Rules

**ALWAYS AskUserQuestion before:**
- Force push (`--force`, `-f`)
- Hard reset (`reset --hard`)
- Branch deletion (`branch -D`)
- Rebase of shared branches

**NEVER:**
- Force push main/master without explicit confirmation
- Skip pre-commit hooks unless requested
- Amend commits not authored by current user

## Checkpoint Integration (Planner Only)

### Non-Final Checkpoint
After user testing approval:
```bash
git add -A
git commit -m "<type>(<scope>): <checkpoint step summary>"
```

### Final Checkpoint
After user testing approval:
```bash
git add -A
git commit -m "<type>(<scope>): complete <plan name>"
gh pr create --title "<plan name>" --body "<auto-derived>"
```
