/**
 * Event Loop Daemon
 *
 * Non-blocking event loop that monitors external state:
 * 1. Greptile PR feedback polling
 * 2. Git branch change detection (and associated spec changes)
 * 3. Agent window status monitoring
 * 4. Prompt execution loop (when enabled)
 *
 * In the branch-keyed model:
 * - The current git branch determines the active spec
 * - Branch changes trigger spec context updates
 * - No separate "active spec" tracking needed
 */

import { getCurrentBranch, updateGreptileStatus, sanitizeBranchForDir } from './planning.js';
import { loadProjectSettings } from '../hooks/shared.js';
import { listWindows, SESSION_NAME, sessionExists, getCurrentSession, getSpawnedAgentRegistry, unregisterSpawnedAgent } from './tmux.js';
import { pickNextPrompt, markPromptInProgress, loadAllPrompts, type PromptFile } from './prompts.js';
import { shutdownDaemon } from './mcp-client.js';
import { getSpecForBranch, type SpecFile } from './specs.js';
import {
  checkGreptileStatus,
  hasNewReview,
  parsePRUrl,
  type GreptileReviewState,
} from './greptile.js';

export interface PromptSnapshot {
  count: number;
  pending: number;
  inProgress: number;
  done: number;
  /** Hash of prompt filenames + statuses for change detection */
  hash: string;
}

export interface EventLoopState {
  currentBranch: string;
  currentSpec: SpecFile | null;
  planningKey: string | null;  // Sanitized branch name for .planning/ lookup
  prUrl: string | null;
  greptileFeedbackAvailable: boolean;
  greptileReviewState: GreptileReviewState;
  activeAgents: string[];
  lastCheckTime: number;
  loopEnabled: boolean;
  emergentEnabled: boolean;
  parallelEnabled: boolean;  // Parallel execution mode
  /** Active executor prompt numbers (supports parallel execution) */
  activeExecutorPrompts: number[];
  /** Timestamp of last executor spawn (for race condition protection) */
  lastExecutorSpawnTime: number | null;
  /** Last known prompt state for change detection */
  promptSnapshot: PromptSnapshot | null;
}

export interface EventLoopCallbacks {
  onGreptileFeedback?: (available: boolean) => void;
  onBranchChange?: (newBranch: string, spec: SpecFile | null) => void;
  onAgentsChange?: (agents: string[]) => void;
  onSpawnExecutor?: (prompt: PromptFile) => void;
  /** Called when emergent agent should be spawned (prompts done + emergent enabled) */
  onSpawnEmergent?: (donePrompt: PromptFile) => void;
  onLoopStatus?: (message: string) => void;
  /** Called when prompts are added, removed, or their status changes */
  onPromptsChange?: (prompts: PromptFile[], snapshot: PromptSnapshot) => void;
}

// Note: Use isLockedBranch() from planning.ts for consistent branch checks

// Greptile polling interval (separate from main event loop tick)
const GREPTILE_POLL_INTERVAL_MS = 60 * 1000;  // Poll every 60 seconds

export class EventLoop {
  private intervalId: NodeJS.Timeout | null = null;
  private pollIntervalMs: number;
  private state: EventLoopState;
  private callbacks: EventLoopCallbacks;
  private cwd: string;

  // Greptile polling state - only check every GREPTILE_POLL_INTERVAL_MS
  private greptileLastPollTime: number = 0;

  constructor(
    cwd: string,
    callbacks: EventLoopCallbacks = {},
    pollIntervalMs: number = 5000
  ) {
    this.cwd = cwd;
    this.callbacks = callbacks;
    this.pollIntervalMs = pollIntervalMs;

    // Initialize state based on current branch
    const currentBranch = getCurrentBranch(cwd);
    const currentSpec = getSpecForBranch(currentBranch, cwd);
    const planningKey = sanitizeBranchForDir(currentBranch);

    this.state = {
      currentBranch,
      currentSpec,
      planningKey,
      prUrl: null,
      greptileFeedbackAvailable: false,
      greptileReviewState: {
        status: 'none',
        lastCommentId: null,
        lastCommentTime: null,
        reviewCycle: 0,
      },
      activeAgents: [],
      lastCheckTime: Date.now(),
      loopEnabled: false,
      emergentEnabled: false,
      parallelEnabled: false,
      activeExecutorPrompts: [],
      lastExecutorSpawnTime: null,
      promptSnapshot: null,
    };
  }

  /**
   * Start the event loop
   */
  start(): void {
    if (this.intervalId) {
      return; // Already running
    }

    this.intervalId = setInterval(() => {
      this.tick().catch((err) => {
        console.error('[EventLoop] Error in tick:', err);
      });
    }, this.pollIntervalMs);

    // Run initial tick
    this.tick().catch((err) => {
      console.error('[EventLoop] Error in initial tick:', err);
    });
  }

  /**
   * Stop the event loop and clean up
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Set the PR URL to monitor for Greptile feedback
   */
  setPRUrl(url: string | null): void {
    this.state.prUrl = url;
    this.state.greptileFeedbackAvailable = false;
  }

  /**
   * Enable or disable the prompt execution loop
   */
  setLoopEnabled(enabled: boolean): void {
    this.state.loopEnabled = enabled;
    if (!enabled) {
      this.state.activeExecutorPrompts = [];
      this.state.lastExecutorSpawnTime = null;
    }
  }

  /**
   * Enable or disable parallel execution mode
   */
  setParallelEnabled(enabled: boolean): void {
    this.state.parallelEnabled = enabled;
  }

  /**
   * Force an immediate tick of the event loop.
   * Use when enabling parallel mode to spawn immediately without waiting.
   */
  async forceTick(): Promise<void> {
    await this.tick();
  }

  /**
   * Enable or disable emergent refinement
   */
  setEmergentEnabled(enabled: boolean): void {
    this.state.emergentEnabled = enabled;
  }

  /**
   * Get current state
   */
  getState(): EventLoopState {
    return { ...this.state };
  }

  /**
   * Manually set branch context after TUI-initiated branch changes.
   *
   * This prevents the EventLoop from triggering onBranchChange callbacks
   * for changes that the TUI already handled (e.g., switch-spec, clear-spec).
   * Without this, the EventLoop would detect the branch change on its next
   * tick and potentially overwrite TUI state with stale/incorrect data.
   */
  setBranchContext(branch: string, spec: SpecFile | null): void {
    this.state.currentBranch = branch;
    this.state.currentSpec = spec;
    this.state.planningKey = sanitizeBranchForDir(branch);
  }

  /**
   * Main tick - runs all checks
   */
  private async tick(): Promise<void> {
    this.state.lastCheckTime = Date.now();

    await Promise.all([
      this.checkGreptileFeedback(),
      this.checkGitBranch(),
      this.checkAgentWindows(),
      this.checkPromptFiles(),
    ]);

    // Check prompt loop after agent windows (needs to know active agents)
    await this.checkPromptLoop();
  }

  /**
   * Check for Greptile PR feedback
   *
   * Uses the greptile library to:
   * - Track review cycles (not just presence)
   * - Compare comment timestamps with last check
   * - Update status.yaml with current state
   *
   * Polls at a slower rate than the main event loop since Greptile
   * reviews can take several minutes to complete.
   */
  private async checkGreptileFeedback(): Promise<void> {
    if (!this.state.prUrl) {
      return;
    }

    // Only poll Greptile every GREPTILE_POLL_INTERVAL_MS (not every tick)
    const now = Date.now();
    if (now - this.greptileLastPollTime < GREPTILE_POLL_INTERVAL_MS) {
      return;
    }
    this.greptileLastPollTime = now;

    // Validate PR URL
    const prInfo = parsePRUrl(this.state.prUrl);
    if (!prInfo) {
      return;
    }

    try {
      // Get current Greptile review state
      const currentState = await checkGreptileStatus(this.state.prUrl, this.cwd);

      // Check if there's a new review
      const isNewReview = hasNewReview(this.state.greptileReviewState, currentState);

      // Update feedback available flag
      const hasGreptileComment = currentState.status === 'completed';

      if (hasGreptileComment !== this.state.greptileFeedbackAvailable || isNewReview) {
        this.state.greptileFeedbackAvailable = hasGreptileComment;
        this.state.greptileReviewState = currentState;

        // Update status.yaml with Greptile state (use planning key)
        if (this.state.planningKey) {
          try {
            updateGreptileStatus(
              {
                reviewCycle: currentState.reviewCycle,
                lastReviewTime: currentState.lastCommentTime,
                status: currentState.status,
              },
              this.state.planningKey,
              this.cwd
            );
          } catch {
            // Status file might not exist - ignore
          }
        }

        // Notify if there's a new review
        if (isNewReview) {
          this.callbacks.onGreptileFeedback?.(hasGreptileComment);
        }
      }
    } catch {
      // Silently fail - might not have gh installed or no PR
    }
  }

  /**
   * Check for git branch changes
   *
   * In the branch-keyed model:
   * - Branch changes are the primary trigger for context changes
   * - Find the spec for the new branch via findSpecByBranch()
   * - Notify callbacks so TUI can update state
   */
  private async checkGitBranch(): Promise<void> {
    try {
      const currentBranch = getCurrentBranch(this.cwd);

      if (currentBranch !== this.state.currentBranch) {
        // Branch changed - update spec context
        this.state.currentBranch = currentBranch;
        this.state.currentSpec = getSpecForBranch(currentBranch, this.cwd);
        this.state.planningKey = sanitizeBranchForDir(currentBranch);

        // Notify callback with branch and spec info
        this.callbacks.onBranchChange?.(currentBranch, this.state.currentSpec);
      }
    } catch (err) {
      console.error('[EventLoop] checkGitBranch failed:', err);
    }
  }

  /**
   * Check for changes in prompt files
   *
   * The harness is the coordinator and watcher - it detects when agents
   * create, modify, or delete prompt files and notifies the TUI.
   * This enables reactive UI updates without agents needing to know about the harness.
   */
  private async checkPromptFiles(): Promise<void> {
    // Need planning directory to check prompts
    if (!this.state.planningKey) {
      return;
    }

    try {
      const prompts = loadAllPrompts(this.state.planningKey, this.cwd);
      const snapshot = this.computePromptSnapshot(prompts);

      // Check if prompts have changed
      const hasChanged = !this.state.promptSnapshot ||
        snapshot.hash !== this.state.promptSnapshot.hash;

      if (hasChanged) {
        this.state.promptSnapshot = snapshot;
        this.callbacks.onPromptsChange?.(prompts, snapshot);
      }
    } catch (err) {
      console.error('[EventLoop] checkPromptFiles failed:', err);
    }
  }

  /**
   * Compute a snapshot of prompt state for change detection
   */
  private computePromptSnapshot(prompts: PromptFile[]): PromptSnapshot {
    let pending = 0;
    let inProgress = 0;
    let done = 0;

    // Build hash from filenames + statuses + numbers
    const parts: string[] = [];
    for (const p of prompts) {
      parts.push(`${p.filename}:${p.frontmatter.status}:${p.frontmatter.number}`);
      switch (p.frontmatter.status) {
        case 'pending': pending++; break;
        case 'in_progress': inProgress++; break;
        case 'done': done++; break;
      }
    }
    parts.sort(); // Consistent ordering

    return {
      count: prompts.length,
      pending,
      inProgress,
      done,
      hash: parts.join('|'),
    };
  }

  /**
   * Check for changes in agent windows
   *
   * Only tracks agents that were spawned by ALL HANDS (in the registry)
   * and still exist in tmux. This prevents picking up unrelated tmux windows.
   */
  private async checkAgentWindows(): Promise<void> {
    try {
      // Use current session if in tmux, otherwise fall back to SESSION_NAME
      const currentSession = getCurrentSession();
      const sessionName = currentSession || SESSION_NAME;

      if (!sessionExists(sessionName)) {
        // Session gone - cleanup all agent daemons
        if (this.state.activeAgents.length > 0) {
          await this.cleanupAgentDaemons(this.state.activeAgents);
          // Also clear the registry since session is gone
          for (const name of this.state.activeAgents) {
            unregisterSpawnedAgent(name);
          }
          this.state.activeAgents = [];
          this.callbacks.onAgentsChange?.([]);
        }
        return;
      }

      const windows = listWindows(sessionName);
      const registry = getSpawnedAgentRegistry();

      // Only include windows that:
      // 1. Are in our spawned registry (were created by ALL HANDS)
      // 2. Still exist in tmux
      // 3. Are not the TUI/hub window
      const agentWindows = windows
        .filter((w) => w.index > 0 && w.name !== 'hub' && registry.has(w.name))
        .map((w) => w.name);

      // Check if agents have changed
      const sortedCurrent = [...agentWindows].sort();
      const sortedPrevious = [...this.state.activeAgents].sort();

      if (JSON.stringify(sortedCurrent) !== JSON.stringify(sortedPrevious)) {
        // Find agents that disappeared and cleanup their daemons
        const disappeared = this.state.activeAgents.filter(
          (name) => !agentWindows.includes(name)
        );

        if (disappeared.length > 0) {
          await this.cleanupAgentDaemons(disappeared);
          // Unregister disappeared agents
          for (const name of disappeared) {
            unregisterSpawnedAgent(name);
          }

          // If an executor exited, remove it from activeExecutorPrompts
          // Extract prompt number from window name (e.g., "executor-03" -> 3)
          for (const name of disappeared) {
            if (name.startsWith('executor') || name.startsWith('emergent')) {
              const match = name.match(/-(\d+)$/);
              if (match) {
                const promptNum = parseInt(match[1], 10);
                this.state.activeExecutorPrompts = this.state.activeExecutorPrompts.filter(
                  (n) => n !== promptNum
                );
              }
            }
          }
          // Clear spawn timestamp to allow new spawns
          if (disappeared.some((name) => name.startsWith('executor') || name.startsWith('emergent'))) {
            this.state.lastExecutorSpawnTime = null;
          }
        }

        this.state.activeAgents = agentWindows;
        this.callbacks.onAgentsChange?.(agentWindows);
      }
    } catch (err) {
      console.error('[EventLoop] checkAgentWindows failed:', err);
    }
  }

  /**
   * Cleanup MCP daemons for agents that have exited.
   * The window name IS the AGENT_ID, so we can directly shutdown their daemons.
   */
  private async cleanupAgentDaemons(agentNames: string[]): Promise<void> {
    for (const agentName of agentNames) {
      try {
        // Window name = AGENT_ID for daemon isolation
        await shutdownDaemon(agentName);
      } catch {
        // Ignore errors - daemon may already be gone
      }
    }
  }

  /**
   * Check if we should spawn an executor for the next prompt.
   *
   * Parallel execution rules:
   * 1. Emergent: Only ONE at a time; only starts when ALL prompts are done
   * 2. Executors: Respect dependencies; spawn up to maxParallel when parallel enabled
   * 3. One per tick: Only spawn ONE agent per event loop tick
   * 4. Lowest first: Always choose the lowest prompt number among candidates
   */
  private async checkPromptLoop(): Promise<void> {
    if (!this.state.loopEnabled) {
      return;
    }

    // Need a spec and planning directory to pick prompts
    if (!this.state.currentSpec || !this.state.planningKey) {
      this.callbacks.onLoopStatus?.('No spec for this branch - loop paused');
      return;
    }

    try {
      // 1. Block if emergent is running (only ONE emergent ever)
      const hasEmergent = this.state.activeAgents.some((name) => name.startsWith('emergent'));
      if (hasEmergent) {
        return;
      }

      // 2. Count active executors
      const activeExecutors = this.state.activeAgents.filter((name) => name.startsWith('executor'));

      // 3. Determine max parallel based on toggle
      const settings = loadProjectSettings();
      const maxParallel = this.state.parallelEnabled
        ? (settings?.spawn?.maxParallelPrompts ?? 3)
        : 1;

      // 4. Check capacity - if at max, don't spawn
      if (activeExecutors.length >= maxParallel) {
        return;
      }

      // Time-based guard: don't spawn if we spawned recently (within 10 seconds)
      // This protects against race conditions where the tmux registry hasn't caught up
      const SPAWN_COOLDOWN_MS = 10000;
      if (
        this.state.lastExecutorSpawnTime &&
        Date.now() - this.state.lastExecutorSpawnTime < SPAWN_COOLDOWN_MS
      ) {
        // Recently spawned, wait for it to appear in activeAgents or exit
        return;
      }

      // 5. Pick next prompt from planning directory
      // Pass activeExecutorPrompts to exclude prompts already being worked on
      const result = pickNextPrompt(
        this.state.planningKey,
        this.cwd,
        this.state.activeExecutorPrompts
      );

      if (!result.prompt) {
        // 6. Emergent condition: NO pending/in_progress, at least 1 done
        // This ensures emergent only runs when ALL prompts are completed
        if (
          this.state.emergentEnabled &&
          result.stats &&
          result.stats.pending === 0 &&
          result.stats.inProgress === 0 &&
          result.stats.done > 0
        ) {
          // Get all prompts and find a done one to refine
          const allPrompts = loadAllPrompts(this.state.planningKey, this.cwd);
          const donePrompt = allPrompts.find((p) => p.frontmatter.status === 'done');

          if (donePrompt) {
            this.state.activeExecutorPrompts.push(donePrompt.frontmatter.number);
            this.state.lastExecutorSpawnTime = Date.now();

            this.callbacks.onLoopStatus?.(
              `Spawning emergent for prompt ${donePrompt.frontmatter.number}: ${donePrompt.frontmatter.title}`
            );
            this.callbacks.onSpawnEmergent?.(donePrompt);
            return;
          }
        }

        // No actionable prompts and no emergent to spawn
        this.callbacks.onLoopStatus?.(result.reason);
        return;
      }

      // 7. Mark prompt as in_progress and spawn executor (only ONE per tick)
      markPromptInProgress(result.prompt.path);
      this.state.activeExecutorPrompts.push(result.prompt.frontmatter.number);
      this.state.lastExecutorSpawnTime = Date.now();

      this.callbacks.onLoopStatus?.(
        `Spawning executor for prompt ${result.prompt.frontmatter.number}: ${result.prompt.frontmatter.title}`
      );
      this.callbacks.onSpawnExecutor?.(result.prompt);
    } catch (err) {
      console.error('[EventLoop] checkPromptLoop failed:', err);
    }
  }

}
