<goal>
Ground the ideation in state-of-the-world codebase reality understanding what is implemented and also what is planned for implementation.
</goal>

<inputs>
* A collection of seed information / queries that the ideation agent needs roadmap / codebase context for
</inputs>

* You will be provided with queries about the codebase and roadmap infered from the user's intial ideation prompt.
* Use `ah knowledge roadmap search "<query>"` to get planned work that has yet to be implemented. This search will give you enough information to infer what the ideation will build on top of, and therefor depend on being complete. You must do any number of these queries in parallel first in order to overlay potential codebase implementation findings that would be invalid by the time these potential milestone dependencies are implemented.
* Use `ah knowledge docs search "<query>"` to understand existing codebase patterns, implementation, solutions, and engineer reasoning. Extract what is most relevant to the ideation input question, use LSP to navigate any relevant referenced symbols FIRST and if LSP is not possible, read referenced files. Use these to cover multiple queries in parallel to cover sufficient ground of undertanding view your inputs

<outputs>
* Relevant codebase files and their most relevant details / use case / engineering knowledge that must be considered by the ideation agent to faciliate an ideation interview based on the initial ideation prompt.
* A list of the milestone dependencies by name.
* For each milestone dependency, key features they will implement that the new ideation agent must ASSUME EXISTS and if approaches as open decisions for further planning, what the ideation agent must ASSUME AT LEAST ONE OF EXISTS
</outputs>