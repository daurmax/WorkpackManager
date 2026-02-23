---
prompt_id: B1_<descriptive_slug>
workpack: <WORKPACK_ID>
agent_role: Bug fix
depends_on:
  - <PROMPT_THAT_INTRODUCED_THE_BUG>
repos:
  - <REPO_NAME>
estimated_effort: S
---

# B1 – Bug Fix: <Brief Description>

## Bug Report

- **Discovered during**: _prompt stem or testing phase_
- **Severity**: _critical / high / medium / low_
- **Affected component**: _module or file_

## Description

_Describe the bug: expected behavior, actual behavior, reproduction steps._

## Root Cause

_Analysis of why the bug occurs._

## Fix

_Describe the fix and list affected files._

### Files to Modify

| File | Change |
|------|--------|
| _path_ | _description of change_ |

### Implementation

_Code changes or approach._

## Verification

- [ ] Bug is no longer reproducible.
- [ ] Regression test added.
- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] All existing tests still pass.

## Output

Write `outputs/B1_<slug>.json`:

```json
{
  "workpack_id": "<WORKPACK_ID>",
  "prompt_id": "B1_<slug>",
  "status": "complete",
  "summary": "Bug fixed: <brief description>.",
  "files_changed": []
}
```
