---
description: Enter or re-enter plan mode for current feature branch
---

Check plan status and manage plan mode transitions.

Run `envoy plans frontmatter` to get current status:

**If direct mode**: Inform user that plan mode is disabled on protected branches (main, master, staging, production) and quick/* branches. These branches skip planning - switch to a feature branch to use plan mode.

**If no plan or status=draft**:
1. Ensure plan.md exists (run `envoy plans create` if needed)
2. stdout "Plan status: draft (completed plan required before implementation)"
3. stdout "Plan file: .claude/plans/<branch>/plan.md"
4. Enter native plan mode

**If status=active**:
1. Run `envoy plans set-status draft`
2. stdout "Plan status: draft (completed plan required before implementation)"
3. stdout "Plan file: .claude/plans/<branch>/plan.md"
4. Enter native plan mode to revise

## Status Values
- `draft` → plan being built, implementation blocked
- `active` → plan approved, implementation allowed
