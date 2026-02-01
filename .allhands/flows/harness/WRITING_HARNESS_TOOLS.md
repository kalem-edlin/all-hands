<goal>
Guide agents through adding or modifying harness tools (CLI commands, hooks, MCP servers). Per **Knowledge Compounding**, tools follow the auto-discovery pattern — agents find them via `--help`, docs teach motivations.
</goal>

<inputs>
- Tool type: command, hook, or MCP integration
- Tool purpose and trigger conditions
</inputs>

<outputs>
- Working tool integrated into the harness with auto-discovery support
</outputs>

<constraints>
- MUST follow the auto-discovery pattern — commands self-document via `--help`
- MUST validate with `ah validate agents` after changes affecting agent profiles
- NEVER add tools without clear first principle justification
</constraints>

## Execution

- Read `.allhands/principles.md` for first principle context
- Run `ah skills search` to discover the `harness-maintenance` skill
- Read the skill's `references/tools-commands-mcp-hooks.md` for tool architecture and patterns
- Implement the tool following auto-discovery conventions
- Validate with `ah validate agents` if agent profiles are affected
- Test hook behavior with Claude Code runner if adding hooks
