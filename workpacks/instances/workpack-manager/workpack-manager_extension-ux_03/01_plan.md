# Plan

## Summary

This workpack builds the user-facing layer: a tree view for workpack navigation, a detail webview for rich inspection, commands and context menus for common operations, and status visualization with filtering. The UX integrates with the parser/indexer from WP01 and the agent layer from WP02.

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Set up feature branch and verify core + agent APIs | A0_bootstrap | - | XS |
| 2 | Implement tree view data provider with status icons | A1_tree_view | 1 | L |
| 3 | Implement detail webview panel for workpack inspection | A2_detail_panel | 1 | M |
| 4 | Register commands, context menus, and quick picks | A3_commands_actions | 1 | M |
| 5 | Add status visualization, filtering, and sorting | A4_status_visualization | 2, 3 | M |
| 6 | Run V1 verification gate | A5_integration_meta | 2, 3, 4, 5 | M |
| 7 | Post-merge retrospective | R1_retrospective | 6 and merge | S |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h.

## DAG Dependencies (v6)

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_tree_view | [A0_bootstrap] | [WorkpackManager] |
| A2_detail_panel | [A0_bootstrap] | [WorkpackManager] |
| A3_commands_actions | [A0_bootstrap] | [WorkpackManager] |
| A4_status_visualization | [A1_tree_view, A2_detail_panel] | [WorkpackManager] |
| A5_integration_meta | [A1_tree_view, A2_detail_panel, A3_commands_actions, A4_status_visualization] | [WorkpackManager] |
| R1_retrospective | [A5_integration_meta] | [WorkpackManager] |

## Cross-Workpack References (v6)

requires_workpack: [workpack-manager_core-architecture_02]

## Parallelization Map

```
Phase 0 (sequential):
  └── A0_bootstrap

Phase 1 (parallel):
  ├── A1_tree_view             ─┐
  ├── A2_detail_panel          ─┤
  └── A3_commands_actions      ─┘

Phase 2 (sequential):
  └── A4_status_visualization

Phase 3 (sequential — V1 gate):
  └── A5_integration_meta

Phase 4 (post-merge):
  └── R1_retrospective
```

## Branch Strategy

| Component | Branch Name | Base Branch | PR Target |
|-----------|-------------|-------------|-----------|
| Feature root | `feature/extension-ux` | `main` | `main` |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Webview content security restrictions | Medium | Medium | Use VS Code webview toolkit; test CSP early |
| Tree view performance with many workpacks | Low | Medium | Lazy loading; only expand active workpacks |
| VS Code webview API changes | Low | High | Pin minimum VS Code version in engines |
| Codicon availability varies by VS Code version | Low | Low | Use stable Codicons only |

## Handoff Outputs Plan (Protocol v6)

- Each completed prompt writes `outputs/<PROMPT>.json`.
- A5 validates all outputs before merge.
- `workpack.state.json` updated after each prompt completion.
