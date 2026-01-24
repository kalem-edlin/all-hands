import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { basename, dirname, join, resolve } from 'path';
import { isGitRepo } from '../lib/git.js';
import { Manifest, filesAreDifferent } from '../lib/manifest.js';
import { getAllhandsRoot } from '../lib/paths.js';
import { ConflictResolution, askConflictResolution, confirm, getNextBackupPath } from '../lib/ui.js';
import { SYNC_CONFIG_FILENAME, SYNC_CONFIG_TEMPLATE } from '../lib/constants.js';
import { restoreDotfiles } from '../lib/dotfiles.js';
import { fullReplace } from '../lib/full-replace.js';

const AH_SHIM_SCRIPT = `#!/bin/bash
# AllHands CLI shim - finds and executes project-local .allhands/ah
# Installed by: npx all-hands init

dir="$PWD"
while [ "$dir" != "/" ]; do
  if [ -x "$dir/.allhands/ah" ]; then
    exec "$dir/.allhands/ah" "$@"
  fi
  dir="$(dirname "$dir")"
done

echo "error: not in an all-hands project (no .allhands/ah found)" >&2
echo "hint: run 'npx all-hands init .' to initialize this project" >&2
exit 1
`;

function setupAhShim(): { installed: boolean; path: string | null; inPath: boolean } {
  const localBin = join(homedir(), '.local', 'bin');
  const shimPath = join(localBin, 'ah');

  // Check if ~/.local/bin is in PATH
  const pathEnv = process.env.PATH || '';
  const inPath = pathEnv.split(':').some(p =>
    p === localBin || p === join(homedir(), '.local/bin')
  );

  // Check if shim already exists and is current
  if (existsSync(shimPath)) {
    const existing = readFileSync(shimPath, 'utf-8');
    if (existing.includes('.allhands/ah')) {
      return { installed: false, path: shimPath, inPath };
    }
  }

  // Create ~/.local/bin if needed
  mkdirSync(localBin, { recursive: true });

  // Write the shim
  writeFileSync(shimPath, AH_SHIM_SCRIPT, { mode: 0o755 });

  return { installed: true, path: shimPath, inPath };
}

export async function cmdInit(target: string, autoYes: boolean = false, useFullReplace: boolean = false): Promise<number> {
  const resolvedTarget = resolve(process.cwd(), target);
  const allhandsRoot = getAllhandsRoot();

  console.log(`Initializing allhands in: ${resolvedTarget}`);
  console.log(`Source: ${allhandsRoot}`);
  if (useFullReplace) {
    console.log('Mode: full-replace (wholesale directory replacement)');
  }

  if (!existsSync(resolvedTarget)) {
    console.error(`Error: Target directory does not exist: ${resolvedTarget}`);
    return 1;
  }

  if (!isGitRepo(resolvedTarget)) {
    console.error(`Warning: Target is not a git repository: ${resolvedTarget}`);
    if (!autoYes) {
      if (!(await confirm('Continue anyway?'))) {
        console.log('Aborted.');
        return 1;
      }
    }
  }

  // CLAUDE.md handling - migrate existing CLAUDE.md → CLAUDE.project.md
  const targetClaudeMd = join(resolvedTarget, 'CLAUDE.md');
  const targetProjectMd = join(resolvedTarget, 'CLAUDE.project.md');

  let claudeMdMigrated = false;

  if (existsSync(targetClaudeMd) && !existsSync(targetProjectMd)) {
    console.log('\nMigrating CLAUDE.md → CLAUDE.project.md...');
    renameSync(targetClaudeMd, targetProjectMd);
    claudeMdMigrated = true;
    console.log('  Done - your instructions preserved in CLAUDE.project.md');
  }

  let copied = 0;
  let skipped = 0;
  let backupPath: string | null = null;
  let resolution: ConflictResolution = 'overwrite';
  const conflicts: string[] = [];

  if (useFullReplace) {
    // ==================== FULL REPLACE MODE ====================
    // Wholesale replacement of .allhands directory with backup
    console.log('\nPerforming full replacement...');

    const result = await fullReplace({
      sourceRoot: allhandsRoot,
      targetRoot: resolvedTarget,
      verbose: true,
    });

    backupPath = result.backupPath;
    if (result.backupPath) {
      console.log(`  Backup created: ${basename(result.backupPath)}`);
    }
    if (result.filesRestored.length > 0) {
      console.log(`  Restored from backup: ${result.filesRestored.join(', ')}`);
    }
    if (result.claudeMdUpdated) {
      console.log('  CLAUDE.md updated with CORE.md reference');
    }
    if (result.envExampleCopied) {
      console.log('  .env example files copied');
    }

    console.log('\nFull replacement complete!');
  } else {
    // ==================== MANIFEST-BASED MODE ====================
    // Per-file sync using manifest filtering
    const manifest = new Manifest(allhandsRoot);
    const distributable = manifest.getDistributableFiles();

    // Project-specific files: never overwrite if they exist
    const projectSpecificFiles = new Set(['CLAUDE.project.md', '.claude/settings.local.json']);

    // Detect conflicts (files that exist and differ)
    for (const relPath of distributable) {
      if (relPath === 'CLAUDE.md' && claudeMdMigrated) continue;
      if (projectSpecificFiles.has(relPath) && existsSync(join(resolvedTarget, relPath))) continue;

      const sourceFile = join(allhandsRoot, relPath);
      const targetFile = join(resolvedTarget, relPath);

      if (existsSync(targetFile) && existsSync(sourceFile)) {
        if (filesAreDifferent(sourceFile, targetFile)) {
          conflicts.push(relPath);
        }
      }
    }

    // Handle conflicts
    if (conflicts.length > 0) {
      if (autoYes) {
        resolution = 'overwrite';
        console.log(`\nAuto-overwriting ${conflicts.length} conflicting files (--yes mode)`);
      } else {
        resolution = await askConflictResolution(conflicts);
        if (resolution === 'cancel') {
          console.log('Aborted. No changes made.');
          return 1;
        }
      }

      if (resolution === 'backup') {
        console.log('\nCreating backups...');
        for (const relPath of conflicts) {
          const targetFile = join(resolvedTarget, relPath);
          const bkPath = getNextBackupPath(targetFile);
          copyFileSync(targetFile, bkPath);
          console.log(`  ${relPath} → ${basename(bkPath)}`);
        }
      }
    }

    // Copy files
    console.log('\nCopying allhands files...');
    console.log(`Found ${distributable.size} files to distribute`);

    for (const relPath of [...distributable].sort()) {
      const sourceFile = join(allhandsRoot, relPath);
      const targetFile = join(resolvedTarget, relPath);

      if (projectSpecificFiles.has(relPath) && existsSync(targetFile)) {
        skipped++;
        continue;
      }

      if (!existsSync(sourceFile)) continue;

      mkdirSync(dirname(targetFile), { recursive: true });

      if (existsSync(targetFile)) {
        if (!filesAreDifferent(sourceFile, targetFile)) {
          skipped++;
          continue;
        }
      }

      copyFileSync(sourceFile, targetFile);
      copied++;
    }

    // Restore dotfiles (gitignore → .gitignore, etc.)
    restoreDotfiles(resolvedTarget);
  }

  // Setup ah CLI shim in ~/.local/bin
  console.log('\nSetting up `ah` command...');
  const shimResult = setupAhShim();
  if (shimResult.installed) {
    console.log(`  Installed shim to ${shimResult.path}`);
  } else {
    console.log(`  Shim already installed at ${shimResult.path}`);
  }
  if (!shimResult.inPath) {
    console.log('  ⚠️  ~/.local/bin is not in your PATH');
    console.log('  Add this to your shell config (.zshrc/.bashrc):');
    console.log('    export PATH="$HOME/.local/bin:$PATH"');
  }

  // Offer to create sync config for push command
  const syncConfigPath = join(resolvedTarget, SYNC_CONFIG_FILENAME);
  let syncConfigCreated = false;

  if (existsSync(syncConfigPath)) {
    console.log(`\n${SYNC_CONFIG_FILENAME} already exists - skipping`);
  } else if (!autoYes) {
    console.log('\nThe push command lets you contribute changes back to all-hands.');
    console.log('A sync config file lets you customize which files to include/exclude.');
    if (await confirm(`Create ${SYNC_CONFIG_FILENAME}?`)) {
      writeFileSync(syncConfigPath, JSON.stringify(SYNC_CONFIG_TEMPLATE, null, 2) + '\n');
      syncConfigCreated = true;
      console.log(`  Created ${SYNC_CONFIG_FILENAME}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  if (useFullReplace) {
    console.log('Done: full replacement complete');
    if (backupPath) {
      console.log(`Backup: ${basename(backupPath)}`);
    }
  } else {
    console.log(`Done: ${copied} copied, ${skipped} unchanged`);
    if (resolution === 'backup' && conflicts.length > 0) {
      console.log(`Created ${conflicts.length} backup file(s)`);
    }
  }
  if (claudeMdMigrated) {
    console.log('Migrated CLAUDE.md → CLAUDE.project.md');
  }
  if (syncConfigCreated) {
    console.log(`Created ${SYNC_CONFIG_FILENAME} for push customization`);
  }
  console.log('\nProject-specific files preserved (never overwritten):');
  console.log('  - CLAUDE.project.md');
  console.log('  - .claude/settings.local.json');
  console.log(`${'='.repeat(60)}`);

  console.log('\nNext steps:');
  console.log('  1. Review CLAUDE.project.md for your project-specific instructions');
  console.log('  2. Commit the changes');

  return 0;
}
