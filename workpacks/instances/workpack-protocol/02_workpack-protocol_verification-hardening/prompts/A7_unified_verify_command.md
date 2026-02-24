---
depends_on: [A1_state_transition_checks, A2_markdown_json_sync, A3_output_artifact_checks, A4_commit_verification_tool, A5_prompt_style_lint]
repos: [WorkpackManager]
---
# Unified Verify Command Agent Prompt

> Implement a single `workpack verify` command that wraps all verification checks with category filtering and structured output.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/00_request.md`
2. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/01_plan.md`
3. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.state.json`
5. `outputs/A1_state_transition_checks.json` through `outputs/A5_prompt_style_lint.json`
6. All verification modules created in A1–A5

## Context

Workpack: `workpack-protocol/02_workpack-protocol_verification-hardening`

## Delivery Mode

- PR-based

## Objective

Create `workpacks/tools/workpack_verify.py` — a unified CLI entry point that orchestrates all verification checks. The command must:

1. Discover workpack instances to verify (default: all under `workpacks/instances/`).
2. Run all verification modules (state transitions, markdown-JSON sync, output artifacts, commit SHAs, prompt style).
3. Support `--category` filter to run only a subset of checks (e.g., `--category state`, `--category sync`, `--category output`, `--category commits`, `--category style`).
4. Support `--strict` mode (treat warnings as errors, exit non-zero on any finding).
5. Support `--json` output mode (emit structured JSON report instead of human-readable text).
6. Produce a summary with counts: checks passed, warnings, errors.

## Reference Points

- Verification modules: `verify_state_transitions.py`, `verify_md_json_sync.py`, `verify_output_artifacts.py`, `verify_commits.py`, `verify_prompt_style.py`
- `workpacks/tools/workpack_lint.py` — CLI patterns (`argparse`, exit codes)
- `workpacks/PROTOCOL_SPEC.md` — invariant categories

## Implementation Requirements

1. Create `workpacks/tools/workpack_verify.py` with:
   - `argparse` CLI interface with flags: `--category`, `--strict`, `--json`, `--workpack <id>` (optional filter to single workpack).
   - Import and invoke each A1–A5 verification module.
   - Aggregate results into a unified report structure.
   - Exit code: 0 for clean pass, 1 for errors, 2 for warnings in strict mode.
2. Category mapping:
   - `state` → `verify_state_transitions`
   - `sync` → `verify_md_json_sync`
   - `output` → `verify_output_artifacts`
   - `commits` → `verify_commits`
   - `style` → `verify_prompt_style`
3. JSON output schema: `{workpack_id, categories_run, results: [{check_id, severity, message, details}], summary: {passed, warnings, errors}}`.
4. The command must be usable from CLI and CI without VS Code.
5. Integration tests that verify category filtering and output modes.

## Scope

### In Scope
- Unified `workpack verify` command (AC14)
- Category-based filtering (`--category`)
- Strict mode (`--strict`)
- JSON output mode (`--json`)
- Integration tests (AC15)

### Out of Scope
- Individual verification module implementation (A1–A5, already done)
- Pre-commit hooks and CI templates (A6)
- Auto-repair of findings

## Acceptance Criteria

- [ ] AC14: Unified `workpack verify` command with `--category` filter, `--strict`, `--json` output modes.
- [ ] AC15: Integration tests cover category filtering and output modes.
- [ ] AC16: Existing tests remain passing.

## Verification

```bash
python workpacks/tools/workpack_verify.py --help
python workpacks/tools/workpack_verify.py --json
python workpacks/tools/workpack_verify.py --category state --strict
python -m pytest workpacks/tools/tests/ -v
```

## Handoff Output (JSON)

Write `outputs/A7_unified_verify_command.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "02_workpack-protocol_verification-hardening",
  "prompt": "A7_unified_verify_command",
  "component": "verification-cli",
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
    "files_created": ["workpacks/tools/workpack_verify.py", "workpacks/tools/tests/test_workpack_verify.py"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "python workpacks/tools/workpack_verify.py --help", "result": "pass", "notes": "" },
      { "cmd": "python -m pytest workpacks/tools/tests/ -v", "result": "pass", "notes": "" }
    ],
    "regression_added": true,
    "regression_notes": "Integration tests for unified verify command"
  },
  "handoff": {
    "summary": "Unified workpack verify command implemented with category filtering and JSON output.",
    "next_steps": ["Proceed to V1_integration_meta"],
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

- [ ] `workpacks/tools/workpack_verify.py` created
- [ ] Integration tests in `workpacks/tools/tests/test_workpack_verify.py`
- [ ] Existing tests still passing
- [ ] `outputs/A7_unified_verify_command.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
