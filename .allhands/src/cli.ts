#!/usr/bin/env tsx
/**
 * All Hands CLI - Main Entry Point
 *
 * Commands are auto-discovered from the commands/ directory.
 * Each command module exports a `register` function.
 */

import { Command } from 'commander';
import { discoverAndRegister } from './commands/index.js';

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('ah')
    .description('All Hands - Agentic harness for model-first software development')
    .version('0.1.0');

  // Auto-discover and register all commands
  await discoverAndRegister(program);

  // Built-in utility commands
  program
    .command('notify <message>')
    .description('Send a desktop notification')
    .action(async (message: string) => {
      const { exec } = await import('child_process');
      const platform = process.platform;

      if (platform === 'darwin') {
        exec(`osascript -e 'display notification "${message}" with title "All Hands"'`);
      } else if (platform === 'linux') {
        exec(`notify-send "All Hands" "${message}"`);
      } else {
        console.log(`[NOTIFY] ${message}`);
      }
    });

  // Handle no command
  if (process.argv.length <= 2) {
    program.help();
  }

  await program.parseAsync();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
