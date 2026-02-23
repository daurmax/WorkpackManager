---
depends_on: [B1_<bug_slug>]
repos: [<REPO_NAME>]
---
# Bug Fix Verification Agent Prompt (V-Loop)

> Verify that one or more B-series fixes are complete and regression-safe.

## Linked Bug Fixes

- `B1_<bug_slug>`

## Objective

Re-run defect reproduction and regression checks, confirm no new issues were introduced, and decide whether the workpack can proceed.

## Implementation Requirements

- Verify each linked bug is no longer reproducible.
- Execute required regression and integration checks.
- Report unresolved defects and whether another B-series loop is required.

## Verification

```bash
# Replace with project commands
<bug_reproduction_command>
<regression_suite_command>
```

## Handoff Output (JSON)

Write `outputs/V_bugfix_verify.json`.

```json
{
  "schema_version": "1.1",
  "workpack": "<WORKPACK_ID>",
  "prompt": "V_bugfix_verify",
  "component": "verification",
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
    "regression_added": false,
    "regression_notes": ""
  },
  "handoff": {
    "summary": "Bug-fix verification completed.",
    "next_steps": [],
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
  "iteration": 1,
  "b_series_resolved": [
    "B1_<bug_slug>"
  ],
  "b_series_remaining": [],
  "b_series_budget_warning": false,
  "change_details": [],
  "notes": ""
}
```

## Deliverables

- [ ] Linked bug fixes verified
- [ ] V-loop status decided (pass or continue)
- [ ] `outputs/V_bugfix_verify.json` written
