---
depends_on: [A1_data_models]
repos: [WorkpackManager]
---
# State Reconciliation Agent Prompt

> Implement status reconciliation between workpack.state.json, outputs/, and 99_status.md to detect drift.

---

## READ FIRST

1. `src/models/` (all type files from A1)
2. `workpacks/WORKPACK_STATE_SCHEMA.json`
3. `workpacks/instances/02_workpack-manager_core-architecture/00_request.md`

## Context

Workpack: `02_workpack-manager_core-architecture`
This prompt implements the reconciliation engine that detects inconsistencies between declared state and actual filesystem artifacts.

## Delivery Mode

- PR-based.

## Objective

Implement a reconciliation engine that compares three sources of truth: (1) `workpack.state.json` (machine-readable state), (2) `outputs/` folder (actual artifact presence), and (3) `99_status.md` (human-readable status). The engine must detect drift — for example, when `state.json` says a prompt is complete but no output JSON exists, or when `99_status.md` marks something complete but `state.json` still says pending.

## Reference Points

- **Completion markers**: The reference protocol defines markers (✅ Done, 🟢 Complete, etc.) that the linter recognizes in `99_status.md`. The reconciliation engine should recognize the same markers.
- **WorkpackState model**: Defined in `src/models/workpack-state.ts`.
- **Output JSON**: Presence of `outputs/<PROMPT>.json` is a filesystem-level completion signal.

## Implementation Requirements

- Create `src/state/reconciliation-engine.ts`:
  - `reconcile(instance: WorkpackInstance): ReconciliationReport` — compares all three sources.
  - `ReconciliationReport` type with `drifts: DriftEntry[]`, `overallHealth: 'healthy' | 'drifted' | 'inconsistent'`.
  - `DriftEntry` type: `{ promptStem: string, field: string, stateValue: string, actualValue: string, severity: 'info' | 'warning' | 'error' }`.
- Create `src/state/status-markdown-parser.ts`:
  - Extract prompt completion markers from `99_status.md`.
  - Support all markers from the protocol (✅, 🟢, etc.).
- Create `src/state/output-scanner.ts`:
  - Scan `outputs/` folder for `.json` files.
  - Map filenames to prompt stems.
  - Validate basic JSON structure (optional: against output schema).
- Drift detection rules:
  - `state.json` says complete + no output JSON → ERROR drift
  - `state.json` says pending + output JSON exists → WARNING drift
  - `99_status.md` says complete + `state.json` says pending → WARNING drift
  - `state.json` overall_status inconsistent with per-prompt statuses → WARNING drift

## Scope

### In Scope
- Reconciliation engine
- Markdown status parser
- Output folder scanner
- Drift detection and reporting

### Out of Scope
- Auto-repair of drift (future enhancement)
- UI display of drift (WP03)

## Acceptance Criteria

- [ ] Reconciliation detects all listed drift scenarios.
- [ ] Markdown parser handles all protocol-defined completion markers.
- [ ] Output scanner maps files to prompt stems correctly.
- [ ] Unit tests cover each drift scenario.

## Verification

```bash
npm test -- --grep "reconciliation"
npx tsc --noEmit
```

## Deliverables

- [ ] `src/state/*.ts` files created
- [ ] Unit tests in `src/test/state/`
- [ ] `outputs/A3_state_reconciliation.json` written
- [ ] `99_status.md` updated
