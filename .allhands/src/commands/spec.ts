/**
 * Spec Commands (Agent-Facing)
 *
 * Manages milestone spec files.
 *
 * Commands:
 * - ah spec list         - List all specs
 * - ah spec show <name>  - Show spec content
 * - ah spec finalize     - Move roadmap spec to completed location after merge
 */

import { Command } from 'commander';
import { existsSync, readFileSync, renameSync, readdirSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { getCurrentBranch, getGitRoot, readStatus } from '../lib/planning.js';
import { execSync } from 'child_process';

export function register(program: Command): void {
  const spec = program
    .command('spec')
    .description('Milestone spec management');

  // ah spec list
  spec
    .command('list')
    .description('List all spec files')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      const gitRoot = getGitRoot();
      const specsDir = join(gitRoot, 'specs');
      const roadmapDir = join(specsDir, 'roadmap');

      const specs: Array<{ name: string; path: string; status: 'completed' | 'roadmap' }> = [];

      // List completed specs
      if (existsSync(specsDir)) {
        const files = readdirSync(specsDir).filter((f) => f.endsWith('.spec.md'));
        for (const file of files) {
          specs.push({
            name: file.replace('.spec.md', ''),
            path: join(specsDir, file),
            status: 'completed',
          });
        }
      }

      // List roadmap specs
      if (existsSync(roadmapDir)) {
        const files = readdirSync(roadmapDir).filter((f) => f.endsWith('.spec.md'));
        for (const file of files) {
          specs.push({
            name: file.replace('.spec.md', ''),
            path: join(roadmapDir, file),
            status: 'roadmap',
          });
        }
      }

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          specs,
          count: specs.length,
        }, null, 2));
        return;
      }

      console.log(`Found ${specs.length} spec(s):`);
      console.log();

      const completed = specs.filter((s) => s.status === 'completed');
      const roadmap = specs.filter((s) => s.status === 'roadmap');

      if (completed.length > 0) {
        console.log('Completed:');
        for (const s of completed) {
          console.log(`  • ${s.name}`);
        }
        console.log();
      }

      if (roadmap.length > 0) {
        console.log('Roadmap (pending):');
        for (const s of roadmap) {
          console.log(`  • ${s.name}`);
        }
      }
    });

  // ah spec show
  spec
    .command('show <name>')
    .description('Show spec content')
    .option('--json', 'Output as JSON')
    .action(async (name: string, options: { json?: boolean }) => {
      const gitRoot = getGitRoot();

      // Try to find spec
      const paths = [
        join(gitRoot, 'specs', `${name}.spec.md`),
        join(gitRoot, 'specs', 'roadmap', `${name}.spec.md`),
      ];

      let specPath: string | null = null;
      for (const p of paths) {
        if (existsSync(p)) {
          specPath = p;
          break;
        }
      }

      if (!specPath) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: `Spec not found: ${name}` }));
        } else {
          console.error(`Spec not found: ${name}`);
        }
        process.exit(1);
      }

      const content = readFileSync(specPath, 'utf-8');

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          name,
          path: specPath,
          content,
        }, null, 2));
        return;
      }

      console.log(content);
    });

  // ah spec finalize
  spec
    .command('finalize')
    .description('Move roadmap spec to completed location (after merge to main)')
    .option('--name <name>', 'Spec name to finalize')
    .option('--force', 'Force finalize even if not on main branch')
    .option('--json', 'Output as JSON')
    .action(async (options: { name?: string; force?: boolean; json?: boolean }) => {
      const gitRoot = getGitRoot();
      const branch = getCurrentBranch();
      const mainBranch = process.env.MAIN_BRANCH || 'main';

      // Check if on main branch
      if (branch !== mainBranch && !options.force) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: `Not on ${mainBranch} branch. Use --force to override.`,
            currentBranch: branch,
          }));
        } else {
          console.error(`Not on ${mainBranch} branch (current: ${branch})`);
          console.error('Spec finalization should happen after merge to main.');
          console.error('Use --force to override.');
        }
        process.exit(1);
      }

      // Determine spec name
      let specName = options.name;
      if (!specName) {
        // Try to get from status file of recently merged branch
        // This is a heuristic - in practice, compound phase would call this with --name
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'Spec name required. Use --name <name>',
          }));
        } else {
          console.error('Spec name required. Use --name <name>');
        }
        process.exit(1);
      }

      const roadmapPath = join(gitRoot, 'specs', 'roadmap', `${specName}.spec.md`);
      const completedPath = join(gitRoot, 'specs', `${specName}.spec.md`);

      if (!existsSync(roadmapPath)) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: `Roadmap spec not found: ${roadmapPath}`,
          }));
        } else {
          console.error(`Roadmap spec not found: ${roadmapPath}`);
        }
        process.exit(1);
      }

      if (existsSync(completedPath)) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: `Completed spec already exists: ${completedPath}`,
          }));
        } else {
          console.error(`Completed spec already exists: ${completedPath}`);
        }
        process.exit(1);
      }

      // Ensure specs directory exists
      mkdirSync(dirname(completedPath), { recursive: true });

      // Move the file
      renameSync(roadmapPath, completedPath);

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          name: specName,
          from: roadmapPath,
          to: completedPath,
        }, null, 2));
        return;
      }

      console.log(`Finalized spec: ${specName}`);
      console.log(`  From: ${roadmapPath}`);
      console.log(`  To: ${completedPath}`);
    });
}
