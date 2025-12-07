#!/usr/bin/env python3
"""PreToolUse hook: block WebSearch outright."""
import json
import sys

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "WebSearch not allowed - delegate to researcher agent"
    }
}))
sys.exit(0)
