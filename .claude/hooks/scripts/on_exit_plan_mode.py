#!/usr/bin/env python3
"""PostToolUse hook for ExitPlanMode - transitions plan status from draft to active."""

import json
import subprocess
import sys
from pathlib import Path


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        return

    tool_name = input_data.get("tool_name", "")
    if tool_name != "ExitPlanMode":
        return

    cwd = input_data.get("cwd", ".")
    envoy_path = Path(cwd) / ".claude" / "envoy" / "envoy"

    # Set status to active
    result = subprocess.run(
        [str(envoy_path), "plans", "set-status", "active"],
        capture_output=True,
        text=True,
        cwd=cwd,
    )

    if result.returncode == 0:
        try:
            data = json.loads(result.stdout)
            if data.get("status") == "success":
                path = data.get("data", {}).get("path", "")
                print(f"Plan status: active (implementing)")
                if path:
                    print(f"Plan file: {path}")
        except json.JSONDecodeError:
            pass


if __name__ == "__main__":
    main()
