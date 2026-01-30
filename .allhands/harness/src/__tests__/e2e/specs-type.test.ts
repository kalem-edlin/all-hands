/**
 * Spec Type Parsing and Template Wiring Tests
 *
 * Exercises:
 * - parseFrontmatter() type field handling for all 6 SpecType values
 * - scanSpecDir() backward-compatible type defaulting
 * - buildTemplateContext() SPEC_TYPE resolution via getSpecForBranch
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createFixture, type TestFixture } from '../harness/index.js';
import { parseFrontmatter, scanSpecDir } from '../../lib/specs.js';
import type { SpecType } from '../../lib/specs.js';

// ─── parseFrontmatter() Tests ─────────────────────────────────────────────────

describe('parseFrontmatter() type field handling', () => {
  const specTypes: SpecType[] = [
    'milestone',
    'investigation',
    'optimization',
    'refactor',
    'documentation',
    'triage',
  ];

  it.each(specTypes)('parses type: %s correctly', (specType) => {
    const content = `---\nname: test-spec\ntype: ${specType}\n---\n# Test`;
    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(specType);
  });

  it('returns undefined type when no type field present', () => {
    const content = `---\nname: test-spec\nstatus: roadmap\n---\n# Test`;
    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.type).toBeUndefined();
  });

  it('parses invalid type value as-is (no runtime validation)', () => {
    const content = `---\nname: test-spec\ntype: custom-type\n---\n# Test`;
    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('custom-type');
  });

  it('returns null for content without frontmatter', () => {
    const content = `# Just a heading\n\nNo frontmatter here.`;
    const result = parseFrontmatter(content);
    expect(result).toBeNull();
  });
});

// ─── scanSpecDir() Tests ──────────────────────────────────────────────────────

describe('scanSpecDir() type defaulting', () => {
  let fixture: TestFixture;

  beforeAll(() => {
    fixture = createFixture({ name: 'specs-type-test' });
  });

  afterAll(() => {
    fixture.cleanup();
  });

  it('defaults type to milestone when type field is missing', () => {
    const specDir = `specs-no-type`;
    fixture.writeFile(
      `${specDir}/no-type.spec.md`,
      `---\nname: no-type-spec\nstatus: roadmap\n---\n# No Type Spec`,
    );

    const specs = scanSpecDir(`${fixture.root}/${specDir}`, 'roadmap');
    expect(specs).toHaveLength(1);
    expect(specs[0].type).toBe('milestone');
  });

  it('preserves explicit type: optimization', () => {
    const specDir = `specs-explicit-type`;
    fixture.writeFile(
      `${specDir}/opt.spec.md`,
      `---\nname: opt-spec\ntype: optimization\nstatus: roadmap\n---\n# Optimization Spec`,
    );

    const specs = scanSpecDir(`${fixture.root}/${specDir}`, 'roadmap');
    expect(specs).toHaveLength(1);
    expect(specs[0].type).toBe('optimization');
  });

  it('handles mixed directory: some specs with type, some without', () => {
    const specDir = `specs-mixed`;
    fixture.writeFile(
      `${specDir}/with-type.spec.md`,
      `---\nname: typed-spec\ntype: investigation\nstatus: roadmap\n---\n# Investigation Spec`,
    );
    fixture.writeFile(
      `${specDir}/without-type.spec.md`,
      `---\nname: untyped-spec\nstatus: roadmap\n---\n# Untyped Spec`,
    );
    fixture.writeFile(
      `${specDir}/refactor.spec.md`,
      `---\nname: refactor-spec\ntype: refactor\nstatus: roadmap\n---\n# Refactor Spec`,
    );

    const specs = scanSpecDir(`${fixture.root}/${specDir}`, 'roadmap');
    expect(specs).toHaveLength(3);

    const byId = Object.fromEntries(specs.map((s: { id: string; type: string }) => [s.id, s]));
    expect(byId['with-type'].type).toBe('investigation');
    expect(byId['without-type'].type).toBe('milestone');
    expect(byId['refactor'].type).toBe('refactor');
  });

  it('returns empty array for non-existent directory', () => {
    const specs = scanSpecDir(`${fixture.root}/non-existent-dir`, 'roadmap');
    expect(specs).toEqual([]);
  });
});

// ─── buildTemplateContext() SPEC_TYPE Tests ────────────────────────────────────

// These tests mock getSpecForBranch to verify SPEC_TYPE resolution in
// buildTemplateContext(). Follows the same vi.mock hoisting pattern as
// event-loop.test.ts.

vi.mock('../../lib/specs.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/specs.js')>();
  return {
    ...actual,
    getSpecForBranch: vi.fn(() => null),
  };
});

vi.mock('../../lib/planning.js', () => ({
  getCurrentBranch: vi.fn(() => 'feature/test-branch'),
  getPlanningPaths: vi.fn((spec: string, cwd?: string) => {
    const base = cwd || '/tmp';
    return {
      root: `${base}/.planning/${spec}`,
      prompts: `${base}/.planning/${spec}/prompts`,
      alignment: `${base}/.planning/${spec}/alignment.md`,
      status: `${base}/.planning/${spec}/status.yaml`,
    };
  }),
}));

vi.mock('../../hooks/shared.js', () => ({
  loadProjectSettings: vi.fn(() => ({
    spawn: { maxParallelPrompts: 3 },
    emergent: { hypothesisDomains: ['testing', 'stability'] },
  })),
}));

import { getSpecForBranch } from '../../lib/specs.js';
import { buildTemplateContext } from '../../lib/tmux.js';
import type { SpecFile } from '../../lib/specs.js';

function makeSpecFile(overrides: Partial<SpecFile> = {}): SpecFile {
  return {
    id: 'test-spec',
    filename: 'test-spec.spec.md',
    path: '/tmp/specs/test-spec.spec.md',
    title: 'Test Spec',
    category: 'roadmap',
    domain_name: 'test',
    type: 'milestone',
    status: 'roadmap',
    dependencies: [],
    ...overrides,
  };
}

describe('buildTemplateContext() SPEC_TYPE resolution', () => {
  it('sets SPEC_TYPE from spec with type: investigation', () => {
    vi.mocked(getSpecForBranch).mockReturnValue(
      makeSpecFile({ type: 'investigation' }),
    );

    const context = buildTemplateContext('test-spec');
    expect(context.SPEC_TYPE).toBe('investigation');
  });

  it('falls back to milestone when getSpecForBranch returns null', () => {
    vi.mocked(getSpecForBranch).mockReturnValue(null);

    const context = buildTemplateContext('test-spec');
    expect(context.SPEC_TYPE).toBe('milestone');
  });

  it('uses spec type for each of the 6 spec types', () => {
    const specTypes: SpecType[] = [
      'milestone',
      'investigation',
      'optimization',
      'refactor',
      'documentation',
      'triage',
    ];

    for (const specType of specTypes) {
      vi.mocked(getSpecForBranch).mockReturnValue(
        makeSpecFile({ type: specType }),
      );
      const context = buildTemplateContext('test-spec');
      expect(context.SPEC_TYPE).toBe(specType);
    }
  });
});
