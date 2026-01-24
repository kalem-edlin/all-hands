<goal>
Create validation tooling documentation for a new or underserved domain. Per **Agentic Validation Tooling**, this enables deterministic acceptance criteria - engineers test PRODUCT QUALITY, not SOFTWARE STABILITY.
</goal>

<inputs>
- Domain/technology needing validation coverage (e.g., "Supabase migrations", "Expo native UI")
- Pain points or gaps identified in current validation capabilities
</inputs>

<outputs>
- Validation suite file at `.allhands/validation/<suite-name>.md`
</outputs>

<constraints>
- MUST check existing coverage before creating new suites
- MUST get engineer confirmation before creating suite
- MUST include all required schema sections in suite file
</constraints>

## Phase 1: Discovery

Check existing coverage:
- Run `ah validation-tools list`
- Identify what suites already exist
- Determine if any partially cover the needed domain
- Document gaps requiring new tooling

## Phase 2: Research

Read `.allhands/flows/shared/RESEARCH_GUIDANCE.md` and investigate:

**Best practices** - How do engineers typically validate this technology?
- Run `ah perplexity research "best practices for testing <technology>"`

**Available tools** - What MCP servers, CLI tools, SDKs exist?
- Run `ah tavily search "<technology> testing tools CLI"`
- Run `ah grok search "what tools do developers use to test <technology>"`

**Community insights** - What's working well for others?
- Run `ah perplexity research "<technology> validation automation" --grok-challenge`

If external documentation needed, read `.allhands/flows/shared/EXTERNAL_TECH_GUIDANCE.md`:
- Run `ah context7 search "<tool_name>"` for official docs
- Run `ah tavily extract "<doc_url>"` for specific pages

### MCP Gap Assessment

Check if discovered tools are available as MCP integrations:
- Run `ah tools --list`

If research identifies a valuable MCP that isn't currently integrated:
- Document the gap (MCP package name and purpose)
- Spawn sub-agent with flow `.allhands/flows/shared/HARNESS_MCP.md` (non-blocking)
- Continue to Phase 3 - don't block on MCP setup
- In Phase 3, inform engineer that MCP integration is in progress

## Phase 3: Engineer Interview

Present findings:
- Summarize discovered tools with pros/cons
- Recommend a primary approach with reasoning
- Identify CICD integration opportunities
- Confirm scope - what validation scenarios should this suite cover?
- MCP status if sub-agent was spawned

Get engineer confirmation before proceeding to creation.

## Phase 4: Suite Creation

- Run `ah schema validation-suite` for structure
- Write suite file to `.allhands/validation/<suite-name>.md`

Required frontmatter:
- `name`: Unique identifier (matches filename)
- `description`: Use case description (when/why to use)
- `globs`: File patterns this validates

Required body sections:
- **Purpose**: What quality aspects this validates
- **When to Use**: Task patterns needing this validation
- **Validation Commands**: CLI commands and invocations
- **Interpreting Results**: How to read output, what failures mean

Optional body section:
- **CICD Integration**: Pipeline config to add

Validation hook runs on file save - fix any schema errors.

## Phase 5: CICD Integration (If Applicable)

If suite includes CICD integration:
- Document pipeline configuration in suite file
- Discuss with engineer whether to add now or defer
- If adding now, modify `.github/workflows/` files

## Completion

Once suite passes validation:
- Discoverable via `ah validation-tools list`
- Future prompts can reference in `validation_suites` frontmatter
- UTILIZE flow will find it when agents work on matching file patterns
