# Plan

## Summary

Resolve the monorepo scaffold ambiguity by removing the empty packages/extension/ stub (since all extension code correctly lives at root src/), extract a shared SchemaValidatorCache utility to eliminate triple-duplicated AJV caching logic, and clean up stale merged Git branches. This is a pure refactor with no behavioral changes.

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Create feature branch, verify build and tests pass | A0_bootstrap | - | XS |
| 2 | Remove packages/extension/ scaffold, update monorepo docs | A1_resolve_extension_scaffold | 1 | S |
| 3 | Extract shared SchemaValidatorCache from parser, lint-rules, and migration | A2_extract_ajv_cache | 1 | M |
| 4 | Delete merged Git branches (local + remote), document cleanup | A3_clean_merged_branches | 1 | XS |
| 5 | Verification gate: build, lint, tests, import integrity | V1_integration_meta | 2, 3, 4 | S |
| 6 | Post-merge retrospective | R1_retrospective | 5 | XS |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h, XL >8h.

## DAG Dependencies

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_resolve_extension_scaffold | [A0_bootstrap] | [WorkpackManager] |
| A2_extract_ajv_cache | [A0_bootstrap] | [WorkpackManager] |
| A3_clean_merged_branches | [A0_bootstrap] | [WorkpackManager] |
| V1_integration_meta | [A1_resolve_extension_scaffold, A2_extract_ajv_cache, A3_clean_merged_branches] | [WorkpackManager] |
| R1_retrospective | [V1_integration_meta] | [WorkpackManager] |

## Cross-Workpack References

requires_workpack: [01_workpack-manager-v2_execution-wiring]

Execution wiring should be merged first so this refactor doesn't conflict with active feature work.

## Parallelization Map

```
Phase 0 (sequential):  A0_bootstrap
Phase 1 (parallel):    A1_resolve_extension_scaffold, A2_extract_ajv_cache, A3_clean_merged_branches
Phase 2 (sequential):  V1_integration_meta (V1 gate)
Phase 3 (conditional): B-series → V2 (V-loop)
Phase 4 (post-merge):  R1_retrospective
```

### B-series DAG (post-verification)

Populate this section only if V1 generates B-series bug-fix prompts.

## Branch Strategy

| Component | Branch Name | Base Branch | PR Target |
|-----------|-------------|-------------|-----------|
| Feature | feature/extension-consolidation-v2 | master | master |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Removing packages/extension/ breaks pnpm workspace resolution | Low | Medium | Verify `pnpm install` after removal; update pnpm-workspace.yaml if needed |
| AJV cache extraction changes validation timing/behavior | Low | High | Run full test suite + manual schema validation before/after |
| Accidentally deleting unmerged branches | Low | High | Script checks merge status via `git branch --merged master` before delete |

## Security and Tool Safety

- No secrets in prompts or outputs.
- Branch cleanup is non-destructive (can be restored from remote if needed).
- Limit writes to repository workspace only.

## Handoff Outputs Plan

- Each completed prompt writes `outputs/<PROMPT>.json`.
- Schema: `workpacks/WORKPACK_OUTPUT_SCHEMA.json`.
- Output JSON MUST include `repos`, `execution`, and `change_details`.
- V1 validates all outputs before merge.
- `workpack.state.json` is updated after each prompt completion.
