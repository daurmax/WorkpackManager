---
depends_on: [V1_integration_meta]
repos: [<REPO_NAME>]
---
# Retrospective Agent Prompt

> Capture execution outcomes, quality trends, and process improvements after merge.

## Objective

Document what worked, what failed, and what should change for future workpacks.

## Required Sections

1. Scope and delivery summary
2. What went well
3. What caused friction
4. Defects and rework analysis
5. Estimation accuracy (planned vs actual)
6. Action items with owners

## Metrics

| Metric | Value |
|--------|-------|
| Total prompts | |
| First-pass completions | |
| B-series count | |
| Total elapsed time | |

## Handoff Output (JSON)

Write `outputs/R1_retrospective.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "<WORKPACK_ID>",
  "prompt": "R1_retrospective",
  "component": "retrospective",
  "delivery_mode": "pr",
  "branch": {
    "base": "main",
    "work": "feature/<workpack-slug>",
    "merge_target": "main"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": [
      "<COMMIT_SHA_OR_EMPTY_FOR_NO_CHANGE>"
    ],
    "branch_verified": false
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
    "summary": "Retrospective completed.",
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
  "change_details": [],
  "notes": ""
}
```

## Deliverables

- [ ] Retrospective document complete
- [ ] Action items recorded
- [ ] Commit SHA handling documented in `artifacts.commit_shas` (`[]` only for no-change prompts)
- [ ] `outputs/R1_retrospective.json` written
