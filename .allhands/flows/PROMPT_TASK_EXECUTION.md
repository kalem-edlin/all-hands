<goal>
Execute prompt tasks with full context, validate thoroughly, and document your work. Per **Prompt Files as Units of Work**, the prompt IS the task - complete it as a self-contained unit.
</goal>

<constraints>
- MUST read prompt file and alignment doc before implementation
- MUST pass validation before committing
- MUST append summary to prompt file on completion
- NEVER commit without passing validation review
</constraints>

## Context Gathering

- Read the prompt file for tasks and acceptance criteria
  - If FAILURE SUMMARY sections exist, adapt to their redirections / learnings
- Read the alignment doc for milestone context, prior prompt summaries, and key decisions
  - Read any relevant dependency prompt files
- Run `ah knowledge search <query>` for codebase information as needed

## Implementation

- Follow tasks and break them down into Todos if necessary
- After implementation, use validation tooling to acquire test data meeting acceptance criteria

## Validation

- Spawn subtask to read `.allhands/flows/shared/PROMPT_VALIDATION_REVIEW.md` and follow its instructions
- Act on feedback until it passes
- If at prompt attempt > 2 with real limitations, communicate compromises - reviewer may still reject

## Completion

- Commit your work
- Run `ah schema prompt` for summary format
- Append success summary to prompt file
- Set frontmatter `status: done`
- Rename prompt file to include `-DONE` suffix
- Stop