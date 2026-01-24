<goal>
Extract learnings from completed milestones to improve the harness, skills, and validation tooling. Per **Knowledge Compounding**, everything feeds forward - decisions, pivots, limitations, and realizations become persistent improvements.
</goal>

<constraints>
- MUST ask the engineer before modifying harness files
- MUST update `.allhands/flows/shared/HARNESS_FUNCTIONALITY.md` when making structural harness changes
- MUST write compounding summary to `.planning/<milestone>/compounding_summary.md`
- NEVER modify harness without first principle justification
</constraints>

## Context Gathering

Read these milestone artifacts to understand what happened:
- Read the alignment doc at `.planning/<milestone>/alignment.md`
- Read the spec doc at `.planning/<milestone>/spec.md`
- Read all prompt files in `.planning/<milestone>/prompts/`
- Run `git log --oneline` to review commit history for this branch

## Signal Analysis

Identify patterns that indicate harness improvement opportunities:

**Prompt Signals**:
- Failed prompts (multiple attempts) → execution or planning issues
- Patch prompts → check `patches_prompts` field to find root cause
- Emergent refinement inclusions/exclusions → engineer intent signals
- Review prompt count → planning or review quality issues

**Tooling Signals**:
- Cross-reference patch prompts with their `skills` and `validation_suites` frontmatter
- Identify skills that led to bad guidance
- Identify validation suites that missed issues

**Decision Signals**:
- Design decisions made given limitations
- Engineer rejections and frustrations
- Compromises between agentic suggestions and engineer preferences

## Harness Improvement Decision Tree

Per **Frontier Models are Capable**, apply learnings to improve the harness:

| Signal Pattern | Improvement Target |
|----------------|-------------------|
| Initial ideas forgotten during implementation | `MILESTONE_PLANNING.md` |
| More prompts than expected for ideation | `PROMPT_TASKS_CURATION.md` |
| Skills led to bad guidance | Fix skill files directly |
| Validation missed issues | Fix validation suite files |
| Structural harness issues | Read `.allhands/flows/shared/HARNESS_FUNCTIONALITY.md` |

Before modifying any harness file:
- Read `.allhands/flows/shared/HARNESS_FLOWS.md` for flow writing rules
- Cite first principle justification for changes
- Ask the engineer for approval

## Harness Ideation Interview

Conduct a mini ideation session for harness improvements:
- Present detected issues and proposed fixes
- Ask the engineer about painpoints they experienced
- Reference `.allhands/principles.md` to ensure alignment
- Validate that proposed changes serve first principles

## Memory Extraction

Per **Knowledge Compounding**, capture learnings as memories:
- Write to `.allhands/memories.md`
- Format: `[Name] | [Domain] | [Source] | [Description]`
  - Domains: `planning`, `validation`, `implementation`, `harness-tooling`, `ideation`
  - Sources: `user-steering`, `agent-inferred`
  - Description: 1-3 sentences of self-contained learning

## Spec Finalization

Update the milestone spec as a historical record:
- Amend expectations based on implementation reality
- Document decisions and their rationale
- Capture what changed and why

## Completion

Write `.planning/<milestone>/compounding_summary.md`:
```markdown
# Compounding Summary

## Detected Issues
- [Patterns from patches, failures, feedback]

## Tooling Fixes
- [Skill file changes]
- [Validation suite changes]

## Flow Updates
- [Flow file adjustments]

## Memories Added
- [References to .allhands/memories.md entries]

## Engineer Feedback Addressed
- [Specific concerns resolved]
```

This flow is idempotent - if run again without new changes, detect no work needed and stop.
