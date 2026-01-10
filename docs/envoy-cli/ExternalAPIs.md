---
description: Why envoy integrates specific external APIs (Gemini, Perplexity, Tavily, xAI) and how each serves agent workflows.
---

# External API Integrations

Envoy provides access to external APIs through structured commands. Each integration serves a specific purpose in agent workflows.

## API Selection Criteria

APIs were chosen based on:
1. **Agent-friendly output**: Structured responses, not just chat completions
2. **Unique capability**: Each API does something others don't
3. **Reliability**: Production-ready services with reasonable uptime
4. **Cost efficiency**: Affordable for iterative agent workflows

## Gemini (Vertex AI)

**Purpose**: Structured reasoning for plan validation and review.

Gemini commands use the Vertex AI API (not consumer Gemini API) for:
- Higher rate limits suitable for batch operations
- Enterprise reliability
- Consistent model versioning

### Commands

| Command | Model | Purpose |
|---------|-------|---------|
| `ask` | gemini-2.0-flash | Raw inference with file context |
| `validate` | gemini-2.0-flash | Anti-overengineering check |
| `architect` | gemini-2.0-flash | Solutions architecture |
| `audit` | gemini-3-pro-preview | Plan completeness review |
| `review` | gemini-3-pro-preview | Implementation review |

The split between flash (fast, cheap) and pro-preview (thorough) models is intentional. Audit and review need deeper reasoning; ask and validate prioritize speed.

### Structured Output

All Gemini commands request JSON output via system prompts. The prompts in `.claude/envoy/src/commands/gemini.ts` specify exact schemas:

```
Output JSON:
{
  "validation_result": "valid" | "invalid",
  "verdict_context": "...",
  ...
}
```

This enables reliable parsing without fragile text extraction.

### Retry Behavior

Gemini calls use the retry utility in `.claude/envoy/src/lib/retry.ts`. On transient failures (5xx, rate limits, network errors):
1. Wait with exponential backoff (1s -> 2s -> 4s -> 8s)
2. Retry up to 3 times
3. If all retries fail, return structured error with fallback suggestion

Fallback suggestions guide agents to proceed without Gemini (e.g., "Skip audit and proceed with user review only").

## Perplexity

**Purpose**: Deep research with web citations.

Perplexity's `sonar-deep-research` model provides:
- Multi-step web research (not just single-query search)
- Citation tracking (sources for claims)
- Synthesis across multiple sources

### When to Use

- Technology evaluation ("What are the tradeoffs of USearch vs Pinecone?")
- Best practices research ("How do production systems handle rate limiting?")
- Ecosystem understanding ("What tools integrate with tree-sitter?")

### Grok Challenge Mode

`envoy perplexity research --grok-challenge` chains Perplexity research with xAI/Grok validation. Perplexity finds information; Grok searches X for contradicting opinions.

This combats research confirmation bias - Perplexity tends to find supporting evidence; X discussions surface real-world problems.

### Timeout

Perplexity uses 5-minute timeout (vs default 2 minutes) because `sonar-deep-research` performs multi-step research that takes time.

## Tavily

**Purpose**: Agentic web search and content extraction.

Tavily is designed for agents, not humans:
- Returns structured results (title, URL, content, score)
- Provides relevance scoring for filtering
- Includes optional AI-generated answer summary

### Commands

| Command | Purpose |
|---------|---------|
| `search` | Web search with optional LLM summary |
| `extract` | Full content extraction from URLs |

### Search vs Extract Flow

1. `search` returns snippets + URLs
2. Agent identifies promising URLs from snippets
3. `extract` pulls full content from those URLs
4. Agent processes full content

This two-step approach saves tokens - don't extract everything, only what looks relevant.

### Why Tavily Over Generic Search APIs

- Optimized for agent consumption (not human SERPs)
- No ads/SEO pollution in results
- Relevance scores enable threshold-based filtering
- Extract endpoint handles JavaScript-rendered content

## xAI (Grok)

**Purpose**: X (Twitter) search for real-world technology sentiment.

Grok with X search capability provides:
- Developer opinions and experiences
- Community sentiment vs marketing claims
- Recent discussions and announcements

### Challenger Mode

When called with `--results-to-challenge`, Grok's system prompt switches to "critical research challenger" mode:

1. Find contradicting opinions
2. Surface alternatives the research missed
3. Identify real developer satisfaction vs claims
4. Focus on recent posts (last 6 months)

This skeptical framing helps surface what Perplexity's synthesis might miss.

### When to Use

- Validating library choices ("Is SWR actually good in production?")
- Understanding pain points ("What breaks with Prisma at scale?")
- Discovering alternatives ("What are people switching to from Redux?")

## Environment Variables

| Variable | Required For | Purpose |
|----------|--------------|---------|
| `VERTEX_API_KEY` | Gemini commands | Vertex AI authentication |
| `PERPLEXITY_API_KEY` | Perplexity commands | API authentication |
| `TAVILY_API_KEY` | Tavily commands | API authentication |
| `X_AI_API_KEY` | xAI commands | API authentication |

Commands fail with clear `auth_error` if required key is missing. Use `envoy info` to check which keys are configured.

## Error Handling Pattern

All external API commands follow the same pattern:

1. Check API key present (fail fast with `auth_error`)
2. Call API with timeout
3. On success: return structured `{status: "success", data: {...}}`
4. On failure: return `{status: "error", error: {type, message, suggestion}}`

The `suggestion` field guides agents on recovery (retry, use alternative, skip step).

## Cost Considerations

Agent workflows can make many API calls. Design considerations:

- **Batch where possible**: Gemini `ask` can include multiple files in context
- **Filter before extract**: Search first, extract only promising URLs
- **Cache research**: Perplexity deep research is expensive; same query likely gives similar results
- **Use fast models first**: Try flash before pro; escalate only if needed

The observability system tracks API call counts per plan in `metrics.jsonl`, enabling cost monitoring.
