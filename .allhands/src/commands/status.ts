/**
 * Status Commands (Agent-Facing)
 *
 * Manages session status for milestones.
 *
 * Commands:
 * - ah status         - Show current status
 * - ah status init    - Initialize status for a milestone
 * - ah status set     - Set specific status fields
 * - ah status iterate - Increment loop iteration
 */

import { Command } from 'commander';
import {
  readStatus,
  initializeStatus,
  updateStatus,
  getCurrentBranch,
  getPlanningPaths,
  planningDirExists,
  StatusFile,
} from '../lib/planning.js';
import { existsSync } from 'fs';

type Stage = 'planning' | 'executing' | 'reviewing' | 'pr' | 'compound';

export function register(program: Command): void {
  const status = program
    .command('status')
    .description('Session status management');

  // ah status (show)
  status
    .command('show', { isDefault: true })
    .description('Show current status')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('--json', 'Output as JSON')
    .action(async (options: { branch?: string; json?: boolean }) => {
      const branch = options.branch || getCurrentBranch();
      const current = readStatus(branch);

      if (!current) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'No status file found',
            branch,
            initialized: false,
          }));
        } else {
          console.error(`No status file found for branch: ${branch}`);
          console.error('Run "ah status init" to initialize a milestone.');
        }
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          branch,
          status: current,
        }, null, 2));
        return;
      }

      console.log(`Branch: ${branch}`);
      console.log();
      console.log(`Milestone: ${current.milestone}`);
      console.log(`Spec: ${current.spec}`);
      console.log(`Stage: ${current.stage}`);
      console.log();
      console.log('Loop:');
      console.log(`  Enabled: ${current.loop.enabled}`);
      console.log(`  Emergent: ${current.loop.emergent}`);
      console.log(`  Iteration: ${current.loop.iteration}`);
      console.log();
      console.log(`Compound Run: ${current.compound_run}`);
      console.log(`Created: ${current.created}`);
      console.log(`Updated: ${current.updated}`);
    });

  // ah status init
  status
    .command('init <milestone> <spec>')
    .description('Initialize status for a new milestone')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('--json', 'Output as JSON')
    .action(async (milestone: string, spec: string, options: { branch?: string; json?: boolean }) => {
      const branch = options.branch || getCurrentBranch();

      // Check if spec file exists
      if (!existsSync(spec)) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: `Spec file not found: ${spec}` }));
        } else {
          console.error(`Spec file not found: ${spec}`);
        }
        process.exit(1);
      }

      // Check if status already exists
      const existing = readStatus(branch);
      if (existing) {
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: 'Status already exists for this branch',
            existingMilestone: existing.milestone,
          }));
        } else {
          console.error(`Status already exists for branch: ${branch}`);
          console.error(`  Milestone: ${existing.milestone}`);
          console.error('Use "ah status set" to update or delete the status file to reinitialize.');
        }
        process.exit(1);
      }

      const newStatus = initializeStatus(milestone, spec, branch);

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          branch,
          status: newStatus,
        }, null, 2));
        return;
      }

      console.log(`Initialized milestone: ${milestone}`);
      console.log(`  Branch: ${branch}`);
      console.log(`  Spec: ${spec}`);
      console.log(`  Stage: ${newStatus.stage}`);
    });

  // ah status set
  status
    .command('set')
    .description('Set status fields')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('--stage <stage>', 'Set stage (planning, executing, reviewing, pr, compound)')
    .option('--loop-enabled <enabled>', 'Enable/disable loop (true/false)')
    .option('--emergent <enabled>', 'Enable/disable emergent mode (true/false)')
    .option('--compound-run <run>', 'Set compound run flag (true/false)')
    .option('--json', 'Output as JSON')
    .action(async (options: {
      branch?: string;
      stage?: string;
      loopEnabled?: string;
      emergent?: string;
      compoundRun?: string;
      json?: boolean;
    }) => {
      const branch = options.branch || getCurrentBranch();
      const current = readStatus(branch);

      if (!current) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'No status file found' }));
        } else {
          console.error(`No status file found for branch: ${branch}`);
        }
        process.exit(1);
      }

      const updates: Partial<StatusFile> = {};

      if (options.stage) {
        const validStages: Stage[] = ['planning', 'executing', 'reviewing', 'pr', 'compound'];
        if (!validStages.includes(options.stage as Stage)) {
          if (options.json) {
            console.log(JSON.stringify({
              success: false,
              error: `Invalid stage. Must be: ${validStages.join(', ')}`,
            }));
          } else {
            console.error(`Invalid stage. Must be: ${validStages.join(', ')}`);
          }
          process.exit(1);
        }
        updates.stage = options.stage as Stage;
      }

      if (options.loopEnabled !== undefined) {
        updates.loop = {
          ...current.loop,
          enabled: options.loopEnabled === 'true',
        };
      }

      if (options.emergent !== undefined) {
        updates.loop = {
          ...(updates.loop || current.loop),
          emergent: options.emergent === 'true',
        };
      }

      if (options.compoundRun !== undefined) {
        updates.compound_run = options.compoundRun === 'true';
      }

      if (Object.keys(updates).length === 0) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'No updates specified' }));
        } else {
          console.error('No updates specified. Use --stage, --loop-enabled, --emergent, or --compound-run');
        }
        process.exit(1);
      }

      const updated = updateStatus(updates, branch);

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          branch,
          status: updated,
        }, null, 2));
        return;
      }

      console.log(`Updated status for branch: ${branch}`);
      if (updates.stage) console.log(`  Stage: ${updates.stage}`);
      if (updates.loop?.enabled !== undefined) console.log(`  Loop enabled: ${updates.loop.enabled}`);
      if (updates.loop?.emergent !== undefined) console.log(`  Emergent: ${updates.loop.emergent}`);
      if (updates.compound_run !== undefined) console.log(`  Compound run: ${updates.compound_run}`);
    });

  // ah status iterate
  status
    .command('iterate')
    .description('Increment loop iteration counter')
    .option('--branch <branch>', 'Branch to use (defaults to current)')
    .option('--json', 'Output as JSON')
    .action(async (options: { branch?: string; json?: boolean }) => {
      const branch = options.branch || getCurrentBranch();
      const current = readStatus(branch);

      if (!current) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'No status file found' }));
        } else {
          console.error(`No status file found for branch: ${branch}`);
        }
        process.exit(1);
      }

      const updated = updateStatus({
        loop: {
          ...current.loop,
          iteration: current.loop.iteration + 1,
        },
      }, branch);

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          branch,
          iteration: updated.loop.iteration,
          status: updated,
        }, null, 2));
        return;
      }

      console.log(`Iteration: ${updated.loop.iteration}`);
    });
}
