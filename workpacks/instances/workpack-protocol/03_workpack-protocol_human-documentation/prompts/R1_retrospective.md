---
depends_on: [V1_integration_meta]
repos: [WorkpackManager]
---
# Retrospective Agent Prompt

> Capture execution outcomes, quality trends, and process improvements after merge.

## READ FIRST

1. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/00_request.md`
2. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/01_plan.md`
3. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/workpack.state.json`
5. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/outputs/V1_integration_meta.json`

## Objective

Document what worked, what failed, and what should change for future workpacks.

## Implementation Requirements

- Summarize delivery against the request scope and acceptance criteria outcomes.
- Capture first-pass successes and areas that needed correction.
- Record process/tooling issues and concrete preventive actions.
- Include measurable data for prompt counts, rework, and elapsed time.

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

## Verification

```bash
# Optional consistency checks before finalizing retrospective
python workpacks/tools/workpack_lint.py workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation
python workpacks/tools/validate_workpack_files.py workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation
```

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
