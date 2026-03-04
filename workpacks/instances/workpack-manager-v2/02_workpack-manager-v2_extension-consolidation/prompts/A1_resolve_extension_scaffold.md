---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A1_resolve_extension_scaffold

> Remove the duplicate `packages/extension/` scaffold and document root-level extension ownership to eliminate source-location ambiguity.

---

## READ FIRST

1. `workpacks/instances/workpack-manager-v2/02_workpack-manager-v2_extension-consolidation/00_request.md`
2. `workpacks/instances/workpack-manager-v2/02_workpack-manager-v2_extension-consolidation/01_plan.md`
3. `workpacks/instances/workpack-manager-v2/02_workpack-manager-v2_extension-consolidation/workpack.meta.json`
4. `workpacks/instances/workpack-manager-v2/02_workpack-manager-v2_extension-consolidation/workpack.state.json`

## Context

Workpack: `workpack-manager-v2/02_workpack-manager-v2_extension-consolidation`

## Delivery Mode

- PR-based

## Objective

Resolve AC1 by deleting the obsolete `packages/extension/` scaffold and updating repository documentation so contributors treat root `src/` + root `package.json` as the only extension implementation and manifest source.

## Reference Points

- `packages/extension/` (legacy scaffold to remove)
- `src/extension.ts` (canonical extension runtime entrypoint)
- `package.json` at repository root (canonical extension manifest: `main`, `contributes`, `activationEvents`)
- `README.md` monorepo/distribution sections (needs alignment with actual structure)
- `pnpm-workspace.yaml` (`packages/*` should remain valid after removal)

## Implementation Requirements

- Remove tracked scaffold files under `packages/extension/` (`package.json`, `tsconfig.json`, `src/extension.ts`, `.vscodeignore`, `.gitkeep`).
- Ensure no production extension code is moved from root `src/` in this prompt.
- Update docs to explain why `packages/extension/` was removed and where extension code now lives.
- Preserve extension manifest behavior by leaving root `package.json` `main`, `activationEvents`, and `contributes` unchanged.
- Keep workspace/package tooling functional after scaffold removal.

## Scope

### In Scope
- Delete `packages/extension/` scaffold artifacts from version control
- Update top-level docs describing monorepo package layout and extension source location
- Run minimal verification to confirm no import/build regressions from scaffold removal

### Out of Scope
- Shared AJV cache extraction (handled in `A2_extract_ajv_cache`)
- Git branch cleanup (handled in `A3_clean_merged_branches`)
- Functional changes to extension commands/providers/views

## Acceptance Criteria

- [ ] AC1: `packages/extension/` scaffold is removed from the repository with rationale documented in `README.md`.
- [ ] AC2: Root extension manifest/source ownership remains unchanged (`package.json` and `src/extension.ts` continue to be canonical).
- [ ] AC3: `npm run build` succeeds after scaffold removal.

## Verification

```bash
if (Test-Path "packages/extension") { throw "packages/extension should be removed" } else { Write-Output "packages/extension removed" }
npm run build
```

## Deliverables

- [ ] `README.md` updated to reflect canonical extension location
- [ ] `packages/extension/` scaffold files removed
- [ ] `outputs/A1_resolve_extension_scaffold.json` written
