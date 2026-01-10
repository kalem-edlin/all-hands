---
description: Understanding envoy's semantic search system - USearch vector indexing, embedding model choices, and how agents discover relevant documentation.
---

# Knowledge System

The knowledge system enables semantic search over project documentation. Agents use `envoy knowledge search docs "<query>"` to find relevant docs before implementing features.

## Why Semantic Search

Keyword search fails when:
- Query uses different terminology than docs ("authentication" vs "auth flow")
- User intent is conceptual ("how to handle errors") not literal
- Related docs use synonyms or paraphrasing

Semantic search matches meaning. A query about "API authentication" surfaces docs about "token-based auth" even without keyword overlap.

## Technical Stack

### Embedding Model: gtr-t5-quant

The system uses `gtr-t5-quant` via `@visheratin/web-ai-node`. This choice balances:

- **Quality**: T5-based models understand technical content well
- **Speed**: Quantized version runs fast enough for CLI use (~200ms per embedding)
- **Size**: ~100MB download, cached locally in `.claude/envoy/.knowledge/models/`

The model produces 768-dimensional embeddings. Higher-dimensional models (e.g., 1536d) didn't justify the memory cost for our doc corpus size.

### Vector Index: USearch

USearch provides HNSW (Hierarchical Navigable Small World) indexing. Why USearch over alternatives:

- **No server**: Pure library, no separate process to manage
- **Fast**: Sub-millisecond search even with thousands of docs
- **Portable**: Single binary file (`.usearch`) plus JSON metadata

The index configuration in `.claude/envoy/src/lib/knowledge.ts` uses:
- 768 dimensions (matching embedding model)
- Cosine metric (normalized similarity, scale 0-1)
- F32 scalar quantization (full precision, acceptable memory for our scale)
- Connectivity 16 (balanced speed/recall tradeoff)

### Index Storage

Each index produces two files:
- `<name>.usearch`: Binary vector index
- `<name>.meta.json`: Document metadata (paths, descriptions, token counts)

Currently only `docs` index exists. The architecture supports multiple indexes (e.g., `agents`, `code`) but we found a single docs index sufficient when docs are well-structured.

## Search Flow

1. **Query embedding**: Convert search query to 768d vector
2. **Nearest neighbor search**: Find top-k similar doc embeddings (default k=50)
3. **Threshold filter**: Drop results below 0.64 similarity
4. **Token budget**: Stop adding results when cumulative tokens exceed 5000
5. **Full content**: Include full doc content for results above 0.72 similarity

The two-threshold approach (0.64 for inclusion, 0.72 for full content) balances recall with context efficiency. Low-similarity matches get metadata only; high-similarity matches get full content for immediate use.

## Indexing

### Full Reindex

`envoy knowledge reindex-all` rebuilds the entire index:
1. Discover markdown files in `docs/`
2. Parse front-matter for `description` and `relevant_files`
3. Generate embedding for full file content
4. Store in USearch with ID mapping

### Incremental Reindex

`envoy knowledge reindex-from-changes` updates specific files. Used by git hooks after doc commits. The incremental path:
1. Parse changed file list (JSON input)
2. For deletions: remove from metadata (USearch doesn't support deletion, but metadata exclusion works)
3. For adds/modifies: re-embed and update index

Note: USearch lacks native deletion. We handle this by removing entries from metadata mapping, effectively making them unreachable in search results.

## Front-matter Requirements

Docs must include front-matter for effective search:

```yaml
---
description: 1-2 sentence summary for search discovery
---
```

The `description` field is critical - it's what appears in search results before full content. Write it to answer "what will I learn from this doc?"

Optional `relevant_files` array links docs to source files, enabling bidirectional discovery.

## Environment Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `SEARCH_SIMILARITY_THRESHOLD` | 0.64 | Minimum similarity for inclusion |
| `SEARCH_CONTEXT_TOKEN_LIMIT` | 5000 | Max total tokens in results |
| `SEARCH_FULL_CONTEXT_SIMILARITY_THRESHOLD` | 0.72 | Threshold for including full content |

Raise thresholds for precision (fewer, more relevant results). Lower for recall (more results, some noise).

## Model Caching

First search downloads the embedding model (~100MB). Subsequent runs use the cached model in `.claude/envoy/.knowledge/models/`.

The caching implementation patches `node-fetch` to intercept model downloads. This is necessary because `@visheratin/web-ai-node` doesn't expose cache configuration. The patch checks a URL-hashed cache path before fetching.

## Design Tradeoffs

### Why Not a Hosted Vector DB?

Options like Pinecone or Weaviate were considered but rejected:
- **Latency**: Local search is <10ms; API calls add 100-500ms
- **Cost**: Per-query pricing doesn't scale with iterative agent workflows
- **Offline**: Developers want `envoy` to work without internet
- **Simplicity**: No server/connection management

### Why Not Chunk Documents?

Some RAG systems chunk docs into paragraphs. We index full documents because:
- Our docs are relatively short (<2000 tokens typical)
- Chunking loses context about doc structure
- Description field provides sufficient summary for search ranking

For codebases with longer docs, chunking would become necessary.

### Why Separate Search and Full Content Thresholds?

A single threshold forces a tradeoff: low threshold = too much content returned; high threshold = missing relevant docs.

The two-threshold approach returns metadata for "maybe relevant" docs (0.64-0.72 similarity) so agents know they exist, while returning full content only for "very relevant" docs (>0.72). Agents can request full content for specific docs if metadata indicates relevance.
