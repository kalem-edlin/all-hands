---
description: Detailed patterns for the init/update/sync-back coordination, conflict resolution strategies, and migration handling in claude-all-hands.
---

# Sync Patterns

## Overview

The sync workflow coordinates three operations that must handle conflicts, migrations, and edge cases gracefully. This document captures the patterns and their rationale.

## Init Workflow Patterns

### Migration-First Design

When initializing a project that already has Claude configuration, the init command follows a migration-first approach at `src/commands/init.ts:migrateExistingFiles`.

**Why migrate rather than fail:**

Users shouldn't have to manually move files before adopting the framework. The migration map knows the canonical transformation for each conflicting file.

**Standard migrations:**
- `CLAUDE.md` becomes `CLAUDE.project.md` - Project instructions stay separate
- `.claude/settings.json` becomes `.claude/settings.local.json` - Local settings preserved

**Husky hook migration:**

Existing hooks move to `.husky/project/` rather than being overwritten. The migration checks hook content to avoid moving hooks that already reference the framework.

### Overwrite Warning Pattern

After migration, remaining conflicts get explicit warning at `src/commands/init.ts:cmdInit`. The pattern:

1. Calculate which files will overwrite (compare contents)
2. Display prominently with exclamation marks
3. Require explicit confirmation unless `--yes`

This prevents accidental data loss while allowing automated CI runs with the yes flag.

### Gitignore Merge Pattern

Rather than replacing .gitignore, the sync merges entries at `src/commands/init.ts:syncGitignore`:

1. Parse both source and target gitignores
2. Filter to non-comment, non-empty lines
3. Add only missing entries
4. Preserve all existing target entries

This respects project-specific ignores while ensuring framework entries exist.

## Update Workflow Patterns

### Staged Change Guard

The update command at `src/commands/update.ts:cmdUpdate` refuses to run if managed files have staged changes:

1. Get staged files via git diff
2. Intersect with distributable file set
3. Error if overlap exists

**Why this guard:**

Overwriting staged changes would cause confusion. The user has explicitly staged something - they should commit or stash first.

### Three-Way Change Detection

Update detects three change types:

1. **Modified in source**: Source content differs from target - will overwrite with warning
2. **New in source**: File exists in source but not target - will create
3. **Deleted from source**: File in manifest but missing from source - optionally delete

The deletion case prompts separately because removing files is more destructive than updating.

### Preserved Files Pattern

Certain paths never update regardless of source changes:
- `CLAUDE.project.md` - Project-specific by design
- `.claude/settings.local.json` - Local configuration
- `.husky/project/*` - Project hooks

These paths exist outside the manifest's distribute patterns, so they naturally stay untouched.

## Sync-Back Workflow Patterns

### Temp Clone Pattern

Sync-back clones the source repo to a temp directory at `src/commands/sync-back.ts:cloneAllhandsToTemp` rather than using any local copy.

**Why temp clone:**

1. **Clean state**: No local staged changes interfere
2. **Isolation**: Target repo's git state stays untouched
3. **Shallow clone**: Only needs latest commit, uses `--depth=1`

The temp directory cleans up in a finally block regardless of success.

### Protected Branch Filter

In auto mode, sync-back only proceeds on protected branches at `src/commands/sync-back.ts:cmdSyncBack`:

```
const PROTECTED_BRANCHES = new Set(['main', 'master', 'develop', 'staging', 'production']);
```

**Why this filter:**

Feature branches contain work-in-progress. Syncing every commit would spam the upstream repo with PRs. Protected branches represent reviewed, merged work - appropriate for upstream contribution.

### Branch Naming Convention

PR branches follow the pattern: `sync/<repo-name>/<branch>`

Example: `sync/my-project/main`

This namespacing:
- Groups all sync PRs
- Identifies source repo
- Identifies source branch
- Allows multiple projects to contribute without collision

### PR Update vs Create

When a sync branch already exists upstream, the workflow updates rather than creates at `src/commands/sync-back.ts:cmdSyncBack`:

1. Check if branch exists via `ls-remote`
2. If exists: checkout tracking branch, add changes
3. If not: create from `origin/main`
4. Push with `-u` to set tracking

This means repeated sync-back from the same repo/branch updates the existing PR rather than creating duplicates.

## Ignore Pattern Handling

### Source vs Target Ignore Separation

The system maintains two ignore mechanisms:

**Manifest (source-side)** at `src/lib/manifest.ts:Manifest`:
- Declares what files distribute
- Controlled by source repo maintainers
- Uses distribute/internal/exclude patterns

**Allhandsignore (target-side)** at `src/lib/manifest.ts:loadIgnorePatterns`:
- Declares what files sync back
- Controlled by target project
- Uses gitignore-style patterns

**Why separate:**

A file might be:
- Distributed but not synced back (e.g., template that projects customize)
- Synced back but not distributed (won't happen - can't sync what doesn't exist)
- Neither distributed nor synced (internal source files)

### Pattern Matching Consistency

Both mechanisms use minimatch with identical options at `src/lib/manifest.ts:isIgnored`:
- `dot: true` - Matches dotfiles
- Standard glob syntax

This consistency means users only learn one pattern language.

## Error Recovery Patterns

### Git Not Installed

Checked at startup at `src/lib/git.ts:checkGitInstalled`. Exit immediately with clear message rather than cryptic git command failures.

### gh Not Installed

Checked lazily at `src/cli.ts:main` only when needed (sync-back without --list). List mode works without gh since it only computes diffs.

### Clone Failure

If temp clone fails, sync-back returns error code. The temp directory cleanup happens in finally block regardless.

### Push Failure

Push failures log the stderr and return error code. No automatic retry - user should investigate authentication or permission issues.

### PR Creation Failure

In auto mode, PR creation failure returns success (0) to avoid blocking CI. In interactive mode, returns failure for user awareness.

## Edge Cases

### Empty Diff After Copy

After copying files and staging, sync-back checks if there's actually a diff. If files are already synced upstream, it exits cleanly rather than creating empty commits.

### No Origin Remote

Both update and sync-back assume origin remote exists. Fallback behavior uses directory name as repo identifier at `src/lib/git.ts:getRepoName`.

### Manifest Missing

All commands verify manifest existence before proceeding. Clear error message directs users to set `ALLHANDS_PATH` for development setups.
