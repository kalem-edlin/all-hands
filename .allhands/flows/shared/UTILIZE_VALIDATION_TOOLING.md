<goal>
Find and apply existing validation tooling to build strong acceptance criteria. This flow teaches agents how to discover relevant suites and integrate them into their validation approach.
</goal>

<inputs>
- Files/domains involved in the implementation task
- The nature of the changes (UI, backend, database, etc.)
</inputs>

<motivations>
- Validation tooling is only valuable when it's actually used
- Agents must know what tools exist before they can validate effectively
- Matching the right suite to the task ensures acceptance criteria are achievable
- Gaps discovered here should feed back to CREATE_VALIDATION_TOOLING
</motivations>

## Step 1: Discover Available Suites

Run the list command to see all validation tooling:
```bash
ah validation-tools list
```

This returns JSON with each suite's:
- `name`: Suite identifier
- `description`: Use case (when/why to use)
- `globs`: File patterns it validates
- `file`: Path to the full suite documentation

## Step 2: Identify Relevant Suites

Match suites to your task using two approaches:

**A. Glob pattern matching** (programmatic hint):
- Compare files you're touching against each suite's `globs`
- Suites with matching patterns are likely relevant

**B. Description inference** (semantic understanding):
- Read suite descriptions
- Match against the nature of your task (UI changes, DB migrations, API endpoints, etc.)

Select all suites that apply to your implementation scope.

## Step 3: Read Suite Documentation

For each relevant suite, read the full file:
```bash
# Path from the list output
cat .allhands/validation/<suite-name>.md
```

Understand:
- **Purpose**: What quality aspects it validates
- **When to Use**: Confirm it matches your task
- **Validation Commands**: Exact commands to run
- **Interpreting Results**: How to know if validation passed

## Step 4: Integrate into Acceptance Criteria

When writing or reviewing acceptance criteria:

1. **Reference specific commands** from the suite's "Validation Commands" section
2. **Define success conditions** based on "Interpreting Results"
3. **Order validation** progressively (compiles → unit tests → integration → E2E)

Example acceptance criteria integration:
```markdown
## Acceptance Criteria
- [ ] Code compiles without errors
- [ ] `npx vitest run --coverage` passes with >80% coverage on changed files
- [ ] `npx playwright test auth.spec.ts` passes all auth flow scenarios
- [ ] No regressions in existing test suites
```

## Step 5: Note Gaps

If you identify validation needs with no matching suite:
- Document the gap explicitly in your work
- Flag for potential CREATE_VALIDATION_TOOLING follow-up
- Proceed with available validation (compiles, type checks, basic tests)

## For Prompt Curation

When using this flow during prompt creation (via PROMPT_TASKS_CURATION):
- Add matched suite file paths to the prompt's `validation_suites` frontmatter
- Use the `file` field from `ah validation-tools list` output (e.g., `.allhands/validation/typescript-typecheck.md`)
- This makes the validation approach explicit and reviewable
- Executors can read the referenced suite files directly
