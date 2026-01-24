NOTES:
* inputs: 
  * Alignment doc path
  * Spec doc path
  * A specific domain to focus on of the implementation (eg react-native/expo, trpc/serverless, database/drizzle/supabase, web/tanstack/nextjs, dev tooling, CICD etc)
* outputs: A crtitical review of whether the implementation is following best practices for the domain.
* Uses git (diff to base) to read the relevant implementation files for that domain + identify the relevant prompts from the alignment doc (and will read those prompts)
* This reviewer will be spun up per domain touched by the implementation.
* It will extract relevant skills to the implementation using a sub tasks running `.allhands/flows/shared/SKILL_EXTRACTION.md`
* IT will extract relevant knowledge from the codebase using `ah knowledge docs search "<query>"`
* It will combine these learnings to ensure that this implemenation is following best practices for the domain that the codebase and skills have established.
* Returns the review results, and what needs to be improved / changed to better follow best practices + a summary of exactly what implementation violates for that domain (this infomration will be picked up by the compounding agent to encode back into the harness based on what the user wants to honor about this review - therfor preventing this from happneing again, OR modifying the skills / documentation to be more clear / include the correct information). Ordered by priority for fixing.
  