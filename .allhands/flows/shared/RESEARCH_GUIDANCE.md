<goal>
Pick the right research tool for the need. Per **Context is Precious**, use targeted tools to gather external knowledge efficiently.
</goal>

<constraints>
- MUST parse JSON results from all research tools
- MUST use `gh` CLI for GitHub content, not research tools
- NEVER use a single tool when combination would give better results
</constraints>

## Decision Tree

```
├─ Broad synthesis, deep research with citations? → `ah perplexity research "<query>"`
├─ Same + X/Twitter community insights? → `ah perplexity research "<query>" --grok-challenge`
├─ Developer opinions, sentiment, alternatives? → `ah grok search "<query>"`
├─ Find sources, discover URLs? → `ah tavily search "<query>"`
├─ Full content from known URL? → `ah tavily extract "<url1>" "<url2>"`
└─ GitHub content? → Use `gh` CLI directly
```

## When to Use What

| Need | Tool | Why |
|------|------|-----|
| "Best ways to solve X?" | perplexity | Synthesizes multiple sources |
| "Best ways to solve X for agentic developers?" | perplexity --grok-challenge | Synthesis + X/Twitter community challenge |
| "What do agentic developers think of X?" | grok | Real-time social signals |
| "Find articles about X" | tavily search | Returns URLs to explore |
| "Get content from this doc" | tavily extract | Full page content |

## Combination Strategy

When unsure which tool is best:
- Use multiple tools in parallel
- Compare result quality for your use case
- Remember which gives best results for similar future queries
