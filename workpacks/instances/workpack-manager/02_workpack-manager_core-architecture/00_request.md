# Request

## Workpack Protocol Version

Workpack Protocol Version: 2.0.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `extension-core-architecture`

Design and implement the core architecture of the VS Code WorkpackManager extension. This includes TypeScript data models for workpacks, a parser/indexer that discovers and reads workpack instances from the filesystem (including multi-root workspaces), state management for reconciling declared status with actual artifacts, dependency graph handling for both intra-workpack (prompt DAG) and cross-workpack (`requires_workpack`) dependencies, and the extension activation/contribution point scaffold.

The architecture must support both automatic discovery (scanning `workpacks/instances/` in workspace folders) and manual registration of workpack folders when auto-discovery is not possible.

Constraints and notes:

- Depends on WP00 (workpack-protocol-v6) for schema definitions and protocol specification.
- TypeScript with strict mode.
- Extension must handle multi-root VS Code workspaces.
- Parser must read `workpack.meta.json` (primary) with fallback to markdown parsing for v5 workpacks.
- State management must reconcile `workpack.state.json` with actual `outputs/` and `99_status.md`.
- Dependency graph must detect cycles and blocked states.
- Primary repo: `WorkpackManager`.

Preferred Delivery Mode: `PR`
Target Base Branch: `main`

## Acceptance Criteria

- [ ] AC1: TypeScript interfaces exist for WorkpackInstance, WorkpackMeta, WorkpackState, PromptEntry, PromptStatus, and DependencyGraph.
- [ ] AC2: Parser correctly reads `workpack.meta.json` and falls back to markdown parsing for v5 workpacks.
- [ ] AC3: Auto-discovery scans `workpacks/instances/` in all workspace folders (multi-root support).
- [ ] AC4: Manual registration allows adding arbitrary workpack folder paths.
- [ ] AC5: Status reconciliation detects drift between `workpack.state.json`, `outputs/`, and `99_status.md`.
- [ ] AC6: Dependency graph resolver handles both prompt-level DAG and cross-workpack dependencies.
- [ ] AC7: Cycle detection reports cycles instead of hanging.
- [ ] AC8: Extension scaffold includes `package.json`, activation events, and contribution points.
- [ ] AC9: All data models validate against the JSON Schemas defined in WP00.
- [ ] AC10: Unit tests cover parser, reconciliation, and dependency graph.

## Constraints

- TypeScript strict mode required.
- Must not depend on any specific project structure beyond the workpack protocol.
- Must handle missing/malformed files gracefully (warn, don't crash).
- No secrets, tokens, or credentials.

## Acceptance Criteria → Verification Mapping

| AC ID | Criterion | How to Verify |
|-------|-----------|---------------|
| AC1 | Data models exist | `npx tsc --noEmit` passes |
| AC2 | Parser reads meta.json and falls back | Unit tests for parser with both v5 and v6 fixtures |
| AC3 | Multi-root discovery works | Unit tests with mock workspace folders |
| AC4 | Manual registration works | Unit test for addWorkpackFolder API |
| AC5 | Drift detection works | Unit tests with deliberate drift scenarios |
| AC6 | Dependency graph works | Unit tests with known DAG structures |
| AC7 | Cycle detection works | Unit tests with cyclic dependencies |
| AC8 | Extension scaffold is valid | `npx vsce package --no-yarn` succeeds (dry run) |
| AC9 | Models match schemas | Compile-time type checks + runtime validation |
| AC10 | Tests pass | `npm test` passes |

## Delivery Mode

- [x] PR-based (default)
- [ ] Direct push

## Scope

### In Scope

- TypeScript data models and interfaces
- Workpack parser/indexer
- Auto-discovery and manual registration
- Status reconciliation engine
- Dependency graph resolver (intra + cross-workpack)
- Extension scaffold (package.json, activation)
- Unit tests

### Out of Scope

- UI components (separate workpack)
- Agent integration (separate workpack)
- Linter/tooling (handled by WP00)
