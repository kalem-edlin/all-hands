NOTES:
* (diff to base) Looks for maintainability, composablility, and software design inefficiencies in the implementation using git tooling. 
* Purley considers the codebase and its implementation to ensure it is maintainable, composable, and follows best practices from other established code from relevant components/features/services/domains.
* Essentially unsloppification, identifies probable agentic hallucination, agentic implementations that create duplications, miscommunications between inter prompt implementation agents that forget about each others established patterns etc. 
* Will need more firm rules about what to look out for here.
* Returns a selection of areas for improvement, and a summary of exactly what implementation violates the highlighted expectations. Ordered by priority for fixing.