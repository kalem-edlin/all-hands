/**
 * Validation Hooks
 *
 * PostToolUse hooks that run diagnostics on edited files:
 * - Python: pyright + ruff (if available)
 * - TypeScript: tsc --noEmit
 */

import { execSync } from 'child_process';
import { extname } from 'path';
import type { Command } from 'commander';
import { HookInput, outputContext, allowTool, readHookInput } from './shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DiagnosticResult {
  tool: string;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Detection
// ─────────────────────────────────────────────────────────────────────────────

function isToolAvailable(tool: string): boolean {
  try {
    execSync(`which ${tool}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Python Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

function runPyrightDiagnostics(filePath: string): DiagnosticResult | null {
  if (!isToolAvailable('pyright')) {
    return null;
  }

  try {
    execSync(`pyright --outputjson "${filePath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return null; // No errors
  } catch (e: unknown) {
    const error = e as { stdout?: string };
    if (error.stdout) {
      try {
        const output = JSON.parse(error.stdout);
        const diagnostics = output.generalDiagnostics || [];
        const errors = diagnostics
          .filter((d: { severity: string }) => d.severity === 'error')
          .map((d: { file: string; range: { start: { line: number } }; message: string }) => {
            const line = d.range?.start?.line ?? 0;
            return `${d.file}:${line}: ${d.message}`;
          })
          .slice(0, 5); // Limit to 5 errors

        if (errors.length > 0) {
          return { tool: 'pyright', errors };
        }
      } catch {
        // Parse error, skip
      }
    }
    return null;
  }
}

function runRuffDiagnostics(filePath: string): DiagnosticResult | null {
  if (!isToolAvailable('ruff')) {
    return null;
  }

  try {
    execSync(`ruff check "${filePath}" --output-format=text`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return null; // No errors
  } catch (e: unknown) {
    const error = e as { stdout?: string };
    if (error.stdout) {
      const lines = error.stdout.trim().split('\n').filter(Boolean).slice(0, 5);
      if (lines.length > 0) {
        return { tool: 'ruff', errors: lines };
      }
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

function runTscDiagnostics(filePath: string): DiagnosticResult | null {
  if (!isToolAvailable('tsc')) {
    return null;
  }

  try {
    execSync(`tsc --noEmit "${filePath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return null; // No errors
  } catch (e: unknown) {
    const error = e as { stdout?: string; stderr?: string };
    const output = error.stdout || error.stderr || '';
    if (output) {
      const lines = output.trim().split('\n').filter(Boolean).slice(0, 5);
      if (lines.length > 0) {
        return { tool: 'tsc', errors: lines };
      }
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Diagnostics Runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run diagnostics on an edited file.
 *
 * Triggered by: PostToolUse matcher "(Write|Edit)"
 */
export function runDiagnostics(input: HookInput): void {
  const filePath = input.tool_input?.file_path as string | undefined;

  if (!filePath) {
    allowTool();
  }

  const ext = extname(filePath!).toLowerCase();
  const results: DiagnosticResult[] = [];

  // Python files
  if (ext === '.py') {
    const pyright = runPyrightDiagnostics(filePath!);
    if (pyright) results.push(pyright);

    const ruff = runRuffDiagnostics(filePath!);
    if (ruff) results.push(ruff);
  }

  // TypeScript files
  if (ext === '.ts' || ext === '.tsx') {
    const tsc = runTscDiagnostics(filePath!);
    if (tsc) results.push(tsc);
  }

  // Output context if there are errors
  if (results.length > 0) {
    const context = formatDiagnosticsContext(results);
    outputContext(context);
  }

  allowTool();
}

/**
 * Format diagnostic results as context string.
 */
function formatDiagnosticsContext(results: DiagnosticResult[]): string {
  const parts: string[] = ['## Diagnostics'];

  for (const result of results) {
    parts.push(`\n### ${result.tool}`);
    result.errors.forEach((e) => parts.push(e));
  }

  parts.push('\nPlease fix these issues before continuing.');

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register validation hook subcommands.
 */
export function register(parent: Command): void {
  const validation = parent
    .command('validation')
    .description('Validation hooks (PostToolUse)');

  validation
    .command('diagnostics')
    .description('Run diagnostics on edited files')
    .action(async () => {
      try {
        const input = await readHookInput();
        runDiagnostics(input);
      } catch {
        allowTool();
      }
    });
}
