<goal>
Enable a spec by setting up its planning directory and activating it. Per **Frontier Models are Capable**, you manage branch decisions - the harness is a "dumb filing cabinet" that tracks your choices.
</goal>

<inputs>
- spec_path: Path to the spec file (e.g., `specs/roadmap/taskflow-mvp.spec.md`)
</inputs>

<outputs>
- `.planning/{spec}/` directory with `status.yaml` and `prompts/`
- Spec set as active via `.planning/.active`
- Appropriate git branch checked out
</outputs>

<constraints>
- MUST validate spec exists before proceeding
- NEVER work directly on `$BASE_BRANCH` or other protected branches
</constraints>

## Activate Spec

Run `ah planning activate <spec_path>` - this:
- Creates `.planning/{spec}/` if it doesn't exist
- Sets the spec as active
- Returns status including `last_known_branch`

Parse the JSON response to get the spec name and branch state.

## Branch Setup

Ensure you have an isolated branch for this spec's work:

- Check `last_known_branch` from the activate response
- **If prior branch exists** (not null, not `$BASE_BRANCH`):
  - Checkout that branch: `git checkout {last_known_branch}`
  - Merge in latest from base: `git merge $BASE_BRANCH` (pulls in any new specs/changes)
- **If null or equals `$BASE_BRANCH`**:
  - Create new branch from base: `git checkout -b feature/{spec-name}`

The EventLoop automatically updates `last_known_branch` when you switch branches, so no manual tracking command is needed.

## Confirm

Report: spec name, branch, planning directory path, ready for planning.
