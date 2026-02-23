# Workpack Group: Workpack Protocol Evolution

## Overview

This group contains workpacks that evolve the Workpack Protocol itself — a "meta" group. While the `workpack-manager` group builds the VS Code extension that consumes the protocol, this group modifies the protocol specification, schemas, tooling, and processes that define how workpacks work.

Changes tracked here are inherently self-referential: they modify the rules by which all workpacks (including these) operate.

## Execution DAG

### Formal Dependency Graph

```
   01_workpack-protocol_prompt-lifecycle
```

> Single workpack at this time. New protocol evolution workpacks will be added to subsequent phases as they arise.

### Phase Execution Plan

| Phase | Workpacks | Mode | Description |
|-------|-----------|------|-------------|
| 1 | `01_…prompt-lifecycle` | Serial | Add B-series dependency DAG and per-prompt commit tracking with integration gate verification. |

### Rules

1. **Sequential phases**: Phase N+1 cannot start until all workpacks in Phase N are complete.
2. **Parallel within phase**: Workpacks within the same phase (same `execution_order`) MAY execute concurrently.
3. **Edges**: Each directed edge `[A, B]` means workpack A must be complete before workpack B can start.

### Edges (formal)

_No cross-workpack edges yet (single workpack)._

## Workpack Naming Convention

Within a group, workpack directory names follow the pattern:

```
<NN>_<group-id>_<slug>
```

- **NN**: Two-digit zero-padded execution phase number.
- **group-id**: `workpack-protocol` (this group).
- **slug**: A short kebab-case slug for the workpack.

## Workpack Inventory

| ID | Title | Phase | Status |
|----|-------|-------|--------|
| `01_workpack-protocol_prompt-lifecycle` | Prompt Lifecycle Enhancements | 1 | Not Started |
