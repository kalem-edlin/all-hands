---
description: Begin planning workflow for current feature branch
args: [user-prompt]
---

# Planning Workflow

Run `.claude/envoy/envoy plans frontmatter` to get current status.

## If direct mode
Inform user: planning disabled on protected branches (main, master, develop, staging, production) and quick/* branches.

## If status is draft or active
Use the **AskUserQuestion** tool to ask: "How would you like to proceed?"

**Options:**
1. **Enter plan mode** → Continue to Planning Flow below
2. **Start a new branch** → Run `/new-branch` command, then continue to Planning Flow
3. **Decline** → Run `.claude/envoy/envoy plans set-status deactivated`, planning skipped for remainder of session, proceed with user's original request without planning

## Planning Flow

### Step 1: Assess Existing Plan
Read `.claude/plans/<branch>/plan.md`. If plan is complete and user's prompt requires no significant changes → skip to Step 3 (finalize only).

### Step 2: Gather Specialist Context (only if plan needs work)
Check agent descriptions for relevant specialists (exclude researcher).

- **Specialists found**: Dispatch in parallel, query: "What repo context/patterns relevant to: {prompt}?"
- **None found**: Warn user, offer to create specialist via curator + specialist-builder skill

### Step 3: Call Planner Agent
Package and send to planner agent:
- User's original prompt
- Specialist findings (if any)
- Current plan file path: `.claude/plans/<branch>/plan.md`

The planner agent will:
1. Convert prompt into specs (spec-driven development)
2. Incorporate specialist context
3. Research unknown technologies
4. Write plan to plan file
5. Run validation (`.claude/envoy/envoy vertex validate`)
6. Handle validation feedback loop
7. Ask user to approve and activate plan
8. When approved: run `.claude/envoy/envoy plans set-status active` AND `.claude/envoy/envoy plans clear-queries` to reset tracking

### Step 3: Implementation Handoff
Once planner returns:
1. Run `.claude/envoy/envoy plans frontmatter` to verify status
2. If status != active, run `.claude/envoy/envoy plans set-status active` yourself
3. Read the plan file
4. Begin delegating implementation tasks
5. Mark tasks complete as you finish them

## Status Values
- `draft` → planning required, query tracking enabled
- `active` → plan approved, implementation allowed, query tracking disabled
- `deactivated` → user opted out this session, query tracking disabled (resets on new session)
