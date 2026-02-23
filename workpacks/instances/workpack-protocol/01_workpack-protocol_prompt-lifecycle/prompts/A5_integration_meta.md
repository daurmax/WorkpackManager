---
depends_on: [A3_integration_verification]
repos: [WorkpackManager]
---
# Integration and Verification Agent Prompt (V1 Gate)

> Compile, test, lint, and cross-check all acceptance criteria for the prompt lifecycle enhancements.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/00_request.md`
2. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/01_plan.md`
3. All output JSONs in `outputs/`
4. All modified files in `workpacks/` (spec, schemas, templates, linter)

## Context

Workpack: `01_workpack-protocol_prompt-lifecycle`
V1 verification gate. Validate everything, implement nothing.

## Delivery Mode

- PR-based.

## Objective

Validate that all prompt lifecycle enhancements are complete, consistent, and meet all acceptance criteria from `00_request.md`. Cross-check output JSONs from all completed prompts. Authorize or block merge.

## Verification Checks

### Automated

```bash
python -m pytest workpacks/tools/tests/test_workpack_lint.py -v
python workpacks/tools/workpack_lint.py
python workpacks/tools/validate_templates.py
python -c "import json; s=json.load(open('workpacks/WORKPACK_OUTPUT_SCHEMA.json')); assert 'artifacts' in s['required']"
```

### Manual Cross-Check

1. Verify AC1: `PROTOCOL_SPEC.md` documents B-series DAG with examples.
2. Verify AC2: `PROTOCOL_SPEC.md` documents commit tracking requirements.
3. Verify AC3: Output schema `artifacts` is required, `commit_shas` required with minItems.
4. Verify AC4: `branch_verified` boolean field exists in output schema.
5. Verify AC5: Meta schema allows B-series stems in prompts array.
6. Verify AC6: B-series `depends_on` works in front-matter and meta.json.
7. Verify AC7: Linter catches B-series DAG cycles.
8. Verify AC8: Linter warns on missing commit_shas for completed prompts.
9. Verify AC9: Integration template includes commit verification steps.
10. Verify AC10: Templates updated (plan, style guide).
11. Verify AC11: CHANGELOG.md has version 2.2.0 entry.
12. Verify AC12: All tests pass, including new B-series DAG and commit tracking tests.

### Commit Verification (applying the new protocol to itself)

For each prior prompt's output JSON:
1. Extract `artifacts.commit_shas`.
2. Verify each SHA exists: `git log --oneline feature/workpack-protocol-evolution`.
3. Cross-reference `change_details` against `git show --stat <sha>`.
4. Report any discrepancies.

## Deliverables

- [ ] Verification report in `outputs/A4_integration_meta.json`
- [ ] Merge authorized or B-series prompts generated (with B-series DAG if needed)
- [ ] `99_status.md` updated
- [ ] `workpack.state.json` updated
