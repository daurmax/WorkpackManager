---
depends_on: [A5_integration_meta]
repos: [WorkpackManager]
---
# Bugfix Agent Prompt (B2)

> Add a deterministic lint gate for the extension core architecture workpack.

---

## READ FIRST

1. `workpacks/instances/workpack-manager/02_workpack-manager_core-architecture/outputs/A5_integration_meta.json`
2. `package.json`
3. `tsconfig.json`
4. `src/`

## Context

Workpack: `02_workpack-manager_core-architecture`
Gate blocker from A5: `npm run lint` fails because no lint script exists.

## Objective

Introduce and configure lint tooling so `npm run lint` is available, deterministic, and green for the current source tree.

## Required Fixes

- Add a `lint` script in `package.json`.
- Add required lint dependencies/configuration for TypeScript source.
- Ensure lint configuration is compatible with strict TypeScript and current test/source conventions.
- Resolve lint violations in scope of this workpack so the command passes in CI and local runs.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm test
```

## Deliverables

- [ ] `outputs/B2_lint_gate.json`
- [ ] `99_status.md` updated
- [ ] `workpack.state.json` updated
