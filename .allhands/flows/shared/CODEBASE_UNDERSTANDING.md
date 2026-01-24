<goal>
Enable context-efficient codebase exploration using intentional tooling. Minimize context window consumption while maximizing understanding.
</goal>

<constraints>

**LSP  FILE READS** Knowledge search surfaces relevant docs with file references → LSP explores those symbols → full reads only when necessary.
**`tldr semantic search` > `grep`** tldr semantic search can decode your searches and provide relevant code snippets.

Flow: User Task → Knowledge Search → LSP on Referenced Symbols or `tldr` commands if LSP not effective → Full Reads only when Needed

</constraints>

For knowledge search, queries should be **complete sentences** with full context, not minimal keywords. RAG performs better with rich semantic content. They are most effective for complex research needs when spun up in parallel!

```bash
# GOOD - complete question with context
envoy knowledge docs search "how does the retry mechanism handle rate limits when calling external APIs"

# BAD - keyword soup
envoy knowledge docs search "retry rate limit api"
```

You will either recieve full files / minimized descriptions in response or an aggregated / curated list of information depending on the complexity of the search. Pending you recieve the following infromation, heres what to do with it:

* `insight`: Engineering / Product Knowledge extracted along side the file references (the "why").
* `lsp_entry_points`: Key file references, why they are important to explore, and a potential LSP symbol (or just the file by itself) you should use for further codebase understanding.
* `design_notes`: Relevant architectural decisions from docs to be aware of for your tasking.


Only read full files when:
- LSP exploration reveals complex implementation needs investigation
- Path-only references (no symbol to LSP into)
- tldr is not effective for searching the current language

<decision_tree>

```
Need codebase context?
├─ Know exact file/symbol? → LSP directly, skip knowledge search
└─ Conceptual/discovery question? → envoy knowledge docs search
    ├─ Aggregated result? → Follow lsp_entry_points (why field = priority)
    └─ Direct result? → relevant_files + [ref:...] blocks → LSP on symbols
        └─ Use tldr semantic search to understand the codebase
            └─ ast-grep if still struggling
```

</decision_tree>

