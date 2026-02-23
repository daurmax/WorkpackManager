# Manual Prompts

This folder contains ready-to-run prompts for day-2 workpack operations.

Use these prompts when you already have an existing workpack and need to run an operational action (migration, bug intake, DAG-safe task changes) without creating a new scaffold.

## How To Use

1. Open the relevant prompt file in this folder.
2. Replace all placeholders in the `Fill Before Running` section.
3. Paste the completed prompt into your coding agent.
4. Review produced changes and run verification commands.

## Files

- `M_workpack_migration.md` - migrate a specific workpack to a target protocol version.
- `M_bug_report.md` - capture a structured bug report for a specific workpack.
- `M_task_change.md` - add/modify a prompt task in a specific workpack with DAG impact analysis.

## Scope Notes

- `workpacks/_template/` is for creating new workpack instances (scaffolding).
- `workpacks/manual_prompts/` is for operating on existing workpacks.
