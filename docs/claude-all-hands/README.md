---
description: CLI tool for distributing and synchronizing Claude agent configurations across repositories, using a manifest-based approach for deterministic file management.
---

# claude-all-hands

## Overview

claude-all-hands is a distribution CLI that synchronizes agent configurations, skills, and hooks from a central source repository to target projects. It solves the problem of maintaining consistent Claude configurations across multiple codebases while allowing project-specific customizations.

## Why Manifest-Based Distribution

### The Problem

Agent configurations evolve. Teams improve prompts, add skills, fix hooks. Without a synchronization strategy, every project maintains its own diverging copy. Changes that benefit all projects stay siloed.

### Alternative Approaches Considered

**Git submodules** - Creates nested repositories that complicate commits and require manual updates. Doesn't allow project-specific overrides without forking.

**npm package with runtime resolution** - Requires build steps, doesn't work well with Claude's file-based configuration expectations. Config files need to exist at specific paths.

**Copy-once scaffolding** - Projects immediately diverge. No path for receiving upstream improvements.

### The Manifest Solution

The manifest approach uses a single configuration file that declares which files should be distributed. This provides:

- **Explicit control**: The manifest at `src/lib/manifest.ts:Manifest` declares exactly which files sync
- **Bidirectional flow**: Changes can flow back upstream via PRs
- **Project isolation**: Project-specific files stay separate, never overwritten

The manifest distinguishes three categories:
- **distribute**: Files that sync to target projects
- **internal**: Files that stay in the source repo
- **exclude**: Patterns to skip entirely

## Sync Workflow Architecture

### State Flow

The CLI manages a unidirectional distribution model with optional backflow:

```
Source (claude-all-hands) --> init/update --> Target Projects
                         <-- sync-back <--
```

### Init: First-Time Setup

The init command at `src/commands/init.ts:cmdInit` handles first-time distribution with migration support.

**Key decisions:**

1. **Migration over collision**: When a target already has conflicting files (like CLAUDE.md), init migrates them to project-specific paths rather than failing or overwriting. The migration map handles known conflicts.

2. **Gitignore merging**: Rather than replacing .gitignore, init appends missing entries. This preserves project-specific ignores while ensuring framework entries exist.

3. **Husky integration**: The CLI runs husky install to enable git hooks. Project-specific hooks migrate to `.husky/project/` to coexist with framework hooks.

4. **Shell function injection**: The envoy shell function is appended to the user's shell rc file, enabling the `envoy` command in any project directory.

### Update: Pull Latest Changes

The update command at `src/commands/update.ts:cmdUpdate` pulls latest framework files.

**Conflict handling:**

- Staged changes to managed files block update (prevents accidental loss)
- Different file contents trigger overwrite warning with confirmation
- Files deleted from source optionally delete from target

**What stays untouched:**
- CLAUDE.project.md (project-specific instructions)
- .claude/settings.local.json (local config)
- .husky/project/* (project-specific hooks)

### Sync-Back: Upstream Contributions

The sync-back command at `src/commands/sync-back.ts:cmdSyncBack` creates PRs for upstream improvements.

**Why clone to temp:**

The implementation clones the source repo to a temp directory rather than using the local copy. This avoids conflicts with any staged changes in the target and ensures a clean state for PR creation.

**Protected branch behavior:**

When running in auto mode (from hooks/CI), sync-back only triggers on protected branches. This prevents PR spam from feature branches while ensuring merged improvements propagate.

**Ignore patterns:**

The `.allhandsignore` file at `src/lib/manifest.ts:loadIgnorePatterns` uses gitignore-style patterns to exclude project-specific files from sync-back. Files like `CLAUDE.project.md` should never sync upstream.

## Git Integration Design

### Why Git as Foundation

Git provides the infrastructure for:
- Change detection (comparing file contents)
- Branch management (sync-back PRs)
- Staged change awareness (conflict prevention)

The git utilities at `src/lib/git.ts:git` wrap git commands with consistent error handling and result typing.

### GitHub CLI Dependency

The sync-back command requires `gh` CLI for PR creation. This dependency is checked lazily - only when actually needed at `src/cli.ts:main` - so list mode and local operations work without it.

## Ignored File Handling

### The Two-Layer System

1. **Source-side (manifest)**: Controls what distributes from source
2. **Target-side (.allhandsignore)**: Controls what syncs back

This separation means:
- Source controls what projects receive
- Projects control what they contribute

### Pattern Matching

Both layers use minimatch at `src/lib/manifest.ts:isIgnored` for gitignore-style patterns. This familiar syntax reduces learning curve.

## Technologies

**yargs** - Chosen for CLI parsing because it provides subcommand support, type inference, and help generation with minimal boilerplate. The declarative API at `src/cli.ts:main` makes command structure clear.

**minimatch** - Standard glob matching compatible with .gitignore patterns. Used by both manifest and ignore file parsing.

**gh CLI** - GitHub's official CLI handles authentication and API calls for PR creation. Using gh rather than direct API calls means users don't need to manage tokens separately.

## Use Cases

### Distributing to New Projects

Run `claude-all-hands init <target>` to bootstrap a new project with the full agent framework. The init process:
1. Migrates any existing conflicting files
2. Copies all distributable files
3. Sets up gitignore entries
4. Installs husky hooks
5. Creates .allhandsignore template

### Receiving Updates

Run `claude-all-hands update` in any initialized project. Changed files overwrite (with confirmation), new files copy, deleted files optionally remove.

### Contributing Improvements

After improving an agent or fixing a hook, run `claude-all-hands sync-back` to create a PR. The PR targets the source repo with all changed managed files.

### CI/CD Integration

The auto mode (`--auto`) enables hook-based sync-back that only triggers on protected branches. Combined with GitHub Actions, this creates automatic upstream contribution on merge.
