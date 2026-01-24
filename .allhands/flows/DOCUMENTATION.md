NOTES:
* This is close to where it needs to be, but it needs to be refined to follow the FLOW rules. 
* This MUST be able to deduce if the codebase is brownfield and requires a full intensity documentation effort, or if the documentation has good covereage and therefor only requires documentation of the new feature / changes. 
* Im pretty sure there are already two flows to assist with this in this doc, but they need to be obvious as to what practice should be used / works from teh START of this document. 

<goal>
Analyze codebase, design doc structure, delegate writers, finalize with READMEs. View code as products, not paths.
</goal>

## Naming
- Name by PURPOSE: "all-hands-cli", "content-engine" ✓
- NOT by path: "src-lib", "packages-api" ✗

## Mode Decision
├─ No existing docs? → Init Mode
└─ Updating existing? → Adjust Mode (use `ah git diff-base-files` to scope)

---

## Init Mode

### 1. Detect Workspaces
```bash
ls pnpm-workspace.yaml lerna.json package.json 2>/dev/null
cat pnpm-workspace.yaml  # parse packages: array
```
- Each workspace member = candidate main domain

### 2. Analyze Each Domain
```bash
ah docs tree <domain_path> --depth 3
ah docs complexity <domain_path>
ah knowledge docs search "<domain>" --metadata-only
```

### 3. Classify
| Type | Lines | Areas | Agents | Target Files |
|------|-------|-------|--------|--------------|
| Simple | <2k | few | 1 | 3-10 |
| Medium | 2-10k | 2-4 | 1-2 | 10-30 |
| Complex | >10k | 5+ | 2-3 | 30-60 |

### 4. Identify Subdomains
Candidate if:
- 5+ source files in directory
- High complexity score
- Distinct responsibility

### 5. Flag Critical Tech
Check `package.json`. Flag if:
- Imported in 10+ files
- Defines architecture (routing, state, rendering)
- Platform-specific (native, hardware)
- Non-obvious choice needing explanation

### 6. Create Structure
```bash
mkdir -p docs/<domain>/<subdomain>
```
- MUST create dirs BEFORE delegating

### 7. Delegate Writers
- Spawn subtask per assignment
- Tell each subtask to read `.allhands/flows/DOCUMENTATION_WRITING.md`
- Max 15 agents per run - track `uncovered_domains` if exceeded

Assignment to provide:
```yaml
domain: "<product-name>"
doc_directory: "docs/<domain>/<subdomain>/"
source_directories: ["<path/to/src>"]
critical_technologies: ["<tech>"]
target_file_count: 3-6
notes: "<what knowledge to capture>"
```

### 8. Wait & Finalize
After all writers complete:
1. Read all produced docs
2. Write README.md per main domain:
   - Overview (2-3 sentences)
   - Mermaid diagram of subdomain relationships
   - Navigation table linking key docs
   - Entry points for readers

---

## Adjust Mode

### 1. Scope Changes
```bash
ah git diff-base-files
ah docs tree <affected-path> --depth 4
ah docs complexity <affected-path>
```

### 2. Check Existing Coverage
```bash
ah knowledge docs search "<changed-feature>" --metadata-only
```

### 3. Delegate
- Same as Init but only for affected areas

---

## Exclusions
| Never Document | Do Document |
|----------------|-------------|
| `node_modules/`, `dist/`, `build/` | `.github/workflows/` |
| `.next/`, `.expo/`, `.git/` | Root config files |
| `*.generated.ts`, `*.d.ts`, `vendor/` | DX artifacts |

## Constraints
- Every source path MUST appear in an assignment
- Writers produce 3-10 files per subdomain (not monoliths)
- Only taxonomist writes README.md
- Never assign excluded paths
