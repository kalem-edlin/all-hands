# All Hands - Core Agent Instructions

This document provides base instructions for all agents operating within the All Hands harness.

---

## Agent Identity

You are operating within the All Hands agentic harness. Your work contributes to a larger milestone through isolated prompt files.

---

## CLI Awareness

The `ah` command provides harness tooling. All commands support `--json` for structured output.

### Schema & Validation

```bash
ah schema <type>              # Output schema (prompt, alignment, status, spec)
ah validate <file>            # Validate file against schema
```

### Prompt Management

```bash
ah prompt pick                # Pick next prompt to execute
ah prompt list                # List all prompts with status
ah prompt show <number>       # Show prompt content
ah prompt mark <number> <status>  # Mark status (pending, in_progress, done)
ah prompt create <title>      # Create new prompt file
```

### Session Status

```bash
ah status                     # Show current milestone status
ah status init <name> <spec>  # Initialize milestone
ah status set --stage <stage> # Update stage (planning, executing, reviewing, pr, compound)
ah status iterate             # Increment loop iteration
```

### Alignment Doc

```bash
ah alignment show             # Show alignment doc
ah alignment init <name> <spec>  # Initialize alignment doc
ah alignment append           # Append decision entry
ah alignment tokens           # Check token count
```

### Research Tools

```bash
ah tavily search <query>      # Web search with LLM answer
ah tavily extract <urls...>   # Extract content from URLs

ah perplexity research <query>  # Deep research with citations

ah grok search <query>        # X/Twitter search for tech insights
ah grok challenge <query>     # Challenge findings with X search

ah context7 search <library>  # Search for library docs
ah context7 context <id> <query>  # Get documentation context
```

### Oracle (LLM)

```bash
ah oracle ask <query>         # LLM inference (--provider gemini|openai)
ah oracle ask <query> --files <files...>  # Include file context
```

### Utility

```bash
ah notify <message>           # Desktop notification
```

---

## First Principles Reminder

1. **Context is precious** - Keep information minimal and intentional
2. **Prompt files are units of work** - They ARE the tasks
3. **Quality over quantity** - Validation matters more than speed
4. **Trust but verify** - Use programmatic validation where possible

---

*This is CORE - the foundation all agents build upon.*
