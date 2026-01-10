---
description: How envoy uses tree-sitter for AST analysis - symbol resolution, reference formatting, and multi-language support decisions.
---

# AST Analysis

Envoy uses tree-sitter for AST-based code analysis. This enables symbol-level references in documentation and complexity metrics for planning.

## Why Tree-Sitter

Tree-sitter provides:
- **Incremental parsing**: Fast re-parse on edits
- **Multi-language**: Single API for TypeScript, Python, Go, etc.
- **Error recovery**: Parses partial/broken code
- **Query language**: Declarative pattern matching

The alternative (regex-based parsing) breaks on edge cases and requires per-language maintenance.

## Symbol Resolution

The docs system needs to link documentation to code symbols. The flow:

1. User requests reference: `envoy docs format-reference src/lib/foo.ts myFunction`
2. Tree-sitter parses the file
3. Query patterns find all symbol definitions
4. Match requested symbol name
5. Get line range for git blame
6. Return formatted reference: `[ref:src/lib/foo.ts:myFunction:abc1234]`

### Query Patterns

Symbol queries live in `.claude/envoy/src/lib/ast-queries.ts`. Each language defines patterns for its symbol types:

**TypeScript**:
- Functions: `(function_declaration name: (identifier) @name)`
- Classes: `(class_declaration name: (type_identifier) @name)`
- Arrow functions: `(variable_declarator name: (identifier) @name value: (arrow_function))`

**Python**:
- Functions: `(function_definition name: (identifier) @name)`
- Classes: `(class_definition name: (identifier) @name)`

**Go**:
- Functions: `(function_declaration name: (identifier) @name)`
- Types: `(type_declaration (type_spec name: (type_identifier) @name))`
- Methods: `(method_declaration name: (field_identifier) @name)`

The `@name` capture extracts the symbol name for matching.

### Language Support

| Extension | Language | Parser Package |
|-----------|----------|----------------|
| `.ts`, `.tsx` | TypeScript | tree-sitter-typescript |
| `.js`, `.jsx`, `.mjs` | JavaScript | tree-sitter-javascript |
| `.py` | Python | tree-sitter-python |
| `.go` | Go | tree-sitter-go |
| `.rs` | Rust | tree-sitter-rust |
| `.java` | Java | tree-sitter-java |
| `.rb` | Ruby | tree-sitter-ruby |
| `.swift` | Swift | tree-sitter-swift |

Adding a language requires:
1. Install tree-sitter-\<language\> package
2. Add queries in ast-queries.ts
3. Add grammar loading in tree-sitter-utils.ts

## Reference System

Documentation references link docs to code at specific commits.

### Reference Formats

**Symbol reference** (AST-supported files):
```
[ref:path/to/file.ts:symbolName:abc1234]
```

**File-only reference** (any file):
```
[ref:path/to/file.yaml::abc1234]
```

The double colon `::` indicates no symbol (file-level reference).

### Hash Generation

The hash comes from git blame on the symbol's line range:

1. Find symbol start/end lines via AST
2. Run `git blame -L start,end --porcelain -t file`
3. Extract commit timestamps from porcelain output
4. Return most recent commit hash (7 chars)

For file-only references, use `git log -1 --format=%h -- file`.

### Reference Validation

`envoy docs validate` checks all references in docs/:

1. Find all `[ref:...]` patterns in markdown
2. For each reference:
   - Verify file exists
   - Verify symbol exists (if symbol ref)
   - Compare stored hash vs current hash
3. Report: stale refs (hash changed), invalid refs (missing symbol/file)

This enables doc maintenance workflows - after code changes, validate identifies docs needing reference updates.

## Complexity Metrics

`envoy docs complexity <path>` provides planning-useful metrics:

For files:
- Lines of code
- Import count
- Export count
- Function count
- Class count
- Estimated token count

For directories:
- Aggregated metrics across all supported files
- File count

These metrics help agents estimate context costs before reading files.

## Parser Caching

Tree-sitter parsers are heavy to initialize. The caching strategy:

1. First request for a language: load grammar, create parser
2. Cache parser in memory
3. Subsequent requests reuse cached parser

Query objects are also cached per (symbol-type, query-string) pair.

## Design Decisions

### Why Not LSP?

Language servers provide richer analysis but require:
- Running server per language
- Project-specific configuration
- Complex initialization

Tree-sitter is stateless - parse file, run queries, done. Simpler for our use case (find symbol definitions, not full IDE features).

### Why Declarative Queries?

Tree-sitter queries are S-expressions matching AST structure. Benefits:
- No imperative traversal code
- Easy to add new patterns
- Self-documenting (query shows what it matches)

The alternative (manual AST traversal) would require hundreds of lines per language.

### Why Limit to Top-Level Symbols?

Current queries find top-level definitions only. Nested functions/classes are not indexed. This is intentional:
- Documentation references should be stable (nested items move with refactoring)
- Top-level symbols are the public API
- Reduces noise in symbol lists

### Why Git Blame for Hashes?

Using blame instead of file-level commit hash because:
- Symbol-specific hash tracks actual symbol changes
- File could have unrelated changes elsewhere
- More precise staleness detection

## Troubleshooting

### Symbol Not Found

Check:
1. Is the file type supported? (use `envoy docs format-reference <file>` without symbol)
2. Is it a top-level declaration? (nested not supported)
3. Correct casing? (symbols are case-sensitive)

### Parser Load Failure

Tree-sitter grammars are native modules. If loading fails:
1. Rebuild: `npm rebuild tree-sitter`
2. Check Node.js version compatibility
3. Ensure grammar package is installed

### Query Compilation Error

If a query pattern fails to compile, the error is logged but other queries continue. Check ast-queries.ts for syntax errors in the pattern string.
