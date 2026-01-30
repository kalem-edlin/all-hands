<goal>
Guide agents through validation suite creation. Per **Agentic Validation Tooling**, every validation domain has stochastic (exploratory) and deterministic (pass/fail) dimensions that compound through the crystallization lifecycle.
</goal>

<inputs>
- Validation domain and scope
- Tooling requirements (stochastic exploration, deterministic gating, or both)
</inputs>

<outputs>
- Validation suite following harness conventions with both stochastic and deterministic dimensions
</outputs>

<constraints>
- MUST include meaningful stochastic dimension — deterministic-only tools are test commands, not suites
- MUST follow crystallization lifecycle: stochastic discovers, deterministic entrenches
- NEVER create suites without clear validation domain justification
</constraints>

## Execution

- Read `.allhands/principles.md` for first principle context
- Run `ah skills` to discover the `harness-maintenance` skill
- Read the skill's `references/validation-tooling.md` for suite philosophy and crystallization patterns
- Design the suite with both stochastic and deterministic sections
- Validate suite existence threshold — ensure meaningful stochastic dimension exists
- Test deterministic checks produce binary pass/fail results
