# Supabase Database Validation Suite — Reference

Reference document for how Supabase database validation fits the stochastic/deterministic mental model from the validation-tooling-practice spec. This is NOT a deployable validation suite — it is a template for target repositories that use Supabase. Codebase-specific details are left as open questions.

---

## Suite Frontmatter (Template)

```yaml
name: supabase-database
description: "Database schema validation — migration safety, preview database behavior, dependent service compatibility with Supabase branching"
globs:
  # TARGET REPO: replace with actual migration and schema paths
  - "**/supabase/migrations/**"
  - "**/db/**"
  - "**/*schema*"
tools:
  - "supabase cli"
  - "psql"
  # TARGET REPO: add ORM-specific tools (drizzle-kit, prisma, etc.)
```

---

## Purpose

Validates database schema changes, migration safety, and dependent service behavior when the database schema evolves. This domain has a strong stochastic dimension because:

- Migrations interact with **existing data** in ways that cannot be fully predicted by the migration script alone
- Dependent services (APIs, workers, clients) may behave unexpectedly with schema changes even when the migration itself succeeds
- Production-grade data volumes and shapes introduce failure modes invisible to empty-database testing
- Rollback behavior, concurrent access patterns, and cross-service compatibility require exploratory judgment

The deterministic dimension is equally strong: migration scripts either run or they don't, schema drift is binary, and CI/CD gating on migration success is a natural fit.

---

## Tooling

### Supabase CLI

- `supabase branches create` — Create a preview database branch for isolated testing
- `supabase db push` — Apply pending migrations to a target database
- `supabase db reset` — Reset a database to a clean state and reapply all migrations
- `supabase db diff` — Generate a migration from schema changes
- `supabase db lint` — Lint SQL migrations for common issues
- `supabase inspect db` — Inspect database state (table sizes, index usage, bloat, etc.)

### psql

Direct database connection for inspection, ad-hoc queries, and data verification. Used during stochastic exploration to verify migration outcomes at the data level.

### ORM Tooling

> **TARGET REPO**: Document the specific ORM (Drizzle, Prisma, TypeORM, etc.) and its relevant commands for schema generation, migration creation, and schema-code sync verification.

---

## Stochastic Validation

Freeform playbook for agent-driven exploratory validation during implementation. Per **Frontier Models are Capable** — example scenarios seed intuition but do not prescribe behavior. The agent chains tools intelligently based on what the branch changes.

### Prerequisite

When a branch introduces database changes (migration files, schema definitions, seed modifications), spin up a Supabase preview database for the branch before beginning stochastic exploration. If the branch does NOT contain database changes, no preview database is needed — the main local database suffices.

### Example Scenarios

**1. Migration + Dependent Service Compatibility**

Apply migrations to the preview database. Swap ENV to point dependent services (API servers, workers, clients) at the preview database. Exercise API endpoints and service functions that touch changed tables. Look for:
- Schema mismatch errors from ORM or query layers
- Unexpected nulls from new nullable columns or removed NOT NULL constraints
- Constraint violations from existing application logic writing to altered tables
- Type mismatches between application code expectations and new column types

**2. Rollback Safety**

Apply the migration, then attempt rollback (down migration). Assess:
- Does the down migration execute cleanly?
- Is data preserved through the round-trip (up then down)?
- Are there irreversible operations (column drops, type narrowing, data transforms) that make rollback unsafe?
- If rollback is unsafe, is that explicitly documented in the migration file?

**3. Production-Grade Data Stress**

Seed the preview database with production-representative data (volume and shape). Run migrations against this data. Look for:
- Timeout issues on large table alterations (adding indexes, column type changes)
- Constraint violations on existing data that passes in empty-database tests (e.g., adding NOT NULL to a column with existing nulls)
- Performance degradation on queries that touch altered tables or new indexes
- Lock contention on tables with high write volume during migration

> **TARGET REPO**: Document how to obtain or generate production-representative data. Options include Supabase snapshot restore, pg_dump/pg_restore from a staging environment, or synthetic seed scripts. Note data anonymization requirements if using real production data.

**4. Concurrent Access Under New Schema**

With migration applied, simulate concurrent operations from multiple service contexts against new or altered tables. Check for:
- Deadlocks from new constraints or index changes
- Race conditions on new columns with default values or triggers
- Unexpected constraint behavior under concurrent writes

**5. Cross-Migration Dependency**

If the branch contains multiple sequential migrations, explore:
- Does each migration apply cleanly in isolation (partial migration scenarios)?
- What happens if only some migrations have been applied and a service connects?
- Are there ordering dependencies between migrations that could break if CI/CD applies them out of order?

### Adequacy

Coverage is adequate when the agent has validated that:
1. Migrations apply cleanly to a database with production-representative data
2. Dependent services function correctly with the new schema
3. At least one non-obvious edge case has been explored (rollback safety, concurrent access, data stress)
4. The agent can articulate what was explored and why it provides confidence

The agent should NOT consider coverage adequate if only empty-database migration success was verified. The stochastic value of this suite comes from exercising the migration against realistic conditions.

---

## Deterministic Integration

How to engrain validated patterns into the codebase and CI/CD pipelines. This section starts sparse for new suites and grows as stochastic patterns crystallize.

### Core Deterministic Checks

| Check | Command | Pass Condition |
|-------|---------|----------------|
| Migration applies | `supabase db push` | Exit code 0 |
| Schema-code sync | ORM-specific diff command | No diff output (schema and migrations are in sync) |
| Migration lint | `supabase db lint` | No errors (warnings acceptable) |

> **TARGET REPO**: Add the specific ORM diff command (e.g., `drizzle-kit generate` produces no output, `prisma migrate diff` returns empty).

### CI/CD Pipeline Pattern

**On PR open / push:**
1. Ensure a Supabase preview database exists for this branch (create if not)
2. Run all pending migrations against the preview database
3. Run schema-code sync check
4. Report pass/fail — migration failure blocks merge

**On merge to base branch:**
1. Apply the SAME migration scripts to the production database
2. The migration scripts are identical — preview database validation ensures they work before touching production
3. Migration failure on production triggers rollback and engineer notification

**Preview deployment integration:**
- Preview deployments (Vercel preview, TestFlight, etc.) connect to the PR-specific preview database
- This enables end-to-end validation of the full stack against the new schema before merge

### Crystallization Guidance

As stochastic exploration reveals repeated patterns, crystallize them into deterministic checks:

- **NOT NULL additions**: If stochastic exploration repeatedly catches constraint violations on NOT NULL column additions, add a deterministic check — seed representative data before migration, verify no constraint errors
- **Index performance**: If stochastic exploration reveals slow queries after index changes, add a deterministic check — run explain analyze on key queries post-migration, assert no sequential scans on indexed columns
- **Rollback safety**: If rollback testing reveals common failure patterns, add a deterministic check — run up-then-down migration, verify database state matches pre-migration state
- **Schema-service compatibility**: If service compatibility issues are found stochastically, add deterministic contract tests that verify API responses match expected shapes post-migration

> **TARGET REPO**: Document crystallized checks here as they emerge from stochastic exploration during branch work. Each crystallized check should reference the stochastic scenario that motivated it.

### Failure Patterns

| Failure | Signal | Likely Cause |
|---------|--------|--------------|
| Exit code != 0 on `supabase db push` | Migration SQL error | Syntax error, constraint violation, missing dependency |
| ORM diff produces output | Schema drift | Migration was modified after generation, or schema was changed without generating a migration |
| Connection refused | Preview database not active | Branch database not created, or ENV pointing at wrong instance |
| Timeout on migration | Long-running DDL | Large table alteration without concurrent index creation, missing `CONCURRENTLY` on index |
| Constraint violation on push | Data incompatibility | Existing data violates new constraint (NOT NULL, UNIQUE, CHECK) |

---

## ENV Configuration

### Local Development (Stochastic Usage)

When an agent needs to test dependent services against the preview database during implementation:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_DB_URL` | Preview database connection string (postgres://) |
| `SUPABASE_URL` | Preview project API URL |
| `SUPABASE_ANON_KEY` | Preview branch anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview branch service role key |

**Swap pattern**: Point the local `.env` (or equivalent) at the preview database connection details when testing dependent services against new schema. Revert to main/production database details when not testing database changes.

> **TARGET REPO**: Document the specific env file(s) to modify, the exact variable names used by the project, and any service restart requirements after ENV swap.

### CI/CD (Deterministic Usage)

| Variable | Source |
|----------|--------|
| PR-specific database URL | Set by Supabase GitHub integration or branch creation script |
| PR-specific API keys | Derived from branch database provisioning |
| Preview deployment database URL | Configured in deployment platform (Vercel, etc.) to use PR-specific database |

> **TARGET REPO**: Document how CI/CD secrets are managed — GitHub Actions secrets, Supabase GitHub integration automatic provisioning, or manual configuration per branch.

---

## Open Questions for Target Repository

These must be resolved when adopting this suite in a specific codebase:

| Question | Context |
|----------|---------|
| What ORM is used? | Determines schema-code sync commands, migration generation, and diff tooling |
| Where do migrations live? | Needed for glob patterns in frontmatter |
| Where do schema definitions live? | Needed for glob patterns and schema-code sync checks |
| How is production data seeded for testing? | Supabase snapshot restore, pg_dump/pg_restore, synthetic scripts — determines stochastic playbook feasibility |
| Is data anonymization required? | If using real production snapshots, PII handling must be documented |
| What Supabase plan supports branching? | Database branching is a Pro/Team feature — confirm availability |
| What dependent services connect to the database? | Determines scope of stochastic service compatibility testing |
| What is the current CI/CD platform? | GitHub Actions, GitLab CI, etc. — determines deterministic integration specifics |
| Are there existing migration tests? | Existing deterministic coverage that should be referenced in the Deterministic Integration section |
| What env file convention does the project use? | `.env.local`, `.env`, `.env.development` — determines ENV swap instructions |

---

## Crystallization Lifecycle Position

This suite starts at **Phase 1 (Stochastic Exploration)** in any new target repository. The deterministic integration section contains the minimum viable checks (migration applies, schema synced, lint passes). As agents use the stochastic playbook across branch work and the compounding process captures patterns, the deterministic section will grow with crystallized checks specific to the target codebase's migration patterns and failure modes.
