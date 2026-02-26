# Workpack Troubleshooting Guide

This guide lists common failures you may hit when running Workpack Protocol flows and how to fix them quickly.

Use this document as a symptom-to-fix catalog:
- Identify the closest matching problem.
- Run the listed verification commands.
- Apply the resolution steps.
- Re-run lint/validation before moving to the next prompt.

Related guides:
- [CONCEPTS.md](./CONCEPTS.md)
- [QUICKSTART.md](./QUICKSTART.md)
- [INTEGRATION.md](./INTEGRATION.md)

## Category: Schema Errors

### Problem: Invalid `workpack.meta.json` shape or field types
**Symptoms**: `workpack_lint.py` reports `ERR_META_JSON_INVALID` or `ERR_META_SCHEMA_INVALID`; required fields such as `prompts`, `delivery_mode`, or `repos` are missing or have wrong types.

**Cause**: Manual edits broke schema expectations in `workpacks/WORKPACK_META_SCHEMA.json` (for example, string where array is required, invalid `category`, or malformed `protocol_version`).

**Resolution**: Run `python workpacks/tools/workpack_lint.py <workpack-path>` and read the first meta/schema error. Compare `workpack.meta.json` against `workpacks/WORKPACK_META_SCHEMA.json` required fields and enums. Fix one error at a time, then re-run lint until no meta/schema errors remain.

### Problem: Invalid `workpack.state.json` status or prompt runtime fields
**Symptoms**: Linter reports `ERR_STATE_JSON_INVALID` or `ERR_STATE_SCHEMA_INVALID`; errors mention invalid `overall_status`, missing `blocked_reason` for blocked prompts, or missing `completed_at` for complete prompts.

**Cause**: Runtime state edits do not match `workpacks/WORKPACK_STATE_SCHEMA.json` rules for prompt lifecycle fields and enum values.

**Resolution**: Run `python workpacks/tools/workpack_lint.py <workpack-path>`. Check `workpack.state.json` against `WORKPACK_STATE_SCHEMA.json`, especially `overall_status`, each `prompt_status.<stem>.status`, and conditional fields (`blocked_reason`, `started_at`, `completed_at`). Save and re-run lint.

## Category: DAG Issues

### Problem: Circular dependency in `depends_on`
**Symptoms**: Linter fails with `ERR_DAG_CYCLE` and prints a cycle path.

**Cause**: Two or more prompts depend on each other directly or indirectly, so no valid execution order exists.

**Resolution**: Open prompt front-matter and list `depends_on` edges for all involved prompts. Remove or rewrite one dependency edge to restore an acyclic graph. Re-run `python workpacks/tools/workpack_lint.py <workpack-path>` to confirm the cycle is gone.

### Problem: Missing dependency prompt (`depends_on` points to non-existent stem)
**Symptoms**: Linter reports `WARN_DAG_UNKNOWN_DEP` for one or more prompts.

**Cause**: A prompt stem was renamed, deleted, or misspelled in `depends_on` without synchronizing references.

**Resolution**: Verify the target prompt file exists under `prompts/<stem>.md`. Fix spelling/case in front-matter or restore the missing prompt. Re-run lint and ensure the warning is cleared.

## Category: State Drift

### Problem: `01_plan.md` / prompt files are out of sync with `workpack.meta.json`
**Symptoms**: Linter shows `WARN_META_PROMPTS_DRIFT` (missing stems in meta or missing files under `prompts/`).

**Cause**: Plan or prompt files changed, but `workpack.meta.json.prompts[]` was not updated to match stems and dependencies.

**Resolution**: Compare `01_plan.md`, `prompts/*.md`, and `workpack.meta.json.prompts[]` as a single DAG contract. Align `stem`, `depends_on`, `repos`, and `estimated_effort`. Re-run lint until drift warnings are removed.

### Problem: `99_status.md` does not reflect `workpack.state.json`
**Symptoms**: Human-readable checklist says prompt/output is complete, but state JSON still shows `pending` or missing output evidence; reviewers report contradictory status.

**Cause**: Status markdown was edited without the matching state mutation (or vice versa).

**Resolution**: Treat `workpack.state.json` as machine status source and `99_status.md` as synchronized human mirror. Update both files in the same change. Validate with `python workpacks/tools/workpack_lint.py <workpack-path>` and `python workpacks/tools/validate_workpack_files.py <workpack-path>`.

## Category: Tooling Failures

### Problem: Scaffold generated incomplete workpack structure
**Symptoms**: `validate_workpack_files.py` reports `ERR_MISSING_FILE` for required files/folders, or `WARN_EMPTY_PROMPTS` for an empty `prompts/`.

**Cause**: Scaffold run was interrupted, executed with a wrong path, or invoked with arguments that do not match the current tool mode.

**Resolution**: Re-run scaffold using the repository's supported command form, then verify directory layout. If needed, create missing files manually (`00_request.md`, `01_plan.md`, `workpack.meta.json`, `workpack.state.json`, `prompts/`, `outputs/`). Re-run `python workpacks/tools/validate_workpack_files.py <workpack-path>`.

### Problem: Lint reports warnings on a workpack that appears valid
**Symptoms**: Warnings such as `WARN_MISSING_REPOS`, `WARN_MISSING_EXECUTION`, or code-block related prompt warnings appear even though files look complete.

**Cause**: The workpack is valid structurally but missing protocol-recommended metadata, or lint is interpreting prompt content strictly for the protocol version.

**Resolution**: Read the exact warning and fix the minimal missing field first (`repos` in front-matter, `execution` in output JSON, etc.). For intentional prompt code blocks, add `<!-- lint-ignore-code-block -->` directly above the fence. Re-run lint with explicit path to confirm the warning is expected or resolved.

## Category: Commit Tracking Issues

### Problem: Missing commit SHA in output artifact metadata
**Symptoms**: Linter warns `WARN_MISSING_COMMIT_SHAS`; for schema `1.2+`, output validation fails if `artifacts.commit_shas` is empty.

**Cause**: Files were changed but `outputs/<PROMPT>.json` did not record the commit SHA(s), or placeholder values were left behind.

**Resolution**: Commit the prompt changes first, then update `artifacts.commit_shas` with real SHA values from `git log --oneline`. Keep `change_details` aligned with actual changed files and re-run lint.

### Problem: SHA in output does not exist on the work branch
**Symptoms**: Integration checks fail when running `git log --oneline <branch> | findstr <sha>` (or grep equivalent), or V-series verification reports missing commit.

**Cause**: Output JSON references stale SHAs after rebase/squash/cherry-pick, or SHAs from a different branch.

**Resolution**: Verify each SHA exists on `branch.work`. If history changed, replace stale SHAs with current ones and update `change_details` if file sets changed. Re-run integration verification before marking the prompt complete.
