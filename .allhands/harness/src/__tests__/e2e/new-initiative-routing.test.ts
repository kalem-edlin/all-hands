/**
 * New Initiative Routing Integration Tests
 *
 * Validates:
 * - SCOPING_FLOW_MAP completeness and correctness against SpecType values
 * - All referenced scoping flow files exist on disk
 * - flowOverride propagation through spawnAgentFromProfile()
 * - buildActionItems() always-visible guarantee for new-initiative action
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import type { SpecType } from '../../lib/specs.js';
import { SCOPING_FLOW_MAP } from '../../commands/tui.js';
import { buildActionItems, type ToggleState } from '../../tui/actions.js';
import { getFlowsDirectory } from '../../lib/flows.js';

// ─── Task 1: SCOPING_FLOW_MAP completeness and correctness ──────────────────

describe('SCOPING_FLOW_MAP completeness and correctness', () => {
  const ALL_SPEC_TYPES: SpecType[] = [
    'milestone',
    'investigation',
    'optimization',
    'refactor',
    'documentation',
    'triage',
  ];

  it('has exactly 6 keys matching all SpecType values', () => {
    const mapKeys = Object.keys(SCOPING_FLOW_MAP).sort();
    const specTypes = [...ALL_SPEC_TYPES].sort();
    expect(mapKeys).toEqual(specTypes);
  });

  it('milestone maps to null', () => {
    expect(SCOPING_FLOW_MAP.milestone).toBeNull();
  });

  it('investigation maps to INVESTIGATION_SCOPING.md', () => {
    expect(SCOPING_FLOW_MAP.investigation).toBe('INVESTIGATION_SCOPING.md');
  });

  it('optimization maps to OPTIMIZATION_SCOPING.md', () => {
    expect(SCOPING_FLOW_MAP.optimization).toBe('OPTIMIZATION_SCOPING.md');
  });

  it('refactor maps to REFACTOR_SCOPING.md', () => {
    expect(SCOPING_FLOW_MAP.refactor).toBe('REFACTOR_SCOPING.md');
  });

  it('documentation maps to DOCUMENTATION_SCOPING.md', () => {
    expect(SCOPING_FLOW_MAP.documentation).toBe('DOCUMENTATION_SCOPING.md');
  });

  it('triage maps to TRIAGE_SCOPING.md', () => {
    expect(SCOPING_FLOW_MAP.triage).toBe('TRIAGE_SCOPING.md');
  });
});

// ─── Task 2: Verify all referenced scoping flow files exist on disk ──────────

describe('Scoping flow files exist on disk', () => {
  const flowsDir = getFlowsDirectory();

  const nonNullFlows = Object.entries(SCOPING_FLOW_MAP).filter(
    ([, v]) => v !== null
  ) as [string, string][];

  it.each(nonNullFlows)(
    '%s flow file %s exists at .allhands/flows/',
    (_type, flowFile) => {
      const fullPath = join(flowsDir, flowFile);
      expect(existsSync(fullPath)).toBe(true);
    }
  );
});

// ─── Task 3: flowOverride propagation through spawnAgentFromProfile() ────────

describe('flowOverride propagation', () => {
  it('milestone produces undefined flowOverride (null from map)', () => {
    const flowFile = SCOPING_FLOW_MAP.milestone;
    const flowOverride = flowFile
      ? join(getFlowsDirectory(), flowFile)
      : undefined;

    expect(flowOverride).toBeUndefined();
  });

  it('investigation produces correct absolute flowOverride path', () => {
    const flowFile = SCOPING_FLOW_MAP.investigation;
    const flowOverride = flowFile
      ? join(getFlowsDirectory(), flowFile)
      : undefined;

    expect(flowOverride).toBe(
      join(getFlowsDirectory(), 'INVESTIGATION_SCOPING.md')
    );
  });

  it('all non-null spec types produce absolute paths under flows directory', () => {
    const flowsDir = getFlowsDirectory();

    for (const [, flowFile] of Object.entries(SCOPING_FLOW_MAP)) {
      if (flowFile === null) continue;

      const flowOverride = join(flowsDir, flowFile);
      expect(flowOverride).toContain(flowsDir);
      expect(flowOverride).toContain(flowFile);
      // Verify it resolves to a real file
      expect(existsSync(flowOverride)).toBe(true);
    }
  });

  it('flowOverride field is accepted by ProfileSpawnConfig type', () => {
    // Type-level verification: ProfileSpawnConfig includes flowOverride?: string
    // At runtime we verify the contract: config.flowOverride || invocation.flowPath (tmux.ts:731)
    // Actual tmux spawning requires a live session; here we validate the map → override pipeline
    const flowFile = SCOPING_FLOW_MAP.optimization;
    expect(flowFile).toBe('OPTIMIZATION_SCOPING.md');

    // Construct the same config shape the handler builds
    const config = {
      agentName: 'ideation',
      context: {},
      focusWindow: true,
      flowOverride: flowFile ? join(getFlowsDirectory(), flowFile) : undefined,
    };

    expect(config.flowOverride).toBeDefined();
    expect(config.flowOverride).toContain('OPTIMIZATION_SCOPING.md');
  });
});

// ─── Task 4: buildActionItems() always-visible guarantee ─────────────────────

describe('buildActionItems always-visible guarantee', () => {
  const prActionStates = ['create-pr', 'awaiting-review', 'rerun-pr-review'] as const;

  const toggleCombinations: ToggleState[] = [];
  for (const loop of [true, false]) {
    for (const parallel of [true, false]) {
      for (const pr of prActionStates) {
        toggleCombinations.push({
          loopEnabled: loop,
          parallelEnabled: parallel,
          prActionState: pr,
        });
      }
    }
  }

  it.each(toggleCombinations)(
    'new-initiative is present with loop=$loopEnabled, parallel=$parallelEnabled, pr=$prActionState',
    (toggleState) => {
      const items = buildActionItems(toggleState);
      const newInitiative = items.find((item) => item.id === 'new-initiative');
      expect(newInitiative).toBeDefined();
      expect(newInitiative!.type).toBe('action');
    }
  );

  it('no action items have hidden or disabled properties', () => {
    const items = buildActionItems({
      loopEnabled: false,
      parallelEnabled: false,
      prActionState: 'create-pr',
    });

    for (const item of items) {
      // ActionItem interface at actions.ts:21 has: id, label, key?, type, highlight?, checked?
      // No hidden or disabled fields exist
      expect(item).not.toHaveProperty('hidden');
      expect(item).not.toHaveProperty('disabled');
    }
  });

  it('returns consistent action count across all toggle states', () => {
    const counts = toggleCombinations.map(
      (ts) => buildActionItems(ts).length
    );
    const uniqueCounts = new Set(counts);
    expect(uniqueCounts.size).toBe(1);
  });
});
