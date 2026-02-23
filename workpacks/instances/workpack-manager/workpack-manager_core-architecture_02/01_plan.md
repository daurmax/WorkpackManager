# Plan

## Summary

This workpack builds the VS Code extension core: TypeScript data models matching Protocol v6 schemas, a filesystem-based parser/indexer with v5 fallback, multi-root workspace discovery, status reconciliation, dependency graph resolution, and the extension contribution point scaffold. The architecture forms the foundation for UI (WP03) and agent integration (WP02) workpacks.

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Create feature branch, initialize extension scaffold (package.json, tsconfig, activation) | A0_bootstrap | - | S |
| 2 | Define TypeScript data models and interfaces matching Protocol v6 schemas | A1_data_models | 1 | M |
| 3 | Implement workpack parser/indexer with meta.json primary and markdown fallback | A2_parser_indexer | 2 | L |
| 4 | Implement status reconciliation engine (state.json vs outputs/ vs 99_status.md) | A3_state_reconciliation | 2 | M |
| 5 | Implement dependency graph resolver (prompt DAG + cross-workpack) with cycle detection | A4_dependency_graph | 2 | M |
| 6 | Run V1 verification gate: compile, test, lint, AC cross-check | A5_integration_meta | 2, 3, 4, 5 | M |
| 7 | Post-merge retrospective | R1_retrospective | 6 and merge | S |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h.

## DAG Dependencies (v6)

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_data_models | [A0_bootstrap] | [WorkpackManager] |
| A2_parser_indexer | [A1_data_models] | [WorkpackManager] |
| A3_state_reconciliation | [A1_data_models] | [WorkpackManager] |
| A4_dependency_graph | [A1_data_models] | [WorkpackManager] |
| A5_integration_meta | [A1_data_models, A2_parser_indexer, A3_state_reconciliation, A4_dependency_graph] | [WorkpackManager] |
| R1_retrospective | [A5_integration_meta] | [WorkpackManager] |

## Cross-Workpack References (v6)

requires_workpack: [workpack-manager_protocol-v6_01]

## Parallelization Map

```
Phase 0 (sequential):
  └── A0_bootstrap

Phase 1 (sequential):
  └── A1_data_models

Phase 2 (parallel):
  ├── A2_parser_indexer           ─┐
  ├── A3_state_reconciliation     ─┤
  └── A4_dependency_graph         ─┘

Phase 3 (sequential — V1 gate):
  └── A5_integration_meta
        ├── PASS → MERGE ✅
        └── FAIL → B-series → V2

Phase 4 (post-merge):
  └── R1_retrospective
```

## Branch Strategy

| Component | Branch Name | Base Branch | PR Target |
|-----------|-------------|-------------|-----------|
| Feature root | `feature/extension-core-architecture` | `main` | `main` |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| v5 fallback parsing is fragile with varied markdown formats | Medium | Medium | Test with fixtures from multiple real projects; fail gracefully |
| Multi-root workspace edge cases (empty folders, permission errors) | Medium | Low | Wrap discovery in try-catch; log warnings |
| Dependency graph performance with many workpacks | Low | Low | Use adjacency list and topological sort; benchmark with 100+ workpacks |
| Schema evolution breaks parser | Medium | High | Version-gate parsing logic; support schema_version field |

## Security and Tool Safety

- No secrets in prompts or outputs.
- Parser must not execute or eval any file content.
- Limit filesystem access to workspace folders only.

## Handoff Outputs Plan (Protocol v6)

- Each completed prompt writes `outputs/<PROMPT>.json`.
- Output JSONs must include `repos`, `execution`, and `change_details`.
- A5 validates all outputs.
- `workpack.state.json` updated after each prompt completion.
