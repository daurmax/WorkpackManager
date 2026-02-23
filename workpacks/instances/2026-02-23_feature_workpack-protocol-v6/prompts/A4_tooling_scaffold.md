---
depends_on: [A1_protocol_spec, A2_schemas_and_templates]
repos: [WorkpackManager]
---
# Tooling — Scaffold Agent Prompt

> Update the workpack scaffold tool to generate workpack.meta.json and workpack.state.json alongside prompt skeletons.

---

## READ FIRST

1. `workpacks/WORKPACK_META_SCHEMA.json`
2. `workpacks/WORKPACK_STATE_SCHEMA.json`
3. `workpacks/PROTOCOL_SPEC.md` (created by A1)
4. `workpacks/instances/2026-02-23_feature_workpack-protocol-v6/00_request.md`
5. Reference: `FurlanPronunciationService/workpacks/tools/workpack_scaffold.py` (v5 scaffold)

## Context

Workpack: `2026-02-23_feature_workpack-protocol-v6`
This prompt extends the scaffold tool to support Protocol v6 artifacts.

## Delivery Mode

- PR-based.

## Objective

Create or update `workpacks/tools/workpack_scaffold.py` to generate `workpack.meta.json` and `workpack.state.json` when scaffolding a new workpack. The scaffold should read `01_plan.md` to extract the prompt table and populate the `prompts` array in `workpack.meta.json` with correct DAG dependencies and repos. The state file should be initialized with all prompts in `pending` status.

## Reference Points

- **v5 scaffold**: The reference project's `workpack_scaffold.py` reads `01_plan.md` and generates prompt skeleton files. Extend this to also generate JSON metadata files.
- **Template files**: `_template/workpack.meta.json` and `_template/workpack.state.json` provide the starting point.

## Implementation Requirements

- Parse workpack folder name to extract `id`, `category`, and `created_at` for meta.json.
- Parse `01_plan.md` to extract the prompt table (agent prompt names, dependencies, repos, effort).
- Generate `workpack.meta.json` with all fields populated from parsing.
- Generate `workpack.state.json` with all prompts in `pending` status.
- If `workpack.meta.json` already exists, do not overwrite (warn and skip).
- Keep the venv bootstrap pattern from the reference scaffold.
- Support a `--force` flag to overwrite existing files.

## Scope

### In Scope
- Scaffold tool implementation
- Plan parsing for meta.json population
- State initialization

### Out of Scope
- Linter (A3)
- Protocol specification (A1)

## Acceptance Criteria

- [ ] Scaffold generates `workpack.meta.json` with correct id, category, prompts.
- [ ] Scaffold generates `workpack.state.json` with all prompts pending.
- [ ] Scaffold does not overwrite existing files without `--force`.
- [ ] Generated meta.json validates against the schema.
- [ ] Generated state.json validates against the schema.

## Verification

```bash
# Create a test workpack and scaffold it
mkdir -p workpacks/instances/2026-01-01_feature_test-scaffold/prompts
# (create a minimal 01_plan.md)
python workpacks/tools/workpack_scaffold.py workpacks/instances/2026-01-01_feature_test-scaffold
test -f workpacks/instances/2026-01-01_feature_test-scaffold/workpack.meta.json
test -f workpacks/instances/2026-01-01_feature_test-scaffold/workpack.state.json
# Cleanup
rm -rf workpacks/instances/2026-01-01_feature_test-scaffold
```

## Deliverables

- [ ] `workpacks/tools/workpack_scaffold.py` created/updated
- [ ] Scaffold generates valid v6 artifacts
- [ ] `outputs/A4_tooling_scaffold.json` written
- [ ] `99_status.md` updated
