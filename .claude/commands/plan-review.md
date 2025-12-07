---
description: Review implementation against plan
args: [--last-commit]
---

Auto-detects plan and base branch from current branch.

**Intermediary step review** (`--last-commit`):
```bash
envoy vertex review --last-commit
```

**Final review** (all commits against base branch):
```bash
envoy vertex review
```

Review results and address any deviations from plan.
