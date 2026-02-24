---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Prompt Style Linter Agent Prompt

> Implement automated prompt section structure and YAML front-matter validation per PROMPT_STYLE_GUIDE.md.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/00_request.md`
2. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/01_plan.md`
3. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/02_workpack-protocol_verification-hardening/workpack.state.json`
5. `workpacks/_template/prompts/PROMPT_STYLE_GUIDE.md` — required sections and front-matter rules
6. `workpacks/PROTOCOL_SPEC.md` — prompt file invariants

## Context

Workpack: `workpack-protocol/02_workpack-protocol_verification-hardening`

## Delivery Mode

- PR-based

## Objective

Create a Python module `workpacks/tools/verify_prompt_style.py` that lints prompt files against the rules defined in `PROMPT_STYLE_GUIDE.md`. The linter performs two classes of checks:

1. **Required sections** — every prompt must contain the sections enumerated in the style guide: title and one-line objective, `READ FIRST`, `Objective`, `Implementation Requirements`, `Verification`, `Handoff Output (JSON)`, `Deliverables`.
2. **YAML front-matter structure** — every prompt must have valid YAML front-matter with `depends_on` (array of prompt stems) and `repos` (array of repository names).

## Reference Points

- `PROMPT_STYLE_GUIDE.md` — section 'Required Prompt Sections' and 'Required YAML Front-Matter'
- Existing prompts in `workpacks/instances/` for real-world examples
- `workpacks/tools/workpack_lint.py` — existing lint infrastructure patterns

## Implementation Requirements

1. Create `workpacks/tools/verify_prompt_style.py` with functions:
   - `check_required_sections(prompt_path)` — parse the markdown and check for the presence of each required section heading.
   - `check_yaml_frontmatter(prompt_path)` — parse the YAML front-matter block and validate:
     - `depends_on` exists and is a list of strings (prompt stems, no `.md` suffix).
     - `repos` exists and is a list of strings.
   - `lint_prompt_directory(prompts_dir)` — scan all `.md` files in a directory and run both checks.
2. Return structured results: list of `{check_id, severity, message, details}` dicts.
3. Apply reasonable tolerance: template prompts (e.g., `B_template.md`) may use placeholders.
4. The module must be importable and also runnable standalone.
5. Read-only analysis: never modify prompt files.

## Scope

### In Scope
- Required sections validation per PROMPT_STYLE_GUIDE.md (AC10)
- YAML front-matter structure validation (AC11)
- Unit tests with >90% branch coverage (AC15)

### Out of Scope
- State transition validation (A1)
- Markdown-JSON sync (A2)
- Output artifact checks (A3)
- Commit verification (A4)

## Acceptance Criteria

- [ ] AC10: Prompt style linter validates required sections per PROMPT_STYLE_GUIDE.md.
- [ ] AC11: Prompt style linter validates YAML front-matter structure (`depends_on`, `repos`).
- [ ] AC15: All new checks have unit tests with >90% branch coverage.
- [ ] AC16: Existing tests remain passing.

## Verification

```bash
python -m pytest workpacks/tools/tests/ -v
python workpacks/tools/workpack_lint.py
python workpacks/tools/verify_prompt_style.py
```

## Handoff Output (JSON)

Write `outputs/A5_prompt_style_lint.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "02_workpack-protocol_verification-hardening",
  "prompt": "A5_prompt_style_lint",
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
    "files_created": ["workpacks/tools/verify_prompt_style.py", "workpacks/tools/tests/test_verify_prompt_style.py"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "python -m pytest workpacks/tools/tests/ -v", "result": "pass", "notes": "" }
    ],
    "regression_added": true,
    "regression_notes": "Unit tests for prompt style linting"
  },
  "handoff": {
    "summary": "Prompt style linter for section structure and YAML front-matter implemented.",
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

- [ ] `workpacks/tools/verify_prompt_style.py` created
- [ ] Unit tests in `workpacks/tools/tests/test_verify_prompt_style.py`
- [ ] Existing tests still passing
- [ ] `outputs/A5_prompt_style_lint.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
