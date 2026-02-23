---
prompt_id: A5_integration_meta
workpack: <WORKPACK_ID>
agent_role: V1 verification gate
depends_on:
  - <ALL_PRIOR_A_SERIES_PROMPTS>
repos:
  - <REPO_NAME>
estimated_effort: M
---

# A5 – V1 Verification Gate: <Workpack Title>

## Objective

Run a comprehensive verification pass across all deliverables from prior A-series prompts. Ensure the entire module compiles, tests pass, integration points are sound, and all acceptance criteria are met.

## Verification Checklist

### 1. Compilation and Type Safety

```bash
npx tsc --noEmit
```

- [ ] 0 errors, 0 warnings in strict mode.
- [ ] No `any` types in public API surfaces.

### 2. Unit Tests

```bash
npm test -- --grep "<module>"
```

- [ ] All tests pass.
- [ ] Coverage meets minimum threshold.

### 3. Integration Points

_Verify that the module integrates correctly with its consumers/dependencies._

- [ ] Public API exports are correct and complete.
- [ ] No internal types leak to public API.
- [ ] Dependencies are properly declared.

### 4. Documentation

- [ ] Public API is documented with JSDoc.
- [ ] README or module docs updated if needed.

## Acceptance Criteria Coverage

_Map each AC from `00_request.md` to evidence:_

| AC | Status | Evidence |
|----|--------|----------|
| AC1: _description_ | ✅/❌ | _evidence_ |
| AC2: _description_ | ✅/❌ | _evidence_ |
| ... | | |

## Output

Write `outputs/A5_integration_meta.json`:

```json
{
  "workpack_id": "<WORKPACK_ID>",
  "prompt_id": "A5_integration_meta",
  "status": "complete",
  "summary": "All acceptance criteria verified.",
  "files_changed": [],
  "verification_results": {
    "tsc_errors": 0,
    "test_pass_rate": "100%",
    "ac_coverage": "N/N"
  }
}
```

## Gate

- [ ] All ACs verified ✅.
- [ ] PR is ready for review.
- [ ] `99_status.md` updated with results.
