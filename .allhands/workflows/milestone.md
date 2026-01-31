---
name: milestone
type: milestone
planning_depth: deep
jury_required: true
max_tangential_hypotheses: 5
required_ideation_questions:
  - "What are you trying to accomplish?"
  - "Why does this matter and what worries you about this?"
  - "What can you handle vs need automated?"
  - "What would success look like?"
---

## Domain Knowledge

### Core Interview Dimensions

The `required_ideation_questions` elicit each dimension directly. Also infer dimensions passively from engineer behavior:

| Dimension | Elicit via | Infer from |
|-----------|------------|------------|
| Goals | "What are you trying to accomplish?" | Problem description |
| Motivations | "Why does this matter?" | Frustrations expressed |
| Concerns | "What worries you about this?" | Caveats/hedging |
| Desires | "What would ideal look like?" | Enthusiasm |
| Capabilities | "What can you handle vs need automated?" | Technical language |
| Expectations | "What would success look like?" | Examples given |

### Category Deep Dives

Work through relevant categories based on milestone scope. Each category surfaces domain-specific concerns that engineers often underspecify:

| Category | Key Questions | Knowledge Gap Signals |
|----------|---------------|----------------------|
| **User Experience** | "Walk through: user opens this first time - what happens?" | Describes features instead of journeys |
| **Data & State** | "What needs to be stored? Where does data come from/go?" | Says "just a database" without schema thinking |
| **Technical** | "What systems must this work with? Constraints?" | Picks tech without understanding tradeoffs |
| **Scale** | "How many users/requests? Now vs future?" | Says "millions" without infrastructure thinking |
| **Integrations** | "External services? APIs consumed/created?" | Assumes integrations are simple |
| **Security** | "Who should do what? Sensitive data?" | Says "just basic login" |

### Knowledge Gap Detection

Watch for these signals requiring deeper probing:

| Signal | Action |
|--------|--------|
| "I think..." or "Maybe..." | Probe deeper, offer research |
| "That sounds good" (to your suggestion) | Verify they understand implications |
| "Just simple/basic X" | Challenge - define what simple means |
| Technology buzzwords without context | Ask what they think it does |
| Conflicting requirements | Surface the conflict explicitly and ask for Disposable Variants Approach |

### Preference Language

Map engineer input to spec language that preserves intent fidelity:

| Engineer Input | Write As |
|----------------|----------|
| Strong preference | "Engineer desires X" / "Engineer expects X" |
| Likes but flexible | "Engineer likes X but open to alternatives" |
| Just an idea | "Engineer proposes X, open-ended for architect" |
| No opinion | Leave in Open Questions |

### Open Questions Guidance

- **Close yourself**: Obvious feasibility questions, things answerable from gathered context
- **Leave open**: Technology selection needing deep research, tradeoffs needing architect expertise, anything engineer explicitly delegated

### Building on Unimplemented Milestones

Use "Assuming X exists..." or "Assuming any of X, Y, Z exist..." to express dependencies on milestones that will be implemented by the time this one is. Never use cross-references to unimplemented milestone specs.

### Completeness Check

Before transitioning from ideation to spec writing, verify coverage:

| Area | Verified |
|------|----------|
| Problem statement clear | [ ] |
| Technical constraints understood | [ ] |
| User expectations deeply understood | [ ] |
| All discernable milestone elements either have a user expectation, or an open question for downstream agents | [ ] |
| No "To Be Discussed" items remaining | [ ] |

If gaps exist, return to surveying for specific categories.

## Ideation Guidance

Per **Ideation First**, engineers control depth — domain config ensures coverage without forcing depth.

### Probe Guidance

- Probe vague responses with category deep dives
- Detect knowledge gaps using the signal table
- Validate preference language to preserve intent fidelity
- Ask one question at a time — reflect back understanding before moving on

### Grounding

Spawn parallel subtasks during interview to ground ideation in codebase reality:
- 1-3 codebase exploration subtasks (yields hard dependencies, feasibility constraints)
- 0-2 research subtasks for high-level tech solution approaches (if necessary)
- Spawn ongoing research subtasks as new concepts emerge during the interview

Present feasibility feedback grounded in exploration results.

### Guiding Principles Synthesis

Synthesize guiding principles from the engineer's philosophy expressed during ideation. Validate synthesized principles with the engineer before proceeding to spec writing.

### Output Sections

Spec body sections for milestone domain:
- **Motivation**: Implicit in goals — why this matters
- **Goals**: What the engineer is trying to accomplish
- **Technical Considerations**: Grounded in codebase reality from exploration subtasks
- **Open Questions**: For architect to research/decide during planning

### Optional: Spec Flow Analysis

Before or after creating the spec, offer flow analysis for complex features. Recommended for user-facing features with multiple paths, complex integrations, or features with unclear scope boundaries.

## Planning Considerations

### Deep Research

Spawn parallel subtasks to ground recommendations before the engineer interview:
- 1-4 codebase understanding subtasks for relevant implementation approaches
- 0-3 external research subtasks to isolate optimal solutions (if necessary)
- Search documented solutions with `ah solutions search` for relevant past learnings
- Search memories with `ah memories search` for engineer preferences and prior spec insights

### Full Engineer Interview

Per **Quality Engineering**, present researched approaches as options:
- Ask one decision point at a time — do not batch questions
- 2-4 options per question with recommended approach marked
- Engineer can choose one or many (disposable variants)
- Adapt subsequent questions based on prior answers when logical dependencies exist

### Disposable Variant Architecture

When engineer selects multiple approaches:
- Create parallel variant prompts behind feature flags
- Each variant is cheap to implement and test
- Engineer must choose a convention when selecting multiple approaches
- Multi-select triggers parallel variant prompts — planning agent architects variant structures

### External Technology Research

After understanding implementation approach and required external technology:
- Spawn subtasks for external tech documentation research
- Consolidate approach against actual documentation
- Derive specific implementation steps
- Can inform engineer interview where beneficial

### Validation Suite Discovery

- Discover and assign existing validation suites to prompts
- For high-risk domains (auth, payments, data), flag TDD workflow requirement in prompts

### Plan Verification

Before jury review, self-verify plans achieve goals:

| Dimension | Check |
|-----------|-------|
| Requirement Coverage | Every spec requirement has task(s)? |
| Task Completeness | Every prompt has clear acceptance criteria? |
| Key Links Planned | Components wire together (API -> UI)? |
| Scope Sanity | 2-3 tasks per prompt? <7 files per prompt? |
| Validation Coverage | Prompts reference available validation suites where applicable? |

Fix issues before proceeding to jury review.

### 4-Member Jury Review

Spawn parallel review subtasks:

| Jury Member | Focus |
|-------------|-------|
| **Expectations Fit** | Alignment + prompts fit spec expectations |
| **Flow Analysis** | Prompt dependencies, variant ordering, importance |
| **YAGNI** | Holistic over-engineering check |
| **Premortem** | Risk analysis — Tigers (P1/P2), Elephants (discussion points), failure modes |

After jury returns:
- Premortem Tigers become P1/P2 review items; Elephants become discussion points
- Present actionable options to engineer (including risk acceptance decisions)
- Create new prompts for additions exceeding scope limits rather than packing into existing prompts
- Update prompt dependencies when inserting new prompts

### Review Options Breakdown

Synthesize jury feedback into actionable options for the engineer. Document only deviations from recommendations, including accepted risks that were flagged.

### Plan Deepening (Optional)

Per **Knowledge Compounding**, offer to deepen the plan with comprehensive research. Recommended for complex architectural decisions, high-risk domains, novel technologies, or large specs with many unknowns.

### Prompt Output Range

Milestone specs produce 5-15 coordinated prompts. Prompts must be fully autonomous — no human intervention during execution.
