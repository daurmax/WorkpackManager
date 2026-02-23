---
depends_on: [<ALL_REQUIRED_A_SERIES_PROMPTS>]
repos: [<REPO_NAME>]
---
# Integration and Verification Agent Prompt (V1 Gate)

> Validate all required deliverables for merge readiness.

## READ FIRST

1. `workpacks/instances/<group>/<workpack>/00_request.md`
2. `workpacks/instances/<group>/<workpack>/01_plan.md`
3. `workpacks/instances/<group>/<workpack>/workpack.meta.json`
4. `workpacks/instances/<group>/<workpack>/workpack.state.json`
5. `workpacks/WORKPACK_OUTPUT_SCHEMA.json`
6. All completed prompt outputs in `outputs/`

## Objective

Run the integration gate for this workpack: validate output payloads, verify acceptance criteria coverage, and confirm merge readiness.

## Implementation Requirements

- Validate each completed `outputs/*.json` against `WORKPACK_OUTPUT_SCHEMA.json`.
- Run project verification commands (build/test/lint/security checks).
- Verify each acceptance criterion from `00_request.md` has evidence.
- Confirm status/state files reflect current execution state.
- Produce clear pass/fail decision with blocking issues if any.

## Verification

```bash
# Replace with project commands
<project_validation_command_1>
<project_validation_command_2>
```

## Acceptance Criteria Coverage Table

| AC ID | Status | Evidence |
|-------|--------|----------|
| AC1 | pass/fail | command, file, or test reference |

## Handoff Output (JSON)

Write `outputs/A5_integration_meta.json`.

```json
{
  "schema_version": "1.1",
  "workpack": "<WORKPACK_ID>",
  "prompt": "A5_integration_meta",
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
    "summary": "Integration gate executed.",
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

- [ ] Verification report completed
- [ ] `outputs/A5_integration_meta.json` written
- [ ] Merge decision documented
