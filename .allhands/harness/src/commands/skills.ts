/**
 * Skills Command (Agent-Facing)
 *
 * Searches and discovers skills for domain expertise.
 * Agents use this to find relevant skills for their tasks.
 *
 * Usage:
 *   ah skills search <query> [--paths <paths...>] [--limit <n>] [--no-aggregate]
 */

import { Command } from 'commander';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { minimatch } from 'minimatch';
import { tracedAction } from '../lib/base-command.js';
import { AgentRunner, withDebugInfo, type SkillSearchOutput } from '../lib/opencode/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SkillFrontmatter {
  name: string;
  description: string;
  globs: string[];
  version?: string;
  license?: string;
}

interface SkillEntry {
  name: string;
  description: string;
  globs: string[];
  file: string;
}

interface SkillMatch extends SkillEntry {
  score: number;
  matchedFields: string[];
  pathMatch: boolean;
}

/** Scoring weights for keyword matching against skill fields. */
const SCORE_WEIGHT = {
  NAME: 3,
  DESCRIPTION: 3,
  GLOBS: 2,
  PATH_BOOST: 4,
} as const;

// Load aggregator prompt from file
const AGGREGATOR_PROMPT_PATH = join(__dirname, '../lib/opencode/prompts/skills-aggregator.md');

const getAggregatorPrompt = (): string => {
  return readFileSync(AGGREGATOR_PROMPT_PATH, 'utf-8');
};

const getProjectRoot = (): string => {
  return process.env.PROJECT_ROOT || process.cwd();
};

/**
 * Extract frontmatter from markdown content
 */
function extractFrontmatter(content: string): Record<string, unknown> | null {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  try {
    return parseYaml(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extract body content from markdown (everything after frontmatter)
 */
function extractBody(content: string): string {
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n?/;
  return content.replace(frontmatterRegex, '').trim();
}

/**
 * Get the skills directory path
 * Path: harness/src/commands/ -> harness/src/ -> harness/ -> .allhands/ -> skills/
 */
function getSkillsDir(): string {
  return join(__dirname, '..', '..', '..', 'skills');
}

/**
 * List all skills by reading SKILL.md files and extracting frontmatter
 */
function listSkills(): SkillEntry[] {
  const dir = getSkillsDir();

  if (!existsSync(dir)) {
    return [];
  }

  const entries = readdirSync(dir);
  const skills: SkillEntry[] = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry);
    const stat = statSync(entryPath);

    // Skip non-directories
    if (!stat.isDirectory()) continue;

    // Look for SKILL.md in the directory
    const skillFile = join(entryPath, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    const content = readFileSync(skillFile, 'utf-8');
    const frontmatter = extractFrontmatter(content) as SkillFrontmatter | null;

    if (frontmatter && frontmatter.name && frontmatter.description && frontmatter.globs) {
      skills.push({
        name: frontmatter.name,
        description: frontmatter.description,
        globs: frontmatter.globs,
        file: `.allhands/skills/${entry}/SKILL.md`,
      });
    }
  }

  return skills;
}

/**
 * Extract keywords from a search query.
 * Handles quoted phrases and splits remaining words.
 */
function extractKeywords(query: string): string[] {
  const keywords: string[] = [];
  const quotedRegex = /"([^"]+)"/g;
  let remaining = query;
  let match;

  while ((match = quotedRegex.exec(query)) !== null) {
    keywords.push(match[1].toLowerCase());
    remaining = remaining.replace(match[0], '');
  }

  const words = remaining
    .split(/\s+/)
    .map(w => w.toLowerCase().trim())
    .filter(w => w.length > 1);

  keywords.push(...words);
  return keywords;
}

/**
 * Score a skill against search keywords.
 * Returns score and which fields matched.
 */
function scoreSkill(
  entry: SkillEntry,
  keywords: string[],
): { score: number; matchedFields: string[] } {
  let score = 0;
  const matchedFields: string[] = [];
  const nameLC = entry.name.toLowerCase();
  const descLC = entry.description.toLowerCase();
  const globsLC = entry.globs.join(' ').toLowerCase();

  for (const kw of keywords) {
    if (nameLC.includes(kw)) {
      score += SCORE_WEIGHT.NAME;
      if (!matchedFields.includes('name')) matchedFields.push('name');
    }
    if (descLC.includes(kw)) {
      score += SCORE_WEIGHT.DESCRIPTION;
      if (!matchedFields.includes('description')) matchedFields.push('description');
    }
    if (globsLC.includes(kw)) {
      score += SCORE_WEIGHT.GLOBS;
      if (!matchedFields.includes('globs')) matchedFields.push('globs');
    }
  }

  return { score, matchedFields };
}

/**
 * Check if a skill's globs match any of the provided file paths.
 */
function matchesPaths(skill: SkillEntry, paths: string[]): boolean {
  for (const filePath of paths) {
    for (const glob of skill.globs) {
      if (minimatch(filePath, glob)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Search skills by keyword scoring with optional path boosting.
 */
function searchSkills(
  query: string,
  options: { paths?: string[]; limit?: number },
): SkillMatch[] {
  const { paths, limit = 10 } = options;
  const allSkills = listSkills();
  const keywords = extractKeywords(query);
  const results: SkillMatch[] = [];

  for (const skill of allSkills) {
    const { score: keywordScore, matchedFields } = scoreSkill(skill, keywords);
    const pathMatch = paths ? matchesPaths(skill, paths) : false;

    let finalScore = keywordScore;

    if (paths && pathMatch) {
      finalScore = keywordScore > 0 ? keywordScore + SCORE_WEIGHT.PATH_BOOST : SCORE_WEIGHT.PATH_BOOST;
    }

    if (finalScore > 0) {
      results.push({
        ...skill,
        score: finalScore,
        matchedFields: pathMatch && matchedFields.length === 0
          ? ['paths']
          : pathMatch
            ? [...matchedFields, 'paths']
            : matchedFields,
        pathMatch,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Get the body content of a SKILL.md file (without frontmatter).
 */
function getSkillContent(entry: SkillEntry): string | null {
  const dir = getSkillsDir();
  const skillFile = join(dir, entry.name, 'SKILL.md');

  if (!existsSync(skillFile)) return null;

  const content = readFileSync(skillFile, 'utf-8');
  return extractBody(content);
}

/**
 * Get reference file paths for a skill (from references/ and docs/ subdirs).
 */
function getSkillReferenceFiles(entry: SkillEntry): string[] {
  const dir = getSkillsDir();
  const skillDir = join(dir, entry.name);
  const refPaths: string[] = [];
  const subdirs = ['references', 'docs'];

  for (const subdir of subdirs) {
    const subdirPath = join(skillDir, subdir);
    if (!existsSync(subdirPath) || !statSync(subdirPath).isDirectory()) continue;

    const files = readdirSync(subdirPath);
    for (const file of files) {
      if (file.endsWith('.md')) {
        refPaths.push(`.allhands/skills/${entry.name}/${subdir}/${file}`);
      }
    }
  }

  return refPaths;
}

/**
 * Run AI aggregation on skill matches to produce synthesized guidance.
 * Returns a JSON-serializable result object.
 */
async function aggregateSkills(
  query: string,
  matches: SkillMatch[],
  debug: boolean,
): Promise<Record<string, unknown>> {
  const skillsInput = matches.map(m => {
    const content = getSkillContent(m);
    const referenceFiles = getSkillReferenceFiles(m);
    return {
      name: m.name,
      description: m.description,
      globs: m.globs,
      file: m.file,
      content: content || '',
      reference_files: referenceFiles,
    };
  });

  const userMessage = JSON.stringify({ query, skills: skillsInput });
  const projectRoot = getProjectRoot();
  const runner = new AgentRunner(projectRoot);

  try {
    const agentResult = await runner.run<SkillSearchOutput>(
      {
        name: 'skills-aggregator',
        systemPrompt: getAggregatorPrompt(),
        timeoutMs: 60000,
        steps: 5,
      },
      userMessage,
    );

    if (!agentResult.success) {
      return withDebugInfo({
        success: true,
        query,
        matches,
        count: matches.length,
        aggregated: false,
        aggregation_error: agentResult.error,
      }, agentResult, debug);
    }

    return withDebugInfo({
      success: true,
      query,
      aggregated: true,
      guidance: agentResult.data!.guidance,
      relevant_skills: agentResult.data!.relevant_skills,
      design_notes: agentResult.data!.design_notes,
      source_matches: matches.length,
    }, agentResult, debug);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: true,
      query,
      matches,
      count: matches.length,
      aggregated: false,
      aggregation_error: message,
    };
  }
}

export function register(program: Command): void {
  const cmd = program
    .command('skills')
    .description('Search and discover skills for domain expertise');

  // Search subcommand
  cmd
    .command('search')
    .description('Search skills by query with optional path boosting and AI aggregation')
    .argument('<query>', 'Descriptive search query (e.g. "how to write a flow")')
    .option('--paths <paths...>', 'File paths to match against skill globs (boosts relevance)')
    .option('--limit <n>', 'Maximum results', '10')
    .option('--no-aggregate', 'Skip aggregation, return raw matches')
    .option('--debug', 'Include agent debug metadata (model, timing, fallback) in output')
    .action(tracedAction('skills search', async (query: string, _opts: Record<string, unknown>, command: Command) => {
      const opts = command.opts();
      const paths = opts.paths as string[] | undefined;
      const limit = parseInt(opts.limit as string, 10) || 10;
      const noAggregate = opts.aggregate === false;
      const debug = !!opts.debug;

      if (!query) {
        console.log(JSON.stringify({
          success: false,
          error: 'validation_error: query is required',
        }, null, 2));
        return;
      }

      const matches = searchSkills(query, { paths, limit });

      if (matches.length === 0) {
        console.log(JSON.stringify({
          success: true,
          query,
          matches: [],
          count: 0,
          message: 'No skills matched the search query.',
        }, null, 2));
        return;
      }

      // Return raw matches if aggregation disabled
      if (noAggregate) {
        console.log(JSON.stringify({
          success: true,
          query,
          matches,
          count: matches.length,
          aggregated: false,
        }, null, 2));
        return;
      }

      const result = await aggregateSkills(query, matches, debug);
      console.log(JSON.stringify(result, null, 2));
    }));
}
