# Workpack Template (Protocol 2.0.0)

This folder is a ready-to-copy scaffold for creating a new workpack instance in any repository.

If you need prompts to operate on an existing workpack (instead of creating one), use `workpacks/manual_prompts/`.

## Included Files

- `00_request.md` - request intake and acceptance criteria
- `01_plan.md` - execution plan and DAG
- `99_status.md` - human-readable status tracking
- `workpack.meta.json` - static machine-readable metadata
- `workpack.state.json` - mutable runtime state
- `prompts/` - reusable prompt templates
- `outputs/.gitkeep` - output artifact folder placeholder

Operational manual prompts live outside this scaffold:

- `../manual_prompts/M_workpack_migration.md`
- `../manual_prompts/M_bug_report.md`
- `../manual_prompts/M_task_change.md`

## How to Use

1. Copy `_template/` to a new instance folder under `workpacks/instances/<group>/<workpack-id>/`.
2. Rename and customize prompt templates for your WBS (A-series, B/V loop, R-series).
3. Replace placeholders in copied files.
4. Validate schemas and templates before starting implementation.

## Placeholder Keys

Replace these placeholders in JSON and prompt files:

- `__WORKPACK_ID__`
- `__WORKPACK_TITLE__`
- `__WORKPACK_SUMMARY__`
- `__CREATED_AT__` (format: `YYYY-MM-DD`)
- `__LAST_UPDATED__` (format: `YYYY-MM-DDTHH:MM:SSZ`)
- `__REPO_NAME__`
- `<WORKPACK_ID>`
- `<REPO_NAME>`
- `<MODEL_ID>`

## Validation

From repository root:

```bash
python workpacks/tools/validate_templates.py
```

The validator checks:

- JSON Schema 2020-12 validity for meta/state/output schemas
- `_template/workpack.meta.json` validation after placeholder substitution
- `_template/workpack.state.json` validation after placeholder substitution
- Required prompt front-matter (`depends_on`, `repos`) (since 1.4.0)
- Absence of common domain-specific leakage in templates

## Notes

- `workpack.meta.json` is static metadata and should be version-controlled.
- `workpack.state.json` is mutable runtime state updated by agents/tooling.
- `99_status.md` remains the human-readable companion to `workpack.state.json`.
