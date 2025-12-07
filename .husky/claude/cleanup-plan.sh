#!/bin/sh
# Clean up plan directory for merged branch
# Called from post-merge hook

. "$(dirname "$0")/claude/common.sh"

# Get the branch that was just merged (from reflog)
merged_branch=$(git reflog -1 2>/dev/null | grep -oE 'merge [^:]+' | sed 's/merge //' || echo "")

if [ -n "$merged_branch" ]; then
    get_plan_dir_for_branch "$merged_branch"
    if [ -d "$PLAN_DIR" ]; then
        rm -r "$PLAN_DIR"
    fi
fi
