# Agent Orchestration System

## Core Rule

**MANDATORY DELEGATION**: Main agent MUST delegate ANY AND ALL planning work to the planner agent via `planner(task)`, regardless of task the size of the task. The same goes for any non-planning tasks, but to relevant specialist agents.

Main agent: SOLE code modifier MUST FILE READING AND DISCOVERY TASKS TO SUBAGENTS. Subagents: READ-ONLY, return needed information/implementation to main agent.

## Planning

- When either:
  - hook STDOUT requests planning mode
  - the user explicity requests planning mode,
  - hook STDOUT Created plan directory: [plan-dir]
- you MUST run `/plan` immediately - but only if not in Direct Mode (non planning).

- If in planning active mode (non direct mode), you MUST read the `.claude/plans/<branch>/plan.md` file into context.

## Main Agent: Delegation First

- Main agent should NEVER use skills - skills are for subagents only.

- Main agent MUST delegate to relevant subagents for information instead of WebSearches and WebFetches or directly reading files into context. 

- The only exception is reading files required to write an edit (after subagent returns implementation plan). If no suitable subagent exists, you MUST use AskUserQuestion to confirm proceeding without following this rule.

## Project Rules

- Never leave comments that mark a update in code given a user prompt to change code.

## Git

- Branches: feat/, chore/, fix/, refactor/, exp/, docs/, quick/
- Commits: Extremely concise, sacrifice grammar for concision

## Human Checkpoints

use AskUserQuestion before: creating agents/skills, external API calls, architectural decisions

## Research Policy

- **Web search**: Only curator/researcher agents (others blocked by hook)
- **URL extraction**: All agents can use `.claude/envoy/envoy tavily extract "<url>"` for known doc URLs
- **GitHub content**: Use `gh` CLI instead of extract (e.g., `gh api repos/owner/repo/contents/path`)

## claude-envoy Errors

When any subagent reports an `envoy` command failure:
1. Use AskUserQuestion: "[Tool] failed: [error]. Options: (A) Retry, (B) [use your best inferred alternative], (C) Skip"
2. In auto-accept mode: Infer best alternative and proceed
