NOTES:
* this needs refinement. Also does this fit with the test plan logic of the harness implementation in src?

<goal>
Engineers need to be convinced of milestone implemention efficacy - and because they are excluded from prompt-by-prompt validation, one big E2E test plan is needed to ensure the milestone is working as expected.
</goal>

## Context Gathering
- Read the alignment doc file which includes the top level goal + objectives and acceptance criteria as well as summaries of all prior prompt executions
  - Run `ah git diff-base-files` or `ah git diff-base` if you want ot see ALL context (be carefuly with this incase of information overload)
- Investigate the core validation tooling testing methods used to verify work done in prompts and the consequences on the actual E2E product flows / business logic
- Deeply understand how to test the full suite of changes acrsos all implementation 

## E2E Test Plan Doc
- Break down the most product focused, end user experience enlightening, and core E2E test flow that targets the areas of the product that may have regressed with the changes, or where the changes are focused, the will elicit edgecase behaviour within the context of the actual product's functionaltiy
  - This is the core of the test plan and should be the most improtant part
- Suppliment the main test flow / checklist with additional secondary valdiation methods that can show what the agents had seen during their implementation:
  - These are not as important as the main test flow.
  - These can be specific tests, specific args for CLI invocations, profiling tool usage etc - leveraging the main validation tools of the harness
    - Run `ah validation-tools list` to see all available validation suites
    - Read `.allhands/flows/shared/UTILIZE_VALIDATION_TOOLING.md` for guidance on selecting and applying suites to the E2E test plan
- Create the E2E test plan doc alongside the alignment doc as `e2e_test_plan.md`