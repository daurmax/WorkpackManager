---
depends_on: [A1_data_models, A2_parser_indexer, A3_state_reconciliation, A4_dependency_graph]
repos: [WorkpackManager]
---
# Integration and Verification Agent Prompt (V1 Gate)

> Compile, test, lint, and cross-check all acceptance criteria for the extension core architecture.

---

## READ FIRST

1. `workpacks/instances/2026-02-23_feature_extension-core-architecture/00_request.md`
2. `workpacks/instances/2026-02-23_feature_extension-core-architecture/01_plan.md`
3. All output JSONs in `outputs/`
4. All source files in `src/`

## Context

Workpack: `2026-02-23_feature_extension-core-architecture`
V1 verification gate. Validate everything, implement nothing.

## Delivery Mode

- PR-based.

## Objective

Validate that the extension core architecture is complete, compiles successfully, passes all tests, and meets all acceptance criteria from `00_request.md`. Cross-check output JSONs from all completed prompts. Authorize or block merge.

## Verification

```bash
npx tsc --noEmit
npm test
npm run lint
```

## Deliverables

- [ ] Verification report in `outputs/A5_integration_meta.json`
- [ ] Merge authorized or B-series prompts generated
- [ ] `99_status.md` updated
- [ ] `workpack.state.json` updated
