<goal>
Pick the right research tool for the need. All return JSON - parse results accordingly. 
</goal>

- Use multiple tools in combination when unsure about the best tools, and remember which gives the best results for your use case.

## Decision Tree
├─ Broad synthesis, deep research / solution discovery with citations but not concerned / worried about who it is currently working well for? → `ah perplexity research "<query>"`
├─ Same as perplexity but with X/Twitter community insights challenging the findings? → `ah perplexity research "<query>" --grok-challenge`
├─ Developer opinions, community sentiment, alternatives? → `ah grok search "<query>"`
├─ Find sources, discover URLs? → `ah tavily search "<query>"`
├─ Full content from known URL? → `ah tavily extract "<url1>" "<url2>"`
└─ GitHub content? → Use `gh` CLI directly, not research tools

## When to Use What
| Need | Tool | Why |
|------|------|-----|
| "Find all of the best ways to solve X?" | perplexity | Synthesizes multiple sources |
| "Find all of the best ways to solve X that works for Agentic Developers?" | perplexity --grok-challenge | Synthesizes multiple sources and challenges the findings with X/Twitter community insights |
| "What do Agentic Developers think of X?" | grok | Real-time social signals |
| "Find articles about X that are relevant to this query" | tavily search | Returns URLs to explore |
| "Get content from this doc" | tavily extract | Full page content |
