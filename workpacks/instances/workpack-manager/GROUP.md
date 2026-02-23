# Workpack Group: WorkpackManager VS Code Extension

## Overview

This group contains 5 workpacks that together deliver the WorkpackManager VS Code extension and the reusable Workpack Protocol 2.0.0 framework.

## Execution DAG

### Formal Dependency Graph

```
   01_workpack-manager_protocol-v6
               │
               ▼
   02_workpack-manager_core-architecture
               │
        ┌──────┴──────┐
        ▼             ▼
03_workpack-      03_workpack-
manager_agent-    manager_extension-
integration       ux
        │             │
        └──────┬──────┘
               ▼
   04_workpack-manager_validation-quality
```

### Phase Execution Plan

| Phase | Workpacks | Mode | Description |
|-------|-----------|------|-------------|
| 1 | `01_…protocol-v6` | Serial | Foundation: Protocol 2.0.0 spec, JSON schemas, templates, linter/scaffold tooling. |
| 2 | `02_…core-architecture` | Serial | Core extension: TypeScript data models, parser/indexer, state reconciliation, dependency graph. |
| 3 | `03_…agent-integration`, `03_…extension-ux` | **Parallel** | Two independent feature tracks. Agent layer (provider abstraction, Copilot/Codex providers, orchestrator) and UX layer (tree view, webview, commands, status visualization). |
| 4 | `04_…validation-quality` | Serial | Quality backbone: test framework, protocol linter, drift detection, 1.4.0→2.0.0 migration, CI pipeline. Integrates all prior workpacks. |

### Rules

1. **Sequential phases**: Phase N+1 cannot start until all workpacks in Phase N are complete.
2. **Parallel within phase**: Workpacks within the same phase (same `execution_order`) MAY execute concurrently. They have no dependencies on each other.
3. **Edges**: Each directed edge `[A, B]` means workpack A must be complete before workpack B can start.

### Edges (formal)

| From | To | Rationale |
|------|----|-----------|
| `01_…protocol-v6` | `02_…core-architecture` | Core needs 2.0.0 schemas and spec |
| `02_…core-architecture` | `03_…agent-integration` | Agent layer needs data models and parser |
| `02_…core-architecture` | `03_…extension-ux` | UX layer needs data models and parser |
| `03_…agent-integration` | `04_…validation-quality` | Quality layer validates agent integration |
| `03_…extension-ux` | `04_…validation-quality` | Quality layer validates UX integration |

## Workpack Naming Convention

Within a group, workpack directory names follow the pattern:

```
<NN>_<group-id>_<slug>
```

- **NN**: Two-digit zero-padded execution phase number (e.g., `01`, `02`, `03`). Comes first so that directories sort naturally by phase.
- **group-id**: The group directory name (e.g., `workpack-manager`).
- **slug**: A short kebab-case slug for the workpack.

Workpacks with the same `NN` can run in parallel.

## Workpack Inventory

| ID | Title | Phase | Status |
|----|-------|-------|--------|
| `01_workpack-manager_protocol-v6` | Protocol v6 Framework | 1 | Not Started |
| `02_workpack-manager_core-architecture` | Extension Core Architecture | 2 | Not Started |
| `03_workpack-manager_agent-integration` | Agent Integration Layer | 3 | Not Started |
| `03_workpack-manager_extension-ux` | Extension UX Layer | 3 | Not Started |
| `04_workpack-manager_validation-quality` | Validation & Quality | 4 | Not Started |
