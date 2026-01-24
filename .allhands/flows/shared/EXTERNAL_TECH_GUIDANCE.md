<goal>
Acquire explicit documentation and implementation inspiration from external technologies. Per **Frontier Models are Capable**, this provides the specific implementation guidance needed to deduce "how" from "why".
</goal>

<inputs>
- Query for context7 or btca usage
- Query type indication: open source git project OR proprietary documentation only
- Relevant codebase files to inject into query context (if applicable)
</inputs>

<outputs>
- Summary of guidance provided
- Strong implementation examples/suggestions inferred from tool responses
</outputs>

<constraints>
- MUST use context7 for documentation references
- MUST use btca for open source library dissection
- MUST run both tools in parallel when query benefits from dual perspective
</constraints>

## Tool Selection

| Query Type | Tool | Purpose |
|------------|------|---------|
| Documentation lookup | `ah context7 search` | Official docs and API references |
| Open source dissection | `btca` | Implementation inspiration from source |
| Both applicable | Run in parallel | Well-rounded perspective |

## Usage Patterns

### Documentation Only (context7)

For proprietary domains with documentation pages:
- Run `ah context7 search "<technology> <query>"`
- Extract API patterns, configuration examples
- Note version-specific behaviors

### Open Source Inspiration (btca)

For dissecting git repositories:
- Run `btca "<repo> <query>"`
- Study implementation patterns
- Extract architectural decisions
- Note how library handles similar problems

### Parallel Exploration

Most cases benefit from both tools:
- Documentation gives official guidance
- Source code reveals actual implementation patterns
- Cross-reference for comprehensive understanding

## Query Formulation

When injecting codebase context:
- Include relevant file paths from this codebase
- Explain how query relates to existing implementation
- Ask specific questions about integration approach

## Output Synthesis

Provide:
- Summary of what guidance was found
- Specific implementation suggestions
- Code patterns to follow
- Gotchas or edge cases discovered