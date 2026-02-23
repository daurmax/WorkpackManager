---
depends_on: [A5_integration_meta]
repos: [WorkpackManager]
---
# Retrospective Agent Prompt

> Capture execution outcomes, quality trends, and process improvements after merge.

## READ FIRST

1. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/00_request.md`
2. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/01_plan.md`
3. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/workpack.state.json`

## Objective

Document what worked, what failed, and what should change for future workpacks in the `workpack-protocol` group.

## Required Sections

1. Scope and delivery summary
2. What went well
3. What caused friction
4. Defects and rework analysis (B-series review)
5. Estimation accuracy (planned vs actual effort)
6. Commit tracking bootstrapping exception assessment
7. Action items with owners

## Metrics

| Metric | Value |
|--------|-------|
| Total prompts | 8 (A0–A5, B1, B2) |
| First-pass completions | 7 |
| B-series count | 2 (B1 complete, B2 skipped) |
| Skipped prompts | 1 (B2 — bootstrapping exception) |
| Total elapsed time | |

## Context

This workpack introduced three protocol enhancements (B-series DAG, commit tracking, workpack modernization) in a single delivery. Notably, commit tracking (A2) was itself introduced by this workpack, creating a bootstrapping exception where all prompts share a single batch commit (`70434b2`). This retrospective should explicitly assess whether the bootstrapping approach was acceptable and whether future workpacks should avoid self-referential protocol changes.

## Handoff Output (JSON)

Write `outputs/R1_retrospective.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "01_workpack-protocol_prompt-lifecycle",
  "prompt": "R1_retrospective",
  "component": "retrospective",
  "delivery_mode": "pr",
  "branch": {
    "base": "main",
    "work": "feature/workpack-protocol-evolution",
    "merge_target": "main"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": [],
    "branch_verified": false
  },
  "changes": {
    "files_modified": [],
    "files_created": [],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      "python workpacks/tools/workpack_lint.py",
      "python workpacks/tools/validate_workpack_files.py"
    ],
    "regression_added": false,
    "regression_notes": "Retrospective — no code changes."
  },
  "handoff": {
    "summary": "Retrospective completed.",
    "next_steps": [],
    "known_issues": []
  },
  "repos": ["WorkpackManager"],
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
- [ ] Bootstrapping exception assessment documented
- [ ] Commit SHA handling documented in `artifacts.commit_shas` (`[]` only for no-change prompts)
- [ ] `outputs/R1_retrospective.json` written
