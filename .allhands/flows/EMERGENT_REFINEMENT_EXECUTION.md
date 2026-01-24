NOTES:
* this needs refinement. as the context gathering stage, goal, and implementation stage were written on top of the `./PROMPT_TASK_EXECUTION.md` doc (which the rest of the flow is equivalent to - honor this, these two flows are VERY SIMILAR minus their key differences)

<goal>
Create a hypothesis of implementation -> outcome that works to iteratively solve/improve/converge on the goals defined in the alignment doc. Implement and Document it.
</goal>

## Context Gathering
- Read the alignment doc file which includes the top level goal + objectives and acceptance criteria as well as summaries of all prior prompt executions
- Create a non overlapping hypothesis of implementation and intended outcome for iteratively solving/improving/converging on the goals defined in the alignment doc.
- Ensure it does not conflict with prior prompts - read the prompt files / relevant files / even the commit hash files if neccessary to isolating your hypothesis.
- You may need to use codebase grounding tools to verify your hypothesis:
  - `ah spawn codesearch <query>` for suspected codebase features recently implemented 
  - `ah knowledge search <query>` for documented codebase features
  - `ah spawn git-diff-base-files` for recently changed file names of implementation already done on this feature branch. 

## Implementation
- Once convinced of your tasking, create a new prompt file using the `.allhands/flows/shared/PROMPT_TASKS_CURATION.md` file as a guide to creating the prompt file ensuring it has the next avialable number and that its type is "emergent".
- Follow tasks and break them down into Todos if necessary
- After implementation, use validation tooling to acquire test data / information that meets acceptance criteria convincingly

## Validation
- Spin up a sub task to read `.allhands/flows/PROMPT_VALIDATION_REVIEW.md` and follow its instructions
  - Act on feedback until it passes
  - If at prompt attempt > 2 with real limitations, communicate compromises to adjust perspective - it may still reject

## Completion
- Once passed validation, commit your work
- Run `ah schema prompt` for the success/failure summary formats and append your entry to the prompt file and mark the file as "done" in the front matter.
- Rename prompt file to include "-DONE" at the end of the filename.
- Stop