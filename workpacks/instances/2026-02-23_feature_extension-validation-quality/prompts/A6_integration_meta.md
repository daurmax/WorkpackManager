---
prompt_id: A6_integration_meta
workpack: 2026-02-23_feature_extension-validation-quality
agent_role: V1 verification gate
depends_on:
  - A1_test_strategy
  - A2_protocol_linter
  - A3_drift_detection
  - A4_migration_compat
  - A5_ci_pipeline
repos:
  - WorkpackManager
estimated_effort: M
---

# A6 – V1 Verification Gate: Validation & Quality

## Objective

Comprehensive verification of all validation and quality deliverables from A1–A5.

## Verification Checklist

### 1. Compilation

```bash
npx tsc --noEmit
```
- [ ] 0 errors, 0 warnings.

### 2. Tests

```bash
npm test
```
- [ ] All unit tests pass.
- [ ] Coverage meets minimum thresholds (60%).

### 3. Lint

```bash
npm run lint
```
- [ ] 0 lint errors.

### 4. Workpack Linter Verification

Run the workpack linter on all workpack instances in this repo:
- [ ] All 5 workpacks pass linting.
- [ ] No errors (warnings acceptable).
- [ ] Diagnostics appear in VS Code Problems panel.

### 5. Drift Detection Verification

Run drift detection on all workpack instances:
- [ ] All expected drifts are detected in test fixtures.
- [ ] No false positives on valid workpacks.

### 6. Migration Verification

Run migration on a v5 fixture:
- [ ] `workpack.meta.json` generated and valid.
- [ ] `workpack.state.json` generated and valid.
- [ ] Original files untouched.

### 7. CI Pipeline Verification

- [ ] `.github/workflows/ci.yml` exists and is valid.
- [ ] CI would pass with current codebase.

## Acceptance Criteria Coverage

| AC | Status | Evidence |
|----|--------|----------|
| AC1: Test framework configured | ✅/❌ | `npm test` runs |
| AC2: Unit tests for all modules | ✅/❌ | Coverage report |
| AC3: Linter validates | ✅/❌ | Lint rule tests |
| AC4: VS Code diagnostics | ✅/❌ | Diagnostics provider test |
| AC5: Drift detector | ✅/❌ | Drift detection tests |
| AC6: Migration tool works | ✅/❌ | Migration tests |
| AC7: Non-destructive migration | ✅/❌ | File preservation test |
| AC8: Integration tests | ✅/❌ | End-to-end test |
| AC9: CI configuration | ✅/❌ | Workflow file |

## Output

Write `outputs/A6_integration_meta.json`.

## Gate

- [ ] All ACs verified.
- [ ] PR is ready for review.
