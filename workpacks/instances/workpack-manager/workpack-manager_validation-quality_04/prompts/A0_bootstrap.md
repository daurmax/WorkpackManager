---
prompt_id: A0_bootstrap
workpack: workpack-manager_validation-quality_04
agent_role: Bootstrap
depends_on: []
repos:
  - WorkpackManager
estimated_effort: XS
---

# A0 – Bootstrap: Validation & Quality

## Objective

Prepare the development environment for the validation and quality workpack. Verify that WP01, WP02, and WP03 deliverables are available.

## Pre-Conditions

1. WP01, WP02, WP03 are merged or their outputs are available on `main`.
2. Repository builds successfully.

## Tasks

### Task 1: Create Feature Branch

```bash
cd <repo-root>
git checkout main && git pull
git checkout -b feature/extension-validation-quality
```

### Task 2: Verify Prior Deliverables

Confirm the following compile:
- `src/models/` — Data models (WP01).
- `src/parser/` — Parser/indexer (WP01).
- `src/state/` — State reconciliation (WP01).
- `src/agents/` — Agent integration layer (WP02).
- `src/views/` — Tree view, detail panel (WP03).
- `src/commands/` — Command registration (WP03).

### Task 3: Scaffold Validation Module

```
src/
  validation/
    index.ts                  # Barrel export
    linter.ts                 # Workpack structural linter
    lint-rules.ts             # Individual lint rules
    diagnostics.ts            # VS Code DiagnosticCollection integration
    drift-detector.ts         # State vs artifacts drift detection
    migration.ts              # v5 → v6 migration tool
```

Verify: `npx tsc --noEmit` passes.

## Output

Write `outputs/A0_bootstrap.json`.

## Gate

- [ ] Feature branch exists.
- [ ] All prior WP deliverables compile.
- [ ] Validation module scaffolded.
