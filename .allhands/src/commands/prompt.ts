/**
 * Prompt Commands (Agent-Facing)
 *
 * Exposes prompt picker and management to agents and TUI.
 *
 * Commands:
 * - ah prompt pick   - Pick next prompt to execute
 * - ah prompt list   - List all prompts with status
 * - ah prompt mark   - Mark prompt status (pending, in_progress, done)
 * - ah prompt show   - Show prompt content
 * - ah prompt create - Create a new prompt file
 */

import { Command } from 'commander';
import {
  pickNextPrompt,
  loadAllPrompts,
  parsePromptFile,
  markPromptInProgress,
  markPromptDone,
  updatePromptFrontmatter,
  createPrompt,
  getPromptByNumber,
  PromptFile,
  PromptStatus,
  PromptPriority,
} from '../lib/prompts.js';
import { getPlanningPaths, getCurrentBranch } from '../lib/planning.js';
import { join } from 'path';

export function register(program: Command): void {
  const prompt = program
    .command('prompt')
    .description('Prompt file management');

  // ah prompt pick
  prompt
    .command('pick')
    .description('Pick the next prompt to execute')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('--json', 'Output as JSON')
    .action(async (options: { branch?: string; json?: boolean }) => {
      const result = pickNextPrompt(options.branch);

      if (options.json) {
        console.log(JSON.stringify({
          success: result.prompt !== null,
          prompt: result.prompt ? formatPromptJson(result.prompt) : null,
          reason: result.reason,
          stats: result.stats,
        }, null, 2));
        return;
      }

      console.log(`Branch: ${options.branch || getCurrentBranch()}`);
      console.log(`Stats: ${result.stats.done}/${result.stats.total} done, ${result.stats.inProgress} in-progress, ${result.stats.pending} pending, ${result.stats.blocked} blocked`);
      console.log();

      if (result.prompt) {
        console.log(`Next prompt: ${result.prompt.filename}`);
        console.log(`  Number: ${result.prompt.frontmatter.number}`);
        console.log(`  Title: ${result.prompt.frontmatter.title}`);
        console.log(`  Priority: ${result.prompt.frontmatter.priority}`);
        console.log(`  Status: ${result.prompt.frontmatter.status}`);
        console.log(`  Path: ${result.prompt.path}`);
      } else {
        console.log(`No prompt to pick: ${result.reason}`);
      }
    });

  // ah prompt list
  prompt
    .command('list')
    .description('List all prompts')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('--status <status>', 'Filter by status (pending, in_progress, done)')
    .option('--json', 'Output as JSON')
    .action(async (options: { branch?: string; status?: PromptStatus; json?: boolean }) => {
      let prompts = loadAllPrompts(options.branch);

      if (options.status) {
        prompts = prompts.filter(p => p.frontmatter.status === options.status);
      }

      // Sort by number
      prompts.sort((a, b) => a.frontmatter.number - b.frontmatter.number);

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          branch: options.branch || getCurrentBranch(),
          count: prompts.length,
          prompts: prompts.map((p) => formatPromptJson(p)),
        }, null, 2));
        return;
      }

      console.log(`Branch: ${options.branch || getCurrentBranch()}`);
      console.log(`Found ${prompts.length} prompt(s)`);
      console.log();

      if (prompts.length === 0) {
        console.log('No prompts found.');
        return;
      }

      for (const p of prompts) {
        const statusIcon = getStatusIcon(p.frontmatter.status);
        const deps = p.frontmatter.dependencies.length > 0
          ? ` [deps: ${p.frontmatter.dependencies.join(', ')}]`
          : '';
        console.log(`${statusIcon} ${String(p.frontmatter.number).padStart(2, '0')}. ${p.frontmatter.title} (${p.frontmatter.priority})${deps}`);
      }
    });

  // ah prompt show
  prompt
    .command('show <number>')
    .description('Show a prompt by number')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('--json', 'Output as JSON')
    .option('--body', 'Include full body content')
    .action(async (number: string, options: { branch?: string; json?: boolean; body?: boolean }) => {
      const promptNum = parseInt(number, 10);
      if (isNaN(promptNum)) {
        console.error('Invalid prompt number');
        process.exit(1);
      }

      const prompt = getPromptByNumber(promptNum, options.branch);
      if (!prompt) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: `Prompt ${promptNum} not found` }));
        } else {
          console.error(`Prompt ${promptNum} not found`);
        }
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          prompt: formatPromptJson(prompt, options.body),
        }, null, 2));
        return;
      }

      console.log(`Prompt ${prompt.frontmatter.number}: ${prompt.frontmatter.title}`);
      console.log(`  Status: ${prompt.frontmatter.status}`);
      console.log(`  Priority: ${prompt.frontmatter.priority}`);
      console.log(`  Dependencies: ${prompt.frontmatter.dependencies.length > 0 ? prompt.frontmatter.dependencies.join(', ') : 'none'}`);
      console.log(`  Attempts: ${prompt.frontmatter.attempts}`);
      console.log(`  Path: ${prompt.path}`);

      if (options.body) {
        console.log();
        console.log('--- Body ---');
        console.log(prompt.body);
      }
    });

  // ah prompt mark
  prompt
    .command('mark <number> <status>')
    .description('Mark a prompt status (pending, in_progress, done)')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('--json', 'Output as JSON')
    .action(async (number: string, status: string, options: { branch?: string; json?: boolean }) => {
      const promptNum = parseInt(number, 10);
      if (isNaN(promptNum)) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'Invalid prompt number' }));
        } else {
          console.error('Invalid prompt number');
        }
        process.exit(1);
      }

      if (!['pending', 'in_progress', 'done'].includes(status)) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'Invalid status. Must be: pending, in_progress, done' }));
        } else {
          console.error('Invalid status. Must be: pending, in_progress, done');
        }
        process.exit(1);
      }

      const prompt = getPromptByNumber(promptNum, options.branch);
      if (!prompt) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: `Prompt ${promptNum} not found` }));
        } else {
          console.error(`Prompt ${promptNum} not found`);
        }
        process.exit(1);
      }

      const updated = updatePromptFrontmatter(prompt.path, { status: status as PromptStatus });
      if (!updated) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'Failed to update prompt' }));
        } else {
          console.error('Failed to update prompt');
        }
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          prompt: formatPromptJson(updated),
        }, null, 2));
        return;
      }

      console.log(`Marked prompt ${promptNum} as ${status}`);
    });

  // ah prompt create
  prompt
    .command('create <title>')
    .description('Create a new prompt file')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('-n, --number <number>', 'Prompt number (auto-assigned if not specified)')
    .option('-p, --priority <priority>', 'Priority (high, medium, low)', 'medium')
    .option('-d, --deps <deps>', 'Comma-separated dependency numbers')
    .option('--json', 'Output as JSON')
    .action(async (title: string, options: {
      branch?: string;
      number?: string;
      priority?: string;
      deps?: string;
      json?: boolean;
    }) => {
      const prompts = loadAllPrompts(options.branch);

      // Auto-assign number if not specified
      let number: number;
      if (options.number) {
        number = parseInt(options.number, 10);
        if (isNaN(number)) {
          if (options.json) {
            console.log(JSON.stringify({ success: false, error: 'Invalid prompt number' }));
          } else {
            console.error('Invalid prompt number');
          }
          process.exit(1);
        }
      } else {
        const maxNumber = prompts.reduce((max, p) => Math.max(max, p.frontmatter.number), 0);
        number = maxNumber + 1;
      }

      // Parse dependencies
      const dependencies = options.deps
        ? options.deps.split(',').map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n))
        : [];

      // Validate priority
      const priority = options.priority as PromptPriority;
      if (!['high', 'medium', 'low'].includes(priority)) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'Invalid priority. Must be: high, medium, low' }));
        } else {
          console.error('Invalid priority. Must be: high, medium, low');
        }
        process.exit(1);
      }

      const filePath = createPrompt(
        number,
        title,
        ['Define task 1', 'Define task 2', 'Define task 3'],
        { dependencies, priority },
        options.branch
      );

      if (options.json) {
        const created = parsePromptFile(filePath);
        console.log(JSON.stringify({
          success: true,
          prompt: created ? formatPromptJson(created) : null,
          path: filePath,
        }, null, 2));
        return;
      }

      console.log(`Created prompt ${number}: ${title}`);
      console.log(`  Path: ${filePath}`);
    });
}

function getStatusIcon(status: PromptStatus): string {
  switch (status) {
    case 'done':
      return '[x]';
    case 'in_progress':
      return '[>]';
    case 'pending':
      return '[ ]';
  }
}

function formatPromptJson(prompt: PromptFile, includeBody = false): Record<string, unknown> {
  const result: Record<string, unknown> = {
    number: prompt.frontmatter.number,
    title: prompt.frontmatter.title,
    status: prompt.frontmatter.status,
    priority: prompt.frontmatter.priority,
    dependencies: prompt.frontmatter.dependencies,
    attempts: prompt.frontmatter.attempts,
    created: prompt.frontmatter.created,
    updated: prompt.frontmatter.updated,
    path: prompt.path,
    filename: prompt.filename,
  };

  if (includeBody) {
    result.body = prompt.body;
  }

  return result;
}
