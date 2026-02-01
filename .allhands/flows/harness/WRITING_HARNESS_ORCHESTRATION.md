<goal>
Guide agents through orchestration layer changes — TUI lifecycle, event loop, agent profiles, workflows. Per **Frontier Models are Capable**, understand architectural invariants before modifying interconnected systems.
</goal>

<inputs>
- Orchestration domain: TUI, event loop, agent profiles, or workflows
- Change purpose and affected components
</inputs>

<outputs>
- Working orchestration changes preserving architectural invariants
</outputs>

<constraints>
- MUST understand lifecycle implications before modifying TUI or event loop
- MUST validate with `ah validate agents` after agent profile changes
- NEVER break graceful degradation for optional dependencies
</constraints>

## Execution

- Read `.allhands/principles.md` for first principle context
- Run `ah skills search` to discover the `harness-maintenance` skill
- Read the skill's `references/core-architecture.md` for architecture, schemas, and lifecycle patterns
- Implement changes preserving architectural invariants (graceful degradation, semantic validation, in-memory state)
- Validate with `ah validate agents` after profile modifications
- Test lifecycle behavior end-to-end
