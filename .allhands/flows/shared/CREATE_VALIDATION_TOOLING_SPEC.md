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

## Engineer Interview

Present: recommended approach, alternatives, CICD impact, effort, MCP availability.

Confirm engineer agrees and understands this creates a blocking dependency.

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
