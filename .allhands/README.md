# All Hands CLI

Internal CLI for the All Hands agentic harness.

## Installation

```bash
cd .allhands
npm install
```

## Usage

```bash
npx tsx src/cli.ts <command>
```

Or create an alias:
```bash
alias ah="npx tsx $(pwd)/src/cli.ts"
```

## Optional Dependencies

### Universal Ctags (for `ah docs` command)

The `ah docs` command uses [Universal Ctags](https://ctags.io/) for symbol lookup and documentation reference validation.

**Install (macOS):**
```bash
brew install universal-ctags
```

**Install (Ubuntu/Debian):**
```bash
sudo apt install universal-ctags
```

**Install (other platforms):**
See [Universal Ctags installation guide](https://github.com/universal-ctags/ctags#how-to-build-and-install).

**Verify installation:**
```bash
ctags --version
# Should show "Universal Ctags" in output
```

**What happens if ctags isn't installed?**

The `ah docs` commands will exit with an error message asking you to install universal-ctags. Other `ah` commands work normally without it.

### AST-grep (optional, for advanced code search)

[AST-grep](https://ast-grep.github.io/) is an optional tool for pattern-based code search and exploration. It's not required for docs validation but provides richer code exploration capabilities.

**Install (macOS):**
```bash
brew install ast-grep
```

**Install (cargo):**
```bash
cargo install ast-grep --locked
```

**Install (npm - slower startup):**
```bash
npm install -g @ast-grep/cli
```

**Verify installation:**
```bash
sg --version
```

### MCP Tools (for `ah tools` command)

The `ah tools` command uses [mcptools](https://github.com/f/mcptools) to interact with MCP (Model Context Protocol) servers for lazy-loaded tool integrations.

**Install (macOS):**
```bash
brew tap f/mcptools
brew install mcp
```

**Install (other platforms):**
```bash
go install github.com/f/mcptools/cmd/mcptools@latest
```

**Verify installation:**
```bash
mcp --version
```

**What happens if mcptools isn't installed?**

The `ah tools` command will exit with an error message asking you to install mcptools. Other `ah` commands work normally without it.

### Desktop Notifications (macOS)

The `ah notify` command uses [jamf/Notifier](https://github.com/jamf/Notifier) for native macOS notifications.

**Install:**
```bash
brew install --cask notifier
```

**What happens if Notifier isn't installed?**

The notification commands fail gracefully:
- Returns `{ success: false, sent: false, reason: "notifier not available" }` in JSON mode
- Prints "Failed to send notification (notifier not installed?)" in normal mode
- Exits with code 1
- No crash or exception

This allows hooks to safely call `ah notify` without breaking if Notifier isn't installed.

**Usage:**
```bash
# Send a notification
ah notify send "Title" "Message"

# Gate notification (persistent alert - requires dismissal)
ah notify gate "Review" "Plan ready for review"

# Hook notification (auto-dismissing banner)
ah notify hook "Stop" "Agent execution stopped"

# JSON output (for hooks)
ah notify send "Title" "Message" --json
```

**Claude Code Hooks Example:**

In `.claude/settings.json`:
```json
{
  "hooks": {
    "Stop": [
      "ah notify hook Stop \"Agent stopped\""
    ]
  }
}
```

## Commands

Run `ah --help` to see all available commands.

| Command | Description |
|---------|-------------|
| `ah status` | Show milestone status |
| `ah prompt` | Manage prompt files |
| `ah alignment` | Manage alignment doc |
| `ah schema` | Output schemas |
| `ah validate` | Validate files against schemas |
| `ah docs` | Documentation validation and reference management |
| `ah notify` | Desktop notifications |
| `ah oracle` | LLM inference |
| `ah tavily` | Web search |
| `ah perplexity` | Deep research |
| `ah grok` | X/Twitter search |
| `ah context7` | Library documentation |
| `ah tools` | Lazy-loaded MCP tool integrations |
| `ah tui` | Launch TUI |

## Documentation Commands

The `ah docs` command provides tools for documentation reference validation:

```bash
# Validate all documentation references
ah docs validate

# Validate specific docs path
ah docs validate --path docs/api/

# Create a symbol reference
ah docs format-reference src/lib/foo.ts MyClass
# Output: [ref:src/lib/foo.ts:MyClass:abc1234]

# Create a file-only reference
ah docs format-reference src/lib/foo.ts
# Output: [ref:src/lib/foo.ts::abc1234]

# Get complexity metrics
ah docs complexity src/lib/

# Get tree with doc coverage
ah docs tree src/ --depth 2
```

### Reference Format

Documentation uses validated references to link to source code:

```
[ref:file:symbol:hash]   - Symbol reference (validated via ctags)
[ref:file::hash]         - File-only reference (no symbol validation)
```

Where `hash` is the git commit hash (7 chars) of the file when the reference was created.

### Validation States

| State | Condition | Action |
|-------|-----------|--------|
| VALID | File exists, symbol exists, hash matches | None |
| STALE | File exists, symbol exists, hash differs | Review and update |
| INVALID | File missing OR symbol missing | Fix documentation |
