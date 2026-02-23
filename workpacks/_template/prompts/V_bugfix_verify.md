---
prompt_id: V1_<descriptive_slug>
workpack: <WORKPACK_ID>
agent_role: Bug fix verification
depends_on:
  - B1_<corresponding_bug_slug>
repos:
  - <REPO_NAME>
estimated_effort: XS
---

# V1 – Verify Fix: <Brief Description>

## Linked Bug

- **Bug prompt**: `B1_<slug>`
- **Fix summary**: _brief description of the fix_

## Verification Steps

### 1. Reproduction Test

_Attempt to reproduce the original bug:_

```bash
# Steps to reproduce...
```

- [ ] Bug no longer reproduces.

### 2. Regression Tests

- [ ] New regression test exists for this bug.
- [ ] Regression test passes.
- [ ] All existing tests still pass.

### 3. Side Effects

- [ ] No new warnings introduced.
- [ ] No performance regression.
- [ ] Related functionality still works correctly.

## Output

Write `outputs/V1_<slug>.json`:

```json
{
  "workpack_id": "<WORKPACK_ID>",
  "prompt_id": "V1_<slug>",
  "status": "complete",
  "summary": "Fix verified: <brief description>.",
  "files_changed": []
}
```
