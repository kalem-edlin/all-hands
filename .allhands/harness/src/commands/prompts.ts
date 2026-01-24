/**
 * Prompts Command (Agent-Facing)
 *
 * Lists and analyzes prompt files with their frontmatter status.
 * Used by coordination agents to understand prompt state.
 *
 * Usage:
 * - ah prompts status              - List all prompts with status summaries
 * - ah prompts status --pending    - Only show pending prompts
 * - ah prompts status --in-progress - Only show in-progress prompts
 * - ah prompts status --done       - Only show completed prompts
 * - ah prompts status --type <type> - Filter by type (planned, emergent, user-patch, review-fix)
 */

import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import {
  getCurrentBranch,
  getPlanningPaths,
  listPromptFiles,
  hasPlanningForBranch,
  isLockedBranch,
} from '../lib/planning.js';

interface PromptFrontmatter {
  number: number;
  title: string;
  type: 'planned' | 'emergent' | 'user-patch' | 'review-fix';
  planning_session: number;
  status: 'pending' | 'in_progress' | 'done';
  dependencies: number[];
  attempts: number;
  commits: string[];
  validation_suites: string[];
  skills: string[];
  patches_prompts?: number[];
}

interface PromptSummary {
  number: number;
  title: string;
  type: string;
  status: string;
  file: string;
  dependencies: number[];
  attempts: number;
  hasSummary: boolean;
  patches_prompts?: number[];
}

/**
 * Extract frontmatter from markdown content
 */
function extractFrontmatter(content: string): Record<string, unknown> | null {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  try {
    return parseYaml(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Check if prompt has a success or failure summary
 */
function hasSummarySection(content: string): boolean {
  return content.includes('SUCCESS SUMMARY:') || content.includes('FAILURE SUMMARY:');
}

/**
 * Parse a prompt file and extract summary info
 */
function parsePromptFile(filePath: string, relativePath: string): PromptSummary | null {
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, 'utf-8');
    const frontmatter = extractFrontmatter(content) as PromptFrontmatter | null;

    if (!frontmatter || typeof frontmatter.number !== 'number') {
      return null;
    }

    return {
      number: frontmatter.number,
      title: frontmatter.title || 'Untitled',
      type: frontmatter.type || 'planned',
      status: frontmatter.status || 'pending',
      file: relativePath,
      dependencies: frontmatter.dependencies || [],
      attempts: frontmatter.attempts || 0,
      hasSummary: hasSummarySection(content),
      ...(frontmatter.patches_prompts && { patches_prompts: frontmatter.patches_prompts }),
    };
  } catch {
    return null;
  }
}

/**
 * Load all prompts for the current branch
 */
function loadPrompts(branch?: string): PromptSummary[] {
  const currentBranch = branch || getCurrentBranch();

  if (isLockedBranch(currentBranch)) {
    return [];
  }

  if (!hasPlanningForBranch(currentBranch)) {
    return [];
  }

  const paths = getPlanningPaths(currentBranch);
  const files = listPromptFiles(currentBranch);
  const prompts: PromptSummary[] = [];

  for (const file of files) {
    const filePath = join(paths.prompts, file);
    const relativePath = `.planning/${currentBranch}/prompts/${file}`;
    const summary = parsePromptFile(filePath, relativePath);

    if (summary) {
      prompts.push(summary);
    }
  }

  // Sort by number
  return prompts.sort((a, b) => a.number - b.number);
}

export function register(program: Command): void {
  const cmd = program
    .command('prompts')
    .description('Prompt file analysis and status');

  cmd
    .command('status')
    .description('List all prompts with their frontmatter status')
    .option('--json', 'Output as JSON (default)')
    .option('--branch <branch>', 'Branch to check (defaults to current)')
    .option('--pending', 'Only show pending prompts')
    .option('--in-progress', 'Only show in-progress prompts')
    .option('--done', 'Only show completed prompts')
    .option('--type <type>', 'Filter by type (planned, emergent, user-patch, review-fix)')
    .option('--emergent', 'Shorthand for --type emergent')
    .option('--user-patch', 'Shorthand for --type user-patch')
    .action(async (options: {
      json?: boolean;
      branch?: string;
      pending?: boolean;
      inProgress?: boolean;
      done?: boolean;
      type?: string;
      emergent?: boolean;
      userPatch?: boolean;
    }) => {
      const branch = options.branch || getCurrentBranch();

      // Check if branch has planning
      if (isLockedBranch(branch)) {
        console.log(JSON.stringify({
          success: false,
          error: `Branch "${branch}" is a locked branch and does not have planning.`,
        }, null, 2));
        return;
      }

      if (!hasPlanningForBranch(branch)) {
        console.log(JSON.stringify({
          success: false,
          error: `No planning directory found for branch "${branch}". Initialize with \`ah planning init\`.`,
        }, null, 2));
        return;
      }

      let prompts = loadPrompts(branch);

      // Apply status filters
      if (options.pending) {
        prompts = prompts.filter((p) => p.status === 'pending');
      } else if (options.inProgress) {
        prompts = prompts.filter((p) => p.status === 'in_progress');
      } else if (options.done) {
        prompts = prompts.filter((p) => p.status === 'done');
      }

      // Apply type filters
      let typeFilter = options.type;
      if (options.emergent) typeFilter = 'emergent';
      if (options.userPatch) typeFilter = 'user-patch';

      if (typeFilter) {
        prompts = prompts.filter((p) => p.type === typeFilter);
      }

      // Compute stats
      const stats = {
        total: prompts.length,
        pending: prompts.filter((p) => p.status === 'pending').length,
        in_progress: prompts.filter((p) => p.status === 'in_progress').length,
        done: prompts.filter((p) => p.status === 'done').length,
        by_type: {
          planned: prompts.filter((p) => p.type === 'planned').length,
          emergent: prompts.filter((p) => p.type === 'emergent').length,
          'user-patch': prompts.filter((p) => p.type === 'user-patch').length,
          'review-fix': prompts.filter((p) => p.type === 'review-fix').length,
        },
      };

      console.log(JSON.stringify({
        success: true,
        branch,
        stats,
        prompts,
      }, null, 2));
    });

  cmd
    .command('unblocked')
    .description('List prompts that are ready to execute (pending with all dependencies done)')
    .option('--branch <branch>', 'Branch to check (defaults to current)')
    .action(async (options: { branch?: string }) => {
      const branch = options.branch || getCurrentBranch();

      if (isLockedBranch(branch)) {
        console.log(JSON.stringify({
          success: false,
          error: `Branch "${branch}" is a locked branch.`,
        }, null, 2));
        return;
      }

      if (!hasPlanningForBranch(branch)) {
        console.log(JSON.stringify({
          success: false,
          error: `No planning directory found for branch "${branch}".`,
        }, null, 2));
        return;
      }

      const allPrompts = loadPrompts(branch);

      // Get set of done prompt numbers
      const doneNumbers = new Set(
        allPrompts
          .filter((p) => p.status === 'done')
          .map((p) => p.number)
      );

      // Find pending prompts with all dependencies satisfied
      const unblocked = allPrompts.filter((p) => {
        if (p.status !== 'pending') return false;

        // Check if all dependencies are done
        return p.dependencies.every((dep) => doneNumbers.has(dep));
      });

      console.log(JSON.stringify({
        success: true,
        branch,
        count: unblocked.length,
        prompts: unblocked,
      }, null, 2));
    });

  cmd
    .command('summaries')
    .description('List prompts that have success/failure summaries (completed executions)')
    .option('--branch <branch>', 'Branch to check (defaults to current)')
    .action(async (options: { branch?: string }) => {
      const branch = options.branch || getCurrentBranch();

      if (!hasPlanningForBranch(branch)) {
        console.log(JSON.stringify({
          success: false,
          error: `No planning directory found for branch "${branch}".`,
        }, null, 2));
        return;
      }

      const prompts = loadPrompts(branch).filter((p) => p.hasSummary);

      console.log(JSON.stringify({
        success: true,
        branch,
        count: prompts.length,
        prompts,
      }, null, 2));
    });
}
