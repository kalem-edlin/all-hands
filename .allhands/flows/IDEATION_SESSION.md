<goal>
Capture user intent into a spec that grounds expectations in codebase reality. Spec = user intent document, not requirements doc.
</goal>

## Initiation
- Run `ah specs list --domains-only` to list all domains to get full observability to the roadmap's initiatives (can return empty)
- If a specific milestone name is not provided:
  - List the currently available domains to the user
  - Ask the user which initiative domain this new milestone will belong to (can be new)
  - The user may refer to an existing one, or be clearly talking about a new one.
  - You will need to infer the new milestone spec name from the users initial ideation prompt.
- Ask the user for their initial ideation prompt...
  
## Grounding (after initial ideation prompt, to prepare for user interview)
- Run `ah specs list --roadmap --domain <domain_name>` to list all milestones in the domain to get full observability to the roadmap's initiatives, and read those that this milestone may depend on.
- Kickoff parallel exploration Sub Tasks:
  - 1 to 3 Tasks: break apart the user's intial ideation prompt parts and tell each Task to read the `.allhands/flows/IDEATION_CODEBASE_GROUNDING.md` along with verbose search goals for state-of-the-world codebase reality understanding.
    - These tasks will give you hard roadmap milestone dependencies that your spec will be building on top of.
  - 1 to 2 Tasks: break apart the user's intial ideation prompt parts and tell each Task to read the `.allhands/flows/RESEARCH_GUIDANCE.md` along with verbose search goals for high level approaches to solve the problem(s) / identify the solution the user is looking for.

## Surveying (conversation)
- Interview to elicit: goals, motivations, concerns, desires, capabilities, expectations
- One question at a time - reflect back understanding, probe vague answers
- The user may want to go level in the solution space - IF THEY DO, you MUST allow this and MUST entertain their research needs by reading `.allhands/flows/RESEARCH_GUIDANCE.md` yourself for guidance.
- Present feasibility feedback grounded in what you learned - let user react and clarify
- Synthesize guiding principles from user's philosophy - validate with them
- Continue this loop until the user tells you to move on to spec writing.

### Interview Guidance
| Dimension | Elicit via | Infer from |
|-----------|------------|------------|
| Goals | "What are you trying to accomplish?" | Problem description |
| Motivations | "Why does this matter?" | Frustrations expressed |
| Concerns | "What worries you about this?" | Caveats/hedging |
| Desires | "What would ideal look like?" | Enthusiasm |
| Capabilities | "What can you handle vs need automated?" | Technical language |
| Expectations | "What would success look like?" | Examples given |

## Spec Output
- Run `ah schema spec` to understand the spec format, goals, and motiviations
- In `specs/roadmap/`, write your spec file `{MILESTONE_NAME}.spec.md` capturing:
  - User desires and expectations (what they want, why, success criteria)
  - Assumptions about other milestones (NOT cross-references - use "Assuming X exists...")
  - Open questions for architect to research/decide
  - Technical considerations grounded in codebase reality
  - Dont forget to add the milestones this spec builds upon as dependencies!
- Spec captures where user's head is at - architect may find better approaches and present findings

### Preference Language
| User input | Write as |
|------------|----------|
| Strong preference | "User desires X" / "User expects X" |
| Likes but flexible | "User likes X but open to alternatives" |
| Just an idea | "User proposes X, open-ended for architect" |
| No opinion | Leave in Open Questions |

### Open Questions Guidance
- **Close yourself**: Obvious feasibility questions, things answerable from gathered context
- **Leave open**: Technology selection needing deep research, tradeoffs needing architect expertise, anything user explicitly delegated

### Building on Unimplemented Milestones
- Ideation uses "Assuming X exists..." or in the case of open questions, "Assuming any of X, Y, Z exist..." to express ground truths that are being built upon that should be implemented by the time this milestone is implemented.

## Closing

After writing the spec file, you MUST ask the user:

> **"Would you like to enable this milestone now?"**
>
> This will:
> 1. Create a new branch for this milestone (name will be inferred from the spec)
> 2. Initialize the `.planning/{branch}/` directory with status tracking
> 3. Allow you to proceed to planning and execution
>
> If you choose "no", the spec will remain in `specs/roadmap/` for later activation via the TUI's "Choose Milestone" action.

If the user says yes:
1. Use `ah oracle suggest-branch` with the spec content to get a branch name (e.g., `feature/add-user-auth`)
2. Run `git checkout -b <the-suggested-branch-name>` to create and switch to the new branch
3. Use `ah planning init` to initialize the planning directory for this branch
4. Notify the user that the milestone is now active and they can return to the TUI hub

**IMPORTANT**: Never use literal placeholder text like `{branch_name}` in commands. Always substitute with actual values.

**Note**: The TUI hub monitors for branch changes and will automatically detect when this ideation session has created a new milestone branch.