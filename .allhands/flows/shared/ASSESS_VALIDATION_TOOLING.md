<goal>
Assess validation tooling coverage for a spec. Returns structured gap analysis
that determines whether planning can proceed or if tooling must be created first.
Per **Agentic Validation Tooling**, implementation cannot be planned without
knowing what deterministic validation is available.
</goal>

<inputs>
- Spec file path
- Spec acceptance criteria
</inputs>

<outputs>
- Coverage report with confidence levels
- Blocking gaps that prevent quality automation
- Recommendations for each gap
- Fallback strategies if engineer declines tooling creation
</outputs>

<constraints>
- MUST use the validation quality matrix for assessment
- MUST distinguish between blocking and non-blocking gaps
- MUST provide fallback strategies for each gap
- MUST NOT recommend tooling creation for trivial gaps
</constraints>

## Phase 1: Inventory Current Tooling

Run `ah validation-tools list` to enumerate:
- Available validation suites
- Their glob patterns (what files they cover)
- Their capabilities (what they validate)
- Their confidence level (how close to end-user experience)

## Phase 2: Spec Decomposition

For each acceptance criterion in the spec:
1. What technology domains does it touch?
2. What file patterns will implementation create/modify?
3. What validation is needed for confidence?

Use the **Validation Quality Matrix** (below) to determine optimal validation.

## Phase 3: Coverage Mapping

For each validation need:
1. Check if existing suite covers it
2. Assess coverage confidence (full, partial, none)
3. Identify gaps

## Phase 4: Gap Classification

Classify each gap:

**Blocking Gaps** (cannot achieve quality automation without):
- No E2E validation for user-facing flows
- No type safety for typed languages
- No contract validation for API integrations
- No migration validation for schema changes

**Non-Blocking Gaps** (reduce confidence but can proceed):
- Missing load testing (can manually verify)
- Missing visual regression (can manually review)
- Partial coverage of edge cases

## Phase 5: Fallback Strategy Generation

For each gap, provide fallback if engineer declines tooling:
- What manual steps replace automation?
- What acceptance criteria become human-verified?
- What confidence level drops to?

## Phase 6: Report Generation

Return structured assessment:

```yaml
spec: <spec-name>
assessment_date: <date>

coverage:
  - criterion: "<acceptance criterion text>"
    domain: <web|api|mobile|database|infrastructure|performance>
    validation_type: <type from quality matrix>
    suite: <existing-suite-name>
    confidence: <high|medium|low>
    notes: "<explanation>"

gaps:
  - criterion: "<acceptance criterion text>"
    domain: <domain>
    validation_type: <needed type>
    blocking: <true|false>
    reason: "<why this is a gap>"
    recommendation:
      tooling: "<recommended framework/tool>"
      effort: "<low|medium|high>"
      cicd_impact: "<pipeline changes needed>"
    fallback:
      strategy: "<manual alternative>"
      confidence_drop: "<from X to Y>"
      acceptance: "<what engineer must manually verify>"

blocking_summary:
  has_blocking_gaps: <true|false>
  blocking_count: <number>
  recommendation: "<summary recommendation>"

proceed_without_tooling:
  possible: <true|false>
  confidence_level: "<full|reduced|minimal>"
  manual_steps_required: <number>
  risk_accepted: "<what won't be automatically validated>"
```

---

## Validation Quality Matrix

Use this matrix to assess validation quality by domain. Goal: validation as close to end-user experience as possible.

### Web/Frontend

| Validation Type | Confidence | Distance from User | When Required |
|----------------|------------|-------------------|---------------|
| E2E Browser (Playwright/Cypress) | **Highest** | Closest | User-facing flows |
| Visual Regression | High | Close | Design-sensitive UI |
| Accessibility | High | Close | Public-facing |
| Component Testing | Medium | Moderate | Complex components |
| Unit Tests | Lower | Far | Utility functions |
| Type Checking | Baseline | Farthest | Always |

**Blocking if missing**: E2E browser for user-facing acceptance criteria

### API/Backend

| Validation Type | Confidence | Distance from User | When Required |
|----------------|------------|-------------------|---------------|
| Integration Tests (real DB) | **Highest** | Closest | Data persistence |
| Contract Tests (OpenAPI) | High | Close | API consumers |
| Service Tests (mocked deps) | Medium | Moderate | Business logic |
| Unit Tests | Lower | Far | Utilities |
| Type Checking | Baseline | Farthest | Always |

**Blocking if missing**: Integration tests for CRUD acceptance criteria

### Database/Migration

| Validation Type | Confidence | Distance from User | When Required |
|----------------|------------|-------------------|---------------|
| Migration E2E (real DB) | **Highest** | Closest | Schema changes |
| Rollback Testing | High | Close | Production safety |
| Data Integrity Checks | Medium | Moderate | Data transformations |
| Schema Validation | Lower | Far | Structure only |

**Blocking if missing**: Migration E2E for any schema change

### Mobile

| Validation Type | Confidence | Distance from User | When Required |
|----------------|------------|-------------------|---------------|
| Device E2E (Detox/Maestro) | **Highest** | Closest | User flows |
| Visual Regression | High | Close | Design-sensitive |
| Component Testing | Medium | Moderate | Complex components |
| Unit Tests | Lower | Far | Utilities |

**Blocking if missing**: Device E2E for user-facing flows

### Infrastructure

| Validation Type | Confidence | Distance from User | When Required |
|----------------|------------|-------------------|---------------|
| Deployment E2E | **Highest** | Closest | Infra changes |
| Smoke Tests | High | Close | Service health |
| Config Validation | Medium | Moderate | Config changes |
| IaC Linting | Lower | Far | Syntax |

**Blocking if missing**: Deployment E2E for infrastructure changes

### Performance

| Validation Type | Confidence | Distance from User | When Required |
|----------------|------------|-------------------|---------------|
| Load Testing (k6/Artillery) | **Highest** | Closest | Scale requirements |
| Benchmark Suites | High | Close | Regression detection |
| Profiling | Medium | Moderate | Optimization work |

**Blocking if missing**: Usually non-blocking (can be manual)

---

## Decision Tree for Gap Assessment

```
For each acceptance criterion:
│
├─► Identify technology domain (web, api, mobile, infra, etc.)
│
├─► Look up domain in Validation Quality Matrix
│
├─► What validation type is needed for this criterion?
│   │
│   ├─► User-facing behavior? → Need highest-confidence validation
│   ├─► Data persistence? → Need integration/E2E tests
│   ├─► API contract? → Need contract tests
│   └─► Internal logic? → Unit tests may suffice
│
├─► Does existing tooling cover this?
│   │
│   ├─► Yes, full coverage → Mark covered, high confidence
│   ├─► Yes, partial → Mark covered, medium confidence, note gaps
│   └─► No coverage → Identify as gap
│
└─► For gaps:
    │
    ├─► Is this criterion user-facing or critical path?
    │   ├─► Yes → Blocking gap
    │   └─► No → Non-blocking gap
    │
    └─► Generate fallback strategy
```
