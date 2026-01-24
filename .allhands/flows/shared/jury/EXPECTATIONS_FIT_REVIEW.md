NOTES:
* inputs: 
  * Alignment doc path
  * Spec doc path
* outputs: A crtitical review of whether the implementation fits the user's expectations as defined in the spec doc.
* Uses git (diff to base) to read any relevant implementation files and accounts for all decisions made in the alignment doc (reading select prompts for more info where necessary)
* It will combine these learnings to ensure that this implemenation is fitting the user's expectations as defined in the spec doc and all interjected user specific decisions among planning decisions (in the alignment doc).
* Returns the review results, and what needs to be improved / changed to better fit the user's expectations + a summary of exactly what implementation violates the highlighted expectations. Ordered by priority for fixing.