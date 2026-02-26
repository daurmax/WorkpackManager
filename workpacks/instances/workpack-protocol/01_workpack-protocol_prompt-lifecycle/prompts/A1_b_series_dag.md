---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# B-series Dependency DAG Agent Prompt

> Design and implement B-series dependency DAG support across the protocol specification, schemas, templates, and linter.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/00_request.md`
2. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/01_plan.md`
3. `outputs/A0_bootstrap.json`
4. `workpacks/PROTOCOL_SPEC.md` — current B-series and DAG sections
5. `workpacks/WORKPACK_META_SCHEMA.json` — prompts array and stem pattern
6. `workpacks/tools/workpack_lint.py` — existing DAG validation logic
7. `workpacks/tools/tests/test_workpack_lint.py` — existing tests
8. `workpacks/_template/01_plan.md` — plan template

## Context

Workpack: `01_workpack-protocol_prompt-lifecycle`
Feature: B-series dependency DAG.

Currently B-series prompts are an unstructured flat list. This prompt introduces a DAG so that:
- B-series prompts can declare `depends_on` in their YAML front-matter.
- B-series prompts can appear in the `workpack.meta.json` `prompts[]` array with `depends_on`.
- The integration/verification prompt that generates B-series prompts must also produce a dependency plan (which can run in parallel, which are sequential).
- The linter validates B-series DAG consistency (no cycles, no unknown references).

## Delivery Mode

- PR-based.

## Objective

### 1. Protocol Specification (`PROTOCOL_SPEC.md`)

Add or extend the B-series section to document:
- B-series prompts MAY declare `depends_on: [B1_other_fix]` in YAML front-matter.
- B-series with the same DAG depth (no inter-dependency) MAY run in parallel.
- The integration prompt that identifies bugs MUST produce a B-series plan including dependency ordering.
- The plan section of `01_plan.md` SHOULD be extended with B-series DAG information after the V1 gate identifies bugs.

### 2. Template Updates

- `workpacks/_template/01_plan.md`: Add a `### B-series DAG (post-verification)` section after the B-series mentions, with a stub table for B-series dependencies.
- `workpacks/_template/prompts/PROMPT_STYLE_GUIDE.md`: Document that B-series prompts should include `depends_on` front-matter referencing other B-series stems.

### 3. Linter Updates (`workpacks/tools/workpack_lint.py`)

- Extend the existing DAG validation to also cover B-series prompts.
- B-series `depends_on` references should be validated: no cycles, no references to unknown stems.
- If B-series prompts have `depends_on` in front-matter that differs from the meta.json prompts array, emit `WARN_META_PROMPTS_DRIFT`.

### 4. Linter Tests

- Add test for B-series prompts with valid `depends_on`.
- Add test for B-series with cyclic dependencies (should error).
- Add test for B-series referencing unknown stem (should warn).

## Verification

```bash
python -m pytest workpacks/tools/tests/test_workpack_lint.py -v
python workpacks/tools/workpack_lint.py
python workpacks/tools/validate_templates.py
```

## Deliverables

- [ ] Updated `PROTOCOL_SPEC.md` with B-series DAG documentation
- [ ] Updated `01_plan.md` template with B-series DAG section
- [ ] Updated `PROMPT_STYLE_GUIDE.md`
- [ ] Updated `workpack_lint.py` with B-series DAG validation
- [ ] New linter tests for B-series DAG
- [ ] Output in `outputs/A1_b_series_dag.json`
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
