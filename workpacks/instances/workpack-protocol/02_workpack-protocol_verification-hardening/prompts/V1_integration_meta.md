---
depends_on: [A6_git_hooks_ci_templates, A7_unified_verify_command]
repos: [WorkpackManager]
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
- For each prior prompt output JSON, extract `artifacts.commit_shas` and verify each SHA exists on `branch.work`.
- For each verified SHA, inspect changed files and cross-reference with `change_details[].file`.
- Report commit/file declaration discrepancies (undeclared files in commits, declared files not in commits).
- Set `artifacts.branch_verified` to `true` only when all commit checks pass.
- If B-series prompts exist, verify DAG acyclicity, dependency-respecting execution order, and output JSON presence for all DAG-referenced prompts.
- Produce clear pass/fail decision with blocking issues if any.

## Verification

```bash
# Replace with project commands
<project_validation_command_1>
<project_validation_command_2>

# Commit verification examples
git log --oneline <WORK_BRANCH> | grep <SHA>
git show --stat <SHA>
```

## Commit and B-series Verification Procedure

1. Enumerate completed prompt outputs and read each `artifacts.commit_shas`.
2. For each SHA, run `git log --oneline <WORK_BRANCH> | grep <SHA>` and fail on missing SHAs.
3. For each SHA, run `git show --stat <SHA>` and extract the changed file list.
4. Compare git changed files with that prompt output's `change_details[].file` entries.
5. Record both mismatch classes:
   - file exists in commit but is missing from `change_details`
   - file declared in `change_details` but absent from commit
6. If B-series prompts are present:
   - verify DAG is acyclic,
   - verify prompt completion order respects `depends_on`,
   - verify every B-series prompt in DAG has `outputs/<PROMPT>.json`.
7. Set `artifacts.branch_verified` to `true` in the integration output only if all checks above pass.

## Acceptance Criteria Coverage Table

| AC ID | Status | Evidence |
|-------|--------|----------|
| AC1 | pass/fail | command, file, or test reference |

## Handoff Output (JSON)

Write `outputs/V1_integration_meta.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "<WORKPACK_ID>",
  "prompt": "V1_integration_meta",
  "component": "verification",
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
- [ ] Commit SHA(s) verified and `artifacts.branch_verified` set when applicable
- [ ] `outputs/V1_integration_meta.json` written
- [ ] Merge decision documented
