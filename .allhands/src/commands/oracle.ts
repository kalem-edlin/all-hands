/**
 * Oracle Commands (Agent-Facing)
 *
 * Multi-provider LLM inference for agent tasks.
 * Uses the standardized oracle library for provider integration.
 *
 * Commands:
 * - ah oracle ask <query> - Raw LLM inference with file context
 *
 * Note: Internal oracle functions (like branch naming) are NOT exposed
 * via CLI - they are only available through direct library imports.
 */

import { Command } from 'commander';
import {
  ask,
  getDefaultProvider,
  PROVIDERS,
  type ProviderName,
} from '../lib/llm.js';

export function register(program: Command): void {
  const oracle = program
    .command('oracle')
    .description('Multi-provider LLM inference');

  // ah oracle ask
  oracle
    .command('ask <query>')
    .description('Raw LLM inference with optional file context')
    .option('--provider <provider>', 'LLM provider (gemini | openai)', getDefaultProvider())
    .option('--model <model>', 'Override default model')
    .option('--files <files...>', 'Files to include as context')
    .option('--context <context>', 'Additional context')
    .option('--json', 'Output as JSON')
    .action(async (query: string, options: {
      provider: ProviderName;
      model?: string;
      files?: string[];
      context?: string;
      json?: boolean;
    }) => {
      // Validate provider
      if (!PROVIDERS[options.provider]) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'Invalid provider. Use: gemini, openai' }));
        } else {
          console.error('Error: Invalid provider. Use: gemini, openai');
        }
        process.exit(1);
      }

      try {
        const result = await ask(query, {
          provider: options.provider,
          model: options.model,
          files: options.files,
          context: options.context,
        });

        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            content: result.text,
            model: result.model,
            provider: result.provider,
            duration_ms: result.durationMs,
          }, null, 2));
          return;
        }

        console.log(result.text);
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        if (options.json) {
          console.log(JSON.stringify({ success: false, error }));
        } else {
          console.error(`Error: ${error}`);
        }
        process.exit(1);
      }
    });
}
