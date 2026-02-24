---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Output Artifact Validation Agent Prompt

> Validate output JSON existence, schema conformance, and that declared files exist on disk.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/00_request.md`
2. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/01_plan.md`
3. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.state.json`
5. `workpacks/WORKPACK_OUTPUT_SCHEMA.json` — output JSON schema
6. `workpacks/PROTOCOL_SPEC.md` — output artifact invariants
7. `workpacks/tools/workpack_lint.py` — existing output validation logic

## Context

Workpack: `workpack-protocol/02_workpack-protocol_verification-hardening`

## Delivery Mode

- PR-based

## Objective

Create a Python module `workpacks/tools/verify_output_artifacts.py` that validates output artifacts for completed prompts. The module checks three things:

1. **Output existence** — every prompt marked `complete` in `workpack.state.json` must have a corresponding `outputs/<stem>.json` file.
2. **Schema conformance** — each output JSON must validate against `WORKPACK_OUTPUT_SCHEMA.json`.
3. **Declared file existence** — files listed in `changes.files_created` and `changes.files_modified` must exist on disk relative to the repository root.

## Reference Points

- `workpack.state.json` `prompt_status` — identifies which prompts are `complete`
- `WORKPACK_OUTPUT_SCHEMA.json` — the canonical schema for output validation
- `workpacks/tools/workpack_lint.py` — existing `WARN_SCHEMA_MISMATCH` infrastructure

## Implementation Requirements

1. Create `workpacks/tools/verify_output_artifacts.py` with functions:
   - `check_output_existence(workpack_dir)` — for each `complete` prompt in state, verify `outputs/<stem>.json` exists.
   - `check_output_schema(workpack_dir)` — validate each output JSON against `WORKPACK_OUTPUT_SCHEMA.json` using `jsonschema`.
   - `check_declared_files(workpack_dir, repo_root)` — for each output JSON, verify that files in `changes.files_created` and `changes.files_modified` exist on disk.
2. Return structured results: list of `{check_id, severity, message, details}` dicts.
3. The module must be importable and also runnable standalone.
4. Read-only analysis: never modify workpack files.
5. No new Python dependencies beyond `jsonschema` (already used).

## Scope

### In Scope
- Output JSON existence check for complete prompts (AC6)
- Output JSON schema validation against `WORKPACK_OUTPUT_SCHEMA.json`
- Declared file existence on disk (AC7)
- Unit tests with >90% branch coverage (AC15)

### Out of Scope
- State transition validation (A1)
- Markdown-JSON sync (A2)
- Commit SHA verification (A4)

## Acceptance Criteria

- [ ] AC6: Output artifact checker validates that `outputs/<stem>.json` exists for every `complete` prompt.
- [ ] AC7: Output artifact checker validates that files declared in `changes.files_created` and `changes.files_modified` exist on disk.
- [ ] AC15: All new checks have unit tests with >90% branch coverage.
- [ ] AC16: Existing tests remain passing.

## Verification

```bash
python -m pytest workpacks/tools/tests/ -v
python workpacks/tools/workpack_lint.py
python workpacks/tools/verify_output_artifacts.py
```

## Handoff Output (JSON)

Write `outputs/A3_output_artifact_checks.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "02_workpack-protocol_verification-hardening",
  "prompt": "A3_output_artifact_checks",
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
    "files_created": ["workpacks/tools/verify_output_artifacts.py", "workpacks/tools/tests/test_verify_output_artifacts.py"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "python -m pytest workpacks/tools/tests/ -v", "result": "pass", "notes": "" }
    ],
    "regression_added": true,
    "regression_notes": "Unit tests for output artifact validation"
  },
  "handoff": {
    "summary": "Output artifact existence, schema, and file declaration validation implemented.",
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

- [ ] `workpacks/tools/verify_output_artifacts.py` created
- [ ] Unit tests in `workpacks/tools/tests/test_verify_output_artifacts.py`
- [ ] Existing tests still passing
- [ ] `outputs/A3_output_artifact_checks.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
