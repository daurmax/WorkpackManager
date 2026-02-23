# Plan

## Summary

This workpack delivers the quality backbone: a test framework with coverage, a structural linter that surfaces diagnostics, drift detection between state and artifacts, a v5→v6 migration tool, and CI configuration. It integrates with all prior workpacks.

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Set up feature branch and verify all prior WPs | A0_bootstrap | - | XS |
| 2 | Configure test framework with coverage | A1_test_strategy | 1 | M |
| 3 | Implement workpack linter with VS Code diagnostics | A2_protocol_linter | 1 | L |
| 4 | Implement drift detection | A3_drift_detection | 1 | M |
| 5 | Implement v5 → v6 migration tool | A4_migration_compat | 1 | M |
| 6 | Configure CI pipeline (GitHub Actions) | A5_ci_pipeline | 2, 3, 4, 5 | S |
| 7 | Run V1 verification gate | A6_integration_meta | 2, 3, 4, 5, 6 | M |
| 8 | Post-merge retrospective | R1_retrospective | 7 and merge | S |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h.

## DAG Dependencies (v6)

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_test_strategy | [A0_bootstrap] | [WorkpackManager] |
| A2_protocol_linter | [A0_bootstrap] | [WorkpackManager] |
| A3_drift_detection | [A0_bootstrap] | [WorkpackManager] |
| A4_migration_compat | [A0_bootstrap] | [WorkpackManager] |
| A5_ci_pipeline | [A1_test_strategy, A2_protocol_linter, A3_drift_detection, A4_migration_compat] | [WorkpackManager] |
| A6_integration_meta | [A1_test_strategy, A2_protocol_linter, A3_drift_detection, A4_migration_compat, A5_ci_pipeline] | [WorkpackManager] |
| R1_retrospective | [A6_integration_meta] | [WorkpackManager] |

## Cross-Workpack References (v6)

requires_workpack: [2026-02-23_feature_extension-core-architecture, 2026-02-23_feature_extension-agent-integration, 2026-02-23_feature_extension-ux]

## Parallelization Map

```
Phase 0 (sequential):
  └── A0_bootstrap

Phase 1 (parallel):
  ├── A1_test_strategy        ─┐
  ├── A2_protocol_linter      ─┤
  ├── A3_drift_detection      ─┤
  └── A4_migration_compat     ─┘

Phase 2 (sequential):
  └── A5_ci_pipeline

Phase 3 (sequential — V1 gate):
  └── A6_integration_meta

Phase 4 (post-merge):
  └── R1_retrospective
```

## Branch Strategy

| Component | Branch Name | Base Branch | PR Target |
|-----------|-------------|-------------|-----------|
| Feature root | `feature/extension-validation-quality` | `main` | `main` |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Test framework conflicts with extension host tests | Medium | Medium | Use separate test configs for unit vs integration |
| Migration tool breaks on edge-case v5 workpacks | Medium | Medium | Test with multiple v5 fixtures including malformed ones |
| CI runner lacks VS Code extension host for integration tests | Medium | High | Use @vscode/test-electron for extension host tests |
| Coverage thresholds too strict initially | Low | Low | Start at 60%, increase to 80% iteratively |

## Handoff Outputs Plan (Protocol v6)

- Each completed prompt writes `outputs/<PROMPT>.json`.
- A6 validates all outputs before merge.
- `workpack.state.json` updated after each prompt completion.
