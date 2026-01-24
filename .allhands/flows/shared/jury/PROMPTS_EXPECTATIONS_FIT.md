NOTES:
* inputs: 
  * Alignment doc path
  * Spec doc path
  * Prompts folder path
* outputs: A review of whether the prompts expectations fit the user's expectations as defined in the spec doc.
* Everything about the produced planning matter (prompts + alignment doc) are criticized whilst taking user expectations from alignment doc + relevant prompts files into account as ground truth but looking for the inconsistencies / holes in user expectations that the planning/implementation approach consolidation phase missed and did not account for.   
* Returns the review results, and what needs to be improved / changed to better fit the user's expectations (by prompt numbers / alignment doc specific etc) + a summary of exactly what implementation violates the highlighted expectations. Ordered by priority for fixing.