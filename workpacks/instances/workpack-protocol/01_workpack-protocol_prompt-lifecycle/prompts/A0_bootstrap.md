---
depends_on: []
repos: [WorkpackManager]
---
# Bootstrap Agent Prompt

> Initialize the feature branch and verify baseline prerequisites for the prompt lifecycle enhancements workpack.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/00_request.md`
2. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/01_plan.md`
3. `workpacks/PROTOCOL_SPEC.md`
4. `workpacks/WORKPACK_OUTPUT_SCHEMA.json`
5. `workpacks/WORKPACK_META_SCHEMA.json`
6. `workpacks/CHANGELOG.md`
7. `workpacks/tools/workpack_lint.py`
8. `workpacks/tools/tests/test_workpack_lint.py`

## Context

Workpack: `01_workpack-protocol_prompt-lifecycle`
Group: `workpack-protocol`
Bootstrap prompt. Set up the working environment.

## Delivery Mode

- PR-based.

## Objective

1. Verify that the branch `feature/workpack-protocol-evolution` exists and is checked out.
2. Verify baseline: `python workpacks/tools/workpack_lint.py` runs without errors.
3. Verify baseline: `python -m pytest workpacks/tools/tests/test_workpack_lint.py -v` passes.
4. Verify baseline: `python workpacks/tools/validate_templates.py` passes.
5. Read and internalize the current protocol spec, output schema, and meta schema.
6. Record the current state of affairs as the starting baseline.

## Verification

```bash
python workpacks/tools/workpack_lint.py
python -m pytest workpacks/tools/tests/test_workpack_lint.py -v
python workpacks/tools/validate_templates.py
```

## Deliverables

- [ ] Baseline verification report in `outputs/A0_bootstrap.json`
- [ ] `workpack.state.json` updated (A0 → complete)
- [ ] `99_status.md` updated
