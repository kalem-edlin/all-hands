/**
 * Observability system for claude-envoy.
 * Log-based tracing via envoy.log.
 */

import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { getProjectRoot, getBranch } from "./git.js";

/**
 * Derive plan_name from branch.
 * Worktree branches follow pattern: feature-foo/implementation-1-A
 * Plan name is the parent branch before /implementation-*
 */
export function getPlanName(branch?: string | null): string | undefined {
  const b = branch ?? getBranch();
  if (!b) return undefined;
  // Strip /implementation-* suffix if present
  const match = b.match(/^(.+?)\/implementation-/);
  return match ? match[1] : b;
}

// --- Constants ---

/** Max string length before truncation in logs (default 200, configurable via env) */
const MAX_LOG_STRING_LENGTH = parseInt(
  process.env.ENVOY_LOG_MAX_STRING_LENGTH ?? "200",
  10
);

/** Max depth for nested structures (default 2) */
const MAX_LOG_DEPTH = parseInt(
  process.env.ENVOY_LOG_MAX_DEPTH ?? "2",
  10
);

/** Max array items before summarizing (default 3) */
const MAX_LOG_ARRAY_ITEMS = parseInt(
  process.env.ENVOY_LOG_MAX_ARRAY_ITEMS ?? "3",
  10
);

/** Max object keys before summarizing (default 5) */
const MAX_LOG_OBJECT_KEYS = parseInt(
  process.env.ENVOY_LOG_MAX_OBJECT_KEYS ?? "5",
  10
);

// --- Types ---

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  command: string;
  plan_name?: string;
  branch?: string;
  agent?: string;
  args?: Record<string, unknown>;
  result?: "success" | "error";
  duration_ms?: number;
  context?: Record<string, unknown>;
}


// --- File Paths ---

function getObservabilityDir(): string {
  return join(getProjectRoot(), ".claude");
}

function getLogPath(): string {
  return join(getObservabilityDir(), "envoy.log");
}

// --- Ensure Directory Exists ---

function ensureObservabilityDir(): void {
  const dir = getObservabilityDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// --- String Trimming ---

/**
 * Recursively trim all strings in an object/array to max length.
 * Adds ellipsis when truncated. Handles circular references.
 */
function trimStrings(
  value: unknown,
  maxLen = MAX_LOG_STRING_LENGTH,
  visited = new WeakSet<object>()
): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return value.length > maxLen ? value.slice(0, maxLen) + "..." : value;
  }

  if (Array.isArray(value)) {
    if (visited.has(value)) return "[Circular Reference]";
    visited.add(value);
    return value.map((item) => trimStrings(item, maxLen, visited));
  }

  if (typeof value === "object") {
    if (visited.has(value)) return "[Circular Reference]";
    visited.add(value);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = trimStrings(v, maxLen, visited);
    }
    return result;
  }

  return value;
}

/**
 * Truncate deep/wide structures to prevent log bloat.
 * Summarizes arrays beyond maxItems and objects beyond maxKeys.
 * At maxDepth, replaces nested structures with summary strings.
 */
function truncateStructure(
  value: unknown,
  maxDepth = MAX_LOG_DEPTH,
  maxArrayItems = MAX_LOG_ARRAY_ITEMS,
  maxObjectKeys = MAX_LOG_OBJECT_KEYS,
  visited = new WeakSet<object>()
): unknown {
  const truncate = (val: unknown, depth: number): unknown => {
    if (val === null || val === undefined) return val;
    if (typeof val !== "object") return val;

    // Circular reference check
    if (visited.has(val as object)) return "[Circular]";
    visited.add(val as object);

    if (Array.isArray(val)) {
      if (val.length === 0) return [];
      if (depth >= maxDepth) return `[${val.length} items]`;

      const items = val
        .slice(0, maxArrayItems)
        .map((v) => truncate(v, depth + 1));
      if (val.length > maxArrayItems) {
        items.push(`...+${val.length - maxArrayItems} more`);
      }
      return items;
    }

    // Object
    const keys = Object.keys(val as Record<string, unknown>);
    if (keys.length === 0) return {};
    if (depth >= maxDepth) return `{${keys.length} fields}`;

    const result: Record<string, unknown> = {};
    const keysToInclude = keys.slice(0, maxObjectKeys);

    for (const k of keysToInclude) {
      result[k] = truncate((val as Record<string, unknown>)[k], depth + 1);
    }

    if (keys.length > maxObjectKeys) {
      result[`...+${keys.length - maxObjectKeys} more`] = true;
    }

    return result;
  };

  return truncate(value, 0);
}

// --- Logging ---

/**
 * Write a log entry to envoy.log.
 */
export function log(entry: Omit<LogEntry, "timestamp">): void {
  ensureObservabilityDir();
  const branch = getBranch() || undefined;

  // Apply structure truncation first (depth/breadth), then string trimming
  const sanitize = (obj: Record<string, unknown>): Record<string, unknown> =>
    trimStrings(truncateStructure(obj)) as Record<string, unknown>;

  const fullEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    branch,
    plan_name: getPlanName(branch),
    ...entry,
    args: entry.args ? sanitize(entry.args) : undefined,
    context: entry.context ? sanitize(entry.context) : undefined,
  };
  try {
    appendFileSync(getLogPath(), JSON.stringify(fullEntry) + "\n");
  } catch {
    // Silent fail - observability should not break commands
  }
}

/**
 * Log an info-level entry.
 */
export function logInfo(
  command: string,
  context?: Record<string, unknown>,
  args?: Record<string, unknown>
): void {
  log({ level: "info", command, context, args });
}

/**
 * Log a warning-level entry.
 */
export function logWarn(
  command: string,
  context?: Record<string, unknown>,
  args?: Record<string, unknown>
): void {
  log({ level: "warn", command, context, args });
}

/**
 * Log an error-level entry.
 */
export function logError(
  command: string,
  context?: Record<string, unknown>,
  args?: Record<string, unknown>
): void {
  log({ level: "error", command, context, args });
}

/**
 * Log command start.
 */
export function logCommandStart(
  command: string,
  args?: Record<string, unknown>,
  agent?: string
): void {
  log({
    level: "info",
    command,
    agent,
    args,
    result: undefined,
    context: { phase: "start" },
  });
}

/**
 * Log command completion.
 */
export function logCommandComplete(
  command: string,
  result: "success" | "error",
  duration_ms: number,
  context?: Record<string, unknown>,
  agent?: string
): void {
  log({
    level: result === "error" ? "error" : "info",
    command,
    agent,
    result,
    duration_ms,
    context: { ...context, phase: "complete" },
  });
}

