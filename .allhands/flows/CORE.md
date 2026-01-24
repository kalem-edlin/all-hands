<goal>
Core harness integration for all agents. Per **Context is Precious**, this flow contains only universal behaviors that apply to every agent type.
</goal>

<constraints>
- MUST use `ah knowledge search <query>` as the first tool when searching the codebase
- MUST read `.allhands/principles.md` when making architectural decisions
- NEVER repeat instructions found in sub-flows; reference them instead
</constraints>

## Git Base Branch
 
For git commands, you can reference the base branch with `$BASE_BRANCH`

## Semantic Search

Per **Context is Precious**, use the semantic index before file exploration:
- Run `ah knowledge search "<query>"` to find relevant code
- Add `--path <path>` to scope searches to specific directories
- Add `--k <n>` to control result count (default: 5)