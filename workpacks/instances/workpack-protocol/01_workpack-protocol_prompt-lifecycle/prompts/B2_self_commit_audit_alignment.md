---
depends_on: [B1_changelog_2_2_0]
repos: [WorkpackManager]
---
# Bug Fix Prompt - Self Commit-Audit Alignment

> Align this workpack execution history with the new commit-tracking protocol so integration commit verification can pass.

## Bug Report

- **Bug ID**: `B2_self_commit_audit_alignment`
- **Discovered in**: `A5_integration_meta`
- **Affected area**: prompt outputs and branch audit trail for `A0`-`A5`

## Severity

This bug is classified as: `blocker`

## Objective

Ensure each completed prompt output includes verifiable `artifacts.commit_shas` that exist on `feature/workpack-protocol-evolution` and match declared `change_details`.

## Implementation Requirements

1. Commit all pending prompt changes with protocol-compliant commit messages.
2. Update completed prompt outputs (`A0`-`A5`) to include produced commit SHA(s).
3. Re-run commit verification:
   - `git log --oneline feature/workpack-protocol-evolution`
   - `git show --stat <sha>`
4. Cross-check each output's `change_details` against actual commit file lists.
5. Set `artifacts.branch_verified` in integration output only after checks pass.
6. Produce `outputs/B2_self_commit_audit_alignment.json`.

## Verification

```bash
python workpacks/tools/workpack_lint.py
python workpacks/tools/validate_templates.py
python -m pytest workpacks/tools/tests/test_workpack_lint.py -v
```

## Deliverables

- [ ] Commit SHA audit trail present and verified for completed prompts
- [ ] Integration output commit verification passes
- [ ] `outputs/B2_self_commit_audit_alignment.json` created
