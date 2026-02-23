---
depends_on: [A1_data_models]
repos: [WorkpackManager]
---
# Dependency Graph Agent Prompt

> Implement dependency graph resolver for prompt-level DAG and cross-workpack dependencies with cycle detection.

---

## READ FIRST

1. `src/models/dependency-graph.ts` (from A1)
2. `workpacks/WORKPACK_META_SCHEMA.json` (requires_workpack and prompts.depends_on)
3. `workpacks/instances/02_workpack-manager_core-architecture/00_request.md`

## Context

Workpack: `02_workpack-manager_core-architecture`
This prompt implements the dependency graph resolver used for execution ordering and blocked-state detection.

## Delivery Mode

- PR-based.

## Objective

Implement a dependency graph resolver that handles two levels of dependencies: (1) prompt-level DAG (within a single workpack, using `depends_on` from prompt YAML front-matter or `workpack.meta.json` prompts array), and (2) workpack-level DAG (cross-workpack, using `requires_workpack` from `workpack.meta.json`). The resolver must support topological sorting, cycle detection, blocked-state computation, and ready-to-execute prompt identification.

## Reference Points

- **DependencyGraphData model**: Defined in `src/models/dependency-graph.ts`.
- **Topological sort**: Standard Kahn's algorithm or DFS-based approach.
- **DAG from meta.json**: The `prompts` array in `workpack.meta.json` contains `depends_on` for each prompt.
- **Cross-workpack refs**: The `requires_workpack` array in `workpack.meta.json`.

## Implementation Requirements

- Create `src/graph/dependency-resolver.ts`:
  - `buildPromptGraph(meta: WorkpackMeta): DependencyGraphData` — builds intra-workpack prompt DAG.
  - `buildWorkpackGraph(instances: WorkpackInstance[]): DependencyGraphData` — builds cross-workpack DAG.
  - `topologicalSort(graph: DependencyGraphData): string[] | CycleError` — returns execution order or cycle details.
  - `detectCycles(graph: DependencyGraphData): CycleError[]` — finds all cycles.
  - `getReadyPrompts(meta: WorkpackMeta, state: WorkpackState): string[]` — returns prompt stems whose dependencies are all complete.
  - `getBlockedWorkpacks(instances: WorkpackInstance[]): Map<string, string[]>` — returns workpack IDs that are blocked and by whom.
- Create `src/graph/graph-utils.ts`:
  - Utility functions for adjacency list construction, transitive closure, etc.
- Cycle detection must report the cycle path (not just "cycle detected").
- `getReadyPrompts` uses `state.promptStatus` to determine completion.

## Scope

### In Scope
- Prompt-level DAG construction and resolution
- Workpack-level DAG construction and resolution
- Topological sort
- Cycle detection with path reporting
- Ready-to-execute prompt computation
- Blocked-workpack computation
- Unit tests

### Out of Scope
- Execution orchestration (WP02)
- UI visualization (WP03)

## Acceptance Criteria

- [ ] Prompt-level DAG correctly orders prompts.
- [ ] Cross-workpack DAG correctly identifies blocked workpacks.
- [ ] Cycle detection returns the cycle path.
- [ ] `getReadyPrompts` returns only prompts whose deps are complete.
- [ ] Unit tests cover linear DAGs, parallel DAGs, cycles, and orphan nodes.

## Verification

```bash
npm test -- --grep "dependency"
npx tsc --noEmit
```

## Deliverables

- [ ] `src/graph/*.ts` files created
- [ ] Unit tests in `src/test/graph/`
- [ ] `outputs/A4_dependency_graph.json` written
- [ ] `99_status.md` updated
