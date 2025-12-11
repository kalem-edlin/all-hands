"""Update target repo from allhands source."""

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Set

from .manifest import Manifest
from .patch import (
    apply_patch,
    generate_patch,
    get_patch_base_commit,
    read_patch_file,
    write_patch_file,
)


def get_staged_files(repo_path: Path) -> Set[str]:
    """Get list of staged files in repo."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        cwd=repo_path,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return set()
    return set(result.stdout.strip().split("\n")) if result.stdout.strip() else set()


def get_allhands_root() -> Path:
    """Get allhands root from environment or relative path."""
    env_path = os.environ.get("ALLHANDS_PATH")
    if env_path:
        return Path(env_path).resolve()

    # Fallback: assume we're running from allhands/scripts
    return Path(__file__).parent.parent.parent.resolve()


def cmd_update(auto_yes: bool = False) -> int:
    """Update target repo from allhands source.

    Must be run from within target repo.
    """
    target_root = Path.cwd().resolve()

    # Check we're in a git repo
    if not (target_root / ".git").exists():
        print("Error: Not in a git repository", file=sys.stderr)
        return 1

    allhands_root = get_allhands_root()

    if not (allhands_root / ".allhands-manifest.json").exists():
        print(f"Error: Manifest not found at {allhands_root}", file=sys.stderr)
        print("Set ALLHANDS_PATH to your claude-all-hands directory", file=sys.stderr)
        return 1

    manifest = Manifest(allhands_root)

    print(f"Updating from: {allhands_root}")
    print(f"Target: {target_root}")

    # Check for staged changes to managed files
    staged = get_staged_files(target_root)
    distributable = manifest.get_distributable_files()
    managed_paths = {str(p) for p in distributable}

    conflicts = staged & managed_paths
    if conflicts:
        print("Error: Staged changes detected in managed files:", file=sys.stderr)
        for f in sorted(conflicts):
            print(f"  - {f}", file=sys.stderr)
        print("\nRun 'git stash' or commit first.", file=sys.stderr)
        return 1

    # Read existing patch
    existing_patch = read_patch_file(target_root)
    base_commit = get_patch_base_commit(target_root)

    print(f"Found {len(distributable)} distributable files")
    if base_commit:
        print(f"Current patch base: {base_commit}")

    # Copy updated files
    updated = 0
    created = 0
    deleted_in_source = []

    for rel_path in sorted(distributable):
        source_file = allhands_root / rel_path
        target_file = target_root / rel_path

        if not source_file.exists():
            # File removed from source
            if target_file.exists():
                deleted_in_source.append(rel_path)
            continue

        target_file.parent.mkdir(parents=True, exist_ok=True)

        if target_file.exists():
            if source_file.read_bytes() != target_file.read_bytes():
                shutil.copy2(source_file, target_file)
                updated += 1
        else:
            shutil.copy2(source_file, target_file)
            created += 1

    # Handle deleted files
    if deleted_in_source:
        print(f"\n{len(deleted_in_source)} files removed from allhands source:")
        for f in deleted_in_source:
            print(f"  - {f}")
        if auto_yes or input("Delete these from target? [y/N]: ").strip().lower() == "y":
            for f in deleted_in_source:
                target_file = target_root / f
                if target_file.exists():
                    target_file.unlink()
                    print(f"  Deleted: {f}")

    print(f"\nUpdated: {updated}, Created: {created}")

    # Re-apply patch
    if existing_patch.strip():
        print("\nApplying project-specific patch...")
        success, message = apply_patch(target_root, existing_patch, dry_run=True)

        if success:
            success, message = apply_patch(target_root, existing_patch)
            if success:
                print("Patch applied successfully")
            else:
                print(f"Warning: Patch partially applied:\n{message}", file=sys.stderr)
        else:
            print(f"Error: Patch conflicts detected:\n{message}", file=sys.stderr)
            print("\nOptions:")
            print("  1. Manually resolve conflicts")
            print("  2. Run 'allhands update' again after fixing")
            print("  3. Delete .allhands.patch to discard customizations")
            return 1

    # Regenerate patch with new base
    print("\nRegenerating patch with updated base commit...")
    changed_files = []
    for rel_path in distributable:
        source_file = allhands_root / rel_path
        target_file = target_root / rel_path
        if target_file.exists() and source_file.exists():
            if source_file.read_bytes() != target_file.read_bytes():
                changed_files.append(rel_path)

    if changed_files:
        new_patch = generate_patch(allhands_root, target_root, changed_files)
        write_patch_file(target_root, new_patch)
        print(f"Updated .allhands.patch with {len(changed_files)} customizations")
    else:
        # Clear patch if no customizations
        write_patch_file(target_root, "")
        print("No customizations - .allhands.patch cleared")

    print("\nUpdate complete!")
    return 0
