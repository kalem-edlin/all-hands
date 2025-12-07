---
name: research-tools
description: External research via claude-envoy. Covers web search, URL extraction, and deep research. Only for curator/researcher agents.
---

# Research Tools

External research capability for curator and researcher agents only.

## Quick Reference

```bash
# Deep research with citations (Perplexity) - synthesized findings
envoy perplexity research "query"

# Web search (Tavily) - find sources, get URLs (includes LLM answer by default)
envoy tavily search "query"
envoy tavily search "query" --max-results 10  # optional, API default is 5

# Extract content from URLs (Tavily) - full page content
envoy tavily extract "url1" "url2"
```

## When to Use What

| Need | Tool | Cost |
|------|------|------|
| Broad question, need synthesis | `perplexity research` | High |
| Find sources, discover URLs | `tavily search` | Medium |
| Get full content from known URL | `tavily extract` | Low |
| Agentic: search then deep-dive | search → extract | Medium |

## Decision Tree

```
Need information?
├─ Know the exact URL? → tavily extract (or delegate to specialist agent)
├─ Need to find sources? → tavily search → extract promising URLs
└─ Need synthesized answer? → perplexity research
```

## GitHub Content

For GitHub repositories, files, issues, PRs - use `gh` CLI instead of extract:

```bash
# Get file content
gh api repos/{owner}/{repo}/contents/{path}

# Get issue/PR
gh issue view {number} --repo {owner}/{repo}
gh pr view {number} --repo {owner}/{repo}

# Search code
gh search code "query" --repo {owner}/{repo}
```

## Research Workflow

### 1. Scope the Query
Before calling any tool, clarify:
- What specifically needs to be learned?
- What will the findings be used for?
- What level of depth is needed?

### 2. Choose Approach

**Option A: Pre-synthesized (faster)**
```bash
envoy perplexity research "[topic] best practices 2025"
```
Returns synthesized findings with citations. Good for broad questions.

**Option B: Agentic (more control)**
```bash
# Find sources
envoy tavily search "[topic]"

# Extract full content from promising URLs
envoy tavily extract "url1" "url2"
```
Returns raw content for you to process. Good when you need specific details.

### 3. Process Results

All tools return JSON. Parse `data.content` or `data.results` for findings.

## Query Tips

**For best practices:**
```
"[topic] best practices 2025"
```

**For implementation:**
```
"how to implement [specific thing] in [context]"
```

**For comparison:**
```
"[option A] vs [option B] for [use case]"
```

## Output Format

After research, return to parent agent:

```markdown
## Research: [Topic]

### Key Findings
- Finding with context
- Finding with context

### Sources
- [Source URL] - what was relevant

### Recommendations
What to do based on findings.
```
