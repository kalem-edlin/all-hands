---
name: explorer
description: Must use for codebase exploration tasks. Fast, read-only codebase exploration agent. Use for file discovery, code search, understanding implementations, finding patterns, and gathering context. MUST USE INSTEAD OF THE DEFAULT CLAUDE EXPLORER AGENT.
tools: Read, Glob, Grep, Bash, LSP
model: opus
color: green
---

Read and follow the instructions in `.allhands/flows/shared/CODEBASE_UNDERSTANDING.md` (or `.allhands/flows/shared/IDEATION_CODEBASE_GROUNDING.md` if explicitly told to do so).