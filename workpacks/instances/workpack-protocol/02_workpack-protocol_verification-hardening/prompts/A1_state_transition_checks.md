---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# State Transition Validation Agent Prompt

> Implement legal state transition validation for workpack-level and prompt-level lifecycles, plus execution log integrity checks.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/00_request.md`
2. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/01_plan.md`
3. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.state.json`
5. `workpacks/PROTOCOL_SPEC.md` — workpack and prompt lifecycle state machines
6. `workpacks/WORKPACK_STATE_SCHEMA.json` — state schema constraints
7. `workpacks/tools/workpack_lint.py` — existing linter infrastructure

## Context

Workpack: `workpack-protocol/02_workpack-protocol_verification-hardening`

## Delivery Mode

- PR-based

## Objective

Create a Python module `workpacks/tools/verify_state_transitions.py` that programmatically enforces the legal state transition invariants declared in PROTOCOL_SPEC.md. The module must validate both workpack-level transitions (`not_started` → `in_progress` → `complete`) and prompt-level transitions (`pending` → `in_progress` → `complete`), rejecting illegal jumps. Additionally, validate execution log integrity: timestamps must be monotonically non-decreasing, required events must be present, and append-only semantics must be enforced.

## Reference Points

- `PROTOCOL_SPEC.md` — defines the legal state machines for workpack and prompt lifecycles
- `WORKPACK_STATE_SCHEMA.json` — `overall_status` and `prompt_status` field definitions
- `workpacks/tools/workpack_lint.py` — follow the same module/function patterns for consistency
- Existing test patterns in `workpacks/tools/tests/test_workpack_lint.py`

## Implementation Requirements

1. Create `workpacks/tools/verify_state_transitions.py` with functions:
   - `validate_workpack_transitions(state_json)` — checks `overall_status` against the legal workpack-level state machine.
   - `validate_prompt_transitions(state_json)` — checks each entry in `prompt_status` against the legal prompt-level state machine.
   - `validate_execution_log(state_json)` — checks monotonic timestamps, required events (`created`), and append-only integrity.
2. Define the legal transitions as data structures (dictionaries mapping current state → set of allowed next states).
3. Return structured results: list of `{check_id, severity, message, details}` dicts.
4. The module must be importable and also runnable standalone (`if __name__ == "__main__"`).
5. Read-only analysis: never modify workpack files.
6. Backward compatible: pre-2.2.0 workpacks must not fail on checks they cannot satisfy.

## Scope

### In Scope
- Workpack-level state transition validation (AC1)
- Prompt-level state transition validation (AC2)
- Execution log integrity: monotonic timestamps, required events, append-only (AC3)
- Unit tests with >90% branch coverage (AC15)

### Out of Scope
- Markdown-JSON synchronization checks (A2)
- Output artifact validation (A3)
- Commit SHA verification (A4)
- Integration into unified verify command (A7)

## Acceptance Criteria

- [ ] AC1: State transition validator detects illegal workpack-level transitions (e.g., `not_started` → `complete` without `in_progress`).
- [ ] AC2: State transition validator detects illegal prompt-level transitions (e.g., `pending` → `complete` without `in_progress`).
- [ ] AC3: Execution log validator detects non-monotonic timestamps and missing required events.
- [ ] AC15: All new checks have unit tests with >90% branch coverage.
- [ ] AC16: Existing tests remain passing.

## Verification

```bash
python -m pytest workpacks/tools/tests/ -v
python workpacks/tools/workpack_lint.py
python workpacks/tools/verify_state_transitions.py
```

## Handoff Output (JSON)

Write `outputs/A1_state_transition_checks.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "02_workpack-protocol_verification-hardening",
  "prompt": "A1_state_transition_checks",
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
    "files_created": ["workpacks/tools/verify_state_transitions.py", "workpacks/tools/tests/test_verify_state_transitions.py"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "python -m pytest workpacks/tools/tests/ -v", "result": "pass", "notes": "" }
    ],
    "regression_added": true,
    "regression_notes": "Unit tests for state transition and execution log validation"
  },
  "handoff": {
    "summary": "State transition and execution log validation implemented.",
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

- [ ] `workpacks/tools/verify_state_transitions.py` created
- [ ] Unit tests in `workpacks/tools/tests/test_verify_state_transitions.py`
- [ ] Existing tests still passing
- [ ] `outputs/A1_state_transition_checks.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
