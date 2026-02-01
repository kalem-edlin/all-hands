<goal>
Guide agents through knowledge compounding infrastructure — docs, solutions, memories, knowledge indexes. Per **Knowledge Compounding**, everything feeds forward: decisions, pivots, limitations, realizations.
</goal>

<inputs>
- Knowledge type: docs, solutions, memories, or indexes
- Content to compound and its domain
</inputs>

<outputs>
- Knowledge artifact following compounding conventions and schema compliance
</outputs>

<constraints>
- MUST follow schema for the specific knowledge type
- MUST ensure knowledge compounds — future tasks benefit from all past work
- NEVER create isolated knowledge that doesn't feed forward
</constraints>

## Execution

- Read `.allhands/principles.md` for first principle context
- Run `ah skills search` to discover the `harness-maintenance` skill
- Read the skill's `references/knowledge-compounding.md` for schemas and compounding patterns
- Create or update the knowledge artifact following type-specific conventions
- Ensure proper indexing for discoverability via `ah knowledge docs search` or `ah solutions search`
- Verify schema compliance for the knowledge type
