---
prompt_id: A0_bootstrap
workpack: 03_workpack-manager_extension-ux
agent_role: Bootstrap
depends_on: []
repos:
  - WorkpackManager
estimated_effort: XS
---

# A0 – Bootstrap: Extension UX Layer

## Objective

Prepare the development environment for the UX workpack. Verify that WP01 (core architecture) deliverables are available.

## Pre-Conditions

1. WP01 (`02_workpack-manager_core-architecture`) is merged.
2. Repository builds successfully.

## Tasks

### Task 1: Create Feature Branch

```bash
cd <repo-root>
git checkout main && git pull
git checkout -b feature/extension-ux
```

### Task 2: Verify WP01 Deliverables

Confirm the following compile:
- `src/models/` — TypeScript interfaces for workpack, prompt, state.
- `src/parser/` — Parser/indexer for workpack discovery.
- `src/state/` — State reconciliation module.

### Task 3: Scaffold UX Module

```
src/
  views/
    index.ts                         # Barrel export
    workpack-tree-provider.ts        # TreeDataProvider
    workpack-tree-item.ts            # TreeItem subclass
    workpack-detail-panel.ts         # WebviewPanel
    status-icons.ts                  # Status → Codicon mapping
  commands/
    index.ts                         # Barrel export
    register-commands.ts             # Command registration
```

### Task 4: Add VS Code Contributions Stubs

Add to `package.json`:
- `contributes.views.explorer` — workpackManager tree view.
- `contributes.commands` — placeholder commands.
- `contributes.menus.view/item/context` — placeholder menu items.

Verify: `npx tsc --noEmit` passes.

## Output

Write `outputs/A0_bootstrap.json` per WORKPACK_OUTPUT_SCHEMA.json.

## Gate

- [ ] Feature branch exists.
- [ ] UX module scaffolded and compiles.
- [ ] `package.json` contributions added.
