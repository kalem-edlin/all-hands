# Documentation System Goals & Motivations

## Core Philosophy

Documentation is a **semantically searchable knowledge base**, not capability coverage.

Observers (humans and LLMs) use docs to:
1. **Gain knowledge** about decisions, patterns, rationale via semantic search
2. **Investigate references** to build full picture of implementation
3. **Iterate on codebase** with context-efficient understanding

Docs answer "why and how was this built" not "what does this do".

---

## Key Heuristics

Documentation MUST focus on:

| Heuristic | Description |
|-----------|-------------|
| **Design decisions** | Why choices were made, tradeoffs considered |
| **Implementation rationale** | How things work and why that approach |
| **Best practices** | Patterns to maintain, conventions to follow |
| **Key patterns** | With references to canonical examples |
| **Technologies** | What's used and why it matters |
| **Product use cases** | User-facing scenarios the code enables |

Documentation MUST NOT contain:
- Exhaustive capability lists
- Inline code snippets (use references instead)
- API surface documentation (that's what code is for)
- Redundant information available in code
- State machines or flows copied from code
- "How to use" command documentation
- ASCII diagrams that duplicate code structure

---

## Pre-Documentation Requirements

### 1. Clean Git State Required

All source changes MUST be committed before documentation runs:
- References require valid git hashes from committed state
- Uncommitted files produce invalid `0000000` hashes
- Documentation commands must gate on clean state

### 2. Commit Gate Workflow

Before delegating to taxonomist/writers:
1. Check for uncommitted changes: `git status --porcelain`
2. If changes exist: prompt user to commit or stash
3. Propose commit message based on staged changes
4. Proceed only after commit completes

### 3. No Placeholder Hashes

References with placeholder hashes (`abc1234`, `0000000`, `hash123`) are INVALID:
- Every `[ref:...]` must have a real 7-char git hash
- Placeholder hashes indicate the writer didn't call `envoy docs format-reference`
- Validation must reject placeholder patterns

---

## Reference System

### Purpose

References eliminate inline snippets, reducing doc context to pure knowledge. Observers read docs for understanding, then investigate references for implementation details.

### Format

**AST-supported files** (TypeScript, Python, Go, etc.):
```
[ref:path/to/file.ts:symbolName:abc1234]
```

**Non-AST files** (YAML, JSON, Markdown, configs, etc.):
```
[ref:path/to/file.yaml::abc1234]
```

- `path`: Relative from project root
- `symbol`: Function/class/variable name (empty for non-AST)
- `hash`: 7-char git blame hash for staleness detection

### Reference Generation Rules

**CRITICAL: Writers must NEVER write refs manually.**

1. For EVERY file/code mention, call: `envoy docs format-reference <file> [symbol]`
2. Use the returned `[ref:...]` string EXACTLY as output
3. If symbol not found: use file-only ref from `envoy docs format-reference <file>`
4. If file not found: investigate why, don't skip or fake
5. NEVER type `[ref:...]` by hand - ALWAYS use command output

### Reference Discipline

- **Required**: Every code mention uses reference format
- **Selective**: Only reference what's key to the knowledge being conveyed
- **Canonical**: Reference specific patterns/functions, not just files
- **No overload**: Each doc page is focused knowledge, not reference dumps
- **Never inline**: Zero code snippets in documentation

### Validation

The validation system (`envoy docs validate`) detects:

| Issue Type | Detection |
|------------|-----------|
| Invalid ref | File/symbol doesn't exist |
| Stale ref | Hash doesn't match current commit |
| Placeholder hash | Hash matches known placeholder patterns |
| Inline code | Fenced code blocks in markdown |
| Missing frontmatter | No description field |

---

## Anti-Pattern Examples

### BAD: Capability List

```markdown
## Commands

| Command | Purpose |
|---------|---------|
| `search` | Web search |
| `extract` | Extract content |
| `ask` | Raw inference |
```

### GOOD: Knowledge with Selective Refs

```markdown
## Search/Extract Pattern

The two-step search/extract pattern exists because web searches return snippets,
not full content. Agents call search first [ref:tavily.ts:searchCommand:a1b2c3d]
to identify promising URLs based on relevance scores, then extract
[ref:tavily.ts:extractCommand:e4f5g6h] only those worth full retrieval.

This approach reduces token cost by 60-80% compared to extracting everything.
```

---

### BAD: State Machine from Code

```markdown
## Status Flow

draft -> in_progress -> implemented -> tested -> merged
```

### GOOD: Rationale with Canonical Ref

```markdown
## Status Lifecycle

Prompts track status to enable dependency resolution and parallel execution.
The state machine [ref:plan-io.ts:PromptStatus:a1b2c3d] ensures prompts
only become available when their dependencies reach `merged` status.

This prevents agents from starting work on prompts whose prerequisites
haven't been tested yet.
```

---

### BAD: How-To Documentation

```markdown
### Get Next Work

```bash
envoy plan next -n 3
```

Returns up to 3 prompts.
```

### GOOD: Decision Knowledge

```markdown
### Parallel Prompt Dispatch

The `next` command [ref:plan/lifecycle.ts:nextCommand:a1b2c3d] returns
multiple independent prompts to enable parallel specialist execution.

Dependencies are checked at query time, not stored statically, because
prompt status changes as work progresses. Returning N prompts (default 3)
balances parallelism against context overhead of tracking multiple streams.
```

---

### BAD: Folder Structure Listing

```markdown
## Structure

```
skill-name/
  SKILL.md
  workflows/
  references/
```
```

### GOOD: Pattern with Canonical Example

```markdown
## Router Pattern

Complex skills split content across folders to enable progressive disclosure.
The skills-development skill [ref:.claude/skills/skills-development/SKILL.md::a1b2c3d]
demonstrates this pattern: SKILL.md routes to workflows based on user intent,
and workflows load only the references they need.

This keeps initial context under 500 lines while providing deep expertise on demand.
```

---

### BAD: Inline Code Example

```markdown
The retry logic uses exponential backoff:

```typescript
const delay = Math.pow(2, attempt) * 1000;
await sleep(delay);
```
```

### GOOD: Reference to Implementation

```markdown
Retry logic uses exponential backoff [ref:lib/retry.ts:withRetry:a1b2c3d]
starting at 1s and doubling each attempt. The 3-retry default handles
transient API failures while failing fast on persistent errors.
```

---

## Content Quality Rules

### 1. Knowledge Over Capability

| Instead of... | Write... |
|---------------|----------|
| "These commands exist: X, Y, Z" | "X solves problem A because..." |
| "The options are: ..." | "We chose X over Y because..." |
| "This returns: ..." | "This design enables..." |

### 2. Canonical References

Don't just ref files - ref the specific pattern being discussed:

| Instead of... | Write... |
|---------------|----------|
| `[ref:agent.md::]` | `[ref:agent.md:tools:hash]` (the specific field) |
| `[ref:utils.ts::]` | `[ref:utils.ts:retryWithBackoff:hash]` (the specific function) |

### 3. Context Efficiency

- Target 50-80 lines per doc page
- One focused topic per page
- Split complex topics into linked pages
- Refs replace verbose explanations

### 4. Product Use Cases Required

Every domain doc must include a Use Cases section explaining:
- What users/systems accomplish with this code
- Real scenarios, not abstract possibilities
- How it fits into larger workflows

---

## Documentation Writer Responsibilities

The writer agent must understand these motivations intrinsically:

1. **Knowledge-first**: Write what observers need to know, not what code does
2. **Reference-heavy**: Point to code, don't embed it
3. **Decision-focused**: Capture the "why" that isn't in code
4. **Context-efficient**: Minimal words, maximum insight
5. **Searchable**: Frontmatter descriptions enable semantic discovery
6. **Command-driven refs**: ALWAYS use `envoy docs format-reference`, NEVER write refs manually

The writer is NOT:
- Documenting APIs
- Providing tutorials
- Covering all features
- Writing inline examples
- Listing commands/options
- Transcribing code structure

The writer IS:
- Building a knowledge base
- Capturing institutional knowledge
- Enabling informed iteration
- Connecting decisions to implementations via references
- Explaining WHY, not WHAT

---

## Validation Requirements

### Before Commit

Writers must validate before committing:

1. `envoy docs validate --path <worktree>/docs/<domain>/`
2. Check: `invalid_count == 0` (no broken refs)
3. Check: `grep -c '^\`\`\`' docs/**/*.md == 0` (no inline code)
4. Check: No placeholder hashes (`abc1234`, `0000000`)

### Validation Command Extensions

`envoy docs validate` must detect:

| Check | Failure Condition |
|-------|-------------------|
| Placeholder hash | Hash matches `/^(abc|123|000|hash)/` |
| Inline code blocks | Any fenced code block in docs |
| Missing use cases | No "Use Cases" or "Usage" section |
| Capability lists | Tables with Command/Purpose columns |

---

## Success Criteria

After documentation generation, validate:

1. **No inline snippets**: Zero fenced code blocks in docs
2. **Valid refs only**: All refs use real git hashes from `format-reference`
3. **Decision coverage**: Each domain explains key "why" decisions
4. **Canonical refs**: Refs point to specific patterns, not just files
5. **Context efficiency**: Each doc under 100 lines
6. **Use cases present**: Every domain has product use cases
7. **No capability lists**: No command/option tables
8. **Semantic searchability**: Descriptions enable finding relevant knowledge

---

## Comparison Checklist

After documentation, verify each doc against:

- [ ] Contains zero inline code snippets (no fenced blocks)
- [ ] Uses `[ref:...]` format for ALL code mentions
- [ ] All refs have real git hashes (not placeholders)
- [ ] Refs point to specific symbols, not just files where possible
- [ ] Explains design decisions and rationale (the WHY)
- [ ] Does NOT list capabilities, commands, or options
- [ ] Does NOT transcribe state machines or flows from code
- [ ] Includes product use cases section
- [ ] Frontmatter description enables semantic search
- [ ] Under 100 lines (focused, not comprehensive)
- [ ] Non-AST files use `[ref:file::hash]` format
- [ ] Content is knowledge, not API documentation

---

## Enforcement Mechanisms

### 1. Pre-Documentation Gate

Commands `docs-init` and `docs-adjust` must:
- Check `git status --porcelain` before proceeding
- Prompt user to commit if changes exist
- Block documentation on uncommitted state

### 2. Reference Command Enforcement

`envoy docs format-reference` must:
- Return error (not `0000000`) for uncommitted files
- Include validation that hash is real before returning
- Fail explicitly rather than silently

### 3. Writer Validation Step

Documentation-writer agent must:
- Call `envoy docs validate` before committing
- Fix all issues before proceeding
- Grep for fenced blocks and fail if found

### 4. Post-Documentation Audit

After merge, run full validation:
- `envoy docs validate` on entire docs/
- Report any violations for immediate fix
- Block PR if critical violations exist
