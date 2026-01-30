<goal>
Create a validation tooling spec for a new domain. Per **Prompt Files as Units of Work**, validation tooling is infrastructure that goes through the full harness loop.
</goal>

<inputs>
- Gap analysis from ASSESS_VALIDATION_TOOLING
- Original spec blocked by this tooling need
</inputs>

<outputs>
- Spec at `specs/roadmap/validation-<name>.spec.md`
- Original spec updated with `dependencies: [validation-<name>]`
</outputs>

<constraints>
- MUST create spec, NOT implement tooling
- MUST get engineer confirmation
- MUST include CICD + meta-testing in acceptance criteria
- MUST verify the validation domain has a meaningful stochastic dimension before creating a suite spec. Per **Agentic Validation Tooling**, deterministic-only tools (type checking, linting, formatting) are test commands — NOT suites.
</constraints>

## Research

Read `.allhands/flows/shared/RESEARCH_GUIDANCE.md` and investigate:
- Best practices: `ah perplexity research "best practices <validation_type> testing <technology>"`
- Available tools: `ah tavily search "<technology> testing tools"`, `ah tools --list`
- CICD patterns: `ah perplexity research "<validation_type> CICD GitHub Actions"`
- Determine whether the domain has exploratory patterns that benefit from agent intuition (stochastic dimension). If the validation is purely deterministic (binary command output), it does not justify a suite — document it as a test command reference instead.

If valuable MCP not integrated, note as acceptance criterion.

## Tool Validation

Per **Agentic Validation Tooling**, research produces assumptions; running the tool produces ground truth. Per **Ideation First**, prevents encoding untested assumptions.

- Install and verify the tool responds to `--help`
- Create a minimal test target (temp directory, not committed)
- Execute representative stochastic workflows — discover commands, chaining, and the observe-act-verify loop
- Document divergences from researched documentation — informs spec and engineer interview

## Engineer Interview

Present: recommended approach, alternatives, CICD impact, effort, MCP availability. Include divergences discovered during Tool Validation.

Confirm engineer agrees and understands this creates a blocking dependency.

## Suite Writing Philosophy

<constraints>
- MUST reference `<tool> --help` as authoritative command reference — suites MUST NOT replicate tool command docs. Per **Knowledge Compounding**, single source prevents drift.
- MUST provide brief command/use-case pairs as calibration anchors, not exhaustive catalogs. Per **Frontier Models are Capable**, illustrative examples enable agent extrapolation.
- MUST frame motivations around harness value: reducing human-in-loop supervision, verifying code quality, confirming implementation matches expectations.
- MUST describe exploration categories, not prescriptive command sequences. Per **Frontier Models are Capable**, agents deduce the "how" from motivations and `--help`.
</constraints>

Per **Context is Precious**, target the density of `WRITING_HARNESS_FLOWS.md`. The formula: **motivations + brief command/use-case pairs + `--help` progressive disclosure**.

## Evidence Capture

Per **Quality Engineering**, two audiences require different artifacts:

- **Agent (self-verification)** — primitives used during the observe-act-verify loop (state checks, assertions, console output). Real-time, not recorded.
- **Engineer (review artifacts)** — trust evidence produced after exploration (recordings, screenshots, traces, reports).

Pattern: explore first, capture second.

## Spec Creation

Use `name: validation-{name}` and `domain_name: infrastructure`.

New suites must articulate both their stochastic and deterministic dimensions. Per **Agentic Validation Tooling**, the stochastic dimension justifies the suite's existence; the deterministic dimension provides CI/CD gating.

Body sections: Context, Acceptance Criteria (setup, coverage, meta-testing, CICD, documentation), Technical Constraints, Out of Scope.

Follow `.allhands/flows/shared/CREATE_SPEC.md`.

Update original spec with `dependencies: [validation-{name}]`.

## Handoff

Ask engineer: "This validation tooling spec is ready and blocks your original work. Would you like to switch focus to it now?"

If yes: checkout the branch and run `ah planning ensure`

If no: inform engineer spec is saved and original spec is blocked until this is complete
