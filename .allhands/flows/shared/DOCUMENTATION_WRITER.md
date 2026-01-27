<goal>
Write documentation that exposes engineering knowledge via file references and LSP symbols. Per **Knowledge Compounding**, docs enable semantic discovery of code through compounded understanding of use cases, intent, and key decisions.

Engineering knowledge sources: prompts, commit messages, and alignment docs when provided via `session_knowledge`, otherwise infer decisions and intent from the code itself.
</goal>

<inputs>
- `domain`: Domain being documented
- `approaches`: List of approaches with:
  - `name`: Approach identifier
  - `group`: Subdirectory name (or null for flat)
  - `files`: Source files to document
  - `symbols`: Key symbols to reference
- `doc_directory`: Target directory for docs
- `existing_docs`: Paths to edit (empty for new docs)
- `session_knowledge`: (incremental only) Commit messages, alignment summary, prompt learnings
</inputs>

<outputs>
- Documentation files with `[ref:file:Symbol]` placeholders
- Created directories as needed
</outputs>

<constraints>
- MUST follow `ah schema documentation` for frontmatter and file reference format
- MUST use LSP symbols (function names, class names) in refs for searchability
- MUST create directories before writing files
- NEVER write command/installation guides - those belong in README.md
- NEVER use restrictive templates - freestyle format that serves the content
</constraints>

## Doc Quality Goals

Per **Knowledge Compounding**, each doc should:

1. **Expose engineering knowledge** - Use cases, intent, key decisions, trade-offs
2. **Enable semantic discovery** - Descriptions that match how someone would search
3. **Minimize token count** - Right-sized for indexing, not bloated

## Writing Approach

### For New Docs

- Run `ah schema documentation` to get required frontmatter format
- Read source files to understand the approach
- Identify key entry points, core logic, and integration points
- Structure freely - use whatever sections serve the content:
  - Overview, Architecture, Patterns, Data Flow, Key Decisions
  - Tables, diagrams (mermaid), lists - whatever communicates best
- Embed refs throughout: `[ref:src/lib/semantic-search.ts:searchIndex]`

### For Editing Existing Docs

- Read existing doc and `existing_docs` paths
- Read source files to understand changes
- If `session_knowledge` provided, incorporate learnings:
  - New patterns or approaches from implementation
  - Key decisions documented in alignment
  - Deviations or discoveries from prompts
- Update refs to match current code
- Add new sections for new functionality
- Remove or update stale content

### For Fixing Validation Issues

If provided `stale_refs` or `invalid_refs`:
- Read the doc and referenced files
- For stale refs: update to current symbols/locations
- For invalid refs: remove or fix (symbol may have been renamed/moved)
- Verify all refs point to real implementations

## Directory Structure

Use the `group` field from approach input to determine file paths:

- **If `group` is set**: `<doc_directory>/<group>/<approach-name>.md`
  - Example: `docs/harness/cli/knowledge-command.md`
- **If `group` is null**: `<doc_directory>/<approach-name>.md`
  - Example: `docs/harness/test-harness.md`

Create subdirectories as needed before writing files.

## Completion

- Ensure all docs are written to `doc_directory`
- Report files created/modified
