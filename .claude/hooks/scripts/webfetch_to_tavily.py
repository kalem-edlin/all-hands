#!/usr/bin/env python3
"""PreToolUse hook: intercept WebFetch → redirect to envoy tavily extract."""
import json
import sys

data = json.load(sys.stdin)
url = data.get("tool_input", {}).get("url", "")

if not url:
    sys.exit(0)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": f"Use: envoy tavily extract '{url}'"
    }
}))
sys.exit(0)
