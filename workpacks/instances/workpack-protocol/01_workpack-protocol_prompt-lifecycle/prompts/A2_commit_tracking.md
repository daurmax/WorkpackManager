---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Per-Prompt Commit Tracking Agent Prompt

> Design and implement per-prompt commit tracking: output schema changes, spec updates, and template adjustments.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/00_request.md`
2. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/01_plan.md`
3. `outputs/A0_bootstrap.json`
4. `workpacks/PROTOCOL_SPEC.md` — current agent interaction protocol
5. `workpacks/WORKPACK_OUTPUT_SCHEMA.json` — current output schema (note `artifacts` optional, `commit_shas` optional)
6. `workpacks/tools/workpack_lint.py` — existing output validation

## Context

Workpack: `01_workpack-protocol_prompt-lifecycle`
Feature: Per-prompt commit tracking.

Currently, prompts may or may not commit their changes, and `artifacts.commit_shas` is optional. This prompt makes commit tracking a protocol requirement for version ≥ 2.2.0.

## Delivery Mode

- PR-based.

## Objective

### 1. Output Schema Changes (`WORKPACK_OUTPUT_SCHEMA.json`)

- Bump `schema_version` to `"1.2"`.
- Move `artifacts` from optional to the `required` array.
- Within `artifacts`, make `commit_shas` required with `"minItems": 1`.
- Add `artifacts.branch_verified` boolean field (default `false`, set to `true` by the integration prompt after verifying commits).
- **Backward compatibility**: add a note in the schema description that `commit_shas` is required for `schema_version >= 1.2`. Existing `1.1` outputs remain valid.

### 2. Protocol Specification (`PROTOCOL_SPEC.md`)

Add a "Commit Tracking" section under the agent interaction protocol:
- Every prompt that modifies files MUST commit changes before writing `output.json`.
- Commit message convention: `<type>(<workpack-slug>/<prompt-stem>): <summary>`.
- The commit SHA(s) MUST be recorded in `output.json` → `artifacts.commit_shas`.
- The `branch.work` field MUST match the actual branch where commits were made.
- Pure verification/integration prompts that modify no source files MAY have `commit_shas: []` only if no files were changed.

### 3. Template & Style Guide Updates

- `workpacks/_template/prompts/PROMPT_STYLE_GUIDE.md`: Document the commit tracking requirement and commit message convention.
- Consider adding a "Commit" section to the deliverables checklist in the template.

### 4. Linter Updates (`workpacks/tools/workpack_lint.py`)

- For completed prompts with output JSON (protocol ≥ 2.2.0 / schema_version ≥ 1.2):
  - WARN if `artifacts` is missing.
  - WARN if `artifacts.commit_shas` is empty or missing.
  - WARN if `branch.work` is empty.
- New check IDs: `WARN_MISSING_COMMIT_SHAS`, `WARN_MISSING_ARTIFACTS`.

### 5. Linter Tests

- Test for output with valid `commit_shas` (no warning).
- Test for output with empty `commit_shas` (should warn for protocol ≥ 2.2.0).
- Test for output without `artifacts` key (should warn for protocol ≥ 2.2.0).

## Verification

```bash
python -m pytest workpacks/tools/tests/test_workpack_lint.py -v
python workpacks/tools/workpack_lint.py
python -c "import json; s=json.load(open('workpacks/WORKPACK_OUTPUT_SCHEMA.json')); assert 'artifacts' in s['required']"
```

## Deliverables

- [ ] Updated `WORKPACK_OUTPUT_SCHEMA.json` with required artifacts and commit_shas
- [ ] Updated `PROTOCOL_SPEC.md` with commit tracking section
- [ ] Updated `PROMPT_STYLE_GUIDE.md`
- [ ] Updated `workpack_lint.py` with commit SHA validation
- [ ] New linter tests for commit tracking
- [ ] Output in `outputs/A2_commit_tracking.json`
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
