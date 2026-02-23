---
depends_on: []
repos: [<REPO_NAME>]
---
# Bootstrap Agent Prompt

> Set up the workpack execution baseline and unblock parallel A-series prompts.

## READ FIRST

1. `workpacks/instances/<group>/<workpack>/00_request.md`
2. `workpacks/instances/<group>/<workpack>/01_plan.md`
3. `workpacks/instances/<group>/<workpack>/workpack.meta.json`
4. `workpacks/_template/prompts/PROMPT_STYLE_GUIDE.md`

## Objective

Prepare the branch, verify required dependencies, and ensure scaffold/runtime files are in place for the workpack.

## Implementation Requirements

- Confirm all `requires_workpack` dependencies are complete.
- Create or switch to the feature branch defined in `01_plan.md`.
- Verify repository baseline checks pass (build/lint/test command set for the project).
- Ensure `outputs/` exists and is writable.

## Constraints

- Do not implement feature code in this prompt.
- Do not change scope beyond bootstrap prerequisites.

## Verification

```bash
# Replace with project commands
<build_or_sanity_command>
<lint_or_static_check_command>
```

## Handoff Output (JSON)

Write `outputs/A0_bootstrap.json`.

```json
{
  "schema_version": "1.1",
  "workpack": "<WORKPACK_ID>",
  "prompt": "A0_bootstrap",
  "component": "bootstrap",
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
    "commands": [
      {
        "cmd": "<build_or_sanity_command>",
        "result": "pass",
        "notes": ""
      }
    ],
    "regression_added": false,
    "regression_notes": ""
  },
  "handoff": {
    "summary": "Bootstrap completed and workspace is ready.",
    "next_steps": [
      "Start dependent A-series prompts"
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
  "change_details": [],
  "notes": ""
}
```

## Deliverables

- [ ] Bootstrap checks complete
- [ ] Branch ready for dependent prompts
- [ ] `outputs/A0_bootstrap.json` written
