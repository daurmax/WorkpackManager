---
depends_on: [A1_b_series_dag, A2_commit_tracking]
repos: [WorkpackManager]
---
# Integration Verification Enhancements Agent Prompt

> Extend the integration prompt pattern to verify commits and B-series DAG consistency.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/00_request.md`
2. `workpacks/instances/workpack-protocol/01_workpack-protocol_prompt-lifecycle/01_plan.md`
3. `outputs/A1_b_series_dag.json`
4. `outputs/A2_commit_tracking.json`
5. `workpacks/PROTOCOL_SPEC.md` — with the newly added B-series DAG and commit tracking sections
6. `workpacks/WORKPACK_OUTPUT_SCHEMA.json` — with the updated schema
7. `workpacks/_template/prompts/PROMPT_STYLE_GUIDE.md`

## Context

Workpack: `01_workpack-protocol_prompt-lifecycle`
Feature: Integration prompt enhancements.

A1 added B-series DAG support. A2 added commit tracking. This prompt synthesizes both into the integration/verification prompt pattern, documenting what the integration prompt must do to verify these new requirements.

## Delivery Mode

- PR-based.

## Objective

### 1. Protocol Specification (`PROTOCOL_SPEC.md`)

Extend the integration prompt (A5 / V-series) responsibilities section:

**Commit Verification** — the integration prompt MUST:
1. For each prior prompt's `output.json`, extract `artifacts.commit_shas`.
2. Verify each SHA exists on the work branch: `git log --oneline <branch> | grep <sha>`.
3. For each commit, diff the files changed: `git show --stat <sha>`.
4. Cross-reference diffed files against `change_details[].file` in the output JSON.
5. Report discrepancies: files in commit but not declared, or declared but not in commit.
6. Set `artifacts.branch_verified: true` in its own output if all checks pass.

**B-series DAG Verification** — the integration prompt MUST:
1. If B-series prompts exist, verify their DAG is acyclic.
2. Verify that B-series execution order respected dependencies.
3. Verify that all B-series prompts referenced in the DAG have corresponding output JSONs.

### 2. Style Guide Updates

- `workpacks/_template/prompts/PROMPT_STYLE_GUIDE.md`: Add a section on integration prompt responsibilities for commit and B-series verification.

### 3. Integration Template

Update or create a reference integration prompt template that includes:
- Git verification commands to run.
- Cross-reference procedure between output JSONs and git history.
- B-series DAG consistency check procedure.

## Verification

```bash
python workpacks/tools/validate_templates.py
# Manual review of PROTOCOL_SPEC.md integration section
```

## Deliverables

- [ ] Updated `PROTOCOL_SPEC.md` integration prompt section
- [ ] Updated `PROMPT_STYLE_GUIDE.md` with integration responsibilities
- [ ] Output in `outputs/A3_integration_verification.json`
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
