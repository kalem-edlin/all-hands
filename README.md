# Claude Agent Orchestration System

Opinionated Claude Code workflow configuration. Self-sufficient in tracking best practices. Plug-and-play for any repository.

## Purpose

Enforces structured agent orchestration:
- Main agent: sole code modifier
- Subagents: read-only research/planning
- Automatic planning workflow for feature branches
- Direct mode for `main`, `master`, `staging`, `production`, `quick/*`

## Installation

```bash
# Clone into your project's .claude directory
git clone https://github.com/youruser/claude-agents.git .claude

# Or copy specific components
cp -r claude-agents/.claude/agents .claude/
cp -r claude-agents/.claude/skills .claude/
cp -r claude-agents/.claude/hooks .claude/
```

## Architecture

```
.claude/
├── agents/           # Subagent definitions (planner, curator, researcher)
├── skills/           # Knowledge skills for subagents
├── hooks/            # Lifecycle hooks (planning workflow, validation)
├── commands/         # Slash commands (/plan, /plan-checkpoint)
├── envoy/            # External tool integrations (replaces MCP)
└── plans/            # Auto-generated plan files per branch
```

## Key Components

### Agents
- **planner**: Spec-driven planning, creates implementation plans
- **curator**: Claude Code expert, manages .claude/ configurations
- **researcher**: Web search, documentation analysis

### Skills
- **claude-code-patterns**: Best practice URLs for Claude Code features
- **orchestration-idols**: Patterns from production agent systems
- **skill-builder**: Templates for creating new skills

### Hooks
- Planning workflow triggers on feature branches
- Validation before commits
- Automatic plan file management

## Usage

```bash
# Start planning workflow (auto-triggers on feature branches)
/plan

# Review implementation against plan
/plan-checkpoint
```

## Configuration

See `CLAUDE.md` for project rules and agent behavior configuration.
