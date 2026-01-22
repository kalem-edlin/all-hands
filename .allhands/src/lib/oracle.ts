/**
 * Oracle - Harness-Specific AI Tasks
 *
 * High-level AI functions specific to the All Hands harness.
 * These are INTERNAL functions - not exposed to agents via CLI.
 *
 * Uses llm.ts for the underlying provider integration.
 *
 * Functions:
 * - suggestBranchName() - Generate branch name from spec
 * - generatePRDescription() - Generate PR content from prompts + alignment
 */

import { ask } from './llm.js';

// ============================================================================
// Types
// ============================================================================

export type BranchPrefix = 'feat' | 'chore' | 'fix' | 'refactor' | 'exp' | 'docs';

export interface BranchSuggestion {
  prefix: BranchPrefix;
  name: string;
  fullName: string;
  reasoning: string;
}

export interface PRContent {
  title: string;
  body: string;
}

// ============================================================================
// Branch Naming (Internal)
// ============================================================================

/**
 * Suggest a branch name based on a spec file
 *
 * INTERNAL ONLY - Not exposed via CLI to agents.
 * Used by TUI for switch-milestone functionality.
 *
 * Branch prefixes:
 * - feat/   - New features
 * - chore/  - Tooling, config, CI/CD
 * - fix/    - Bug fixes
 * - refactor/ - Code restructuring
 * - exp/    - Experimental (throw-away)
 * - docs/   - Documentation
 */
export async function suggestBranchName(
  specContent: string,
  specFilename: string
): Promise<BranchSuggestion> {
  const prompt = `You are a git branch naming assistant. Given a milestone spec, suggest an appropriate branch name.

## Branch Prefix Rules:
- feat/ - New features or functionality
- chore/ - Tooling, configuration, CI/CD, dependencies
- fix/ - Bug fixes
- refactor/ - Code restructuring without new features
- exp/ - Experimental work (throw-away, exploratory)
- docs/ - Documentation only

## Requirements:
1. Choose the most appropriate prefix based on the spec content
2. Create a short, kebab-case branch name (max 50 chars total)
3. The name should be descriptive but concise

## Spec Filename: ${specFilename}

## Spec Content:
${specContent}

## Response Format (JSON only, no markdown):
{
  "prefix": "feat",
  "name": "example-branch-name",
  "reasoning": "Brief explanation of why this prefix and name"
}`;

  try {
    const result = await ask(prompt, {
      context: 'You must respond with valid JSON only. No markdown code blocks.',
    });

    // Parse JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      prefix: string;
      name: string;
      reasoning: string;
    };

    // Validate prefix
    const validPrefixes: BranchPrefix[] = ['feat', 'chore', 'fix', 'refactor', 'exp', 'docs'];
    const prefix = validPrefixes.includes(parsed.prefix as BranchPrefix)
      ? (parsed.prefix as BranchPrefix)
      : 'feat';

    // Sanitize branch name
    const name = parsed.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40);

    return {
      prefix,
      name,
      fullName: `${prefix}/${name}`,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    // Fallback: derive from filename
    const baseName = specFilename
      .replace(/\.spec\.md$/i, '')
      .replace(/\.md$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40);

    return {
      prefix: 'feat',
      name: baseName,
      fullName: `feat/${baseName}`,
      reasoning: 'Fallback: derived from spec filename',
    };
  }
}

// ============================================================================
// PR Generation (Internal)
// ============================================================================

/**
 * Generate a PR description from prompts and alignment doc
 *
 * INTERNAL ONLY - Not exposed via CLI to agents.
 * Used by TUI for create-pr functionality.
 */
export async function generatePRDescription(
  prompts: Array<{ number: number; title: string; status: string }>,
  alignmentContent: string,
  milestoneName: string
): Promise<PRContent> {
  const promptSummary = prompts
    .map((p) => `- ${p.number}. ${p.title} (${p.status})`)
    .join('\n');

  const prompt = `Generate a pull request title and description for this milestone.

## Milestone: ${milestoneName}

## Prompts Completed:
${promptSummary}

## Alignment Document:
${alignmentContent}

## Response Format (JSON only):
{
  "title": "Short PR title (max 72 chars)",
  "body": "Markdown PR body with Summary and Test Plan sections"
}`;

  try {
    const result = await ask(prompt, {
      context: 'You must respond with valid JSON only. No markdown code blocks.',
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as PRContent;
    return parsed;
  } catch {
    // Fallback
    return {
      title: `[${milestoneName}] Implementation complete`,
      body: `## Summary\nImplementation of ${milestoneName} milestone.\n\n## Prompts\n${promptSummary}`,
    };
  }
}
