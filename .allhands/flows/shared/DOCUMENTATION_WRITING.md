<goal>
Write knowledge-base docs - capture decisions, rationale, patterns. Zero inline code. Multiple focused files per subdomain.
</goal>

## Philosophy
- Docs = KNOWLEDGE, not API coverage
- Explain WHY, not WHAT (code shows what)
- Zero inline code - every mention is a reference
- Concise > verbose - drop articles, use fragments
- 3-10 focused files per subdomain (RAG-optimized)

## What to Document
| Focus | Write |
|-------|-------|
| Design decisions | Why choices made, tradeoffs |
| Rationale | How things work and why |
| Patterns | With refs to canonical examples |
| Critical tech | Why chosen, how used |
| Use cases | User-facing scenarios |

## What NOT to Document
- Capability tables (command/option lists)
- API surface coverage
- Inline code snippets
- Info obvious from reading code
- Folder structure diagrams

---

## Reference System

**All code mentions use refs. No exceptions.**

```bash
# Symbol reference (TS, Python, Go, etc.)
ah docs format-reference <file> <symbol>
# Output: [ref:path/file.ts:symbolName:abc1234]

# File-only reference (YAML, JSON, configs)
ah docs format-reference <file>
# Output: [ref:path/file.yaml::abc1234]
```

- NEVER write refs manually - always use command output
- NEVER use placeholder hashes (abc1234, 0000000)
- If `symbol_not_found`: retry without symbol
- If `uncommitted_file`: STOP and report

---

## Write Mode

### Input (from taxonomist)
```yaml
domain: "<product-name>"
doc_directory: "docs/<domain>/<subdomain>/"
source_directories: ["<paths>"]
critical_technologies: ["<tech>"]
target_file_count: 3-6
notes: "<guidance>"
```

### Steps

1. **Check existing docs**
   ```bash
   ah knowledge docs search "<domain> <subdomain>" --metadata-only
   ```
   - Extend existing, don't duplicate

2. **Analyze sources for KNOWLEDGE**
   - Read `source_directories`
   - Find design decisions, rationale
   - Note `critical_technologies` usage

3. **Plan file breakdown**
   - 3-10 distinct topics per subdomain
   - Each file answers specific question types
   - Map critical tech to files

4. **Write focused files**
   - Use `ah docs format-reference` for ALL refs
   - Focus on WHY and HOW
   - Zero code blocks

5. **Verify coverage**
   - Every source_directory has docs
   - Every critical_technology documented
   - File count meets target

### Output
```yaml
success: true
files_created: ["docs/domain/subdomain/file1.md", ...]
coverage_gaps: []  # report any gaps
```

---

## File Structure

**Front-matter (required):**
```yaml
---
description: 1-2 sentence summary for semantic search
---
```

**Sections:**
```markdown
# Topic Name

## Overview *
Why this exists, what problem it solves.

## Key Decisions *
- Decision 1: Why this approach [ref:...]
- Decision 2: Tradeoffs considered [ref:...]

## Patterns
How to work with this (only if needed).

## Use Cases *
- Scenario 1: Real usage at product level
- Scenario 2: Another real scenario
```

`*` = required sections

---

## File Naming
- Descriptive kebab-case: `state-management.md`, `api-integration.md`
- Name indicates what questions file answers
- NEVER: `README.md` (taxonomist writes these)
- NEVER: `docs/domain/index.md` (only `docs/domain/subdomain/index.md` allowed)

## Example Breakdown
For a `services/` subdomain:
- `media-processing.md` - FFmpeg pipeline decisions
- `api-client.md` - TRPC integration patterns
- `auth-flow.md` - Token management rationale
- `sync-strategy.md` - Offline/conflict approach

---

## Fix Mode

### Input
```yaml
mode: "fix"
stale_refs: [...]
invalid_refs: [...]
```

### Steps
1. **Stale refs:** Get updated hash via `ah docs format-reference`, update
2. **Invalid refs:**
   - Symbol renamed → update symbol name
   - File moved → update path
   - Deleted → remove ref, update prose

---

## Constraints
- MUST use `ah docs format-reference` for ALL refs
- MUST include `description` front-matter
- MUST include Overview, Key Decisions, Use Cases sections
- MUST create 3-10 files per subdomain
- MUST cover ALL `source_directories` and `critical_technologies`
- MUST NOT commit (taxonomist commits after all writers)
- MUST NOT create directories (taxonomist pre-creates)
- MUST NOT write README.md
- NEVER write inline code blocks
