---
depends_on: [A1_state_transition_checks, A2_markdown_json_sync, A3_output_artifact_checks, A4_commit_verification_tool, A5_prompt_style_lint]
repos: [WorkpackManager]
---
# Git Hooks and CI Templates Agent Prompt

> Create pre-commit hook template and GitHub Actions CI workflow template that run verification checks.

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

Create two integration artifacts that connect the verification tools to developer workflows:

1. **Pre-commit hook template** — a shell script under `.githooks/pre-commit` (or `workpacks/tools/hooks/pre-commit`) that runs a quick subset of verification checks before each commit. Must be fast enough for interactive use.
2. **GitHub Actions CI workflow** — a `.github/workflows/workpack-verify.yml` template that runs the full verification suite on push and pull request events.

Both artifacts must invoke the verification modules created in A1–A5 and produce clear pass/fail output.

## Reference Points

- Verification modules: `verify_state_transitions.py`, `verify_md_json_sync.py`, `verify_output_artifacts.py`, `verify_commits.py`, `verify_prompt_style.py`
- Existing Python tool patterns in `workpacks/tools/`
- Project uses Python virtual environment at `workpacks/tools/.venv/`

## Implementation Requirements

1. Create pre-commit hook template:
   - Shell script (bash) that runs quick verification checks (state transitions, prompt style).
   - Must activate the Python venv or use the venv Python directly.
   - Must exit non-zero on any verification failure.
   - Include installation instructions as comments in the file.
2. Create GitHub Actions CI workflow template:
   - Triggers on `push` and `pull_request` to `main`.
   - Sets up Python, installs dependencies (`jsonschema`).
   - Runs all verification checks (full suite).
   - Reports structured output in the job summary.
3. Both templates must be self-documenting (inline comments for customization).
4. Neither template may modify workpack files.

## Scope

### In Scope
- Pre-commit hook template (AC12)
- GitHub Actions CI workflow template (AC13)
- Installation/usage documentation in file comments

### Out of Scope
- Actual hook installation automation
- CI workflow for npm publishing (npm-distribution workpack scope)
- Unified verify command (A7)

## Acceptance Criteria

- [ ] AC12: Pre-commit hook template exists and runs quick verification.
- [ ] AC13: CI workflow template (GitHub Actions) exists and runs full verification.
- [ ] AC15: Templates are validated (hook is executable, workflow is valid YAML).
- [ ] AC16: Existing tests remain passing.

## Verification

```bash
# Validate YAML syntax
python -c "import yaml; yaml.safe_load(open('.github/workflows/workpack-verify.yml'))"
# Validate hook is a valid shell script
bash -n workpacks/tools/hooks/pre-commit
# Existing tests
python -m pytest workpacks/tools/tests/ -v
```

## Handoff Output (JSON)

Write `outputs/A6_git_hooks_ci_templates.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "02_workpack-protocol_verification-hardening",
  "prompt": "A6_git_hooks_ci_templates",
  "component": "ci-integration",
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
    "files_created": ["workpacks/tools/hooks/pre-commit", ".github/workflows/workpack-verify.yml"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "bash -n workpacks/tools/hooks/pre-commit", "result": "pass", "notes": "" },
      { "cmd": "python -c \"import yaml; yaml.safe_load(open('.github/workflows/workpack-verify.yml'))\"", "result": "pass", "notes": "" }
    ],
    "regression_added": false,
    "regression_notes": ""
  },
  "handoff": {
    "summary": "Pre-commit hook and CI workflow templates created.",
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

- [ ] Pre-commit hook template created
- [ ] GitHub Actions CI workflow template created
- [ ] Templates validated (syntax, structure)
- [ ] Existing tests still passing
- [ ] `outputs/A6_git_hooks_ci_templates.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
