#!/usr/bin/env python3
"""SessionStart hook: scan skills directories for missing/invalid SKILL.md files."""
from __future__ import annotations

import re
import sys
from pathlib import Path


def parse_frontmatter(content):
    """Parse YAML frontmatter from content."""
    if not content.startswith("---"):
        return None
    parts = content.split("---", 2)
    if len(parts) < 3:
        return None
    result = {}
    for line in parts[1].strip().split("\n"):
        if ":" in line:
            key, _, value = line.partition(":")
            result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def validate_skill(skill_path):
    """Validate a skill directory. Returns list of errors."""
    errors = []
    skill_md = skill_path / "SKILL.md"
    name = skill_path.name

    if not skill_md.exists():
        errors.append(f"{name}: missing SKILL.md")
        return errors

    try:
        content = skill_md.read_text()
    except Exception as e:
        errors.append(f"{name}: error reading SKILL.md - {e}")
        return errors

    fm = parse_frontmatter(content)
    if fm is None:
        errors.append(f"{name}: missing or invalid frontmatter")
        return errors

    # Validate name
    if "name" not in fm:
        errors.append(f"{name}: missing 'name' field")
    else:
        n = fm["name"]
        if len(n) > 64:
            errors.append(f"{name}: 'name' exceeds 64 chars ({len(n)})")
        if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", n):
            errors.append(f"{name}: 'name' must be kebab-case")

    # Validate description
    if "description" not in fm:
        errors.append(f"{name}: missing 'description' field")
    elif len(fm["description"]) > 300:
        errors.append(f"{name}: 'description' exceeds 300 chars")

    return errors


def main():
    # Use CLAUDE_PROJECT_DIR env var to find .claude directory
    import os
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
    if not project_dir:
        return
    skills_dir = Path(project_dir) / ".claude" / "skills"

    if not skills_dir.exists():
        return

    all_errors = []
    for skill_path in skills_dir.iterdir():
        if skill_path.is_dir() and not skill_path.name.startswith("_"):
            errors = validate_skill(skill_path)
            all_errors.extend(errors)

    if all_errors:
        print("⚠️ Skill validation warnings:", file=sys.stderr)
        for error in all_errors:
            print(f"  • {error}", file=sys.stderr)


if __name__ == "__main__":
    main()
