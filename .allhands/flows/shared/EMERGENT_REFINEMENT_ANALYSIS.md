NOTES:
* Inputs: alginment doc path, prompts file directory
* reads into the prompts that were specifically emergent refinement prompts
* Breaks down each by their hyopthesis, their approach to solving the outcome and their effectiveness in doing so by focusing on their validation results and hwo they proved their contributions pushed towards the goal of the alignment doc. 
* Will help with the rules / ccriteria for a good emergent refinement when compared to the rest of the emergent refinements
* Gives holistic perspective on which should be kept, which should be improved and what can be done to improve them / why they arent "should be kept" and what itll take to get them there, and which had hyopthesis that do not have enough potential to support the goal in a positive way
* Prsent these findings to the user. Allow them to decide which existing emergent refinement propts should be changed based on the suggestions of the agent / any custom suggests by the user as user-patch prompts. The user can also decide to eliminate these prompt tasks, in which this flow will also create user-patch prompts to revert / undo the changes brought about by the emergent refinement prompt.
* This skill would have otpimally idetnified all of the files change via the incldued git hashes of each prompt in order to use these as file references and change impelmentation steps for improvements / elimination user patch prompts
* Will yuse the `.allhands/flows/shared/PROMPT_TASKS_CURATION.md` file as a guide to create user-patch prompts to make these extra work units.
* esnures that user deicsions and rationale as to the removal / adjustments of these emergent refinement prompts are documented in the alignment doc and the prompts files themselves.
        