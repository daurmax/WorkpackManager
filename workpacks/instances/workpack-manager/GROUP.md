# Workpack Group: WorkpackManager VS Code Extension

## Overview

This group contains 5 workpacks that together deliver the WorkpackManager VS Code extension and the reusable Workpack Protocol v6 framework.

## Execution DAG

### Formal Dependency Graph

```
workpack-manager_protocol-v6_01
        │
        ▼
workpack-manager_core-architecture_02
        │
        ├──────────────────────┐
        ▼                      ▼
workpack-manager_          workpack-manager_
agent-integration_03       extension-ux_03
        │                      │
        └──────────┬───────────┘
                   ▼
workpack-manager_validation-quality_04
```

### Phase Execution Plan

| Phase | Workpacks | Mode | Description |
|-------|-----------|------|-------------|
| 1 | `protocol-v6_01` | Serial | Foundation: Protocol v6 spec, JSON schemas, templates, linter/scaffold tooling. |
| 2 | `core-architecture_02` | Serial | Core extension: TypeScript data models, parser/indexer, state reconciliation, dependency graph. |
| 3 | `agent-integration_03`, `extension-ux_03` | **Parallel** | Two independent feature tracks. Agent layer (provider abstraction, Copilot/Codex providers, orchestrator) and UX layer (tree view, webview, commands, status visualization). |
| 4 | `validation-quality_04` | Serial | Quality backbone: test framework, protocol linter, drift detection, v5→v6 migration, CI pipeline. Integrates all prior workpacks. |

### Rules

1. **Sequential phases**: Phase N+1 cannot start until all workpacks in Phase N are complete.
2. **Parallel within phase**: Workpacks within the same phase (same `execution_order`) MAY execute concurrently. They have no dependencies on each other.
3. **Edges**: Each directed edge `[A, B]` means workpack A must be complete before workpack B can start.

### Edges (formal)

| From | To | Rationale |
|------|----|-----------|
| `protocol-v6_01` | `core-architecture_02` | Core needs v6 schemas and spec |
| `core-architecture_02` | `agent-integration_03` | Agent layer needs data models and parser |
| `core-architecture_02` | `extension-ux_03` | UX layer needs data models and parser |
| `agent-integration_03` | `validation-quality_04` | Quality layer validates agent integration |
| `extension-ux_03` | `validation-quality_04` | Quality layer validates UX integration |

## Workpack Naming Convention

Within a group, workpack directory names follow the pattern:

```
<group-id>_<workpack-slug>_<execution-order>
```

- **group-id**: The group directory name (e.g., `workpack-manager`).
- **workpack-slug**: A short kebab-case slug for the workpack.
- **execution-order**: Two-digit zero-padded phase number (e.g., `01`, `02`, `03`).

Workpacks with the same execution order can run in parallel.

## Workpack Inventory

| ID | Title | Phase | Status |
|----|-------|-------|--------|
| `workpack-manager_protocol-v6_01` | Protocol v6 Framework | 1 | Not Started |
| `workpack-manager_core-architecture_02` | Extension Core Architecture | 2 | Not Started |
| `workpack-manager_agent-integration_03` | Agent Integration Layer | 3 | Not Started |
| `workpack-manager_extension-ux_03` | Extension UX Layer | 3 | Not Started |
| `workpack-manager_validation-quality_04` | Validation & Quality | 4 | Not Started |
