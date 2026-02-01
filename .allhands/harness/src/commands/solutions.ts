/**
 * Solutions Command (Agent-Facing)
 *
 * Grep-based search for documented solutions in docs/solutions/.
 * Uses frontmatter fields (tags, module, component, symptoms) for precise matching.
 * Search includes AI aggregation with memory context from docs/memories.md.
 *
 * Usage:
 *   ah solutions search <query>                Search solutions with AI aggregation + memory context
 *   ah solutions search <query> --no-aggregate Skip aggregation, return raw matches
 *   ah solutions search <query> --full         Include full content of matches (no-aggregate mode)
 */

import { Command } from 'commander';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import { tracedAction } from '../lib/base-command.js';
import { AgentRunner, withDebugInfo, type SolutionSearchOutput } from '../lib/opencode/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AGGREGATOR_PROMPT_PATH = join(__dirname, '../lib/opencode/prompts/solutions-aggregator.md');

const getAggregatorPrompt = (): string => {
  return readFileSync(AGGREGATOR_PROMPT_PATH, 'utf-8');
};

const getProjectRoot = (): string => {
  return process.env.PROJECT_ROOT || process.cwd();
};

const getSolutionsDir = (): string => {
  return join(getProjectRoot(), 'docs', 'solutions');
};

const getMemoriesPath = (): string => {
  return join(getProjectRoot(), 'docs', 'memories.md');
};

interface SolutionFrontmatter {
  title: string;
  date: string;
  spec?: string;
  problem_type: string;
  component: string;
  symptoms: string[];
  root_cause: string;
  severity: string;
  tags: string[];
  source?: string;
}

interface SolutionMatch {
  path: string;
  frontmatter: SolutionFrontmatter;
  score: number;
  matchedFields: string[];
}

interface MemoryEntry {
  name: string;
  domain: string;
  source: string;
  description: string;
}

/**
 * Extract keywords from a search query.
 * Handles quoted phrases and splits on whitespace.
 */
function extractKeywords(query: string): string[] {
  const keywords: string[] = [];

  // Extract quoted phrases first
  const quotedRegex = /"([^"]+)"/g;
  let match;
  while ((match = quotedRegex.exec(query)) !== null) {
    keywords.push(match[1].toLowerCase());
  }

  // Remove quoted phrases and split remaining on whitespace
  const remaining = query.replace(quotedRegex, '').trim();
  if (remaining) {
    keywords.push(...remaining.toLowerCase().split(/\s+/).filter(k => k.length > 0));
  }

  return keywords;
}

/**
 * Parse YAML frontmatter from a markdown file.
 */
function parseFrontmatter(filePath: string): SolutionFrontmatter | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const parsed = parse(fmMatch[1]) as SolutionFrontmatter;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Score how well a solution matches the search keywords.
 */
function scoreSolution(fm: SolutionFrontmatter, keywords: string[]): { score: number; matchedFields: string[] } {
  let score = 0;
  const matchedFields: string[] = [];

  for (const keyword of keywords) {
    // Title match (high weight)
    if (fm.title?.toLowerCase().includes(keyword)) {
      score += 3;
      if (!matchedFields.includes('title')) matchedFields.push('title');
    }

    // Tags match (high weight)
    if (fm.tags?.some(t => t.toLowerCase().includes(keyword))) {
      score += 3;
      if (!matchedFields.includes('tags')) matchedFields.push('tags');
    }

    // Component match (medium weight)
    if (fm.component?.toLowerCase().includes(keyword)) {
      score += 2;
      if (!matchedFields.includes('component')) matchedFields.push('component');
    }

    // Symptoms match (medium weight)
    if (fm.symptoms?.some(s => s.toLowerCase().includes(keyword))) {
      score += 2;
      if (!matchedFields.includes('symptoms')) matchedFields.push('symptoms');
    }

    // Problem type match (low weight)
    if (fm.problem_type?.toLowerCase().includes(keyword)) {
      score += 1;
      if (!matchedFields.includes('problem_type')) matchedFields.push('problem_type');
    }

    // Root cause match (low weight)
    if (fm.root_cause?.toLowerCase().replace(/_/g, ' ').includes(keyword)) {
      score += 1;
      if (!matchedFields.includes('root_cause')) matchedFields.push('root_cause');
    }
  }

  return { score, matchedFields };
}

/**
 * Find all solution files in the solutions directory.
 */
function findSolutionFiles(dir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findSolutionFiles(fullPath));
    } else if (entry.endsWith('.md') && !entry.startsWith('README')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Search for solutions matching the query.
 */
function searchSolutions(query: string, limit: number = 10): SolutionMatch[] {
  const solutionsDir = getSolutionsDir();
  const keywords = extractKeywords(query);

  if (keywords.length === 0) {
    return [];
  }

  const files = findSolutionFiles(solutionsDir);
  const matches: SolutionMatch[] = [];

  for (const file of files) {
    const frontmatter = parseFrontmatter(file);
    if (!frontmatter) continue;

    const { score, matchedFields } = scoreSolution(frontmatter, keywords);

    if (score > 0) {
      // Make path relative to project root
      const relativePath = file.replace(getProjectRoot() + '/', '');
      matches.push({
        path: relativePath,
        frontmatter,
        score,
        matchedFields,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, limit);
}

/**
 * Get full content of a solution file (without frontmatter).
 */
function getSolutionContent(filePath: string): string | null {
  try {
    const fullPath = filePath.startsWith('/') ? filePath : join(getProjectRoot(), filePath);
    const content = readFileSync(fullPath, 'utf-8');
    // Remove frontmatter
    return content.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
  } catch {
    return null;
  }
}

/**
 * Parse all memory entries from docs/memories.md.
 */
function parseMemories(): MemoryEntry[] {
  const memoriesPath = getMemoriesPath();
  if (!existsSync(memoriesPath)) return [];

  const content = readFileSync(memoriesPath, 'utf-8');
  const lines = content.split('\n');
  const entries: MemoryEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip non-table lines, header rows, and separator rows
    if (!trimmed.startsWith('|') || trimmed.includes('---') || /\|\s*Name\s*\|/i.test(trimmed)) {
      continue;
    }

    // Parse table row
    const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length >= 4) {
      entries.push({
        name: cells[0],
        domain: cells[1],
        source: cells[2],
        description: cells[3],
      });
    }
  }

  return entries;
}

export function register(program: Command): void {
  const solutionsCmd = program
    .command('solutions')
    .description('Search and browse documented solutions (includes memory context)');

  // Search command
  solutionsCmd
    .command('search <query>')
    .description('Search solutions by keywords with AI aggregation and memory context')
    .option('--full', 'Include full content of matched solutions (non-aggregated mode)')
    .option('--limit <n>', 'Maximum number of results', '10')
    .option('--no-aggregate', 'Skip aggregation, return raw matches')
    .option('--debug', 'Include agent debug metadata (model, timing, fallback) in output')
    .action(tracedAction('solutions search', async (query: string, _opts: Record<string, unknown>, command: Command) => {
      const opts = command.opts();
      const limit = parseInt(opts.limit as string || '10', 10);
      const noAggregate = opts.aggregate === false;
      const debug = !!opts.debug;
      const full = !!opts.full;

      const matches = searchSolutions(query, limit);

      if (matches.length === 0) {
        // Still check memories even when no solution matches
        if (!noAggregate) {
          const memories = parseMemories();
          if (memories.length > 0) {
            // Build aggregation input with only memories
            const userMessage = JSON.stringify({
              query,
              solutions: [],
              memories,
            });

            const projectRoot = getProjectRoot();
            const runner = new AgentRunner(projectRoot);

            try {
              const agentResult = await runner.run<SolutionSearchOutput>(
                {
                  name: 'solutions-aggregator',
                  systemPrompt: getAggregatorPrompt(),
                  timeoutMs: 60000,
                  steps: 5,
                },
                userMessage,
              );

              if (agentResult.success && agentResult.data) {
                console.log(JSON.stringify(withDebugInfo({
                  success: true,
                  query,
                  aggregated: true,
                  guidance: agentResult.data.guidance,
                  relevant_solutions: agentResult.data.relevant_solutions,
                  memory_insights: agentResult.data.memory_insights,
                  design_notes: agentResult.data.design_notes,
                  source_matches: 0,
                }, agentResult, debug), null, 2));
                return;
              }
            } catch {
              // Fall through to no-results output
            }
          }
        }

        console.log(JSON.stringify({
          success: true,
          query,
          keywords: extractKeywords(query),
          results: [],
          message: 'No matching solutions found',
        }, null, 2));
        return;
      }

      // Return raw matches if aggregation disabled
      if (noAggregate) {
        const results = matches.map(match => {
          const result: Record<string, unknown> = {
            path: match.path,
            title: match.frontmatter.title,
            score: match.score,
            matched_fields: match.matchedFields,
            severity: match.frontmatter.severity,
            problem_type: match.frontmatter.problem_type,
            component: match.frontmatter.component,
            tags: match.frontmatter.tags,
          };

          if (full) {
            result.content = getSolutionContent(match.path);
          }

          return result;
        });

        console.log(JSON.stringify({
          success: true,
          query,
          keywords: extractKeywords(query),
          result_count: results.length,
          results,
          aggregated: false,
        }, null, 2));
        return;
      }

      // Build aggregation input
      const solutionsInput = matches.map(m => {
        const content = getSolutionContent(m.path);
        return {
          title: m.frontmatter.title,
          path: m.path,
          severity: m.frontmatter.severity,
          problem_type: m.frontmatter.problem_type,
          component: m.frontmatter.component,
          tags: m.frontmatter.tags,
          content: content || '',
        };
      });

      const memories = parseMemories();

      const userMessage = JSON.stringify({
        query,
        solutions: solutionsInput,
        memories,
      });

      const projectRoot = getProjectRoot();
      const runner = new AgentRunner(projectRoot);

      try {
        const agentResult = await runner.run<SolutionSearchOutput>(
          {
            name: 'solutions-aggregator',
            systemPrompt: getAggregatorPrompt(),
            timeoutMs: 60000,
            steps: 5,
          },
          userMessage,
        );

        if (!agentResult.success) {
          // Graceful degradation: return raw matches on aggregation failure
          const results = matches.map(match => ({
            path: match.path,
            title: match.frontmatter.title,
            score: match.score,
            matched_fields: match.matchedFields,
            severity: match.frontmatter.severity,
            problem_type: match.frontmatter.problem_type,
            component: match.frontmatter.component,
            tags: match.frontmatter.tags,
          }));

          console.log(JSON.stringify(withDebugInfo({
            success: true,
            query,
            results,
            count: results.length,
            aggregated: false,
            aggregation_error: agentResult.error,
          }, agentResult, debug), null, 2));
          return;
        }

        console.log(JSON.stringify(withDebugInfo({
          success: true,
          query,
          aggregated: true,
          guidance: agentResult.data!.guidance,
          relevant_solutions: agentResult.data!.relevant_solutions,
          memory_insights: agentResult.data!.memory_insights,
          design_notes: agentResult.data!.design_notes,
          source_matches: matches.length,
        }, agentResult, debug), null, 2));
      } catch (error) {
        // Graceful degradation on any error
        const message = error instanceof Error ? error.message : String(error);
        const results = matches.map(match => ({
          path: match.path,
          title: match.frontmatter.title,
          score: match.score,
          matched_fields: match.matchedFields,
          severity: match.frontmatter.severity,
          problem_type: match.frontmatter.problem_type,
          component: match.frontmatter.component,
          tags: match.frontmatter.tags,
        }));

        console.log(JSON.stringify({
          success: true,
          query,
          results,
          count: results.length,
          aggregated: false,
          aggregation_error: message,
        }, null, 2));
      }
    }));
}
