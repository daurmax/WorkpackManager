# Manual Prompts

This folder contains ready-to-run prompts for workpack operations.

Use these prompts when you need to create a new workpack or run an operational action (migration, bug intake, DAG-safe task changes) on an existing one without writing a prompt from scratch.

## How To Use

1. Open the relevant prompt file in this folder.
2. Replace all placeholders in the `Fill Before Running` section.
3. Paste the completed prompt into your coding agent.
4. Review produced changes and run verification commands.

## Files

- `M_new_workpack.md` - create a new workpack instance from scratch (request, plan, scaffold, validate).
- `M_workpack_migration.md` - migrate a specific workpack to a target protocol version.
- `M_bug_report.md` - capture a structured bug report for a specific workpack.
- `M_task_change.md` - add/modify a prompt task in a specific workpack with DAG impact analysis.

## Scope Notes

- `workpacks/_template/` provides the raw template files used by the scaffolder.
- `workpacks/manual_prompts/` provides structured prompts for humans/agents to drive workpack operations.
- Use `M_new_workpack.md` for new creation; use the other prompts for day-2 operations on existing workpacks.
