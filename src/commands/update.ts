import { existsSync, mkdirSync, copyFileSync, unlinkSync, renameSync } from 'fs';
import { join, dirname, basename } from 'path';
import { Manifest, filesAreDifferent } from '../lib/manifest.js';
import { isGitRepo, getStagedFiles } from '../lib/git.js';
import { getAllhandsRoot } from '../lib/paths.js';
import { ConflictResolution, askConflictResolution, confirm, getNextBackupPath } from '../lib/ui.js';
import { restoreDotfiles } from '../lib/dotfiles.js';
import { fullReplace } from '../lib/full-replace.js';

export async function cmdUpdate(autoYes: boolean = false, useFullReplace: boolean = false): Promise<number> {
  const targetRoot = process.cwd();

  if (!isGitRepo(targetRoot)) {
    console.error('Error: Not in a git repository');
    return 1;
  }

  const allhandsRoot = getAllhandsRoot();

  if (!existsSync(join(allhandsRoot, '.internal.json'))) {
    console.error(`Error: Internal config not found at ${allhandsRoot}`);
    console.error('Set ALLHANDS_PATH to your claude-all-hands directory');
    return 1;
  }

  console.log(`Updating from: ${allhandsRoot}`);
  console.log(`Target: ${targetRoot}`);
  if (useFullReplace) {
    console.log('Mode: full-replace (wholesale directory replacement)');
  }

  // CLAUDE.md handling - migrate existing CLAUDE.md → CLAUDE.project.md
  const targetClaudeMd = join(targetRoot, 'CLAUDE.md');
  const targetProjectMd = join(targetRoot, 'CLAUDE.project.md');

  let claudeMdMigrated = false;

  if (existsSync(targetClaudeMd) && !existsSync(targetProjectMd)) {
    console.log('\nMigrating CLAUDE.md → CLAUDE.project.md...');
    renameSync(targetClaudeMd, targetProjectMd);
    claudeMdMigrated = true;
    console.log('  Done - your instructions preserved in CLAUDE.project.md');
  }

  let updated = 0;
  let created = 0;
  let backupPath: string | null = null;
  let resolution: ConflictResolution = 'overwrite';
  const conflicts: string[] = [];

  if (useFullReplace) {
    // ==================== FULL REPLACE MODE ====================
    // Wholesale replacement of .allhands directory with backup
    console.log('\nPerforming full replacement...');

    const result = await fullReplace({
      sourceRoot: allhandsRoot,
      targetRoot: targetRoot,
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

    // Check for staged changes to managed files
    const staged = getStagedFiles(targetRoot);
    const managedPaths = new Set(distributable);

    const stagedConflicts = [...staged].filter(f => managedPaths.has(f));
    if (stagedConflicts.length > 0) {
      console.error('Error: Staged changes detected in managed files:');
      for (const f of stagedConflicts.sort()) {
        console.error(`  - ${f}`);
      }
      console.error("\nRun 'git stash' or commit first.");
      return 1;
    }

    console.log(`Found ${distributable.size} distributable files`);

    // Detect conflicts and deleted files
    const deletedInSource: string[] = [];
    const projectSpecificFiles = new Set(['CLAUDE.project.md', '.claude/settings.local.json']);

    for (const relPath of distributable) {
      if (relPath === 'CLAUDE.md' && claudeMdMigrated) continue;
      if (projectSpecificFiles.has(relPath)) continue;

      const sourceFile = join(allhandsRoot, relPath);
      const targetFile = join(targetRoot, relPath);

      if (!existsSync(sourceFile)) {
        if (existsSync(targetFile)) {
          deletedInSource.push(relPath);
        }
        continue;
      }

      if (existsSync(targetFile)) {
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
          const targetFile = join(targetRoot, relPath);
          const bkPath = getNextBackupPath(targetFile);
          copyFileSync(targetFile, bkPath);
          console.log(`  ${relPath} → ${basename(bkPath)}`);
        }
      }
    }

    // Copy updated files
    for (const relPath of [...distributable].sort()) {
      if (projectSpecificFiles.has(relPath)) continue;

      const sourceFile = join(allhandsRoot, relPath);
      const targetFile = join(targetRoot, relPath);

      if (!existsSync(sourceFile)) continue;

      mkdirSync(dirname(targetFile), { recursive: true });

      if (existsSync(targetFile)) {
        if (filesAreDifferent(sourceFile, targetFile)) {
          copyFileSync(sourceFile, targetFile);
          updated++;
        }
      } else {
        copyFileSync(sourceFile, targetFile);
        created++;
      }
    }

    // Restore dotfiles
    restoreDotfiles(targetRoot);

    // Handle deleted files
    if (deletedInSource.length > 0) {
      console.log(`\n${deletedInSource.length} files removed from allhands source:`);
      for (const f of deletedInSource) {
        console.log(`  - ${f}`);
      }
      const shouldDelete = autoYes || (await confirm('Delete these from target?'));
      if (shouldDelete) {
        for (const f of deletedInSource) {
          const targetFile = join(targetRoot, f);
          if (existsSync(targetFile)) {
            unlinkSync(targetFile);
            console.log(`  Deleted: ${f}`);
          }
        }
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  if (useFullReplace) {
    console.log('Done: full replacement complete');
    if (backupPath) {
      console.log(`Backup: ${basename(backupPath)}`);
    }
  } else {
    console.log(`Updated: ${updated}, Created: ${created}`);
    if (resolution === 'backup' && conflicts.length > 0) {
      console.log(`Created ${conflicts.length} backup file(s)`);
    }
  }
  if (claudeMdMigrated) {
    console.log('Migrated CLAUDE.md → CLAUDE.project.md');
  }
  console.log('\nProject-specific files preserved:');
  console.log('  - CLAUDE.project.md');
  console.log('  - .claude/settings.local.json');
  console.log(`${'='.repeat(60)}`);

  return 0;
}
