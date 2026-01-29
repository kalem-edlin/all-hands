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

Per **Agentic Validation Tooling**, research produces assumptions; running the tool produces ground truth. Per **Ideation First**, this phase prevents the suite spec from encoding untested assumptions that waste implementor context.

- **Install the tool** following the method discovered in Research. Verify it installs and responds to `--help` (or equivalent) as expected.
- **Create a minimal test target** — a throwaway environment the tool can validate against (e.g., sample data, test fixtures, a scratch workspace). Create in a temp directory, not committed to the repo.
- **Execute representative stochastic workflows** — walk through the exploration patterns you plan to document. Discover what commands exist, how they chain together, and what the observe-act-verify loop looks like for this tool.
- **Identify evidence capabilities** — distinguish between:
  - Artifacts the agent consumes during the validation loop (state checks, console output, assertion results)
  - Artifacts produced for engineer review (recordings, traces, reports, exported logs)
- **Document divergences** — capture where researched documentation differs from actual tool behavior. These findings inform both the spec and the engineer interview.

## Engineer Interview

Present: recommended approach, alternatives, CICD impact, effort, MCP availability. Include divergences discovered during Tool Validation.

Confirm engineer agrees and understands this creates a blocking dependency.

## Suite Documentation Principles

Per **Frontier Models are Capable**, suites teach agents HOW TO THINK about using a tool, not HOW TO EXPLICITLY USE IT.

- **Motivations over commands** — describe WHY an agent would reach for a tool in a given situation. The agent deduces the "how" from the tool's own help system.
- **`--help` as the command reference** — suites MUST NOT replicate tool command documentation. Reference the tool's own help system (`<tool> --help`, `<tool> <command> --help`) for command discovery. This prevents documentation drift.
- **Light, non-exhaustive examples** — illustrate thinking patterns, not command catalogs. Examples show how the tool fits a motivation, not how to invoke the tool.
- **Open-ended use cases** — the stochastic dimension is inherently exploratory. Describe categories of exploration (e.g., "flow verification", "edge case probing", "state change validation") and trust the model's intuition per **Frontier Models are Capable**.

## Evidence Capture

Per **Quality Engineering**, the engineer needs to review agent work. Evidence artifacts bridge the trust gap. Suites must articulate their evidence capture story across two audiences:

| Audience | Purpose | Consumed When | Examples |
|----------|---------|---------------|----------|
| **Agent (self-verification)** | Close the observe-act-verify loop during stochastic exploration | During validation loop | State checks, console monitoring, text extraction, assertion primitives |
| **Engineer (review artifacts)** | Trust evidence that the agent validated what it claims | After validation complete | Recordings, full-page screenshots, traces, exported reports |

Require suites to document:
- What verification primitives the agent uses during the loop (real-time feedback, not recorded)
- What artifacts the agent produces for engineer review (recordings, collected screenshots, trace files, logs)
- The "explore first, capture second" pattern — agents explore stochastically for discovery, then produce clean evidence artifacts of their findings for human consumption

## Recommended Stochastic Structure

Per **Context is Precious**, this structure is a recommendation, not a mandate. Suites should adapt section naming to their domain while maintaining the conceptual separation.

1. **Core Loop** — the fundamental observe-act-verify cycle for this tool. How does the agent interact, wait for results, and confirm outcomes?
2. **Verification Primitives** — tools the agent uses during the loop to programmatically check outcomes. How does the agent KNOW something worked?
3. **Evidence Capture** — artifacts the agent collects during exploration for its own decision-making. Used in-loop, not for final reporting.
4. **Exploration Patterns** — categories of stochastic exploration the tool enables. Motivation-driven, not prescriptive command sequences.
5. **Resilience** — how to handle failures, timeouts, unexpected states. Death-spiral escape hatches, alternative approaches, graceful degradation.
6. **Evidence for Engineer** — artifacts produced specifically for human review after exploration. References evidence from subsection 3 as also being reportable.

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
