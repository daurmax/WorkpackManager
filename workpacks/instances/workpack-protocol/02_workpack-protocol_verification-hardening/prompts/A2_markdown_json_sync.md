---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Markdown-JSON Synchronization Checker Agent Prompt

> Implement drift detection between markdown documents and their JSON counterparts: plan ↔ meta and status ↔ state.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/00_request.md`
2. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/01_plan.md`
3. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.state.json`
5. `workpacks/PROTOCOL_SPEC.md` — synchronization invariants
6. `workpacks/WORKPACK_META_SCHEMA.json` — meta prompts array structure
7. `workpacks/WORKPACK_STATE_SCHEMA.json` — state prompt_status structure
8. `workpacks/_template/01_plan.md` — WBS table format
9. `workpacks/_template/99_status.md` — status completion marker format

## Context

Workpack: `workpack-protocol/02_workpack-protocol_verification-hardening`

## Delivery Mode

- PR-based

## Objective

Create a Python module `workpacks/tools/verify_md_json_sync.py` that detects drift between markdown and JSON representations of workpack data. Two synchronization checks are required:

1. **Plan ↔ Meta sync** — the WBS rows in `01_plan.md` must match the `prompts[]` array in `workpack.meta.json` (prompt stems, dependency ordering, depends_on references).
2. **Status ↔ State sync** — the completion markers in `99_status.md` must be consistent with `prompt_status` entries in `workpack.state.json`.

## Reference Points

- `01_plan.md` WBS table — each row has a `#`, `Task`, `Agent Prompt`, `Depends On`, `Estimated Effort`
- `workpack.meta.json` `prompts[]` array — each entry has `stem`, `agent_role`, `depends_on`, `repos`, `estimated_effort`
- `99_status.md` uses `[x]` / `[ ]` markers for prompt completion
- `workpack.state.json` `prompt_status` maps stem → `{status}`

## Implementation Requirements

1. Create `workpacks/tools/verify_md_json_sync.py` with functions:
   - `check_plan_meta_sync(plan_md_path, meta_json_path)` — parse the WBS table from `01_plan.md`, extract prompt stems, and compare against `meta.prompts[]`. Report: missing stems, extra stems, `depends_on` mismatches.
   - `check_status_state_sync(status_md_path, state_json_path)` — parse completion markers from `99_status.md` and compare against `state.prompt_status`. Report: status drift (e.g., marked `[x]` in markdown but still `pending` in JSON, or vice versa).
2. Return structured results: list of `{check_id, severity, message, details}` dicts.
3. The module must be importable and also runnable standalone.
4. Read-only analysis: never modify workpack files.
5. Gracefully handle missing files (report warning, don't crash).

## Scope

### In Scope
- Plan ↔ meta synchronization drift detection (AC4)
- Status ↔ state synchronization drift detection (AC5)
- Unit tests with >90% branch coverage (AC15)

### Out of Scope
- State transition validation (A1)
- Output artifact checks (A3)
- Auto-repair of detected drift (future work)

## Acceptance Criteria

- [ ] AC4: Markdown-JSON sync checker detects drift between `01_plan.md` WBS and `meta.prompts[]`.
- [ ] AC5: Markdown-JSON sync checker detects drift between `99_status.md` completion markers and `state.prompt_status`.
- [ ] AC15: All new checks have unit tests with >90% branch coverage.
- [ ] AC16: Existing tests remain passing.

## Verification

```bash
python -m pytest workpacks/tools/tests/ -v
python workpacks/tools/workpack_lint.py
python workpacks/tools/verify_md_json_sync.py
```

## Handoff Output (JSON)

Write `outputs/A2_markdown_json_sync.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "02_workpack-protocol_verification-hardening",
  "prompt": "A2_markdown_json_sync",
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
    "files_created": ["workpacks/tools/verify_md_json_sync.py", "workpacks/tools/tests/test_verify_md_json_sync.py"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "python -m pytest workpacks/tools/tests/ -v", "result": "pass", "notes": "" }
    ],
    "regression_added": true,
    "regression_notes": "Unit tests for plan↔meta and status↔state sync checks"
  },
  "handoff": {
    "summary": "Markdown-JSON synchronization drift detection implemented.",
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

- [ ] `workpacks/tools/verify_md_json_sync.py` created
- [ ] Unit tests in `workpacks/tools/tests/test_verify_md_json_sync.py`
- [ ] Existing tests still passing
- [ ] `outputs/A2_markdown_json_sync.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
