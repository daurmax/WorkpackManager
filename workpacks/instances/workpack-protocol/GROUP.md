# Workpack Group: Workpack Protocol Evolution

## Overview

This group contains workpacks that evolve the Workpack Protocol itself — a "meta" group. While the `workpack-manager` group builds the VS Code extension that consumes the protocol, this group modifies the protocol specification, schemas, tooling, and processes that define how workpacks work.

Changes tracked here are inherently self-referential: they modify the rules by which all workpacks (including these) operate.

## Execution DAG

### Formal Dependency Graph

```
Phase 1:  01_prompt-lifecycle ──────────────┐
                                            │
Phase 2:  02_verification-hardening ──┬─┐   │
          02_project-config ──────────┤ │   │
                                      │ │   │
Phase 3:  03_agent-documentation ─────┤ ◄───┘
          03_human-documentation ─────┤
                                      │
Phase 4:  04_npm-distribution ────────┘
```

### Phase Execution Plan

| Phase | Workpacks | Mode | Description |
|-------|-----------|------|-------------|
| 1 | `01_…prompt-lifecycle` | Serial | B-series dependency DAG and per-prompt commit tracking with integration gate verification. |
| 2 | `02_…verification-hardening`, `02_…project-config` | Parallel | Full invariant enforcement in Python tools; `workpack.config.json` format and tool integration. |
| 3 | `03_…agent-documentation`, `03_…human-documentation` | Parallel | Agent-optimized rules and state machine; human-readable docs suite (concepts, quickstart, integration, troubleshooting). |
| 4 | `04_…npm-distribution` | Serial | Monorepo restructure, `@workpack/protocol` npm package, `init` CLI command, extension scaffold. |

### Rules

1. **Sequential phases**: Phase N+1 cannot start until all workpacks in Phase N are complete.
2. **Parallel within phase**: Workpacks within the same phase (same `execution_order`) MAY execute concurrently.
3. **Edges**: Each directed edge `[A, B]` means workpack A must be complete before workpack B can start.

### Edges (formal)

| From | To |
|------|----|
| `01_…prompt-lifecycle` | `02_…verification-hardening` |
| `01_…prompt-lifecycle` | `02_…project-config` |
| `02_…verification-hardening` | `03_…agent-documentation` |
| `02_…project-config` | `03_…agent-documentation` |
| `02_…verification-hardening` | `03_…human-documentation` |
| `02_…project-config` | `03_…human-documentation` |
| `03_…agent-documentation` | `04_…npm-distribution` |
| `03_…human-documentation` | `04_…npm-distribution` |

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
| `01_workpack-protocol_prompt-lifecycle` | Prompt Lifecycle Enhancements | 1 | Complete |
| `02_workpack-protocol_verification-hardening` | Verification Hardening — Full Invariant Enforcement | 2 | Not Started |
| `02_workpack-protocol_project-config` | Project Configuration (workpack.config.json) | 2 | Not Started |
| `03_workpack-protocol_agent-documentation` | Agent-Optimized Documentation | 3 | Not Started |
| `03_workpack-protocol_human-documentation` | Human-Readable Documentation Suite | 3 | Not Started |
| `04_workpack-protocol_npm-distribution` | npm Distribution & Monorepo Setup | 4 | Not Started |
