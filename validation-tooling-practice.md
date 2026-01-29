# Validation Tooling Practice

Findings and mental model for validation tooling in the all-hands harness, derived from first-principles discussion and codebase analysis.

---

## What Validation Tooling IS

A **validation tooling suite** is a domain-scoped document describing a package of tools and practices for validating implementation in a specific domain. It serves as both an **immediate stochastic playbook** for agent-driven exploratory validation during implementation, and a **deterministic integration guide** for engraining proven validation patterns into the codebase and CICD pipelines over time.

A suite is NOT a wrapper around a single test command. A suite's existence is justified by the presence of a meaningful **stochastic dimension** — if a tool can only be used deterministically (e.g., a linter with binary pass/fail), it is a test command, not a validation tooling suite. The suite abstraction earns its existence when the domain benefits from intelligent, model-driven exploratory validation that cannot be reduced to a fixed script.

Validation tooling suites are **project-specific infrastructure**. They describe how a specific project uses a specific set of tools for a specific domain. They are not generic documentation — they encode the project's validation practices and evolve with the codebase.

---

## The Two Dimensions

A single validation tooling suite covers the **same domain and tooling package** across two dimensions. These are not separate suites — they are two perspectives on the same tools serving the same acceptance criteria.

### Stochastic Validation

- **Nature**: Non-deterministic, exploratory, probabilistic coverage. Different runs may explore different paths. The model chains tools together intelligently based on the scenario.
- **When**: During implementation. Agent reads the suite playbook and uses model intuition to decide what to explore, how to chain tools, and what constitutes adequate coverage.
- **Output**: Qualitative assessment. The model interprets results, judges adequacy, identifies edge cases. Not binary pass/fail — requires intelligence to evaluate.
- **Format in suite doc**: Freeform playbook with a limited set of example scenarios. Examples seed intuition but do not prescribe behavior. Per **Frontier Models are Capable** — provide the "why" and examples, let the model deduce "what" and "how."
- **Purpose**: Use tools like a human would. Explore the implementation the way an engineer would manually test — but with model-scale intuition, speed, and coverage. Especially valuable for domains where deterministic testing is impossible or insufficient (UI/UX, novel integrations, migration behavior with production-grade data, performance characteristics).

### Deterministic Integration

- **Nature**: Binary pass/fail. Reproducible. Same input always produces same result.
- **When**: Engrained into CICD pipelines and run on every push, PR, or merge. Also used during implementation for rigid acceptance criteria (e.g., "migrations must run without error").
- **Output**: Quantitative. Exit codes, pass/fail counts, error messages. Hard numbers giving hard results.
- **Format in suite doc**: Guide for entrenchment. Describes which commands become tests, where they live in the codebase, how to wire them into CICD pipelines, what scenarios each covers, and what ENV configuration is needed for branch/preview setups. Includes result interpretation (expected exit codes, output patterns).
- **Purpose**: Catch regressions automatically. Bring the engineer back into the loop when something breaks. Provide hard acceptance criteria. Prevent regressions across features on merge.

### Why "Stochastic" and Not "Heuristic"

The term **stochastic** was chosen deliberately over "heuristic" because:

- **Deterministic vs Stochastic** is an established conceptual pair in CS/mathematics. They are natural opposites. "Deterministic vs Heuristic" is not — heuristic's opposite is "optimal" or "exact."
- The defining characteristic is **non-determinism of coverage**: different runs explore different paths, the model chains tools differently each time, and adequacy is probabilistically assessed. This is stochastic by definition.
- "Heuristic" implies rule-of-thumb judgment, which undersells what's happening. The model is performing intelligent probabilistic exploration, not applying crude rules.
- It reads clearly in flow documentation: *"Run stochastic validation using the Supabase suite to explore migration behavior with connected services."*

---

## The Stochastic-to-Deterministic Crystallization Lifecycle

Every validation tooling suite follows an evolutionary lifecycle. This is the core practice model.

```
Stochastic exploration --> Pattern recognition --> Deterministic crystallization --> CICD entrenchment
         ^                                                                                |
         |                                                                                |
         +------------ (new features, edge cases, UI/UX) <-------------------------------+
```

### Phase 1 — Stochastic Exploration

Agent uses domain tools during implementation, chaining them intelligently per the suite playbook. Coverage is probabilistic, driven by model intuition. The suite doc is the immediate reference.

### Phase 2 — Pattern Recognition

Certain stochastic validations prove repeatedly valuable across implementations. The agent or compounding process recognizes these patterns: "every time we change table X, we need to check Y."

### Phase 3 — Deterministic Crystallization

Those recognized patterns get formalized as deterministic commands, test cases, and scripts. They get written into the codebase. The suite doc's deterministic integration section guides HOW to engrain them — where to put tests, how to structure them, what commands to use.

### Phase 4 — CICD Entrenchment

Deterministic coverage runs automatically on every push. What used to require an agent's stochastic exploration now runs without agent involvement. Regressions are caught automatically. Engineers are brought back into the loop when checks fail.

### Phase 5 — Frontier Shift

Stochastic validation shifts focus to the frontier: new features, novel integrations, edge cases, and domains where deterministic testing remains impossible (UI/UX, subjective quality). The deterministic section of the suite doc grows. The stochastic section remains the same size — it's always a playbook for exploring the frontier, not for re-testing the known.

### The Cycle Continues

Stochastic usage never ends. It is the frontier of validation. Deterministic coverage is its crystallized output. Over time, the deterministic integration section of a suite grows as stochastic patterns become standard practice — but the stochastic playbook always encourages exploration of new use cases and intuitive edge-case discovery.

The validation tooling suite doc is the **living guide** to this process for a specific domain.

---

## Suite Schema

### Frontmatter

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Unique suite identifier |
| `description` | string | yes | Domain and tooling purpose |
| `globs` | string[] | yes | File patterns that trigger relevance of this suite |
| `tools` | string[] | yes | The tooling package available (e.g., `["supabase cli", "psql", "drizzle-kit"]`) |

### Body Sections (in order)

| Section | Required | Content |
|---------|----------|---------|
| `## Purpose` | yes | Why this domain needs validation tooling. The "why" that enables capable deduction. What the suite protects against and what confidence it provides. |
| `## Tooling` | yes | Available tools, setup instructions, prerequisites, installation. How to get the tools ready for use. |
| `## Stochastic Validation` | yes | Freeform playbook with limited example scenarios. Describes how to chain tools, what to explore, what "adequate coverage" looks like. Includes guidance on interpreting results (which are qualitative/intuitive). Example scenarios seed model intuition — they do not prescribe all behavior. |
| `## Deterministic Integration` | yes | How to engrain validated patterns into the codebase and CICD pipelines. Which commands become tests, where they live, how to wire into pipelines, what scenarios each covers. Includes result interpretation (exit codes, expected outputs, failure patterns). Starts sparse for new suites, grows as stochastic patterns crystallize. |
| `## ENV Configuration` | conditional | Branch/preview-specific ENV vars for connecting to preview databases, preview deployments, or branch-scoped infrastructure. Required when the domain involves environment-dependent connections. Suite-specific — each domain documents its own connection patterns following a standardized section format. |

### Schema Rules

- **Both stochastic and deterministic sections are always present.** A new suite's deterministic section may be sparse — that's correct. It reflects where the domain is in its crystallization journey.
- **Result interpretation is folded into each dimension's section.** Stochastic results need intuitive interpretation guidance. Deterministic results need expected exit codes and failure patterns. No standalone "Interpreting Results" section.
- **No standalone "CICD Integration" section.** CICD integration is part of the deterministic integration section — it IS the deterministic integration.
- **ENV Configuration is suite-specific, not shared.** Each domain knows its own connection patterns. A standardized section format ensures consistency across suites, but the actual env vars and setup steps are domain-specific.

---

## Suite Existence Threshold

A validation tooling suite MUST have a meaningful stochastic dimension. This is the threshold for whether something deserves to be a "suite" or is simply a test command.

| Tool | Deterministic | Stochastic | Suite? | Rationale |
|------|:---:|:---:|:---:|---|
| `tsc --noEmit` | Yes | No | No | Binary pass/fail. No exploratory dimension. It's a test command. |
| `ruff check .` | Yes | No | No | Same — binary linting. |
| Supabase branching + migration tools | Yes | Yes | **Yes** | Deterministic migration scripts AND exploratory testing with preview databases, connected services, production-grade data. |
| Playwright + browser tools | Yes | Yes | **Yes** | Deterministic regression test runner AND agent-driven UI exploration, screenshot comparison, UX assessment. |
| Performance profiling (flamegraphs, memory profilers) | Maybe | Yes | **Yes** | Stochastic interpretation of profiling results, threshold judgment. Can crystallize thresholds into deterministic checks. |
| API testing (curl automation, endpoint exploration) | Yes | Yes | **Yes** | Deterministic contract tests AND exploratory payload fuzzing, error discovery, edge-case probing. |

**The principle**: if an agent gains nothing from using the tool stochastically (i.e., the tool's output is always binary and requires no interpretation or exploration), it does not need the suite abstraction. It should be a test command in CICD and referenced directly in acceptance criteria.

---

## ENV Configuration Pattern

When a validation suite involves infrastructure that varies by branch (preview databases, preview deployments, branch-scoped services), the suite doc includes an `## ENV Configuration` section describing:

1. **What env vars are needed** — connection URLs, API keys, service endpoints
2. **How to swap them** — for local service testing against preview infrastructure during implementation (stochastic usage)
3. **How they're set in CICD** — for PR-specific preview deployments and automated validation (deterministic usage)

This is suite-specific because:
- Validation tooling is project-specific infrastructure
- Each domain has unique connection patterns
- Maintenance is localized to the suite that changes
- A shared cross-suite ENV doc would drift and become a maintenance liability

The pattern IS standardized (every suite that needs ENV swapping uses the same section heading and follows the same structure), but the content is domain-specific.

---

## Preview Database Pattern

The term **preview database** describes the practice of branching a production database for feature-branch-scoped validation. This aligns with the "preview deployment" terminology used by Vercel, TestFlight, and similar tools. Supabase calls their implementation "database branching."

A preview database is:
- A branch-scoped database instance containing production-replica data
- Created when a feature branch contains database changes
- Used for both stochastic validation (agent explores migration behavior with connected services and production-grade data) and deterministic validation (CICD runs migrations on every PR push)
- The same migration scripts that run against the preview database are applied to production on merge to the base branch

### Preview Database Lifecycle Within a Suite

**During implementation (stochastic):**
- Branch DB is spun up when the branch contains DB changes
- Migrations are run against the preview database
- Dependent services connect to the preview database via ENV swap
- Agent explores: Does the migration work? Do dependent services behave correctly with the new schema? Do edge cases with production-grade data trigger errors?
- IF the current branch does NOT contain DB changes, the main/production local DB suffices — no preview database needed

**During PR review (deterministic):**
- Preview database is spun up for the PR if not already active for this branch
- Migrations run on every push via CICD actions
- Preview deployments (Vercel preview branch, TestFlight build, etc.) connect to this preview database
- On merge to base branch, the SAME migration scripts are applied to production
- This is the crystallized deterministic flow — it runs automatically, catches regressions, and provides hard pass/fail signals

---

## Supabase Suite Example (Sketch)

To make the model concrete, here is what a `supabase-database.md` validation tooling suite would look like:

```markdown
---
name: supabase-database
description: "Database schema validation - migrations, preview databases, dependent service behavior with Supabase branching"
globs:
  - "**/supabase/migrations/**"
  - "**/drizzle/**"
  - "**/schema.ts"
  - "**/db/**"
tools:
  - "supabase cli"
  - "psql"
  - "drizzle-kit"
---

# Supabase Database Validation

## Purpose

Validates database schema changes, migration safety, and dependent service behavior when the database schema evolves. Protects against migration failures, data loss, schema incompatibilities with connected services, and regressions in database-dependent functionality.

## Tooling

- `supabase db branch` — Create and manage preview databases
- `supabase db push` — Apply migrations to preview database
- `supabase db reset` — Reset preview database to clean state
- `psql` — Direct database inspection and query testing
- `drizzle-kit generate` / `drizzle-kit push` — Schema generation and application

## Stochastic Validation

Freeform playbook for agent-driven exploratory validation during implementation.

When a branch introduces database changes, spin up a preview database and explore:

**Example scenarios (seed intuition, do not prescribe):**

1. **Migration + connected services**: Run migration on preview DB. Swap ENV to point dependent services at the preview DB. Hit API endpoints that touch changed tables. Look for schema mismatch errors, unexpected nulls, constraint violations.

2. **Rollback behavior**: Apply migration, then attempt rollback. Does the down migration work cleanly? Is data preserved? Are there irreversible operations that should be flagged?

3. **Production-grade data stress**: Seed preview DB with production snapshot. Run migrations against real-world data volumes and shapes. Look for timeout issues, constraint violations on existing data, performance degradation on altered tables.

4. **Concurrent access**: With migration applied, simulate concurrent writes to new/altered columns from multiple service contexts. Check for deadlocks, race conditions, unexpected constraint behavior.

**Adequacy**: Coverage is adequate when the agent has validated that (a) migrations apply cleanly, (b) dependent services work with the new schema, and (c) at least one non-obvious edge case has been explored with production-grade data. The agent should articulate what edge cases were explored and why they provide confidence.

## Deterministic Integration

How to engrain validated patterns into the codebase and CICD.

**Current deterministic checks:**
- Migration script applies without error (`supabase db push` exit code 0)
- `drizzle-kit generate` produces no diff (schema and migrations are in sync)

**CICD pipeline integration:**
- On PR open/push: Ensure preview database exists for this branch. Run all pending migrations. Report pass/fail.
- On merge to base branch: Apply the SAME migration scripts to production database.
- Migration failure on PR blocks merge — engineer must resolve before proceeding.

**Crystallization guidance:**
As stochastic exploration reveals patterns (e.g., "every time we add a NOT NULL column, we need to check existing rows"), add deterministic checks:
- Write migration smoke tests that seed representative data and verify post-migration state
- Add schema diff assertions to CICD (expected vs actual after migration)
- Create seed scripts for production-representative data to run before migration tests

**Failure patterns:**
- Exit code != 0 on `supabase db push` — migration SQL error
- `drizzle-kit generate` produces non-empty output — schema drift
- Connection refused — preview database not active or ENV misconfigured

## ENV Configuration

**Local development (stochastic usage):**
- `SUPABASE_DB_URL` — Preview database connection string
- `SUPABASE_ANON_KEY` — Preview branch anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Preview branch service role key
- Swap `.env.local` to point at preview database when testing dependent services against new schema. Revert to main DB when not testing DB changes.

**CICD (deterministic usage):**
- PR-specific env vars set by Supabase GitHub integration
- Preview deployment (Vercel/TestFlight) configured to use PR-specific database URL
- Secrets managed via GitHub Actions secrets scoped to the preview environment
```

---

## Relationship to Existing Harness Concepts

### Principle #6: Agentic Validation Tooling

The existing principle in `principles.md` states:
> Programmatic validation > human supervision. Strict acceptance criteria make prompt work verifiable. Types of validation: tests, UI automation, profiling, script results. Makes engineering supervision redundant for routine checks. Validation tooling is infrastructure — assess gaps before planning, create via specs.

This principle is **compatible** with the refined model but could be enriched with:
- The stochastic/deterministic dimension distinction
- The crystallization lifecycle concept
- The suite existence threshold (meaningful stochastic dimension required)

### Validation Suite Lifecycle in Prompts

The existing flow already integrates validation suites through the prompt lifecycle:
1. **Planning** — `UTILIZE_VALIDATION_TOOLING.md` discovers and assigns suites
2. **Curation** — `PROMPT_TASKS_CURATION.md` includes `validation_suites` in frontmatter
3. **Execution** — `PROMPT_TASK_EXECUTION.md` reads suite commands
4. **Review** — `PROMPT_VALIDATION_REVIEW.MD` checks validation quality
5. **Compounding** — `COMPOUNDING.md` refines suite effectiveness

Under the refined model, step 3 (execution) becomes richer: the agent reads the stochastic playbook and uses it during implementation, while the deterministic section informs acceptance criteria and CICD integration.

### Progressive Validation Order

The existing ordering from `UTILIZE_VALIDATION_TOOLING.md` (compiles -> unit tests -> integration -> E2E) describes the deterministic dimension only. The stochastic dimension runs in parallel during implementation, guided by the suite playbook. Both dimensions contribute to the same acceptance criteria.

### E2E Test Plan Building

`E2E_TEST_PLAN_BUILDING.md` already groups validation tools into categories (UI automation, load testing, profiling, DB inspection, API testing). Under the refined model, these categories map to validation tooling suites, each with their own stochastic playbook and deterministic integration guide. Section 3 ("AI-Coordinated Validation") is essentially describing stochastic validation.

---

## Implied Codebase Changes

### Schema Updates

`validation-suite.yaml` needs:
- **Add** `tools` frontmatter field (array of strings, required)
- **Replace** body sections: remove standalone `Interpreting Results` and `CICD Integration`, replace with `Purpose`, `Tooling`, `Stochastic Validation`, `Deterministic Integration`, conditional `ENV Configuration`
- **Update** section requirements to match the new structure

### Flow Updates

- `UTILIZE_VALIDATION_TOOLING.md` — Reference stochastic/deterministic dimensions when matching suites to acceptance criteria. Stochastic suites are used during implementation. Deterministic patterns inform rigid acceptance criteria and CICD integration.
- `CREATE_VALIDATION_TOOLING_SPEC.md` — Spec creation should follow the new schema and lifecycle model. New suites must articulate their stochastic dimension to justify existence.
- `PROMPT_TASK_EXECUTION.md` — Execution should distinguish between stochastic exploration (during implementation) and deterministic validation (for acceptance criteria checks).
- `E2E_TEST_PLAN_BUILDING.md` — Align categorization with suite taxonomy. Reference stochastic/deterministic lifecycle.
- `COMPOUNDING.md` — Compounding should track the crystallization lifecycle: which stochastic patterns have been recognized and should be engrained deterministically.

### Principle Update

`principles.md` Principle #6 could be updated to reference the crystallization lifecycle and the stochastic/deterministic dimensions, enriching the "why" for agents.

---

## Recommendation for `typescript-typecheck.md`

The existing `typescript-typecheck.md` validation suite has:
- **Deterministic dimension**: `npx tsc --noEmit` — binary pass/fail, CICD-integrable
- **Stochastic dimension**: None. There is no exploratory, model-driven validation possible with TypeScript type checking. The output is always a list of type errors or silence. It requires no interpretation beyond "fix the listed errors."

**Under the refined model, `typescript-typecheck.md` does not meet the suite existence threshold.** It is a deterministic test command, not a validation tooling suite.

### Recommended action

**Reclassify `typescript-typecheck.md` out of the validation suite system.** It should be:

1. **Referenced directly in acceptance criteria** as a deterministic check ("TypeScript must compile without errors"), not as a validation suite
2. **Engrained in CICD** as a pipeline step (which it likely already is or should be), per its own CICD Integration section
3. **Referenced by the harness validation hooks** — the existing `validation.ts` hook already runs TSC on file save, which is the correct integration point for this kind of tool

The type check is valuable — it's just not a "validation tooling suite" under the refined definition. It's infrastructure-level linting that runs deterministically everywhere. It does not benefit from the suite abstraction (stochastic playbook, crystallization lifecycle, ENV configuration).

If there is a desire to keep it in `.allhands/validation/` for discoverability via `ah validation-tools list`, it could be reclassified as a different schema type (e.g., `deterministic-check` vs `validation-suite`) or moved to a different location (e.g., `.allhands/checks/` or referenced in CICD config directly). The key point: it should not be the template or exemplar for what validation tooling suites look like, because it only represents one dimension of a two-dimensional concept.
