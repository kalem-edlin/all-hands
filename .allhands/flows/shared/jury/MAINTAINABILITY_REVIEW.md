<goal>
Review implementation for maintainability, composability, and software design quality. Per **Frontier Models are Capable**, identify probable agentic issues: hallucinations, duplications, and inter-prompt miscommunications.
</goal>

<inputs>
- Git diff to base (implementation files)
</inputs>

<outputs>
- Areas for improvement, ordered by priority
- Summary of design inefficiencies
</outputs>

<constraints>
- MUST use git diff to base for implementation review
- MUST compare against established codebase patterns
- MUST identify agentic-specific anti-patterns
</constraints>

## Context Gathering

- Run `ah git diff-base` to review all implementation changes
- Run `ah knowledge docs search "architecture"` for established patterns
- Run `ah knowledge docs search "conventions"` for codebase standards

## Agentic Anti-Patterns to Detect

| Pattern | Description |
|---------|-------------|
| **Hallucination** | Imports that don't exist, APIs used incorrectly, made-up patterns |
| **Duplication** | Re-implementing existing utilities, duplicate logic across prompts |
| **Miscommunication** | Prompt A establishes pattern, Prompt B ignores it |
| **Inconsistency** | Different approaches for same problem in different files |
| **Over-abstraction** | Unnecessary wrappers, premature generalization |

## Design Quality Checks

| Check | Question |
|-------|----------|
| Composability | Can components be reused independently? |
| Coupling | Are dependencies minimal and explicit? |
| Cohesion | Does each module have single responsibility? |
| Naming | Are names descriptive and consistent? |
| Structure | Does organization follow codebase conventions? |

## Review Process

For each changed file:
- Compare against similar existing code
- Identify deviations from established patterns
- Flag probable agentic issues
- Note design inefficiencies

## Output Format

Return findings ordered by priority:

```
## Maintainability Review

### P1 (Critical)
- [File]: [Issue] -> [Impact] -> [Fix]

### P2 (Important)
- [File]: [Issue] -> [Impact] -> [Fix]

### P3 (Polish)
- [File]: [Issue] -> [Impact] -> [Fix]

## Agentic Issues Detected
- [Hallucinations found]
- [Duplications found]
- [Miscommunications found]
```