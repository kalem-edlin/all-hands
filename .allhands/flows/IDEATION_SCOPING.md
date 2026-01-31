<goal>
Domain-agnostic ideation scoping that adapts behavior from workflow domain config. Per **Ideation First**, engineers control depth; the domain config ensures coverage without forcing depth. Per **Frontier Models are Capable**, this flow provides orchestration scaffolding while the domain config provides domain-specific substance.
</goal>

<constraints>
- MUST read the workflow domain config at `WORKFLOW_DOMAIN_PATH` before any interview
- MUST ask all questions listed in the domain config's `required_ideation_questions`
- MUST ask ONE question at a time
- MUST adapt depth based on domain config's guidance (probe vague responses, skip answered questions)
- NEVER batch all questions together
</constraints>

## Active Spec Revision Mode

**Check first**: If `SPEC_PATH` is non-empty and the file exists at that path, enter **revision mode** instead of the normal flow below.

### Revision Mode

1. Read the existing spec file at `SPEC_PATH`
2. Read the workflow domain config at `WORKFLOW_DOMAIN_PATH`
3. Present the existing spec content to the engineer as grounding:
   - Summarize the current spec scope, goals, and key decisions
   - State: "This spec already exists. I'll focus on what you want to change or add."
4. Conduct a focused revision interview:
   - Ask what aspects of the spec need changing, extending, or refining
   - Reference existing spec content — do not ask about things already covered unless the engineer wants to revise them
   - Apply domain config's `required_ideation_questions` only where they surface gaps in the revision context
   - ONE question at a time, as with normal ideation
5. After the engineer signals readiness:
   - Revise the existing spec file in place — update and append, do not replace wholesale
   - Preserve unchanged sections; modify only what the revision touches
   - Update the spec frontmatter `updated` timestamp
6. **After spec revision is written**: reset planning artifacts since existing plans are now stale:
   ```bash
   ah planning reset
   ```
   This deletes all prompts and the alignment doc, and resets status to `planning` stage.
7. Report to the engineer: "Spec revised. Planning artifacts cleared — the planning flow will re-trigger to produce new prompts aligned with the updated spec."
8. **Stop** — do not continue to the normal Initiation flow below.

---

**If `SPEC_PATH` is empty or the file does not exist**: proceed with the normal flow below.

## Initiation

- Run `ah specs list --domains-only` for roadmap visibility (may return empty)
- If specific spec name not provided:
  - List available domains to the engineer
  - Ask which initiative domain this spec belongs to (can be new)
  - Infer spec name from the engineer's initial ideation prompt
- Ask the engineer for their initial ideation prompt

## Context Gathering

- Read the workflow domain config file at `WORKFLOW_DOMAIN_PATH`
- Ground using `ah knowledge docs search` across ROADMAP then DOCS indexes (in that order)
- If `planning_depth: deep`:
  - Run `ah specs list --roadmap --domain <domain_name>` for domain milestone visibility
  - Read dependent milestone specs
  - Spawn 1-3 subtasks: tell them to read `.allhands/flows/shared/CODEBASE_UNDERSTANDING.md` to deeply understand codebase reality
  - Spawn 0-2 research subtasks: tell them to read `.allhands/flows/shared/RESEARCH_GUIDANCE.md` for high-level tech solution approaches
- If `planning_depth: focused`: lighter grounding as needed based on the problem domain
- Search with `ah solutions search` and `ah memories search` for relevant context
- Spawn additional research subtasks as new concepts emerge during interview

## Scoping Interview

- Ask all `required_ideation_questions` from the domain config frontmatter, one at a time
- Per **Ideation First**, reflect back understanding before moving on — probe vague responses, skip questions already answered
- Apply the domain config's Ideation Guidance:
  - Follow probe guidance for depth calibration
  - Respect output section structure for content synthesis
- Apply the domain config's Domain Knowledge sections as they become relevant:
  - If category deep dives are defined: work through relevant categories based on scope
  - If knowledge gap detection signals are defined: watch for them and probe deeper
  - If preference language mapping is defined: map engineer input to spec language
- Present feasibility feedback grounded in exploration results (where grounding was performed)
- If the domain config includes guiding principles synthesis guidance: synthesize and validate with engineer
- Continue until engineer signals readiness to move to spec creation

## Completeness Check

- If the domain config's Domain Knowledge includes completeness check criteria: apply them before proceeding
  - If gaps exist, return to Scoping Interview for specific areas
- For domains without completeness check criteria: proceed directly to Spec Creation

## Spec Creation

- Synthesize answers into spec content using the domain config's output section structure
- Write `initial_workflow_domain: <domain_name>` to spec frontmatter (from the config's `name` field)
- Set `type: <domain_type>` in spec frontmatter (from the config's `type` field)
- If the domain config includes "Building on Unimplemented Milestones" guidance: use "Assuming X exists..." pattern for dependencies
- Follow `.allhands/flows/shared/CREATE_SPEC.md` to write, create, and optionally activate the spec

### Optional: Spec Flow Analysis

- If the domain config's Ideation Guidance mentions spec flow analysis: offer it for complex features
  - Ask: "Would you like me to analyze this spec for user flow coverage and gaps?"
  - If yes: read `.allhands/flows/shared/SPEC_FLOW_ANALYSIS.md` and follow instructions
