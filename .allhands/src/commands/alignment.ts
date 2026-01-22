/**
 * Alignment Commands (Agent-Facing)
 *
 * Manages the alignment doc for milestone coordination.
 *
 * Commands:
 * - ah alignment show    - Show alignment doc
 * - ah alignment init    - Initialize alignment doc
 * - ah alignment append  - Append a decision to the alignment doc
 * - ah alignment tokens  - Check alignment doc token count
 */

import { Command } from 'commander';
import {
  readAlignment,
  readAlignmentFrontmatter,
  initializeAlignment,
  appendDecision,
  getAlignmentTokenCount,
  getCurrentBranch,
  getPlanningPaths,
  DecisionEntry,
} from '../lib/planning.js';
import { existsSync } from 'fs';

export function register(program: Command): void {
  const alignment = program
    .command('alignment')
    .description('Alignment doc management');

  // ah alignment show
  alignment
    .command('show', { isDefault: true })
    .description('Show alignment doc')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('--json', 'Output as JSON')
    .option('--frontmatter', 'Show only frontmatter')
    .action(async (options: { branch?: string; json?: boolean; frontmatter?: boolean }) => {
      const branch = options.branch || getCurrentBranch();
      const paths = getPlanningPaths(branch);

      if (!existsSync(paths.alignment)) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'No alignment doc found',
            branch,
          }));
        } else {
          console.error(`No alignment doc found for branch: ${branch}`);
          console.error('Run "ah alignment init" to create one.');
        }
        process.exit(1);
      }

      if (options.frontmatter) {
        const frontmatter = readAlignmentFrontmatter(branch);
        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            branch,
            frontmatter,
          }, null, 2));
        } else {
          console.log(`Milestone: ${frontmatter?.milestone}`);
          console.log(`Spec: ${frontmatter?.spec}`);
          console.log(`Created: ${frontmatter?.created}`);
          console.log(`Updated: ${frontmatter?.updated}`);
        }
        return;
      }

      const content = readAlignment(branch);

      if (options.json) {
        const frontmatter = readAlignmentFrontmatter(branch);
        console.log(JSON.stringify({
          success: true,
          branch,
          frontmatter,
          content,
          tokenCount: getAlignmentTokenCount(branch),
        }, null, 2));
        return;
      }

      console.log(content);
    });

  // ah alignment init
  alignment
    .command('init <milestone> <spec>')
    .description('Initialize alignment doc')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('-o, --overview <overview>', 'Milestone overview text')
    .option('-r, --requirements <requirements>', 'Comma-separated hard requirements')
    .option('--json', 'Output as JSON')
    .action(async (milestone: string, spec: string, options: {
      branch?: string;
      overview?: string;
      requirements?: string;
      json?: boolean;
    }) => {
      const branch = options.branch || getCurrentBranch();
      const paths = getPlanningPaths(branch);

      // Check if alignment already exists
      if (existsSync(paths.alignment)) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'Alignment doc already exists',
            path: paths.alignment,
          }));
        } else {
          console.error(`Alignment doc already exists at: ${paths.alignment}`);
          console.error('Delete it first if you want to reinitialize.');
        }
        process.exit(1);
      }

      const overview = options.overview || `This milestone implements ${milestone}.`;
      const requirements = options.requirements
        ? options.requirements.split(',').map(r => r.trim())
        : ['Define hard requirements'];

      initializeAlignment(milestone, spec, overview, requirements, branch);

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          branch,
          path: paths.alignment,
          milestone,
          spec,
        }, null, 2));
        return;
      }

      console.log(`Initialized alignment doc for: ${milestone}`);
      console.log(`  Path: ${paths.alignment}`);
    });

  // ah alignment append
  alignment
    .command('append')
    .description('Append a decision to the alignment doc')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .requiredOption('-n, --prompt-number <number>', 'Prompt number')
    .requiredOption('-t, --prompt-title <title>', 'Prompt title')
    .requiredOption('-d, --decision <decision>', 'Decision made')
    .requiredOption('-f, --files <files>', 'Comma-separated list of files affected')
    .requiredOption('-s, --summary <summary>', 'Summary of changes')
    .option('--json', 'Output as JSON')
    .action(async (options: {
      branch?: string;
      promptNumber: string;
      promptTitle: string;
      decision: string;
      files: string;
      summary: string;
      json?: boolean;
    }) => {
      const branch = options.branch || getCurrentBranch();
      const paths = getPlanningPaths(branch);

      if (!existsSync(paths.alignment)) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'No alignment doc found',
            branch,
          }));
        } else {
          console.error(`No alignment doc found for branch: ${branch}`);
        }
        process.exit(1);
      }

      const entry: DecisionEntry = {
        promptNumber: parseInt(options.promptNumber, 10),
        promptTitle: options.promptTitle,
        decision: options.decision,
        files: options.files.split(',').map(f => f.trim()),
        summary: options.summary,
      };

      appendDecision(entry, branch);

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          branch,
          entry,
          tokenCount: getAlignmentTokenCount(branch),
        }, null, 2));
        return;
      }

      console.log(`Appended decision for prompt ${entry.promptNumber}: ${entry.promptTitle}`);
      console.log(`  Token count: ${getAlignmentTokenCount(branch)}`);
    });

  // ah alignment tokens
  alignment
    .command('tokens')
    .description('Check alignment doc token count')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('--json', 'Output as JSON')
    .option('--limit <limit>', 'Token limit to check against')
    .action(async (options: { branch?: string; json?: boolean; limit?: string }) => {
      const branch = options.branch || getCurrentBranch();
      const tokenCount = getAlignmentTokenCount(branch);
      const limit = options.limit ? parseInt(options.limit, 10) : null;

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          branch,
          tokenCount,
          limit,
          exceedsLimit: limit ? tokenCount > limit : null,
        }, null, 2));
        return;
      }

      console.log(`Token count: ${tokenCount}`);
      if (limit) {
        if (tokenCount > limit) {
          console.log(`WARNING: Exceeds limit of ${limit} tokens`);
          process.exit(1);
        } else {
          console.log(`Within limit of ${limit} tokens`);
        }
      }
    });
}
