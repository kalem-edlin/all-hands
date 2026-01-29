<goal>
Write a spec file with proper schema, create its branch, and persist to base. Single source of truth for spec creation.
</goal>

## Write Spec

Run `ah schema spec` for the schema format. Write `specs/roadmap/{name}.spec.md` following the schema.

## Branch Prefix Convention

Per **Frontier Models are Capable**, derive the default branch prefix from the spec `type` field:

| Spec Type | Branch Prefix |
|-----------|---------------|
| `milestone` (or missing) | `feature/` |
| `investigation` | `fix/` |
| `optimization` | `optimize/` |
| `refactor` | `refactor/` |
| `documentation` | `docs/` |
| `triage` | `triage/` |

The `branch` field on the spec is always the source of truth — this convention applies to the default suggestion when the spec doesn't specify one.

## Persist

Run: `ah specs persist specs/roadmap/{name}.spec.md --json`

This creates the branch, resolves naming collisions, and commits. Parse `specBranch` from response for the final branch name.

Run: `ah knowledge roadmap reindex`

## Confirm

Report spec name and branch to engineer.

Ask: "Would you like to start working on this now?"

If yes:
```bash
git checkout {branch}
ah planning ensure
```
