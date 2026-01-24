NOTES:
* Inputs: alignment doc path, spec doc path, prompts folder path - give all of these paths to the jury of reviewing subtasks to read from (you will also read these to help create prompts IF necessary from review)
* The job of this flow is to invoke a jury of reviewing subtasks to judge implementation against the planning files and spec invoking the usage of
  * For each domain touched: `.allhands/flows/shared/jury/DOMAIN_BEST_PRACTICES_REVIEW.md` (eg expo/react native, trpc/serveless api, database/drizzle/supabase, web/tanstack/nextjs, dev tooling, CICD etc) (each domain includes performance best practices, security best practices, code quality best practices, etc)
  * `.allhands/flows/EXPECTATIONS_FIT_REVIEW.md` (ensures the alignment doc + prompts reflect /document user decisions and implementation that combines to fit their original spec expectations)
  * `.allhands/flows/SECURITY_REVIEW.md` (ensures the implementation is secure and does not introduce any security risks)
  * `.allhands/flows/YAGNI_REVIEW.md` (ensures the implementation is performant and does not introduce any performance issues)