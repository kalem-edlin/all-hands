/**
 * Shared Hook Utilities
 *
 * Common types, I/O helpers, and cache utilities for Claude Code hooks.
 * Hooks communicate via stdin/stdout JSON.
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Input from Claude Code hooks (stdin JSON) */
export interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: unknown;
  transcript_path?: string;
  stop_hook_active?: boolean;
}

/** PreToolUse hook output */
export interface PreToolUseOutput {
  hookSpecificOutput: {
    permissionDecision: 'allow' | 'deny' | 'ask';
    updatedInput?: Record<string, unknown>;
  };
  systemMessage?: string;
}

/** PostToolUse hook output - uses standard output format */
export interface PostToolUseOutput {
  continue?: boolean;
  suppressOutput?: boolean;
  systemMessage?: string;
}

/** Stop/SubagentStop hook output */
export interface StopHookOutput {
  decision: 'approve' | 'block';
  reason?: string;
  systemMessage?: string;
}

/** PreCompact hook output - standard format with systemMessage */
export interface PreCompactOutput {
  continue?: boolean;
  systemMessage?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// I/O Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read hook input from stdin (synchronous for hook context).
 */
export async function readHookInput(): Promise<HookInput> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      try {
        if (!data.trim()) {
          resolve({});
          return;
        }
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error(`Failed to parse hook input: ${e}`));
      }
    });

    process.stdin.on('error', reject);
  });
}

/**
 * Deny a tool use with a reason.
 * Outputs JSON to stdout and exits with 0 (success for hooks).
 */
export function denyTool(reason: string): never {
  const output: PreToolUseOutput = {
    hookSpecificOutput: {
      permissionDecision: 'deny',
    },
    systemMessage: reason,
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

/**
 * Allow a tool use (silent exit).
 * Hooks that don't output anything allow the tool.
 */
export function allowTool(): never {
  process.exit(0);
}

/**
 * Output additional context for PostToolUse hooks.
 * Uses systemMessage field per official hook documentation.
 */
export function outputContext(context: string): never {
  const output: PostToolUseOutput = {
    continue: true,
    systemMessage: context,
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

/**
 * Output Stop/SubagentStop hook result.
 * Use decision: "approve" to allow stop, "block" to continue.
 */
export function outputStopHook(decision: 'approve' | 'block', reason?: string): never {
  const output: StopHookOutput = {
    decision,
    reason,
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

/**
 * Output PreCompact hook result.
 * Use systemMessage to inject context that survives compaction.
 */
export function outputPreCompact(systemMessage?: string): never {
  const output: PreCompactOutput = {
    continue: true,
    systemMessage,
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Path Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the project directory from environment or cwd.
 */
export function getProjectDir(): string {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

/**
 * Get the cache directory (.allhands/.cache/).
 * Creates the directory if it doesn't exist.
 */
export function getCacheDir(): string {
  const projectDir = getProjectDir();
  const cacheDir = join(projectDir, '.allhands', '.cache');

  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  return cacheDir;
}

/**
 * Get a specific cache subdirectory.
 */
export function getCacheSubdir(name: string): string {
  const subdir = join(getCacheDir(), name);

  if (!existsSync(subdir)) {
    mkdirSync(subdir, { recursive: true });
  }

  return subdir;
}
