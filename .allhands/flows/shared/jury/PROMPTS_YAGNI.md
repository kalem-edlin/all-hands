NOTES:
* YAGNI = You Ain't Gonna Need It
* inputs: Alignment doc path, prompts folder path
* Reviews all of the planning matter (prompts + alignment doc) looking for ideas planned that are not necessary for the implementation and are therefore a waste of time and effort.
* Challenges user decisions if aboslutely necessary, but gives more leniency for things the human has explicitly decideded on (eg makes challnges of human decisions less of a priority to fix because the human is already specifically aware of it, and may get annoyed if the highest priority suggestions are all things theyve already clarified, but still offering them the opporunriyy to consider this YAGNI perspective)
* Returns the review results, and a summary of exactly what implementation violates the YANGI principles ordered by priority for fixing. 