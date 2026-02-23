---
depends_on: [A3_integration_verification]
repos: [WorkpackManager]
---
# Legacy Workpack Modernization and Maintenance Prompts Agent Prompt

> Define and implement a repeatable legacy-to-modern workpack migration method, plus reusable prompts for bug reporting and task add/modify workflows.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/00_request.md`
2. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/01_plan.md`
3. `outputs/A1_b_series_dag.json`
4. `outputs/A2_commit_tracking.json`
5. `outputs/A3_integration_verification.json`
6. `workpacks/PROTOCOL_SPEC.md`
7. `workpacks/_template/prompts/PROMPT_STYLE_GUIDE.md`
8. `workpacks/_template/prompts/`
9. `workpacks/tools/validate_templates.py`

## Context

Workpack: `01_workpack-protocol_prompt-lifecycle`
Feature slice: modernization workflow + maintenance prompt templates.

This prompt adds an explicit method to modernize workpacks created with older protocol versions and introduces reusable prompts for ongoing maintenance operations.

## Delivery Mode

- PR-based.

## Objective

### 1. Legacy-to-Modern Migration Method (`PROTOCOL_SPEC.md`)

Add a dedicated modernization section that defines:
- Supported source versions (at minimum 2.0.0 and 2.1.0) and target (2.2.0+).
- Ordered migration checklist for:
  - `00_request.md`
  - `01_plan.md`
  - `workpack.meta.json`
  - `workpack.state.json`
  - prompt front-matter and output contracts
- How to preserve backward compatibility during migration.
- Required post-migration verification commands.

### 2. New Maintenance Manual Prompts

Create user-facing operational prompts under `workpacks/manual_prompts/`:

- `M_bug_report.md`
  - Structured bug intake fields (context, repro steps, expected/actual behavior, severity, impacted prompts/files).
  - Output contract that can seed B-series planning.

- `M_task_change.md`
  - Supports adding a new task prompt or modifying an existing task prompt in a workpack.
  - Requires explicit DAG impact analysis (`depends_on`, execution order, status/state/meta updates).

- `M_workpack_migration.md`
  - Supports targeted migration of a selected workpack from a specified source version to a target version.

### 3. Style Guide Alignment

Update `workpacks/_template/prompts/PROMPT_STYLE_GUIDE.md` to document:
- that maintenance operations are user-facing prompts in `workpacks/manual_prompts/`.
- Minimal required deliverables for each maintenance operation.

## Verification

```bash
python workpacks/tools/validate_templates.py
python workpacks/tools/workpack_lint.py
```

## Deliverables

- [ ] Updated `PROTOCOL_SPEC.md` with legacy-to-modern migration method
- [ ] Created `workpacks/manual_prompts/M_bug_report.md`
- [ ] Created `workpacks/manual_prompts/M_task_change.md`
- [ ] Created `workpacks/manual_prompts/M_workpack_migration.md`
- [ ] Updated `PROMPT_STYLE_GUIDE.md` with maintenance prompt guidance
- [ ] Output in `outputs/A4_workpack_modernization.json`
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
