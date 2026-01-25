# Harness Problems Requiring Design Decisions

Issues identified in `.allhands/harness/src` that don't have obvious solutions and require architectural decisions.

---

## 1. Race Conditions in Session/Registry Management

**Location**: `lib/tmux.ts:89-123`, `lib/session.ts:94-99`

**Problem**: The spawned agent registry uses both in-memory (`spawnedAgentRegistry` Set) and disk-backed (`session.json`) storage with no file locking. Each disk write does a full read-modify-write cycle:

```typescript
export function addSpawnedWindow(windowName: string, cwd?: string): void {
  const session = readSession(cwd);  // READ
  session.spawned_windows.push(windowName);
  writeSession(session, cwd);  // WRITE
}
```

**Impact**: Multiple concurrent agent spawns can corrupt session.json or lose registrations. Two TUI instances or rapid concurrent spawns will step on each other.

**Options to Consider**:
- File locking with `proper-lockfile` or similar
- SQLite for session state (single-writer guarantee)
- Append-only log with periodic compaction
- Accept the race and document as limitation (single TUI instance)

---

## 2. No Timeout/Recovery for Stuck Agents

**Location**: `lib/event-loop.ts:345-350`

**Problem**: The execution loop waits indefinitely for an executor to finish:

```typescript
const hasExecutor = this.state.activeAgents.some(
  (name) => name.startsWith('prompt-') || name === 'executor'
);
if (hasExecutor) {
  return;  // Just returns, no timeout check
}
```

**Impact**: A hung agent (crashed Claude, infinite loop, waiting for user input) blocks the entire loop forever. No watchdog, no max retries, no way to detect stuck state.

**Options to Consider**:
- Add configurable timeout per executor (e.g., 30 minutes)
- Track last activity timestamp per agent
- Implement health check via tmux pane capture
- Add max attempts per prompt with backoff
- Human-in-the-loop: notify user after threshold

---

## 3. MCP Daemon Startup is Blocking & Fragile

**Location**: `lib/mcp-client.ts:102-113`

**Problem**: Daemon startup uses a blocking busy-wait:

```typescript
while (!existsSync(socketPath)) {
  if (Date.now() - startTime > timeout) {
    throw new Error(`Daemon failed to start for agent ${aid}`);
  }
  execSync('sleep 0.1');  // BLOCKING the entire Node process
}
```

**Issues**:
- `execSync('sleep 0.1')` blocks the main thread
- Socket existing doesn't guarantee daemon is ready
- No PID validation before declaring "started"
- No feedback during 10-second wait

**Options to Consider**:
- Convert to async with `setTimeout` or `setInterval`
- Add handshake protocol (daemon writes "READY" to socket)
- Use health check endpoint before returning
- Spawn daemon synchronously with inherited stdio for debugging

---

## 4. Branch-to-Spec Mapping is O(n) Full Scan

**Location**: `lib/specs.ts:248-257`

**Problem**: Every call to `findSpecByBranch()` loads ALL spec files from disk:

```typescript
export function findSpecByBranch(branch: string, cwd?: string): SpecFile | null {
  const groups = loadAllSpecs(cwd);  // Reads every .spec.md file
  for (const group of groups) {
    const spec = group.specs.find((s) => s.branch === branch);
    ...
  }
}
```

EventLoop calls `checkGitBranch()` every tick (default 5s), which calls `findSpecByBranch()`.

**Impact**: With many specs, every 5 seconds reads all spec files. Unnecessary I/O and CPU.

**Options to Consider**:
- In-memory cache with file watcher invalidation
- Separate index file mapping branch → spec
- Lazy loading with LRU cache
- Only re-scan on branch change (not every tick)

---

## 5. Prompt Status Updates Have No Atomicity

**Location**: `lib/prompts.ts:235-255`

**Problem**: Prompt file updates are read-modify-write without locking:

```typescript
const prompt = parsePromptFile(filePath);  // READ
// ... modify frontmatter
writeFileSync(filePath, newContent);       // WRITE
```

**Impact**: If two processes update the same prompt (e.g., executor marks done while loop marks in_progress), the second write wins and state is lost.

**Options to Consider**:
- File locking
- Optimistic locking with version/timestamp in frontmatter
- Move prompt state to SQLite (TraceStore already uses it)
- Accept race and document as limitation

---

## 6. Knowledge Index Cannot Delete Entries

**Location**: `lib/knowledge.ts:494-499`

**Problem**: USearch index doesn't support deletion in the basic API:

```typescript
if (deleted) {
  const id = meta.path_to_id[path];
  if (id) {
    // Note: USearch doesn't have a remove method in basic API
    // We mark as deleted in metadata
    delete meta.id_to_path[id];  // Only metadata cleaned
```

**Impact**: Deleted documents remain searchable in the vector index. Only metadata is removed, so search results include stale/deleted content.

**Options to Consider**:
- Full reindex on any deletion (expensive)
- Soft-delete with post-filter (check metadata after search)
- Switch to a vector DB with deletion support (e.g., Chroma, Qdrant)
- Periodic rebuild job to clean up

---

## 7. Oracle JSON Parsing is Fragile

**Location**: `lib/oracle.ts:167-173, 237-241, 301-306`

**Problem**: LLM responses are parsed with a simple regex:

```typescript
const jsonMatch = result.text.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  throw new Error('No JSON found in response');
}
const parsed = JSON.parse(jsonMatch[0]) as PRContent;
```

**Issues**:
- Regex grabs first `{` to last `}` — fails with nested JSON or code blocks
- No schema validation — cast assumes structure
- LLM format changes break silently

**Options to Consider**:
- Use structured output (function calling / tool use)
- JSON schema validation with `ajv` or `zod`
- Multiple extraction attempts with different patterns
- Fallback prompting with explicit format enforcement

---

## 8. TraceStore SQLite Operations Are Synchronous

**Location**: `lib/trace-store.ts:301-322`

**Problem**: Uses `better-sqlite3` which is synchronous:

```typescript
const stmt = database.prepare(`INSERT INTO events ...`);
stmt.run(...);  // Blocks main thread
```

**Impact**: Every trace event blocks the Node event loop. Under high event volume, TUI responsiveness degrades.

**Options to Consider**:
- Switch to async `sql.js` or `better-sqlite3` with worker threads
- Batch writes with periodic flush
- Write to JSONL only (async), load to SQLite on query
- Accept latency for observability (current behavior)

---

## 9. Greptile Integration Has No Rate Limiting

**Location**: `lib/event-loop.ts` via `lib/greptile.ts`

**Problem**: Every EventLoop tick (5s default) makes a Greptile API request when a PR URL is set. No exponential backoff, no rate limiting.

**Impact**: If Greptile API is slow or returns errors, we hammer it continuously. Risk of rate limiting or account issues.

**Options to Consider**:
- Exponential backoff on errors
- Configurable poll interval (separate from event loop tick)
- Cache results with TTL
- Circuit breaker pattern

---

## 10. Planning Directory Key Collisions

**Location**: `lib/planning.ts:43-45`

**Problem**: Branch sanitization can create collisions:

```typescript
export function sanitizeBranchForDir(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9_-]/g, '-');
}
```

**Colliding examples**:
- `feature/foo` → `feature-foo`
- `feature.foo` → `feature-foo`
- `feature:foo` → `feature-foo`

**Impact**: Different branches could map to the same planning directory, causing state confusion.

**Options to Consider**:
- Hash-based naming (e.g., `feature-foo-a1b2c3`)
- Encoding scheme that's reversible
- Store original branch name in status.yaml and validate on load
- Document limitation (avoid unusual branch naming)

---

## Priority Recommendation

| Priority | Issue | Reason |
|----------|-------|--------|
| High | #2 Stuck agent recovery | Can halt all progress indefinitely |
| High | #1 Session race conditions | Data corruption risk |
| Medium | #3 MCP blocking startup | Poor UX, occasional hangs |
| Medium | #7 Oracle JSON parsing | Silent failures |
| Medium | #6 Knowledge deletion | Stale search results |
| Low | #4 Spec lookup efficiency | Performance at scale |
| Low | #5 Prompt atomicity | Rare in practice |
| Low | #8 TraceStore sync | Acceptable latency |
| Low | #9 Greptile rate limiting | External dependency |
| Low | #10 Directory collisions | Edge case |
