"""Patch generation and application for project-specific changes."""

import re
import subprocess
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple


@dataclass
class PatchHeader:
    """Metadata stored in .allhands.patch header."""
    base_commit: str
    generated: str

    @classmethod
    def parse(cls, content: str) -> Optional["PatchHeader"]:
        """Parse header from patch file content."""
        base_match = re.search(r"^# claude-all-hands base: ([a-f0-9]+)", content, re.MULTILINE)
        gen_match = re.search(r"^# generated: (.+)$", content, re.MULTILINE)
        if base_match:
            return cls(
                base_commit=base_match.group(1),
                generated=gen_match.group(1) if gen_match else "",
            )
        return None

    def to_string(self) -> str:
        return f"# claude-all-hands base: {self.base_commit}\n# generated: {self.generated}\n\n"


def get_current_commit(repo_path: Path) -> str:
    """Get current HEAD commit SHA."""
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=repo_path,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Failed to get commit: {result.stderr}")
    return result.stdout.strip()[:7]


def generate_patch(
    allhands_root: Path,
    target_root: Path,
    files: List[Path],
) -> str:
    """Generate unified diff patch for given files."""
    base_commit = get_current_commit(allhands_root)
    header = PatchHeader(
        base_commit=base_commit,
        generated=datetime.now().strftime("%Y-%m-%d"),
    )

    patches = []
    for file_path in files:
        source_file = allhands_root / file_path
        target_file = target_root / file_path

        if not target_file.exists():
            continue

        source_content = source_file.read_text() if source_file.exists() else ""
        target_content = target_file.read_text()

        if source_content == target_content:
            continue

        # Generate unified diff
        result = subprocess.run(
            ["diff", "-u", "--label", f"a/{file_path}", "--label", f"b/{file_path}", "-", str(target_file)],
            input=source_content,
            capture_output=True,
            text=True,
        )
        if result.returncode == 1:  # diff returns 1 when files differ
            patches.append(result.stdout)

    if not patches:
        return ""

    return header.to_string() + "\n".join(patches)


def apply_patch(target_root: Path, patch_content: str, dry_run: bool = False) -> Tuple[bool, str]:
    """Apply patch to target directory.

    Returns (success, message).
    """
    if not patch_content.strip():
        return True, "No patch to apply"

    # Strip header/comment lines (lines starting with #)
    lines = patch_content.split("\n")
    patch_body = "\n".join(
        line for line in lines
        if not line.startswith("#")
    )

    # Check if there's any actual patch content
    if not patch_body.strip():
        return True, "No patch to apply (comments only)"

    args = ["patch", "-p1", "--forward"]
    if dry_run:
        args.append("--dry-run")

    result = subprocess.run(
        args,
        cwd=target_root,
        input=patch_body,
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        return True, result.stdout
    else:
        return False, f"Patch failed:\n{result.stdout}\n{result.stderr}"


def read_patch_file(target_root: Path) -> str:
    """Read .allhands.patch from target repo."""
    patch_file = target_root / ".allhands.patch"
    if patch_file.exists():
        return patch_file.read_text()
    return ""


def write_patch_file(target_root: Path, content: str):
    """Write .allhands.patch to target repo."""
    patch_file = target_root / ".allhands.patch"
    if content.strip():
        patch_file.write_text(content)
    elif patch_file.exists():
        patch_file.unlink()


def get_patch_base_commit(target_root: Path) -> Optional[str]:
    """Get base commit from existing patch file."""
    content = read_patch_file(target_root)
    if content:
        header = PatchHeader.parse(content)
        if header:
            return header.base_commit
    return None
