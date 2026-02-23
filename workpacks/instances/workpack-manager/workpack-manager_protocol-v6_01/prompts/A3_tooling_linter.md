---
depends_on: [A1_protocol_spec, A2_schemas_and_templates]
repos: [WorkpackManager]
---
# Tooling — Linter Agent Prompt

> Update the workpack linter to validate Protocol v6 additions (workpack.meta.json, workpack.state.json, prompt drift).

---

## READ FIRST

1. `workpacks/WORKPACK_META_SCHEMA.json`
2. `workpacks/WORKPACK_STATE_SCHEMA.json`
3. `workpacks/PROTOCOL_SPEC.md` (created by A1)
4. `workpacks/instances/workpack-manager_protocol-v6_01/00_request.md`
5. Reference: `FurlanPronunciationService/workpacks/tools/workpack_lint.py` (v5 linter)

## Context

Workpack: `workpack-manager_protocol-v6_01`
This prompt extends the workpack linter with v6-specific validation checks.

## Delivery Mode

- PR-based.

## Objective

Create or update `workpacks/tools/workpack_lint.py` to support Protocol v6 validation. The linter must handle all v5 checks (backward-compatible) plus new v6 checks for `workpack.meta.json` and `workpack.state.json`. The linter should be usable in any project that adopts the workpack system, not just WorkpackManager.

## Reference Points

- **v5 linter**: The reference project's `workpack_lint.py` provides the baseline. Follow its architecture: venv bootstrap, scan logic, check functions, reporting.
- **v6 checks from CHANGELOG**: `ERR_MISSING_META`, `WARN_META_ID_MISMATCH`, `WARN_META_PROMPTS_DRIFT`, `WARN_STATE_DRIFT`.
- **Schema validation**: Use `jsonschema` library to validate meta.json and state.json against their schemas.

## Implementation Requirements

- Preserve all v5 linter checks (code-block detection, DAG cycle detection, severity checks, etc.).
- Add v6 checks:
  - `ERR_MISSING_META`: Error if a v6 workpack lacks `workpack.meta.json`.
  - `WARN_META_ID_MISMATCH`: Warning if `workpack.meta.json` id does not match the folder name.
  - `WARN_META_PROMPTS_DRIFT`: Warning if the `prompts` array in meta.json does not match actual prompt files in `prompts/`.
  - `WARN_STATE_DRIFT`: Warning if `workpack.state.json` overall_status is inconsistent with per-prompt statuses.
  - Schema validation: Validate `workpack.meta.json` and `workpack.state.json` against their respective schemas.
- Auto-detect protocol version from `00_request.md` and apply version-appropriate checks.
- Keep the venv bootstrap pattern from the reference linter.
- Ensure `jsonschema` is installed in the venv.
- Support `--strict` flag (warnings become errors).
- Exit codes: 0 = pass, 1 = errors, 2 = warnings with --strict.

## Subagent Strategy

- Subagent 1: Port and adapt v5 checks from reference linter.
- Subagent 2: Implement v6-specific check functions.
- Subagent 3: Add unit tests for linter checks.

## Task Tracking

Use a todo list for each linter check function.

## Scope

### In Scope
- Linter implementation with v5 + v6 checks
- Schema validation via jsonschema
- Test fixtures for v5 and v6 workpacks
- CLI interface (--strict, path arguments)

### Out of Scope
- Scaffold tool (A4)
- VS Code extension integration
- CI pipeline setup

## Acceptance Criteria

- [ ] Linter runs without errors on all workpack instances in this repo.
- [ ] v6 checks are implemented and tested.
- [ ] v5 workpacks (without meta.json) pass with appropriate warnings only.
- [ ] `--strict` flag works correctly.
- [ ] `jsonschema` dependency is auto-installed in venv.

## Verification

```bash
python workpacks/tools/workpack_lint.py
python workpacks/tools/workpack_lint.py --strict
```

## Deliverables

- [ ] `workpacks/tools/workpack_lint.py` created/updated
- [ ] Linter passes on all instances
- [ ] `outputs/A3_tooling_linter.json` written
- [ ] `99_status.md` updated
