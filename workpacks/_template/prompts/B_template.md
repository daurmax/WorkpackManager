---
depends_on: [<PROMPT_STEM_THAT_INTRODUCED_ISSUE>]
repos: [<REPO_NAME>]
---
# Bug Fix Agent Prompt

> Resolve a verified defect discovered during workpack execution.

## Bug Report

- **Bug ID**: `B1_<bug_slug>`
- **Discovered in**: `<PROMPT_STEM>`
- **Affected area**: `<component_or_module>`

## Severity

| Level | Definition |
|-------|------------|
| blocker | Must be fixed before merge |
| major | Significant defect that should be fixed in this workpack |
| minor | Low impact; may be deferred with explicit approval |

This bug is classified as: `<blocker|major|minor>`

## Objective

Fix the defect, document root cause, and add regression coverage when feasible.

## Root Cause

Describe why the issue occurred and what invariant was violated.

## Implementation Requirements

- Apply the smallest safe change that resolves the defect.
- Preserve existing behavior outside the bug scope.
- Add or update regression checks when feasible.
- Update status/state files to reflect bug-fix execution.

## Verification

```bash
# Replace with project commands
<reproduction_command>
<regression_command>
```

## Handoff Output (JSON)

Write `outputs/B1_<bug_slug>.json`.

```json
{
  "schema_version": "1.1",
  "workpack": "<WORKPACK_ID>",
  "prompt": "B1_<bug_slug>",
  "component": "bugfix",
  "delivery_mode": "pr",
  "branch": {
    "base": "main",
    "work": "feature/<workpack-slug>",
    "merge_target": "main"
  },
  "changes": {
    "files_modified": [],
    "files_created": [],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [],
    "regression_added": true,
    "regression_notes": ""
  },
  "handoff": {
    "summary": "Bug fixed.",
    "next_steps": [
      "Run V-series verification prompt"
    ],
    "known_issues": []
  },
  "repos": [
    "<REPO_NAME>"
  ],
  "execution": {
    "model": "<MODEL_ID>",
    "tokens_in": 0,
    "tokens_out": 0,
    "duration_ms": 0
  },
  "severity": "major",
  "change_details": [],
  "notes": ""
}
```

## Deliverables

- [ ] Defect resolved
- [ ] Regression coverage added or explicitly waived
- [ ] `outputs/B1_<bug_slug>.json` written
