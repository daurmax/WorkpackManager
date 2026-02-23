---
depends_on: []
repos: [WorkpackManager]
---
# Bootstrap Agent Prompt

> Initialize the VS Code extension scaffold with package.json, tsconfig, activation events, and project structure.

---

## READ FIRST

1. `README.md`
2. `workpacks/instances/workpack-manager_core-architecture_02/00_request.md`
3. `workpacks/instances/workpack-manager_core-architecture_02/01_plan.md`

## Context

Workpack: `workpack-manager_core-architecture_02`
This prompt creates the VS Code extension scaffold.

## Delivery Mode

- Direct push (scaffold creation).

## Objective

Create the initial VS Code extension project structure. This includes `package.json` with extension metadata and contribution points, `tsconfig.json` with strict mode, the `src/` directory structure, and the extension entry point. The scaffold must be minimal but complete enough to compile and activate.

## Reference Points

- **VS Code extension scaffold**: Follow the standard `yo code` generator structure (package.json, src/extension.ts, tsconfig.json).
- **Contribution points**: Plan for `views`, `commands`, and `configuration` contribution points (stubs only — UI implementation is in WP03).

## Implementation Requirements

- Create `package.json` with:
  - Extension name: `workpack-manager`
  - Display name: `Workpack Manager`
  - Activation events: `onStartupFinished` (for scanning) and `onView:workpackExplorer`
  - Contribution point stubs for: tree view container, commands, configuration
  - Dev dependencies: TypeScript, `@types/vscode`, `@vscode/test-electron`
  - Build script via `tsc`
- Create `tsconfig.json` with strict mode, ES2022 target, `src/` root.
- Create `src/extension.ts` with `activate()` and `deactivate()` stubs.
- Create `src/` subdirectory structure:
  - `src/models/` — data models (A1)
  - `src/parser/` — parser/indexer (A2)
  - `src/state/` — state management (A3)
  - `src/graph/` — dependency graph (A4)
  - `src/providers/` — agent providers (WP02)
  - `src/views/` — UI components (WP03)
- Create feature branch `feature/extension-core-architecture`.
- Commit scaffold and workpack.

## Scope

### In Scope
- Extension scaffold
- Directory structure
- Feature branch

### Out of Scope
- Data model implementation (A1)
- Parser implementation (A2)

## Verification

```bash
npx tsc --noEmit
```

## Deliverables

- [ ] Feature branch created
- [ ] Extension scaffold committed
- [ ] `outputs/A0_bootstrap.json` written
