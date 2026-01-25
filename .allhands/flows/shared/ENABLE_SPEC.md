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
- `last_known_branch` updated in status.yaml
</outputs>

<constraints>
- MUST validate spec exists before proceeding
- NEVER work directly on `$BASE_BRANCH` or other protected branches
</constraints>

## Planning Setup

1. Validate spec exists at `<spec_path>`
2. Run `ah planning setup --spec <spec_path>` - parse JSON for `spec` name
3. Run `ah planning activate <spec>`
4. Run `ah planning status --spec <spec>` - check `last_known_branch`

## Branch Setup

Ensure you have an isolated branch for this spec's work:

- Check `last_known_branch` from status - this tracks prior work on this spec
- If prior branch exists, continue there; otherwise create a new branch off `$BASE_BRANCH`
- Update tracking with `ah planning update-branch --spec <spec> --branch <branch>`

## Confirm

Report: spec name, branch, planning directory path, ready for planning.
