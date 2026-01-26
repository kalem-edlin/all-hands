/**
 * Shared Hook Utilities
 *
 * Common types, I/O helpers, and cache utilities for Claude Code hooks.
 * Hooks communicate via stdin/stdout JSON.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logHookStart, logHookSuccess } from '../lib/trace-store.js';

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
    hookEventName: 'PreToolUse';
    permissionDecision?: 'allow' | 'deny' | 'ask';
    permissionDecisionReason?: string;
    updatedInput?: Record<string, unknown>;
    additionalContext?: string;
  };
  systemMessage?: string;
}

/** PostToolUse hook output - uses hookSpecificOutput for model-visible context */
export interface PostToolUseOutput {
  continue?: boolean;
  suppressOutput?: boolean;
  systemMessage?: string;
  hookSpecificOutput?: {
    hookEventName: 'PostToolUse';
    additionalContext?: string;
  };
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
 * The reason is shown to Claude via permissionDecisionReason.
 * Optionally logs to trace-store if hookName is provided.
 */
export function denyTool(reason: string, hookName?: string): never {
  if (hookName) {
    logHookSuccess(hookName, { action: 'deny', reason });
  }
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

/**
 * Allow a tool use (silent exit).
 * Hooks that don't output anything allow the tool.
 * Optionally logs to trace-store if hookName is provided.
 * @see denyTool for blocking with a reason
 */
export function allowTool(hookName?: string): never {
  if (hookName) {
    logHookSuccess(hookName, { action: 'allow' });
  }
  process.exit(0);
}

/**
 * Output additional context for PostToolUse hooks.
 * Uses decision: 'block' with reason for reliable visibility to model.
 * (Since PostToolUse runs after the edit, 'block' just shows the message prominently)
 * Optionally logs to trace-store if hookName is provided.
 */
export function outputContext(context: string, hookName?: string): never {
  if (hookName) {
    logHookSuccess(hookName, { action: 'context', hasContext: true });
  }
  // Use decision: 'block' with reason for reliable visibility (like Continuous-Claude-v3)
  // The edit already happened, so 'block' just ensures the message is shown prominently
  const output = {
    decision: 'block',
    reason: context,
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

/**
 * Block a PostToolUse action with a message.
 * Uses decision: 'block' with reason for reliable visibility.
 * Optionally logs to trace-store if hookName is provided.
 */
export function blockTool(message: string, hookName?: string): never {
  if (hookName) {
    logHookSuccess(hookName, { action: 'block', message });
  }
  // Use decision: 'block' with reason for reliable visibility (like Continuous-Claude-v3)
  const output = {
    decision: 'block',
    reason: message,
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

/**
 * Output Stop/SubagentStop hook result.
 * Use decision: "approve" to allow stop, "block" to continue.
 * Optionally logs to trace-store if hookName is provided.
 */
export function outputStopHook(decision: 'approve' | 'block', reason?: string, hookName?: string): never {
  if (hookName) {
    logHookSuccess(hookName, { action: decision, reason });
  }
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
 * Optionally logs to trace-store if hookName is provided.
 */
export function outputPreCompact(systemMessage?: string, hookName?: string): never {
  if (hookName) {
    logHookSuccess(hookName, { action: 'precompact', hasMessage: !!systemMessage });
  }
  const output: PreCompactOutput = {
    continue: true,
    systemMessage,
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Language Detection (for AST-grep, TLDR, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/** Map of file extensions to AST-grep compatible language names */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // TypeScript
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.mts': 'typescript',
  '.cts': 'typescript',
  // JavaScript
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  // Python
  '.py': 'python',
  '.pyi': 'python',
  '.pyx': 'python',
  // Go
  '.go': 'go',
  // Rust
  '.rs': 'rust',
  // C/C++
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hh': 'cpp',
  // Java
  '.java': 'java',
  // Kotlin
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  // Ruby
  '.rb': 'ruby',
  // Swift
  '.swift': 'swift',
  // C#
  '.cs': 'c-sharp',
  // Lua
  '.lua': 'lua',
  // HTML/CSS
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  // JSON/YAML
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

/** Map of ripgrep type names to AST-grep language names */
const TYPE_TO_LANGUAGE: Record<string, string> = {
  'ts': 'typescript',
  'typescript': 'typescript',
  'tsx': 'tsx',
  'js': 'javascript',
  'javascript': 'javascript',
  'jsx': 'javascript',
  'py': 'python',
  'python': 'python',
  'go': 'go',
  'rust': 'rust',
  'rs': 'rust',
  'c': 'c',
  'cpp': 'cpp',
  'java': 'java',
  'kotlin': 'kotlin',
  'kt': 'kotlin',
  'ruby': 'ruby',
  'rb': 'ruby',
  'swift': 'swift',
  'cs': 'c-sharp',
  'csharp': 'c-sharp',
  'lua': 'lua',
  'html': 'html',
  'css': 'css',
  'json': 'json',
  'yaml': 'yaml',
};

/** Map of code patterns to likely languages */
const PATTERN_TO_LANGUAGE: Record<string, string> = {
  'def ': 'python',
  'async def ': 'python',
  'class ': 'python', // Could be multiple languages, default to python
  'function ': 'typescript',
  'async function ': 'typescript',
  'const ': 'typescript',
  'let ': 'typescript',
  'export ': 'typescript',
  'import ': 'typescript',
  'func ': 'go',
  'fn ': 'rust',
  'pub fn ': 'rust',
  'impl ': 'rust',
  'package ': 'go',
};

/**
 * Detect language from various inputs.
 * Checks in order: glob patterns, ripgrep type, code patterns.
 * Returns AST-grep compatible language name.
 */
export function detectLanguage(options: {
  glob?: string;
  type?: string;
  pattern?: string;
  filePath?: string;
}): string {
  const { glob, type, pattern, filePath } = options;

  // 1. Check file path extension
  if (filePath) {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    if (EXTENSION_TO_LANGUAGE[ext]) {
      return EXTENSION_TO_LANGUAGE[ext];
    }
  }

  // 2. Check glob pattern for extensions
  if (glob) {
    for (const [ext, lang] of Object.entries(EXTENSION_TO_LANGUAGE)) {
      if (glob.includes(ext)) {
        return lang;
      }
    }
  }

  // 3. Check ripgrep type parameter
  if (type) {
    const lowerType = type.toLowerCase();
    if (TYPE_TO_LANGUAGE[lowerType]) {
      return TYPE_TO_LANGUAGE[lowerType];
    }
  }

  // 4. Check code pattern for language hints
  if (pattern) {
    for (const [hint, lang] of Object.entries(PATTERN_TO_LANGUAGE)) {
      if (pattern.includes(hint)) {
        return lang;
      }
    }
  }

  // Default to typescript (most common in this codebase)
  return 'typescript';
}

/**
 * Get all file extensions for a given language.
 * Useful for building glob patterns.
 */
export function getExtensionsForLanguage(language: string): string[] {
  const extensions: string[] = [];
  for (const [ext, lang] of Object.entries(EXTENSION_TO_LANGUAGE)) {
    if (lang === language) {
      extensions.push(ext);
    }
  }
  return extensions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Path Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the project directory.
 * Priority:
 * 1. CLAUDE_PROJECT_DIR env var (set by Claude Code)
 * 2. Find .allhands/harness directory going up from cwd (indicates project root)
 * 3. Fall back to cwd
 */
export function getProjectDir(): string {
  if (process.env.CLAUDE_PROJECT_DIR) {
    return process.env.CLAUDE_PROJECT_DIR;
  }

  // Find project root by looking for .allhands/harness directory
  // This is more reliable than just .allhands since harness may have nested .allhands
  let dir = process.cwd();
  while (dir !== '/') {
    const harnessPath = join(dir, '.allhands', 'harness');
    const ahScript = join(harnessPath, 'ah');
    // Check for the ah script to confirm this is the project root
    if (existsSync(ahScript)) {
      return dir;
    }
    dir = join(dir, '..');
  }

  return process.cwd();
}

/**
 * Get the cache directory (.allhands/harness/.cache/).
 * Creates the directory if it doesn't exist.
 */
export function getCacheDir(): string {
  const projectDir = getProjectDir();
  const cacheDir = join(projectDir, '.allhands', 'harness', '.cache');

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

// ─────────────────────────────────────────────────────────────────────────────
// PreToolUse Context Injection Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Output PreToolUse with context injection (modifies tool input).
 * Prepends additionalContext to the specified field (default: 'prompt').
 * Optionally logs to trace-store if hookName is provided.
 */
export function injectContext(
  originalInput: Record<string, unknown>,
  additionalContext: string,
  targetField: string = 'prompt',
  hookName?: string
): never {
  if (hookName) {
    logHookSuccess(hookName, { action: 'inject', targetField });
  }
  const currentValue = (originalInput[targetField] as string) || '';
  const output: PreToolUseOutput = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: {
        ...originalInput,
        [targetField]: `${additionalContext}\n\n---\n${currentValue}`,
      },
    },
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

/**
 * Output PreToolUse additional context without modifying input.
 * Adds context to the conversation via systemMessage.
 * Optionally logs to trace-store if hookName is provided.
 */
export function preToolContext(context: string, hookName?: string): never {
  if (hookName) {
    logHookSuccess(hookName, { action: 'preToolContext', hasContext: true });
  }
  const output: PreToolUseOutput = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
    },
    systemMessage: context,
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Settings (.allhands/settings.json)
// ─────────────────────────────────────────────────────────────────────────────

/** Format pattern configuration */
export interface FormatPattern {
  match: string;
  command: string;
}

/** Format configuration */
export interface FormatConfig {
  enabled?: boolean;
  command?: string;
  patterns?: FormatPattern[];
}

/** Validation section of settings */
export interface ValidationSettings {
  format?: FormatConfig;
}

/** Git settings */
export interface GitSettings {
  baseBranch?: string;
}

/** TLDR settings */
export interface TldrSettings {
  enableForHarness?: boolean;
}

/** Knowledge search settings */
export interface KnowledgeSettings {
  similarityThreshold?: number;
  fullContextSimilarityThreshold?: number;
  contextTokenLimit?: number;
}

/** Oracle inference settings */
export interface OracleSettings {
  defaultProvider?: 'gemini' | 'openai';
}

/** OpenCode SDK agent execution settings */
export interface OpencodeSdkSettings {
  model?: string;
  codesearchToolBudget?: number;
}

/** Spawn settings for parallel execution */
export interface SpawnSettings {
  maxParallelPrompts?: number;
}

/** Project settings structure (.allhands/settings.json) */
export interface ProjectSettings {
  validation?: ValidationSettings;
  git?: GitSettings;
  tldr?: TldrSettings;
  knowledge?: KnowledgeSettings;
  oracle?: OracleSettings;
  opencodeSdk?: OpencodeSdkSettings;
  spawn?: SpawnSettings;
}

/**
 * Load project settings from .allhands/settings.json.
 * Returns null if file doesn't exist or is invalid.
 */
export function loadProjectSettings(): ProjectSettings | null {
  const settingsPath = join(getProjectDir(), '.allhands', 'settings.json');
  if (!existsSync(settingsPath)) {
    return null;
  }

  try {
    const content = readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content) as ProjectSettings;
  } catch {
    return null;
  }
}

/**
 * Get base branch from settings or default.
 * Priority: settings.json > "main"
 */
export function getBaseBranch(): string {
  const settings = loadProjectSettings();
  return settings?.git?.baseBranch || 'main';
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Context (for hook coordination)
// ─────────────────────────────────────────────────────────────────────────────

/** Search context passed between hooks */
export interface SearchContext {
  timestamp: number;
  queryType: 'structural' | 'semantic' | 'literal';
  pattern: string;
  target: string | null;
  targetType: 'function' | 'class' | 'variable' | 'import' | 'decorator' | 'unknown';
  suggestedLayers: string[];
  definitionLocation?: string;
  callers?: string[];
}

/**
 * Get the search context file path for a session.
 */
function getSearchContextPath(sessionId: string): string {
  const tmpDir = '/tmp/claude-search-context';
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }
  return join(tmpDir, `${sessionId}.json`);
}

/**
 * Save search context for downstream hooks.
 */
export function saveSearchContext(sessionId: string, context: SearchContext): void {
  const path = getSearchContextPath(sessionId);
  writeFileSync(path, JSON.stringify(context, null, 2));
}

/**
 * Load search context from upstream hooks.
 * Returns null if not found or expired (>5 min).
 */
export function loadSearchContext(sessionId: string): SearchContext | null {
  const path = getSearchContextPath(sessionId);
  if (!existsSync(path)) {
    return null;
  }

  try {
    const data = readFileSync(path, 'utf-8');
    const context = JSON.parse(data) as SearchContext;

    // Check if expired (5 minute TTL)
    const age = Date.now() - context.timestamp;
    if (age > 5 * 60 * 1000) {
      return null;
    }

    return context;
  } catch {
    return null;
  }
}

