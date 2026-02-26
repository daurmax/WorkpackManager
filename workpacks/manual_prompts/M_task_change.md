# Manual Prompt - Workpack Task Add/Modify

Use this prompt to add or modify a task prompt in an existing workpack while keeping DAG/state/meta consistent.

## Fill Before Running

- Target workpack path: `<workpacks/instances/<group>/<workpack-id>>`
- Target workpack id: `<workpack-id>`
- Change type: `<add_prompt|modify_prompt>`
- Target prompt stem: `<A#_...|B#_...|V#_...|R#_...>`
- Reason for change: `<why>`
- New/updated dependencies: `<depends_on list>`
- Execution order impact: `<sequential/parallel changes>`
- Repositories: `[<REPO_NAME>]`
- Additional context/constraints: `<optional>`

## Prompt To Run

---
repos: [<REPO_NAME>]
---
# Workpack Task Change Task

Apply a DAG-safe task change to workpack `<workpack-id>` at `<workpack-path>`.

## Required Inputs

- Workpack path: `<workpack-path>`
- Workpack id: `<workpack-id>`
- Change type: `<add_prompt|modify_prompt>`
- Target prompt stem: `<stem>`
- Reason: `<reason>`
- Dependencies update: `<depends_on list>`
- Execution order impact: `<impact>`

## Required Actions

1. Update prompt file(s) under `<workpack-path>/prompts/`.
2. Update `01_plan.md` (WBS + DAG table + parallelization map).
3. Update `workpack.meta.json.prompts[]` with synchronized `stem` and `depends_on`.
4. Update `workpack.state.json.prompt_status` for added/changed prompt.
5. Update `99_status.md` progress/output tables.
6. Provide explicit DAG impact analysis:
   - upstream/downstream affected prompts
   - cycle check result
   - execution order delta
7. Write output artifact:
   - `<workpack-path>/outputs/A_task_change.json`

## Verification Commands

```bash
python workpacks/tools/workpack_lint.py
python workpacks/tools/validate_templates.py
```

## Deliverables

- Prompt add/modify changes applied
- DAG impact analysis documented
- Plan/meta/state/status synchronized
- `outputs/A_task_change.json`
