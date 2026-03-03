# Plan

## Summary

Systematically increase test coverage for the five under-tested TypeScript modules (reconciliation-engine, output-scanner, workpack-parser, status-icons, workpack-tree-item) to 85%+ statements and 75%+ branches. Add integration tests for the extension lifecycle. Update vitest coverage thresholds to enforce the new minimums going forward.

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Create feature branch, scan current coverage baseline | A0_bootstrap | - | XS |
| 2 | Add tests for reconciliation-engine and output-scanner (state module) | A1_state_module_coverage | 1 | M |
| 3 | Add tests for workpack-parser branches (schema validation, legacy, grouped) | A2_parser_coverage | 1 | M |
| 4 | Add tests for status-icons branches and workpack-tree-item variants | A3_views_coverage | 1 | S |
| 5 | Add integration tests for command registration and tree provider lifecycle | A4_integration_tests | 2, 3, 4 | M |
| 6 | Verification: all coverage targets met, thresholds updated, no regressions | V1_integration_meta | 5 | S |
| 7 | Post-merge retrospective | R1_retrospective | 6 | XS |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h, XL >8h.

## DAG Dependencies

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_state_module_coverage | [A0_bootstrap] | [WorkpackManager] |
| A2_parser_coverage | [A0_bootstrap] | [WorkpackManager] |
| A3_views_coverage | [A0_bootstrap] | [WorkpackManager] |
| A4_integration_tests | [A1_state_module_coverage, A2_parser_coverage, A3_views_coverage] | [WorkpackManager] |
| V1_integration_meta | [A4_integration_tests] | [WorkpackManager] |
| R1_retrospective | [V1_integration_meta] | [WorkpackManager] |

## Cross-Workpack References

requires_workpack: [01_workpack-manager-v2_execution-wiring]

Execution wiring should be merged first so new execution paths are included in coverage.

## Parallelization Map

```
Phase 0 (sequential):  A0_bootstrap
Phase 1 (parallel):    A1_state_module_coverage, A2_parser_coverage, A3_views_coverage
Phase 2 (sequential):  A4_integration_tests
Phase 3 (sequential):  V1_integration_meta (V1 gate)
Phase 4 (conditional): B-series → V2 (V-loop)
Phase 5 (post-merge):  R1_retrospective
```

### B-series DAG (post-verification)

Populate this section only if V1 generates B-series bug-fix prompts.

## Branch Strategy

| Component | Branch Name | Base Branch | PR Target |
|-----------|-------------|-------------|-----------|
| Feature | feature/test-coverage-hardening | master | master |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| vscode mock doesn't cover new APIs needed for integration tests | Medium | Medium | Extend `src/__mocks__/vscode.ts` as needed; document additions |
| Tests expose actual bugs in production code | Medium | Low positive | Fix bugs in the same PR; document in output JSON |
| Coverage targets too aggressive for some modules | Low | Low | Adjust targets down to nearest 5% if specific branches are unreachable |

## Security and Tool Safety

- No secrets in prompts or outputs.
- Test fixtures must not contain real API keys or sensitive data.
- Limit writes to repository workspace only.

## Handoff Outputs Plan

- Each completed prompt writes `outputs/<PROMPT>.json`.
- Schema: `workpacks/WORKPACK_OUTPUT_SCHEMA.json`.
- Output JSON MUST include `repos`, `execution`, and `change_details`.
- V1 validates all outputs before merge.
- `workpack.state.json` is updated after each prompt completion.
