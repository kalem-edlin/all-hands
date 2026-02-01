#!/usr/bin/env tsx
/**
 * All Hands CLI - Main Entry Point
 *
 * Running `ah` with no command launches the TUI.
 * Commands are auto-discovered from the commands/ directory.
 * Each command module exports a `register` function.
 */

import { Command } from 'commander';
import { discoverAndRegister } from './commands/index.js';
import { launchTUI } from './commands/tui.js';

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('ah')
    .description('All Hands - Agentic harness for model-first software development')
    .version('0.1.0')
    .option('-s, --use-spec <spec>', 'Spec to use for TUI (defaults to active)')
    .action(async (options: { useSpec?: string }) => {
      // Default action when no subcommand - launch TUI
      await launchTUI({ spec: options.useSpec });
    });

  // Auto-discover and register all commands
  await discoverAndRegister(program);

  await program.parseAsync();

  // CLI subcommands may leave open handles (e.g. OpenCode SDK server sockets).
  // TUI manages its own process.exit(), so this only affects subcommand runs.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
