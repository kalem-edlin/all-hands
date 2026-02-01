<goal>
Guide agents through flow authoring with harness conventions. Per **Context is Precious**, flows are thin entry points that route to skill references for domain knowledge.
</goal>

<inputs>
- Flow file path
- Flow purpose and target audience
</inputs>

<outputs>
- Flow file following harness conventions (XML tags, progressive disclosure, principle citations)
</outputs>

<constraints>
- MUST cite First Principles by name when they motivate a flow directive
- MUST use XML tags per flow writing conventions
- MUST keep flows brief — progressive disclosure over monolithic docs
</constraints>

## Execution

- Read `.allhands/principles.md` for first principle context
- Run `ah skills search` to discover the `harness-maintenance` skill
- Read the skill's `references/writing-flows.md` for flow authoring patterns
- Author the flow using conventions: `<goal>`, `<inputs>`, `<outputs>`, `<constraints>`, action-verb bullets
- Verify flow follows progressive disclosure — reference sub-flows rather than inlining complexity
- Ensure line count stays within 20-40 lines per **Context is Precious**
