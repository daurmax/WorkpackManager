---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Commit SHA Verification Tool Agent Prompt

> Verify that commit SHAs declared in output artifacts exist on the work branch and cross-reference change_details with git history.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/00_request.md`
2. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/01_plan.md`
3. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.state.json`
5. `workpacks/PROTOCOL_SPEC.md` — commit tracking requirements
6. `workpacks/WORKPACK_OUTPUT_SCHEMA.json` — `artifacts.commit_shas` and `change_details` schema

## Context

Workpack: `workpack-protocol/02_workpack-protocol_verification-hardening`

## Delivery Mode

- PR-based

## Objective

Create a Python module `workpacks/tools/verify_commits.py` that verifies commit SHA integrity for completed prompt outputs. The tool performs two classes of checks:

1. **SHA existence** — for each output JSON, extract `artifacts.commit_shas` and verify each SHA exists on the work branch via `git log`.
2. **Change details cross-reference** — for each commit SHA, run `git show --stat` and compare the changed file list against `change_details[].file` entries. Report both discrepancy types: files in commit but not declared, and files declared but not in commit.

## Reference Points

- `PROTOCOL_SPEC.md` — commit tracking section (protocol 2.2.0+)
- `WORKPACK_OUTPUT_SCHEMA.json` — `artifacts.commit_shas`, `change_details[].file`
- `workpacks/tools/workpack_lint.py` — `WARN_MISSING_COMMIT_SHAS` check pattern

## Implementation Requirements

1. Create `workpacks/tools/verify_commits.py` with functions:
   - `check_commit_shas_exist(workpack_dir, work_branch)` — for each completed output JSON, extract `artifacts.commit_shas` and verify each SHA exists on the branch using `git log --oneline <branch>`.
   - `cross_reference_change_details(workpack_dir)` — for each commit SHA, run `git show --stat <sha>` and extract changed files. Compare with `change_details[].file` from the output JSON. Report mismatches.
2. Return structured results: list of `{check_id, severity, message, details}` dicts.
3. Git operations must gracefully degrade when `.git` is absent (skip checks, emit INFO-level note).
4. Only apply commit checks to 2.2.0+ workpacks (check `protocol_version` in meta).
5. The module must be importable and also runnable standalone.
6. Read-only analysis: never modify workpack files or git history.
7. Use `subprocess` for git commands; no new Python dependencies.

## Scope

### In Scope
- Commit SHA existence verification on work branch (AC8)
- Change details cross-reference against `git show --stat` (AC9)
- Graceful degradation without `.git` directory
- Unit tests with mock git operations, >90% branch coverage (AC15)

### Out of Scope
- State transition validation (A1)
- Markdown-JSON sync (A2)
- Output artifact schema validation (A3)

## Acceptance Criteria

- [ ] AC8: Commit verification tool checks that `artifacts.commit_shas` SHAs exist on the work branch (2.2.0+ workpacks only).
- [ ] AC9: Commit verification tool cross-references `change_details[].file` against `git show --stat`.
- [ ] AC15: All new checks have unit tests with >90% branch coverage.
- [ ] AC16: Existing tests remain passing.

## Verification

```bash
python -m pytest workpacks/tools/tests/ -v
python workpacks/tools/workpack_lint.py
python workpacks/tools/verify_commits.py
```

## Handoff Output (JSON)

Write `outputs/A4_commit_verification_tool.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "02_workpack-protocol_verification-hardening",
  "prompt": "A4_commit_verification_tool",
  "component": "verification-tooling",
  "delivery_mode": "pr",
  "branch": {
    "base": "main",
    "work": "feature/verification-hardening",
    "merge_target": "main"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": ["<COMMIT_SHA>"],
    "branch_verified": false
  },
  "changes": {
    "files_modified": [],
    "files_created": ["workpacks/tools/verify_commits.py", "workpacks/tools/tests/test_verify_commits.py"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "python -m pytest workpacks/tools/tests/ -v", "result": "pass", "notes": "" }
    ],
    "regression_added": true,
    "regression_notes": "Unit tests for commit SHA verification with mock git"
  },
  "handoff": {
    "summary": "Commit SHA existence and change_details cross-reference verification implemented.",
    "next_steps": ["Proceed to A6/A7 after parallel tasks complete"],
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

- [ ] `workpacks/tools/verify_commits.py` created
- [ ] Unit tests in `workpacks/tools/tests/test_verify_commits.py`
- [ ] Existing tests still passing
- [ ] `outputs/A4_commit_verification_tool.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
