NOTES:
* Reads the alignment doc to look out for existing prompts that may impact the milestone planning
* Must analyze the milestone spec doc -> which is a highlevel representation of the user's intent and goals for the milestone. Read the relevant codebase files included in the spec for an intiial grounding before a deeper exploration / research session.
* Must focus on each area of considerable implementation approach need identified from the spec and begin to research / ground itself in the codebase implemention using sub tasks of both `.allhands/flows/CODEBASE_UNDERSTANDING.md` and `.allhands/flows/RESEARCH_GUIDANCE.md` to do so. in multiple parallel instances to gather ALL of the required infromation.
* User interview based on the deep research and deep understanding and consideration of approaches, contraints, limitations, where some things may not be set in stone without disposable variant options being considered (first principle!)
  * This means each deeply reserached and consdiered implementation approach is presented as a set of options in which the user can choose 1 or many.
  * When selecting many, prompts will be created to facilitate the disposable variatn implementation of each approch such that they can be executed in parallel and result in multiple feature flag hidden variatsn to test out - disposable / cheap software first prinicple right there
  * The user MUST choose a **convention** when selecting multiple implementation approach
  * Ideally this interview is concsise, and highly actionalbe solutions (where each approach / deicsion reuiqred from the user has a RECOMMENDED APPRAOCH for at least one of the options)
* **We nede to flesh out properly how disposable variant prompting can be ideated here such that the knowledge of this is passed to teh prompt tasks curation - seeing as the planning agent is the only agent who is allowed to work with disposable variant prompt architecture**
* **Validation Tooling Analysis** - Critical for acceptance criteria quality:
  * Run `ah validation-tools list` to see existing coverage
  * For greenfield technology integration → use `.allhands/flows/shared/CREATE_VALIDATION_TOOLING.md` to research and document new validation suites before creating prompts
  * For brownfield domains → verify existing suites cover the implementation scope; flag gaps for CREATE flow
  * This informs acceptance criteria of the new prompts - prompts without validation tooling are weak 
* Consolidate approaches by further research + confirmatory processing / exploration of external technologies source code /docs by using `.allhands/flows/shared/EXTERNAL_TECH_GUIDANCE.md`. 
  * This stage allows planning to disect open source libraries for information / inspiration /guidance, as well as consolidate implementaion approach against actual documentation of tools and tehcnlogies that were discussed in the approach selection / generation phase. This tooling will provide specific implementation steps.
  * This stage should be called as multiple sub tasks as multiple approaches will reuqire different technology research.
* Reads the milestone spec doc and its primary objective is to turn it into a list of prompts using the `.allhands/flows/shared/PROMPT_TASKS_CURATION.md` file as a guide to creating the prompts out of need
* Create the top level goal + objectives entry in the alignment doc by first running `ah schema alignment` to get the format, then create the file.
* Once done, should spin up a jury of plan reviewer agents each reading their own flow respectively. For each you must provide path of alignment doc + spec doc path + prompts folder path:
  * `.allhands/flows/shared/jury/PROMPTS_EXPECTATIONS_FIT.md` (ensures the alignment doc + prompts reflect /document user decisions and implementation that combines to fit their original spec expectations)
  * `.allhands/flows/shared/jury/PROMPTS_FLOW_ANALYSIS.md` (expert on prompt dependenices and disposable variant execution flows / ordering of prompts + importance )
  * `.allhands/flows/shared/jury/PROMPTS_YAGNI.md` (takes a holistic view of the plan and its initiatives and gies feedback on overengineering - is aware that disposable variatns are a core feature, but looks into implementation detail and architecture, understands the needs of the milestone w/r/t the product and its stage of development to see if we are getting ahead of ourselves or not)
  * These agents are primarily just taught to think about things specifically that the planner agent misses out on since it has alot to consider!
  * After they have returend their findings, use `.allhands/flows/shared/REVIEW_OPTIONS_BREAKDOWN.md` to break down the feedback into actionable options for the user to choose from.
  * If any chosen feedback, make ammendments to the alignment doc / prompts (and document whatever human decisions come out of this as they will be important for the compound stage!)
* Stop once prompts + alignment doc are ready for execution!