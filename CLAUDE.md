# Agent Orchestration System

## Core Rule

Main agent: SOLE code modifier. Subagents: READ-ONLY, return needed information/implementation.

## Main Agent: Delegation First

Main agent should NEVER use skills - skills are for subagents only.

Main agent MUST delegate to relevant subagents for information instead of directly reading files into context. The only exception is reading files required to write an edit (after subagent returns plan). If no suitable subagent exists, use AskUserQuestion to confirm proceeding directly.

## Project Rules

- Never leave comments that mark a update in code given a user prompt to change code.

## Git

- Branches: feat/, chore/, fix/, refactor/, exp/, docs/, quick/ 
- Commits: Extremely concise, sacrifice grammar for concision

## Human Checkpoints

use AskUserQuestion before: creating agents/skills, external API calls, architectural decisions

## Research Policy

- **Web search**: Only curator/researcher agents (others blocked by hook)
- **URL extraction**: All agents can use `envoy tavily extract "<url>"` for known doc URLs
- **GitHub content**: Use `gh` CLI instead of extract (e.g., `gh api repos/owner/repo/contents/path`)

## claude-envoy Errors

When any subagent reports an `envoy` command failure:
1. Use AskUserQuestion: "[Tool] failed: [error]. Options: (A) Retry, (B) [use your best inferred alternative], (C) Skip"
2. In auto-accept mode: Infer best alternative and proceed
