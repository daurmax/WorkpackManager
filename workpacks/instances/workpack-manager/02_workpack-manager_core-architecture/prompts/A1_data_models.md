---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Data Models Agent Prompt

> Define TypeScript interfaces and types for WorkpackInstance, WorkpackMeta, WorkpackState, PromptEntry, and DependencyGraph matching Protocol v6 schemas.

---

## READ FIRST

1. `workpacks/WORKPACK_META_SCHEMA.json`
2. `workpacks/WORKPACK_STATE_SCHEMA.json`
3. `workpacks/WORKPACK_OUTPUT_SCHEMA.json`
4. `workpacks/PROTOCOL_SPEC.md`
5. `workpacks/instances/02_workpack-manager_core-architecture/00_request.md`

## Context

Workpack: `02_workpack-manager_core-architecture`
This prompt defines all core TypeScript types that the parser, state engine, and dependency graph will use.

## Delivery Mode

- PR-based.

## Objective

Create TypeScript interfaces and types in `src/models/` that faithfully represent the Protocol v6 data model. These types are the backbone of the extension — every other module depends on them. Types must map closely to the JSON Schema definitions but use idiomatic TypeScript conventions (camelCase properties, union types for enums, optional fields where schema allows).

## Reference Points

- **JSON Schema fields**: Map each field in `WORKPACK_META_SCHEMA.json` and `WORKPACK_STATE_SCHEMA.json` to a TypeScript interface property.
- **VS Code extension conventions**: Follow standard VS Code extension TypeScript patterns (strict mode, explicit return types).

## Implementation Requirements

- Create `src/models/workpack-meta.ts`:
  - `WorkpackMeta` interface matching all fields in `WORKPACK_META_SCHEMA.json`.
  - `PromptEntry` interface for the `prompts` array items.
  - `WorkpackCategory` union type for category enum.
  - `DeliveryMode` union type.
  - `EffortEstimate` union type.
- Create `src/models/workpack-state.ts`:
  - `WorkpackState` interface matching `WORKPACK_STATE_SCHEMA.json`.
  - `PromptStatus` interface for per-prompt status.
  - `OverallStatus` union type.
  - `PromptStatusValue` union type.
  - `ExecutionLogEntry` interface.
- Create `src/models/workpack-instance.ts`:
  - `WorkpackInstance` interface combining meta + state + filesystem location.
  - Fields: `folderPath`, `meta`, `state`, `protocolVersion`, `discoverySource` (auto/manual).
- Create `src/models/dependency-graph.ts`:
  - `DependencyNode` interface (prompt-level and workpack-level).
  - `DependencyEdge` interface.
  - `DependencyGraphData` interface (nodes + edges).
  - `CycleError` type.
- Create `src/models/output.ts`:
  - `AgentOutput` interface matching `WORKPACK_OUTPUT_SCHEMA.json`.
- Create `src/models/index.ts` re-exporting all types.
- All types must compile under `strict: true`.

## Contracts

Key interfaces (signatures only):

| Interface | File | Key Properties |
|-----------|------|----------------|
| `WorkpackMeta` | `workpack-meta.ts` | id, title, summary, protocolVersion, workpackVersion, category, createdAt, requiresWorkpack, tags, owners, repos, deliveryMode, targetBranch, prompts |
| `WorkpackState` | `workpack-state.ts` | workpackId, overallStatus, lastUpdated, promptStatus, agentAssignments, blockedBy, executionLog |
| `WorkpackInstance` | `workpack-instance.ts` | folderPath, meta, state, protocolVersion, discoverySource |
| `DependencyGraphData` | `dependency-graph.ts` | nodes, edges |

## Scope

### In Scope
- All TypeScript interfaces and types
- Index re-exports
- JSDoc comments on all public types

### Out of Scope
- Parser implementation (A2)
- State reconciliation logic (A3)
- Dependency graph algorithms (A4)

## Acceptance Criteria

- [ ] All interfaces match their JSON Schema counterparts.
- [ ] `npx tsc --noEmit` passes.
- [ ] All types have JSDoc comments.
- [ ] Index module re-exports all types.

## Verification

```bash
npx tsc --noEmit
```

## Deliverables

- [ ] `src/models/*.ts` files created
- [ ] Types compile under strict mode
- [ ] `outputs/A1_data_models.json` written
- [ ] `99_status.md` updated
