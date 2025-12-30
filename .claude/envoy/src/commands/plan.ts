import { execSync, spawnSync } from "child_process";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { Command } from "commander";
import { GoogleGenAI } from "@google/genai";
import type { PromptFrontMatter, FindingApproach, FindingsFile } from "../lib/index.js";
import { resolveProtocol, formatProtocol, listProtocols } from "../lib/protocols.js";
import {
  appendUserInput as appendUserInputLib,
  createDefaultApproach,
  deletePrompt,
  ensurePlanDir,
  getApproachId,
  getBaseBranch,
  getBranch,
  getDiff,
  getPromptId,
  getUserFeedbackPath,
  planExists,
  readAllFindings,
  readAllPrompts,
  readDesignManifest,
  readFindings,
  readPlan,
  readPrompt,
  readSummary,
  readUserInput,
  updatePlanStage,
  writeFindings,
  writePlan,
  writePrompt,
  writeSummary,
  // Phase 7: Blocking Gates
  writeFindingsGateFeedback,
  readFindingsGateFeedback,
  writePlanGateFeedback,
  readPlanGateFeedback,
  writeTestingGateFeedback,
  readTestingGateFeedback,
  writeVariantsGateFeedback,
  readVariantsGateFeedback,
  writeLoggingGateFeedback,
  readLoggingGateFeedback,
  deleteFeedbackFile,
  archiveFindings,
  updateApproachFeedback,
  deleteApproach,
  updatePromptStatus,
  updatePromptVariantSolution,
  watchForDone,
  listPrompts,
  // Phase 7: Log file utilities
  getTestingGateLogsPath,
  resetTestingGateDone,
  getLoggingGateLogsPath,
  resetLoggingGateDone,
  // Repomix utilities
  getFileTokenCount,
  getMaxLogTokens,
  // Git utilities
  getProjectRoot,
} from "../lib/index.js";
import { BaseCommand, CommandResult } from "./base.js";

/**
 * Initialize plan directory for current branch.
 */
class InitCommand extends BaseCommand {
  readonly name = "init";
  readonly description = "Initialize plan directory for current branch";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    ensurePlanDir();

    return this.success({
      initialized: true,
      branch,
      base_branch: getBaseBranch(),
    });
  }
}

/**
 * Get plan directory status for current branch.
 */
class StatusCommand extends BaseCommand {
  readonly name = "status";
  readonly description = "Get plan directory status for current branch";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const exists = planExists();

    return this.success({
      exists,
      branch,
      base_branch: getBaseBranch(),
    });
  }
}

// ============================================================================
// Phase 2 Commands: Plan File I/O
// ============================================================================

/**
 * Check plan status and return context based on stage.
 */
class CheckCommand extends BaseCommand {
  readonly name = "check";
  readonly description = "Get plan status and context based on stage";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    if (!planExists()) {
      return this.success({
        exists: false,
        stage: null,
        message: "No plan directory exists for this branch",
      });
    }

    const plan = readPlan();
    const userInput = readUserInput();
    const summary = readSummary();
    const prompts = readAllPrompts();

    // Default stage if plan doesn't exist yet
    const stage = plan?.frontMatter?.stage ?? "draft";

    // Build response based on stage
    const response: Record<string, unknown> = {
      exists: true,
      stage,
      branch,
    };

    if (stage === "draft" && userInput) {
      // Draft with user input: return user_input.md
      response.user_input = userInput;
    } else if (stage === "in_progress") {
      // In progress: return user_input, plan context, and prompt descriptions
      response.user_input = userInput;
      response.plan_context = plan?.content ?? null;
      response.prompts = prompts.map((p) => ({
        id: getPromptId(p.number, p.variant),
        description: p.frontMatter.description,
        status: p.frontMatter.status,
        kind: p.frontMatter.kind,
        depends_on: p.frontMatter.depends_on,
      }));
    } else if (stage === "completed") {
      // Completed: return summary
      response.summary = summary;
    }

    return this.success(response);
  }
}

/**
 * Create or update plan.md with front matter.
 */
class WritePlanCommand extends BaseCommand {
  readonly name = "write-plan";
  readonly description = "Create plan.md with YAML front matter";

  defineArguments(cmd: Command): void {
    cmd.option("--title <title>", "Plan title");
    cmd.option("--objective <objective>", "High-level objective");
    cmd.option("--context <context>", "Design doc style context");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const title = args.title as string | undefined;
    const objective = args.objective as string | undefined;
    const context = args.context as string | undefined;

    // Build content section
    const contentParts: string[] = [];
    if (title) {
      contentParts.push(`# ${title}\n`);
    }
    if (objective) {
      contentParts.push(`## Objective\n\n${objective}\n`);
    }
    if (context) {
      contentParts.push(`## Context\n\n${context}\n`);
    }

    const content = contentParts.join("\n");

    writePlan({ stage: "draft" }, content);

    return this.success({
      created: true,
      branch,
    });
  }
}

/**
 * Create or update a prompt file.
 */
class WritePromptCommand extends BaseCommand {
  readonly name = "write-prompt";
  readonly description = "Create prompt file with YAML front matter";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
    cmd.option("--files <files>", "Comma-separated relevant file paths");
    cmd.option("--depends-on <deps>", "Comma-separated prompt numbers this depends on");
    cmd.option("--debug", "Mark as debugging task");
    cmd.option("--criteria <criteria>", "Success criteria for the prompt");
    cmd.option("--context <context>", "Full approach and implementation notes");
    cmd.option("--requires-testing", "Flag if manual user testing required");
    cmd.option("--description <description>", "Human-readable summary");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    // Parse comma-separated values
    const files = args.files
      ? (args.files as string).split(",").map((f) => f.trim()).filter(Boolean)
      : [];
    const dependsOn = args.dependsOn
      ? (args.dependsOn as string).split(",").map((d) => parseInt(d.trim(), 10)).filter((n) => !isNaN(n))
      : [];

    const frontMatter: Partial<PromptFrontMatter> = {
      number,
      variant: variant || null,
      relevant_files: files,
      depends_on: dependsOn,
      kind: args.debug ? "debug" : "feature",
      success_criteria: (args.criteria as string) || "",
      requires_manual_testing: !!args.requiresTesting,
      description: (args.description as string) || "",
      planned_at: new Date().toISOString(),
    };

    const content = (args.context as string) || "# Approach & Plan\n\n";

    writePrompt(number, variant || null, frontMatter, content);

    return this.success({
      id: getPromptId(number, variant || null),
      created: true,
    });
  }
}

/**
 * Delete a prompt file.
 */
class ClearPromptCommand extends BaseCommand {
  readonly name = "clear-prompt";
  readonly description = "Delete a prompt file";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const id = getPromptId(number, variant || null);
    const deleted = deletePrompt(number, variant || null);

    if (deleted) {
      return this.success({
        id,
        deleted: true,
      });
    } else {
      return this.error("not_found", `Prompt ${id} not found`);
    }
  }
}

/**
 * Read a prompt file.
 */
class ReadPromptCommand extends BaseCommand {
  readonly name = "read-prompt";
  readonly description = "Read a prompt file";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const id = getPromptId(number, variant || null);
    const prompt = readPrompt(number, variant || null);
    if (!prompt) {
      return this.error("not_found", `Prompt ${id} not found`);
    }

    return this.success({
      id,
      front_matter: prompt.frontMatter,
      content: prompt.content,
    });
  }
}

/**
 * Get full plan context including all files.
 */
class GetFullPlanCommand extends BaseCommand {
  readonly name = "get-full-plan";
  readonly description = "Aggregate all plan files";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    if (!planExists()) {
      return this.error("no_plan", "No plan directory exists for this branch");
    }

    const plan = readPlan();
    const userInput = readUserInput();
    const summary = readSummary();
    const prompts = readAllPrompts();

    return this.success({
      branch,
      plan: plan
        ? {
            front_matter: plan.frontMatter,
            content: plan.content,
          }
        : null,
      user_input: userInput,
      summary,
      prompts: prompts.map((p) => ({
        id: getPromptId(p.number, p.variant),
        front_matter: p.frontMatter,
        content: p.content,
      })),
    });
  }
}

/**
 * Append content to user_input.md.
 */
class AppendUserInputCommand extends BaseCommand {
  readonly name = "append-user-input";
  readonly description = "Append content to user_input.md";

  defineArguments(cmd: Command): void {
    cmd.argument("<content>", "User input content to append");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const content = args.content as string;
    if (!content || !content.trim()) {
      return this.error("empty_content", "Content cannot be empty");
    }

    appendUserInputLib(content);

    return this.success({
      appended: true,
    });
  }
}

/**
 * Validate that all prompt dependencies are still valid (not stale).
 */
class ValidateDependenciesCommand extends BaseCommand {
  readonly name = "validate-dependencies";
  readonly description = "Check if prompt dependencies are stale";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    if (!planExists()) {
      return this.error("no_plan", "No plan directory exists for this branch");
    }

    const prompts = readAllPrompts();

    // Build map of prompt id -> planned_at
    const plannedAtMap = new Map<number, string>();
    for (const p of prompts) {
      // Use number as key (variants share dependency tracking with base)
      plannedAtMap.set(p.number, p.frontMatter.planned_at);
    }

    const stalePromptIds: string[] = [];

    for (const p of prompts) {
      const promptPlannedAt = new Date(p.frontMatter.planned_at).getTime();

      for (const depNum of p.frontMatter.depends_on) {
        const depPlannedAt = plannedAtMap.get(depNum);
        if (depPlannedAt) {
          const depTime = new Date(depPlannedAt).getTime();
          if (depTime > promptPlannedAt) {
            // Dependency was modified after this prompt was planned
            stalePromptIds.push(getPromptId(p.number, p.variant));
            break; // Only add once per prompt
          }
        }
      }
    }

    return this.success({
      valid: stalePromptIds.length === 0,
      stale_prompt_ids: stalePromptIds,
    });
  }
}

/**
 * Update prompt dependencies without changing planned_at.
 */
class UpdatePromptDependenciesCommand extends BaseCommand {
  readonly name = "update-prompt-dependencies";
  readonly description = "Update depends_on and bump planned_at to resolve staleness";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
    cmd.option("--depends-on <deps>", "Comma-separated prompt numbers this depends on");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const id = getPromptId(number, variant || null);

    // Read existing prompt
    const prompt = readPrompt(number, variant || null);
    if (!prompt) {
      return this.error("not_found", `Prompt ${id} not found`);
    }

    // Parse new depends_on
    const dependsOnStr = args.dependsOn as string | undefined;
    const newDependsOn = dependsOnStr
      ? dependsOnStr.split(",").map((d) => parseInt(d.trim(), 10)).filter((n) => !isNaN(n))
      : [];

    // Bump planned_at to resolve staleness when deps change
    const newPlannedAt = new Date().toISOString();

    // Update depends_on and planned_at
    const updatedFrontMatter = {
      ...prompt.frontMatter,
      depends_on: newDependsOn,
      planned_at: newPlannedAt,
    };

    writePrompt(number, variant || null, updatedFrontMatter, prompt.content);

    return this.success({
      id,
      depends_on: newDependsOn,
      planned_at: newPlannedAt,
      previous_planned_at: prompt.frontMatter.planned_at,
    });
  }
}

// ============================================================================
// Phase 5 Commands: Findings & Approaches
// ============================================================================

/**
 * Write a full findings file for a specialist.
 */
class WriteFindingCommand extends BaseCommand {
  readonly name = "write-finding";
  readonly description = "Create findings YAML for a specialist";

  defineArguments(cmd: Command): void {
    cmd.argument("<specialist_name>", "Specialist name (e.g., frontend, backend_1)");
    cmd.option("--notes <notes>", "Key practices, stack, technologies, APIs, dependencies");
    cmd.option("--approaches <approaches>", "JSON array of approaches");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const specialistName = args.specialist_name as string;
    if (!specialistName || !specialistName.trim()) {
      return this.error("invalid_specialist", "Specialist name cannot be empty");
    }

    const notes = (args.notes as string) || "";

    // Parse approaches JSON if provided
    let approaches: FindingApproach[] = [];
    if (args.approaches) {
      try {
        const parsed = JSON.parse(args.approaches as string) as Array<{
          number: number;
          description?: string;
          variant?: string;  // Variant letter (A, B, etc.) or null/undefined for primary
          context?: string;
          relevant_files?: string[];
          questions?: string[];
        }>;

        approaches = parsed.map((a) => ({
          number: a.number,
          variant: a.variant && /^[A-Z]$/.test(a.variant) ? a.variant : null,
          description: a.description || "",
          relevant_files: a.relevant_files || [],
          required_clarifying_questions: (a.questions || []).map((q: string) => ({ question: q })),
          user_requested_changes: "",
          approach_detail: a.context || "",
        }));
      } catch {
        return this.error("invalid_json", "Failed to parse approaches JSON");
      }
    }

    const findings: FindingsFile = {
      specialist_name: specialistName,
      notes,
      approaches,
    };

    writeFindings(specialistName, findings);

    return this.success({
      specialist: specialistName,
      created: true,
      approach_count: approaches.length,
    });
  }
}

/**
 * Write or update a single approach in a specialist's findings.
 */
class WriteApproachCommand extends BaseCommand {
  readonly name = "write-approach";
  readonly description = "Update findings file with a new approach";

  defineArguments(cmd: Command): void {
    cmd.argument("<specialist_name>", "Specialist name (e.g., frontend, backend_1)");
    cmd.argument("<approach_num>", "Approach number (integer)");
    cmd.option("--description <description>", "3 sentence description of what approach solves");
    cmd.option("--variant <letter>", "Variant letter (A, B, C, etc.) - makes this a variant of approach_num");
    cmd.option("--context <context>", "Full approach context with pseudocode and findings");
    cmd.option("--files <files>", "Comma-separated list of relevant file paths");
    cmd.option("--questions <questions>", "Pipe-separated clarifying questions");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const specialistName = args.specialist_name as string;
    if (!specialistName || !specialistName.trim()) {
      return this.error("invalid_specialist", "Specialist name cannot be empty");
    }

    const approachNum = parseInt(args.approach_num as string, 10);
    if (isNaN(approachNum) || approachNum < 1) {
      return this.error("invalid_number", "Approach number must be a positive integer");
    }

    // Parse variant letter
    const variantArg = args.variant as string | undefined;
    const variant = variantArg && /^[A-Z]$/.test(variantArg) ? variantArg : null;
    if (variantArg && !variant) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    // Read existing findings or create new
    let findings = readFindings(specialistName);
    if (!findings) {
      findings = {
        specialist_name: specialistName,
        notes: "",
        approaches: [],
      };
    }

    // Parse files
    const files = args.files
      ? (args.files as string).split(",").map((f) => f.trim()).filter(Boolean)
      : [];

    // Parse questions (pipe-separated)
    const questions = args.questions
      ? (args.questions as string).split("|").map((q) => ({ question: q.trim() })).filter((q) => q.question)
      : [];

    // Validate: standalone and variant approaches cannot coexist for same number
    const hasStandalone = findings.approaches.some(
      (a) => a.number === approachNum && a.variant === null
    );
    const existingVariants = findings.approaches.filter(
      (a) => a.number === approachNum && a.variant !== null
    );

    if (variant) {
      // Adding variant - check if standalone exists
      if (hasStandalone) {
        return this.error(
          "standalone_exists",
          `Approach ${approachNum} exists as standalone. Cannot add variant ${variant}.`,
          `Clear approach ${approachNum} first with clear-approach, or update it without --variant`
        );
      }
    } else {
      // Adding standalone - check if variants exist
      if (existingVariants.length > 0) {
        const variantList = existingVariants.map((v) => `${approachNum}_${v.variant}`).join(", ");
        return this.error(
          "variants_exist",
          `Variants exist for approach ${approachNum}: ${variantList}. Cannot add standalone.`,
          `Clear existing variants first with clear-approach, or add this as a variant with --variant`
        );
      }
    }

    // Build the approach
    const approach: FindingApproach = {
      number: approachNum,
      variant,
      description: (args.description as string) || "",
      relevant_files: files,
      required_clarifying_questions: questions,
      user_requested_changes: "", // Clear when overwriting
      approach_detail: (args.context as string) || "",
    };

    // Find and replace existing approach by number AND variant, or add new
    const existingIdx = findings.approaches.findIndex(
      (a) => a.number === approachNum && a.variant === variant
    );
    if (existingIdx >= 0) {
      findings.approaches[existingIdx] = approach;
    } else {
      findings.approaches.push(approach);
      // Sort by number, then by variant (null first, then alphabetically)
      findings.approaches.sort((a, b) => {
        if (a.number !== b.number) return a.number - b.number;
        if (!a.variant && b.variant) return -1;
        if (a.variant && !b.variant) return 1;
        return (a.variant || "").localeCompare(b.variant || "");
      });
    }

    writeFindings(specialistName, findings);

    const approachId = getApproachId(approachNum, variant);
    return this.success({
      specialist: specialistName,
      approach_id: approachId,
      approach_number: approachNum,
      variant: variant,
      updated: existingIdx >= 0,
      created: existingIdx < 0,
    });
  }
}

/**
 * Get a specific approach from a specialist's findings.
 */
class GetFindingApproachCommand extends BaseCommand {
  readonly name = "get-finding-approach";
  readonly description = "Get a specific approach from findings";

  defineArguments(cmd: Command): void {
    cmd.argument("<specialist_name>", "Specialist name");
    cmd.argument("<approach_num>", "Approach number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const specialistName = args.specialist_name as string;
    const approachNum = parseInt(args.approach_num as string, 10);
    const variantArg = args.variant as string | undefined;
    const variant = variantArg && /^[A-Z]$/.test(variantArg) ? variantArg : null;

    if (isNaN(approachNum) || approachNum < 1) {
      return this.error("invalid_number", "Approach number must be a positive integer");
    }

    if (variantArg && !variant) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const findings = readFindings(specialistName);
    if (!findings) {
      return this.error("not_found", `Findings not found for specialist: ${specialistName}`);
    }

    // Find approach by number AND variant
    const approach = findings.approaches.find(
      (a) => a.number === approachNum && a.variant === variant
    );
    const approachId = getApproachId(approachNum, variant);
    if (!approach) {
      return this.error("not_found", `Approach ${approachId} not found for specialist: ${specialistName}`);
    }

    // Filter to only answered questions (skip unanswered)
    const answeredQuestions = (approach.user_addressed_questions || [])
      .filter((qa) => qa.answer && qa.answer.trim());

    // Return only user-facing fields (stripEmpty will remove empties)
    return this.success({
      specialist: specialistName,
      approach_id: approachId,
      approach: {
        number: approach.number,
        variant: approach.variant,
        description: approach.description,
        relevant_files: approach.relevant_files,
        // Only return questions that have answers
        user_addressed_questions: answeredQuestions,
        user_requested_changes: approach.user_requested_changes,
        approach_detail: approach.approach_detail,
      },
    });
  }
}

/**
 * Clear/delete an approach from a specialist's findings.
 */
class ClearApproachCommand extends BaseCommand {
  readonly name = "clear-approach";
  readonly description = "Remove an approach from findings";

  defineArguments(cmd: Command): void {
    cmd.argument("<specialist_name>", "Specialist name");
    cmd.argument("<approach_num>", "Approach number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const specialistName = args.specialist_name as string;
    const approachNum = parseInt(args.approach_num as string, 10);
    const variantArg = args.variant as string | undefined;
    const variant = variantArg && /^[A-Z]$/.test(variantArg) ? variantArg : null;

    if (isNaN(approachNum) || approachNum < 1) {
      return this.error("invalid_number", "Approach number must be a positive integer");
    }

    if (variantArg && !variant) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const findings = readFindings(specialistName);
    if (!findings) {
      return this.error("not_found", `Findings not found for specialist: ${specialistName}`);
    }

    const approachId = getApproachId(approachNum, variant);
    const idx = findings.approaches.findIndex(
      (a) => a.number === approachNum && a.variant === variant
    );

    if (idx < 0) {
      return this.error("not_found", `Approach ${approachId} not found for specialist: ${specialistName}`);
    }

    findings.approaches.splice(idx, 1);
    writeFindings(specialistName, findings);

    return this.success({
      specialist: specialistName,
      cleared: approachId,
      remaining_count: findings.approaches.length,
    });
  }
}

/**
 * Get all findings across all specialists.
 */
class GetFindingsCommand extends BaseCommand {
  readonly name = "get-findings";
  readonly description = "Get all approaches across specialists";

  defineArguments(cmd: Command): void {
    cmd.option("--full", "Include full context and notes per specialist");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const full = !!args.full;
    const allFindings = readAllFindings();

    if (full) {
      // Return full context with notes (user-facing fields only)
      const specialists = allFindings.map((f) => ({
        specialist: f.specialist_name,
        notes: f.notes,
        approaches: f.approaches.map((a) => {
          // Filter to only answered questions
          const answeredQuestions = (a.user_addressed_questions || [])
            .filter((qa) => qa.answer && qa.answer.trim());
          return {
            approach_id: getApproachId(a.number, a.variant),
            number: a.number,
            variant: a.variant,
            description: a.description,
            relevant_files: a.relevant_files,
            user_addressed_questions: answeredQuestions,
            user_requested_changes: a.user_requested_changes,
            approach_detail: a.approach_detail,
          };
        }),
      }));

      return this.success({ specialists });
    }

    // Return summary only
    const approaches: Array<{
      specialist: string;
      approach_id: string;
      number: number;
      variant: string | null;
      description: string;
      relevant_files: string[];
    }> = [];

    for (const f of allFindings) {
      for (const a of f.approaches) {
        approaches.push({
          specialist: f.specialist_name,
          approach_id: getApproachId(a.number, a.variant),
          number: a.number,
          variant: a.variant,
          description: a.description,
          relevant_files: a.relevant_files,
        });
      }
    }

    return this.success({ approaches });
  }
}

/**
 * Read the design manifest.
 */
class ReadDesignManifestCommand extends BaseCommand {
  readonly name = "read-design-manifest";
  readonly description = "Read design manifest with file descriptions";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const manifest = readDesignManifest();
    if (!manifest) {
      return this.success({
        exists: false,
        designs: [],
      });
    }

    return this.success({
      exists: true,
      designs: manifest.designs.map((d) => ({
        file: d.screenshot_file_name,
        description: d.description,
      })),
    });
  }
}

// ============================================================================
// Phase 6 Commands: Prompt Lifecycle
// ============================================================================

/**
 * Get next available prompts respecting dependencies.
 */
class NextCommand extends BaseCommand {
  readonly name = "next";
  readonly description = "Get next available prompts respecting dependencies";

  defineArguments(cmd: Command): void {
    cmd.option("-n <count>", "Number of independent prompts to return");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    if (!planExists()) {
      return this.error("no_plan", "No plan directory exists for this branch");
    }

    // Get count from args, env var, or default to 1
    const countArg = args.n as string | undefined;
    const envCount = process.env.N_PARALLEL_WORKERS;
    const count = countArg
      ? parseInt(countArg, 10)
      : envCount
        ? parseInt(envCount, 10)
        : 1;

    if (isNaN(count) || count < 1) {
      return this.error("invalid_count", "Count must be a positive integer");
    }

    const prompts = readAllPrompts();

    // Build set of merged prompt numbers
    const mergedNumbers = new Set<number>();
    for (const p of prompts) {
      if (p.frontMatter.status === "merged") {
        mergedNumbers.add(p.number);
      }
    }

    // Find prompts that can be worked on (not merged, not in_progress, deps satisfied)
    const availablePrompts: Array<{
      number: number;
      variant: string | null;
      frontMatter: PromptFrontMatter;
      content: string;
    }> = [];

    for (const p of prompts) {
      // Skip already merged or in_progress
      if (p.frontMatter.status === "merged" || p.frontMatter.in_progress) {
        continue;
      }

      // Check all dependencies are merged
      const depsAreMerged = p.frontMatter.depends_on.every((dep) => mergedNumbers.has(dep));
      if (!depsAreMerged) {
        continue;
      }

      availablePrompts.push(p);
    }

    // Sort: debug prompts first, then by number, then by variant
    availablePrompts.sort((a, b) => {
      // Debug prompts first
      const aDebug = a.frontMatter.kind === "debug" ? 0 : 1;
      const bDebug = b.frontMatter.kind === "debug" ? 0 : 1;
      if (aDebug !== bDebug) return aDebug - bDebug;

      // Then by number
      if (a.number !== b.number) return a.number - b.number;

      // Then by variant (null first, then alphabetically)
      if (!a.variant && b.variant) return -1;
      if (a.variant && !b.variant) return 1;
      return (a.variant || "").localeCompare(b.variant || "");
    });

    // Select up to count prompts, pulling all variants when one is selected
    const selectedNumbers = new Set<number>();
    const selected: typeof availablePrompts = [];

    for (const p of availablePrompts) {
      if (selectedNumbers.size >= count && !selectedNumbers.has(p.number)) {
        break;
      }
      selectedNumbers.add(p.number);
      selected.push(p);
    }

    // Format response
    const result = selected.map((p) => ({
      prompt_num: p.number,
      variant: p.variant,
      description: p.frontMatter.description,
      relevant_files: p.frontMatter.relevant_files,
      kind: p.frontMatter.kind,
    }));

    return this.success({
      prompts: result,
      count: result.length,
      requested: count,
    });
  }
}

/**
 * Start working on a prompt - set in_progress and tracking info.
 */
class StartPromptCommand extends BaseCommand {
  readonly name = "start-prompt";
  readonly description = "Start working on a prompt";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
    cmd.option("--specialist <name>", "Name of the specialist/agent working on this prompt");
    cmd.option("--worktree <branch>", "Worktree branch name for tracking");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const id = getPromptId(number, variant || null);
    const prompt = readPrompt(number, variant || null);
    if (!prompt) {
      return this.error("not_found", `Prompt ${id} not found`);
    }

    const specialist = args.specialist as string | undefined;
    const worktree = args.worktree as string | undefined;

    // Update prompt front matter
    const updatedFrontMatter: PromptFrontMatter = {
      ...prompt.frontMatter,
      in_progress: true,
      current_iteration: 1,
      delegated_to: (specialist as PromptFrontMatter["delegated_to"]) || null,
      worktree_branch_name: worktree || null,
    };

    writePrompt(number, variant || null, updatedFrontMatter, prompt.content);

    return this.success({
      id,
      in_progress: true,
      specialist: specialist || null,
      worktree: worktree || null,
      current_iteration: 1,
    });
  }
}

/**
 * Record implementation walkthrough for a prompt.
 */
class RecordImplementationCommand extends BaseCommand {
  readonly name = "record-implementation";
  readonly description = "Record implementation walkthrough for a prompt";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
    cmd.option("--walkthrough <walkthrough>", "Structured walkthrough markdown");
    cmd.option("--iteration <n>", "Iteration number (1 for initial, 2+ for refinements)");
    cmd.option("--refinement-reason <reason>", "Context for why this iteration was needed");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const id = getPromptId(number, variant || null);
    const prompt = readPrompt(number, variant || null);
    if (!prompt) {
      return this.error("not_found", `Prompt ${id} not found`);
    }

    const walkthrough = args.walkthrough as string | undefined;
    if (!walkthrough) {
      return this.error("missing_walkthrough", "Walkthrough is required");
    }

    const iterationStr = args.iteration as string | undefined;
    const iteration = iterationStr ? parseInt(iterationStr, 10) : 1;
    if (isNaN(iteration) || iteration < 1) {
      return this.error("invalid_iteration", "Iteration must be a positive integer");
    }

    const refinementReason = args.refinementReason as string | undefined;
    if (iteration > 1 && !refinementReason) {
      return this.error("missing_refinement_reason", "Refinement reason is required for iteration > 1");
    }

    // Parse walkthrough into structured format
    // Expected format has ### Iteration, **Type**, #### Approach, #### Changes Made, #### Key Decisions
    const walkthroughEntry: PromptFrontMatter["walkthrough"][0] = {
      iteration,
      type: iteration === 1 ? "initial" : "review-refinement",
      refinement_reason: refinementReason || null,
      approach: walkthrough,
      changes: [],
      decisions: [],
    };

    // Append to existing walkthrough
    const existingWalkthrough = prompt.frontMatter.walkthrough || [];
    const updatedWalkthrough = [...existingWalkthrough, walkthroughEntry];

    const updatedFrontMatter: PromptFrontMatter = {
      ...prompt.frontMatter,
      status: "implemented",
      current_iteration: iteration,
      walkthrough: updatedWalkthrough,
    };

    writePrompt(number, variant || null, updatedFrontMatter, prompt.content);

    return this.success({
      id,
      status: "implemented",
      iteration,
      walkthrough_count: updatedWalkthrough.length,
    });
  }
}

/**
 * Complete a prompt - set status to merged.
 */
class CompletePromptCommand extends BaseCommand {
  readonly name = "complete-prompt";
  readonly description = "Complete a prompt (set status to merged)";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const id = getPromptId(number, variant || null);
    const prompt = readPrompt(number, variant || null);
    if (!prompt) {
      return this.error("not_found", `Prompt ${id} not found`);
    }

    const updatedFrontMatter: PromptFrontMatter = {
      ...prompt.frontMatter,
      status: "merged",
      in_progress: false,
    };

    writePrompt(number, variant || null, updatedFrontMatter, prompt.content);

    return this.success({
      id,
      status: "merged",
    });
  }
}

/**
 * Get prompt walkthrough for documentation extraction.
 */
class GetPromptWalkthroughCommand extends BaseCommand {
  readonly name = "get-prompt-walkthrough";
  readonly description = "Get prompt walkthrough for documentation extraction";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const id = getPromptId(number, variant || null);
    const prompt = readPrompt(number, variant || null);
    if (!prompt) {
      return this.error("not_found", `Prompt ${id} not found`);
    }

    // Get git diff summary for this prompt's changes
    // If merge_commit_hash exists, show that merge commit's changes (precise)
    // Otherwise fall back to diffing relevant files vs base branch (imprecise)
    let gitDiffSummary = "";
    const mergeCommit = prompt.frontMatter.merge_commit_hash;
    const relevantFiles = prompt.frontMatter.relevant_files || [];

    if (mergeCommit) {
      // Show changes introduced by the merge commit (precise for this prompt)
      try {
        const result = spawnSync(
          "git",
          ["diff", "--stat", `${mergeCommit}^..${mergeCommit}`],
          { encoding: "utf-8" }
        );
        gitDiffSummary = result.stdout || "(No changes in merge commit)";
      } catch {
        gitDiffSummary = "(Unable to get merge commit diff)";
      }
    } else if (relevantFiles.length > 0) {
      // Fallback: diff relevant files vs base (may include other prompts' changes)
      try {
        const baseBranch = getBaseBranch();
        const result = spawnSync(
          "git",
          ["diff", "--stat", baseBranch, "--", ...relevantFiles],
          { encoding: "utf-8" }
        );
        gitDiffSummary = result.stdout || "(No changes)";
      } catch {
        gitDiffSummary = "(Unable to get diff)";
      }
    }

    return this.success({
      prompt_num: number,
      variant: variant || null,
      description: prompt.frontMatter.description,
      success_criteria: prompt.frontMatter.success_criteria,
      walkthrough: prompt.frontMatter.walkthrough || [],
      git_diff_summary: gitDiffSummary,
      merge_commit_hash: mergeCommit || null,
    });
  }
}

/**
 * Mark a prompt as having its documentation extracted.
 */
class MarkPromptExtractedCommand extends BaseCommand {
  readonly name = "mark-prompt-extracted";
  readonly description = "Mark prompt documentation as extracted";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const id = getPromptId(number, variant || null);
    const prompt = readPrompt(number, variant || null);
    if (!prompt) {
      return this.error("not_found", `Prompt ${id} not found`);
    }

    const updatedFrontMatter: PromptFrontMatter = {
      ...prompt.frontMatter,
      documentation_extracted: true,
    };

    writePrompt(number, variant || null, updatedFrontMatter, prompt.content);

    return this.success({
      id,
      documentation_extracted: true,
    });
  }
}

/**
 * Release all prompts from in_progress status.
 */
class ReleaseAllPromptsCommand extends BaseCommand {
  readonly name = "release-all-prompts";
  readonly description = "Release all prompts from in_progress status";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    if (!planExists()) {
      return this.error("no_plan", "No plan directory exists for this branch");
    }

    const prompts = readAllPrompts();
    let releasedCount = 0;

    for (const p of prompts) {
      if (p.frontMatter.in_progress) {
        const updatedFrontMatter: PromptFrontMatter = {
          ...p.frontMatter,
          in_progress: false,
        };
        writePrompt(p.number, p.variant, updatedFrontMatter, p.content);
        releasedCount++;
      }
    }

    return this.success({
      released_count: releasedCount,
      total_prompts: prompts.length,
    });
  }
}

/**
 * Complete the plan - generate summary, create PR.
 */
class CompleteCommand extends BaseCommand {
  readonly name = "complete";
  readonly description = "Complete the plan - generate summary and create PR";

  private readonly SUMMARY_PROMPT = `You are a technical writer creating a pull request summary.

Given a plan, implementation walkthroughs, user input, and git diff, generate a clear PR description.

Format:
## Summary
[1-3 bullet points summarizing what was implemented]

## Changes
[Grouped by area/feature, list major changes]

## Testing
[How to test these changes]

## Notes
[Any additional context, breaking changes, or follow-up items]`;

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    if (!planExists()) {
      return this.error("no_plan", "No plan directory exists for this branch");
    }

    const apiKey = process.env.VERTEX_API_KEY;
    if (!apiKey) {
      return this.error("auth_error", "VERTEX_API_KEY not set");
    }

    // Gather context
    const plan = readPlan();
    const userInput = readUserInput();
    const prompts = readAllPrompts();
    const baseBranch = getBaseBranch();
    const diff = getDiff(baseBranch);

    // Build context for summary generation
    const promptSummaries = prompts.map((p) => {
      const id = getPromptId(p.number, p.variant);
      const walkthrough = p.frontMatter.walkthrough || [];
      return `### Prompt ${id}: ${p.frontMatter.description}
Status: ${p.frontMatter.status}
Iterations: ${walkthrough.length}
${walkthrough.map((w) => `- Iteration ${w.iteration} (${w.type}): ${w.approach.substring(0, 200)}...`).join("\n")}`;
    }).join("\n\n");

    const fullPrompt = `${this.SUMMARY_PROMPT}

## Plan
${plan?.content || "(No plan content)"}

## User Input
${userInput || "(No user input)"}

## Prompts Implemented
${promptSummaries}

## Git Diff (against ${baseBranch})
\`\`\`diff
${diff.substring(0, 50000)}
\`\`\`

Generate the PR summary now.`;

    try {
      // Generate summary with Gemini
      const [summary, durationMs] = await this.timedExecute(async () => {
        const client = new GoogleGenAI({ vertexai: true, apiKey });
        const result = await client.models.generateContent({
          model: "gemini-2.0-flash",
          contents: fullPrompt,
        });
        return result.text ?? "";
      });

      // Write summary
      writeSummary(summary);

      // Update plan stage to completed
      updatePlanStage("completed");

      // Push to remote
      try {
        execSync(`git push -u origin ${branch}`, { encoding: "utf-8", stdio: "pipe" });
      } catch (e) {
        // Push might fail if already up to date or no remote
      }

      // Create PR using gh CLI
      let prUrl = "";
      try {
        const prResult = spawnSync(
          "gh",
          [
            "pr",
            "create",
            "--title",
            plan?.frontMatter?.branch_name || branch,
            "--body",
            summary,
            "--base",
            baseBranch,
          ],
          { encoding: "utf-8" }
        );
        if (prResult.status === 0) {
          prUrl = prResult.stdout.trim();
        } else {
          // PR might already exist, try to get URL
          const viewResult = spawnSync("gh", ["pr", "view", "--json", "url"], {
            encoding: "utf-8",
          });
          if (viewResult.status === 0) {
            const parsed = JSON.parse(viewResult.stdout);
            prUrl = parsed.url || "";
          }
        }
      } catch {
        // gh CLI might not be available
      }

      return this.success(
        {
          success: true,
          pr_url: prUrl,
          summary_written: true,
          stage: "completed",
        },
        {
          command: "plan complete",
          duration_ms: durationMs,
        }
      );
    } catch (e) {
      return this.error("api_error", e instanceof Error ? e.message : String(e));
    }
  }
}

// ============================================================================
// Phase 7 Commands: Blocking Gates
// ============================================================================

/**
 * Default timeout for blocking gates: 12 hours in milliseconds.
 * Can be overridden via BLOCKING_GATE_TIMEOUT_MS environment variable.
 */
const DEFAULT_BLOCKING_GATE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours

function getBlockingGateTimeout(): number {
  const envTimeout = process.env.BLOCKING_GATE_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_BLOCKING_GATE_TIMEOUT_MS;
}

/**
 * Block for findings gate - user reviews specialist approaches before planning.
 */
class BlockFindingsGateCommand extends BaseCommand {
  readonly name = "block-findings-gate";
  readonly description = "Block until user reviews findings and approaches";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    if (!planExists()) {
      return this.error("no_plan", "No plan directory exists for this branch");
    }

    // Gather all findings and approaches
    const allFindings = readAllFindings();
    if (allFindings.length === 0) {
      return this.success({
        skipped: true,
        reason: "No findings to review",
        thoughts: "",
        affected_approaches: [],
      });
    }

    // Build approach feedback structure with clarifying questions
    // Key format: {specialist}_{number} or {specialist}_{number}_{variant}
    // Only include rejected field for variant approaches (variant !== null)
    // Only include question_answers if there are questions
    const approachFeedback: Record<string, { user_required_changes: string; rejected?: boolean; question_answers?: Array<{ question: string; answer: string }> }> = {};

    for (const findings of allFindings) {
      for (const approach of findings.approaches) {
        // Key: specialist_number or specialist_number_variant
        const approachId = getApproachId(approach.number, approach.variant);
        const key = `${findings.specialist_name}_${approachId}`;
        const entry: { user_required_changes: string; rejected?: boolean; question_answers?: Array<{ question: string; answer: string }> } = {
          user_required_changes: "",
        };

        // Only add rejected field for variant approaches (variant !== null)
        if (approach.variant !== null) {
          entry.rejected = false;
        }

        // Only add question_answers if there are questions
        if (approach.required_clarifying_questions.length > 0) {
          entry.question_answers = approach.required_clarifying_questions.map((q) => ({
            question: q.question,
            answer: "",
          }));
        }

        approachFeedback[key] = entry;
      }
    }

    // Create feedback file
    const filePath = writeFindingsGateFeedback(approachFeedback);

    // Block until done: true (with timeout)
    const watchResult = await watchForDone(filePath, getBlockingGateTimeout());
    const feedback = readFindingsGateFeedback();

    if (!feedback.success) {
      return this.error("invalid_feedback", feedback.error);
    }

    const data = feedback.data;

    // Validate: at least one variant per approach number must NOT be rejected
    // Group variant approaches by specialist + approach number
    const variantGroups: Record<string, { key: string; variant: string; rejected: boolean }[]> = {};
    for (const [key, value] of Object.entries(data.approach_feedback || {})) {
      const match = key.match(/^(.+)_(\d+)(?:_([A-Z]))?$/);
      if (!match) continue;
      const specialist = match[1];
      const approachNum = match[2];
      const variant = match[3];
      if (variant) {
        // This is a variant approach
        const groupKey = `${specialist}_${approachNum}`;
        if (!variantGroups[groupKey]) variantGroups[groupKey] = [];
        variantGroups[groupKey].push({ key, variant, rejected: !!value.rejected });
      }
    }
    // Check each group has at least one non-rejected variant
    for (const [groupKey, variants] of Object.entries(variantGroups)) {
      const allRejected = variants.every((v) => v.rejected);
      if (allRejected) {
        const variantList = variants.map((v) => v.variant).join(", ");
        return this.error(
          "all_variants_rejected",
          `All variants (${variantList}) for ${groupKey} are rejected. At least one variant must be kept.`,
          `Set rejected: false for at least one variant of ${groupKey}`
        );
      }
    }

    // Append thoughts to user_input.md if non-empty
    if (data.thoughts && data.thoughts.trim()) {
      appendUserInputLib(`[Findings Gate]\n${data.thoughts}`);
    }

    // Process approach feedback (user_required_changes, question answers, rejections)
    const affectedApproaches: Array<{ specialist_name: string; approach_id: string }> = [];
    const rejectedApproaches: Array<{ specialist_name: string; approach_id: string }> = [];

    for (const [key, value] of Object.entries(data.approach_feedback || {})) {
      // Parse key: specialist_number or specialist_number_variant
      // Format: {specialist}_{number} or {specialist}_{number}_{variant}
      const match = key.match(/^(.+)_(\d+)(?:_([A-Z]))?$/);
      if (!match) continue;

      const specialist = match[1];
      const approachNum = parseInt(match[2], 10);
      const variant = match[3] || null;
      const approachId = getApproachId(approachNum, variant);

      // Handle rejection (inline per approach)
      if (value.rejected) {
        deleteApproach(specialist, approachNum, variant);
        rejectedApproaches.push({ specialist_name: specialist, approach_id: approachId });
        continue; // Skip other processing for rejected approaches
      }

      // Check if there's any meaningful feedback
      const hasChanges = value.user_required_changes && value.user_required_changes.trim();
      const hasAnswers = value.question_answers?.some((qa) => qa.answer && qa.answer.trim());

      if (hasChanges || hasAnswers) {
        // Update findings with user requested changes and/or question answers
        const answeredQs = value.question_answers?.filter((qa) => qa.answer && qa.answer.trim()) ?? [];
        updateApproachFeedback(specialist, approachNum, variant, {
          userRequestedChanges: hasChanges ? value.user_required_changes : undefined,
          questionAnswers: hasAnswers ? answeredQs : undefined,
        });

        // Append to user_input.md for audit trail
        if (hasChanges) {
          appendUserInputLib(`[User Required Changes for ${specialist} approach ${approachId}]\n${value.user_required_changes}`);
        }
        if (hasAnswers && answeredQs.length > 0) {
          const formattedQs = answeredQs
            .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
            .join("\n\n");
          appendUserInputLib(`[User Addressed Questions for ${specialist} approach ${approachId}]\n${formattedQs}`);
        }

        affectedApproaches.push({ specialist_name: specialist, approach_id: approachId });
      }
    }

    // Post-process: If only one variant remains for an approach number, strip the variant letter
    // Group remaining approaches by specialist
    const specialistsToCheck = new Set<string>();
    for (const { specialist_name } of [...affectedApproaches, ...rejectedApproaches]) {
      specialistsToCheck.add(specialist_name);
    }
    for (const specialist of specialistsToCheck) {
      const findings = readFindings(specialist);
      if (!findings) continue;

      // Group by approach number
      const byNumber: Record<number, FindingApproach[]> = {};
      for (const approach of findings.approaches) {
        if (!byNumber[approach.number]) byNumber[approach.number] = [];
        byNumber[approach.number].push(approach);
      }

      // Check for single-variant groups and strip variant
      let modified = false;
      for (const [_numStr, approaches] of Object.entries(byNumber)) {
        // If exactly one approach and it has a variant, strip the variant
        if (approaches.length === 1 && approaches[0].variant !== null) {
          const oldId = getApproachId(approaches[0].number, approaches[0].variant);
          approaches[0].variant = null;
          modified = true;
          // Update affected_approaches to reflect the new ID
          const affectedIdx = affectedApproaches.findIndex(
            (a) => a.specialist_name === specialist && a.approach_id === oldId
          );
          if (affectedIdx >= 0) {
            affectedApproaches[affectedIdx].approach_id = getApproachId(approaches[0].number, null);
          }
        }
      }

      if (modified) {
        writeFindings(specialist, findings);
      }
    }

    // Delete the feedback file
    deleteFeedbackFile("findings_gate");

    return this.success({
      thoughts: data.thoughts || "",
      affected_approaches: affectedApproaches,
      rejected_approaches: rejectedApproaches,
      duration_ms: watchResult.duration_ms,
    });
  }
}

/**
 * Block for plan gate - user reviews plan and prompts before implementation.
 */
class BlockPlanGateCommand extends BaseCommand {
  readonly name = "block-plan-gate";
  readonly description = "Block until user reviews plan and prompts";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    if (!planExists()) {
      return this.error("no_plan", "No plan directory exists for this branch");
    }

    // Get all prompt IDs
    const prompts = readAllPrompts();
    if (prompts.length === 0) {
      return this.error(
        "no_prompts",
        "No prompts exist to review. Create prompts with write-prompt first.",
        "Run: envoy plan write-prompt <number> ..."
      );
    }
    const promptIds = prompts.map((p) => getPromptId(p.number, p.variant));

    // Create feedback file
    const filePath = writePlanGateFeedback(promptIds);

    // Block until done: true (with timeout)
    const watchResult = await watchForDone(filePath, getBlockingGateTimeout());
    const feedback = readPlanGateFeedback();

    if (!feedback.success) {
      return this.error("invalid_feedback", feedback.error);
    }

    const data = feedback.data;

    // Append thoughts to user_input.md if non-empty
    if (data.thoughts && data.thoughts.trim()) {
      appendUserInputLib(`[Plan Gate]\n${data.thoughts}`);
    }

    // Append user_required_plan_changes to user_input.md if non-empty
    if (data.user_required_plan_changes && data.user_required_plan_changes.trim()) {
      appendUserInputLib(`[User Required Plan Changes]\n${data.user_required_plan_changes}`);
    }

    // Collect prompt changes
    const promptChanges: Array<{ prompt_id: string; user_required_changes: string }> = [];
    for (const [id, value] of Object.entries(data.prompt_feedback || {})) {
      if (value.user_required_changes && value.user_required_changes.trim()) {
        appendUserInputLib(`[User Required Changes for Prompt ${id}]\n${value.user_required_changes}`);
        promptChanges.push({ prompt_id: id, user_required_changes: value.user_required_changes });
      }
    }

    const hasChanges = !!(
      (data.user_required_plan_changes && data.user_required_plan_changes.trim()) ||
      promptChanges.length > 0
    );

    // Only archive findings when user approves with NO changes
    // If changes requested, agent will refine and re-run gate
    let archivedFindings: string[] = [];
    if (!hasChanges) {
      const archiveResult = archiveFindings();
      if (archiveResult.error) {
        return this.error("archive_error", archiveResult.error);
      }
      archivedFindings = archiveResult.archived;
    }

    // Delete the feedback file
    deleteFeedbackFile("plan_gate");

    return this.success({
      thoughts: data.thoughts || "",
      has_user_required_changes: hasChanges,
      user_required_plan_changes: data.user_required_plan_changes || "",
      prompt_changes: promptChanges,
      archived_findings: archivedFindings,
      duration_ms: watchResult.duration_ms,
    });
  }
}

/**
 * Block for prompt testing gate - user tests implementation manually.
 */
class BlockPromptTestingGateCommand extends BaseCommand {
  readonly name = "block-prompt-testing-gate";
  readonly description = "Block until user completes manual testing";

  defineArguments(cmd: Command): void {
    cmd.argument("<prompt_num>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const promptNum = parseInt(args.prompt_num as string, 10);
    if (isNaN(promptNum) || promptNum < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    // Verify prompt exists
    const prompt = readPrompt(promptNum, variant || null);
    if (!prompt) {
      const id = getPromptId(promptNum, variant || null);
      return this.error("not_found", `Prompt ${id} not found`);
    }

    // Verify prompt is in implemented or reviewed status
    const status = prompt.frontMatter.status;
    if (status !== "implemented" && status !== "reviewed") {
      const id = getPromptId(promptNum, variant || null);
      return this.error(
        "invalid_status",
        `Prompt ${id} is in '${status}' status. Must be 'implemented' or 'reviewed' for testing.`,
        "Complete implementation first with: envoy plan complete-prompt <number>"
      );
    }

    // Create feedback files (YAML + sibling log file)
    const { yamlPath, logsPath } = writeTestingGateFeedback(promptNum, variant || null);

    // Block until done: true (with timeout)
    const watchResult = await watchForDone(yamlPath, getBlockingGateTimeout());
    const feedback = readTestingGateFeedback(promptNum, variant || null);

    if (!feedback.success) {
      return this.error("invalid_feedback", feedback.error);
    }

    const data = feedback.data;

    // Check token count on log file
    const tokenResult = getFileTokenCount(logsPath);
    if (tokenResult.success) {
      const maxTokens = getMaxLogTokens();
      if (tokenResult.tokenCount > maxTokens) {
        // Token limit exceeded - reset done flag and return error
        resetTestingGateDone(promptNum, variant || null);
        return this.error(
          "logs_too_large",
          `Log file has ${tokenResult.tokenCount} tokens, max allowed is ${maxTokens}. Please reduce log size and set done: true again.`,
          `Current: ${tokenResult.tokenCount} tokens, Max: ${maxTokens} tokens`
        );
      }
    }

    // Append thoughts to user_input.md if non-empty
    if (data.thoughts && data.thoughts.trim()) {
      const id = getPromptId(promptNum, variant || null);
      appendUserInputLib(`[Testing Gate ${id}]\n${data.thoughts}`);
    }

    // Delete the feedback files
    const feedbackId = variant ? `${promptNum}_${variant}_testing` : `${promptNum}_testing`;
    deleteFeedbackFile(feedbackId);

    if (data.test_passed === false) {
      // Test failed - append user_required_changes to user_input.md
      if (data.user_required_changes && data.user_required_changes.trim()) {
        const id = getPromptId(promptNum, variant || null);
        appendUserInputLib(`[User Required Changes for ${id}]\n${data.user_required_changes}`);
      }

      return this.success({
        thoughts: data.thoughts || "",
        passed: false,
        user_required_changes: data.user_required_changes || "",
        logs: data.logs || "",
        duration_ms: watchResult.duration_ms,
      });
    }

    // Test passed - update prompt status to tested
    updatePromptStatus(promptNum, variant || null, "tested");

    return this.success({
      thoughts: data.thoughts || "",
      passed: true,
      logs: data.logs || "",
      duration_ms: watchResult.duration_ms,
    });
  }
}

/**
 * Block for variant selection gate - user chooses between variants after all tested.
 */
class BlockPromptVariantsGateCommand extends BaseCommand {
  readonly name = "block-prompt-variants-gate";
  readonly description = "Block until user selects variant";

  defineArguments(cmd: Command): void {
    cmd.argument("<prompt_num>", "Prompt number (integer)");
    cmd.argument("<variant>", "Variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const promptNum = parseInt(args.prompt_num as string, 10);
    if (isNaN(promptNum) || promptNum < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string;
    if (!variant || !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    // Verify this is a variant prompt
    const prompt = readPrompt(promptNum, variant);
    if (!prompt) {
      return this.error("not_found", `Prompt ${promptNum}_${variant} not found`);
    }

    if (!prompt.frontMatter.variant) {
      return this.success({
        skipped: true,
        reason: "Not a variant prompt",
        variant_solution: null,
        reason_text: "",
      });
    }

    // Find all variants for this prompt number
    const allPrompts = listPrompts();
    const variantLetters = allPrompts
      .filter((p) => p.number === promptNum && p.variant)
      .map((p) => p.variant as string)
      .sort();

    if (variantLetters.length < 2) {
      return this.success({
        skipped: true,
        reason: "Only one variant exists",
        variant_solution: null,
        reason_text: "",
      });
    }

    // Create feedback file (only creates if doesn't exist)
    const filePath = writeVariantsGateFeedback(promptNum, variantLetters);

    // Block until done: true (with timeout)
    const watchResult = await watchForDone(filePath, getBlockingGateTimeout());
    const feedback = readVariantsGateFeedback(promptNum);

    if (!feedback.success) {
      return this.error("invalid_feedback", feedback.error);
    }

    const data = feedback.data;

    // Append thoughts to user_input.md if non-empty
    if (data.thoughts && data.thoughts.trim()) {
      appendUserInputLib(`[Variants Gate ${promptNum}]\n${data.thoughts}`);
    }

    // Process variant decisions
    for (const [letter, decision] of Object.entries(data.variants)) {
      if (decision.decision) {
        // Map decision to variant_solution
        let variantSolution: PromptFrontMatter["variant_solution"] = null;
        if (decision.decision === "accepted") {
          variantSolution = "accept";
        } else if (decision.decision === "rejected") {
          variantSolution = "discard";
        } else if (decision.decision === "feature-flag") {
          variantSolution = "feature-flag";
        }

        // Update prompt
        updatePromptVariantSolution(promptNum, letter, variantSolution);

        // Delete rejected prompts
        if (decision.decision === "rejected") {
          deletePrompt(promptNum, letter);
        }
      }
    }

    // Delete the feedback file
    deleteFeedbackFile(`${promptNum}_variants`);

    // Return this variant's decision
    const thisDecision = data.variants[variant];
    let variantSolution: string | null = null;
    if (thisDecision?.decision === "accepted") {
      variantSolution = "accepted";
    } else if (thisDecision?.decision === "rejected") {
      variantSolution = "rejected";
    } else if (thisDecision?.decision === "feature-flag") {
      variantSolution = "feature-flag";
    }

    return this.success({
      thoughts: data.thoughts || "",
      variant_solution: variantSolution,
      reason: thisDecision?.reason || "",
      duration_ms: watchResult.duration_ms,
    });
  }
}

/**
 * Block for debugging logging gate - user captures debug output.
 */
class BlockDebuggingLoggingGateCommand extends BaseCommand {
  readonly name = "block-debugging-logging-gate";
  readonly description = "Block until user captures debug logs";

  defineArguments(cmd: Command): void {
    cmd.argument("<prompt_num>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const promptNum = parseInt(args.prompt_num as string, 10);
    if (isNaN(promptNum) || promptNum < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    // Verify prompt exists
    const prompt = readPrompt(promptNum, variant || null);
    if (!prompt) {
      const id = getPromptId(promptNum, variant || null);
      return this.error("not_found", `Prompt ${id} not found`);
    }

    // Verify prompt is debug kind
    if (prompt.frontMatter.kind !== "debug") {
      const id = getPromptId(promptNum, variant || null);
      return this.error(
        "not_debug",
        `Prompt ${id} is '${prompt.frontMatter.kind}' kind. Logging gate only applies to 'debug' prompts.`,
        "Use block-prompt-testing-gate for feature prompts"
      );
    }

    // Create feedback files (YAML + sibling log file)
    const { yamlPath, logsPath } = writeLoggingGateFeedback(promptNum, variant || null);

    // Block until done: true (with timeout)
    const watchResult = await watchForDone(yamlPath, getBlockingGateTimeout());
    const feedback = readLoggingGateFeedback(promptNum, variant || null);

    if (!feedback.success) {
      return this.error("invalid_feedback", feedback.error);
    }

    const data = feedback.data;

    // Check token count on log file
    const tokenResult = getFileTokenCount(logsPath);
    if (tokenResult.success) {
      const maxTokens = getMaxLogTokens();
      if (tokenResult.tokenCount > maxTokens) {
        // Token limit exceeded - reset done flag and return error
        resetLoggingGateDone(promptNum, variant || null);
        return this.error(
          "logs_too_large",
          `Log file has ${tokenResult.tokenCount} tokens, max allowed is ${maxTokens}. Please reduce log size and set done: true again.`,
          `Current: ${tokenResult.tokenCount} tokens, Max: ${maxTokens} tokens`
        );
      }
    }

    // Append thoughts to user_input.md if non-empty
    if (data.thoughts && data.thoughts.trim()) {
      const id = getPromptId(promptNum, variant || null);
      appendUserInputLib(`[Logging Gate ${id}]\n${data.thoughts}`);
    }

    // Delete the feedback files
    const feedbackId = variant ? `${promptNum}_${variant}_logging` : `${promptNum}_logging`;
    deleteFeedbackFile(feedbackId);

    return this.success({
      thoughts: data.thoughts || "",
      logs: data.logs || "",
      duration_ms: watchResult.duration_ms,
    });
  }
}

// ============================================================================
// Phase 9 Commands: Protocol System
// ============================================================================

/**
 * Read and output a protocol with inheritance support.
 */
class ProtocolCommand extends BaseCommand {
  readonly name = "protocol";
  readonly description = "Output protocol steps with inheritance resolved";

  defineArguments(cmd: Command): void {
    cmd.argument("<name>", "Protocol name (implementation, debugging, discovery, bug-discovery)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const name = args.name as string;
    if (!name || !name.trim()) {
      return this.error("invalid_name", "Protocol name cannot be empty");
    }

    const protocol = resolveProtocol(name);
    if (!protocol) {
      const available = listProtocols();
      return this.error(
        "not_found",
        `Protocol '${name}' not found`,
        available.length > 0
          ? `Available protocols: ${available.join(", ")}`
          : "No protocols found in .claude/protocols/"
      );
    }

    // Output formatted protocol for agent consumption
    const formatted = formatProtocol(protocol);

    return this.success({
      name: protocol.name,
      description: protocol.description,
      inputs: protocol.inputs,
      outputs: protocol.outputs,
      step_count: protocol.steps.length,
      formatted_output: formatted,
    });
  }
}

/**
 * Clean up [DEBUG-TEMP] markers from worktree files.
 *
 * Algorithm:
 * 1. Find marker line: `// [DEBUG-TEMP]` (JS/TS) or `# [DEBUG-TEMP]` (Python/Shell)
 * 2. Delete marker line
 * 3. Delete ALL consecutive non-whitespace lines below
 * 4. Stop at first blank/whitespace-only line
 * 5. Repeat for all markers in file
 */
class CleanupDebugLogsCommand extends BaseCommand {
  readonly name = "cleanup-debug-logs";
  readonly description = "Remove all [DEBUG-TEMP] markers and their log statements";

  // Marker patterns for different languages
  private readonly JS_MARKER = "// [DEBUG-TEMP]";
  private readonly PY_MARKER = "# [DEBUG-TEMP]";

  defineArguments(_cmd: Command): void {
    // No arguments - operates on current worktree
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const projectRoot = getProjectRoot();
    const modifiedFiles: string[] = [];
    let totalMarkersRemoved = 0;

    // Find all files containing DEBUG-TEMP markers using grep
    let filesToProcess: string[] = [];
    try {
      const result = spawnSync(
        "grep",
        ["-rl", "\\[DEBUG-TEMP\\]", projectRoot, "--include=*.ts", "--include=*.tsx", "--include=*.js", "--include=*.jsx", "--include=*.py", "--include=*.sh"],
        { encoding: "utf-8" }
      );
      if (result.status === 0 && result.stdout) {
        filesToProcess = result.stdout.trim().split("\n").filter(Boolean);
      }
    } catch {
      // grep might fail if no matches, that's fine
    }

    if (filesToProcess.length === 0) {
      return this.success({
        success: true,
        files_modified: [],
        markers_removed: 0,
        message: "No [DEBUG-TEMP] markers found",
      });
    }

    for (const filePath of filesToProcess) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const { cleaned, markersRemoved } = this.cleanFile(content);

        if (markersRemoved > 0) {
          writeFileSync(filePath, cleaned, "utf-8");
          modifiedFiles.push(filePath);
          totalMarkersRemoved += markersRemoved;
        }
      } catch {
        // Skip files we can't read/write
      }
    }

    return this.success({
      success: true,
      files_modified: modifiedFiles,
      markers_removed: totalMarkersRemoved,
    });
  }

  /**
   * Clean a file's content by removing [DEBUG-TEMP] markers and associated log lines.
   */
  private cleanFile(content: string): { cleaned: string; markersRemoved: number } {
    const lines = content.split("\n");
    const cleanedLines: string[] = [];
    let markersRemoved = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if this is a marker line
      if (trimmed === this.JS_MARKER || trimmed === this.PY_MARKER) {
        markersRemoved++;
        i++; // Skip the marker line

        // Skip all consecutive non-blank lines below the marker
        while (i < lines.length) {
          const nextLine = lines[i];
          // Stop at first blank/whitespace-only line
          if (nextLine.trim() === "") {
            break;
          }
          i++; // Skip this log line
        }
        // Don't add anything - we've removed the marker and its logs
      } else {
        cleanedLines.push(line);
        i++;
      }
    }

    return {
      cleaned: cleanedLines.join("\n"),
      markersRemoved,
    };
  }
}

export const COMMANDS = {
  // Phase 1
  init: InitCommand,
  status: StatusCommand,
  // Phase 2
  check: CheckCommand,
  "write-plan": WritePlanCommand,
  "write-prompt": WritePromptCommand,
  "clear-prompt": ClearPromptCommand,
  "read-prompt": ReadPromptCommand,
  "get-full-plan": GetFullPlanCommand,
  "append-user-input": AppendUserInputCommand,
  "validate-dependencies": ValidateDependenciesCommand,
  "update-prompt-dependencies": UpdatePromptDependenciesCommand,
  // Phase 5: Findings & Approaches
  "write-finding": WriteFindingCommand,
  "write-approach": WriteApproachCommand,
  "clear-approach": ClearApproachCommand,
  "get-finding-approach": GetFindingApproachCommand,
  "get-findings": GetFindingsCommand,
  "read-design-manifest": ReadDesignManifestCommand,
  // Phase 6: Prompt Lifecycle
  next: NextCommand,
  "start-prompt": StartPromptCommand,
  "record-implementation": RecordImplementationCommand,
  "complete-prompt": CompletePromptCommand,
  "get-prompt-walkthrough": GetPromptWalkthroughCommand,
  "mark-prompt-extracted": MarkPromptExtractedCommand,
  "release-all-prompts": ReleaseAllPromptsCommand,
  complete: CompleteCommand,
  // Phase 7: Blocking Gates
  "block-findings-gate": BlockFindingsGateCommand,
  "block-plan-gate": BlockPlanGateCommand,
  "block-prompt-testing-gate": BlockPromptTestingGateCommand,
  "block-prompt-variants-gate": BlockPromptVariantsGateCommand,
  "block-debugging-logging-gate": BlockDebuggingLoggingGateCommand,
  // Phase 9: Protocol System
  protocol: ProtocolCommand,
  "cleanup-debug-logs": CleanupDebugLogsCommand,
};
