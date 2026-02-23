---
depends_on: []
repos: [WorkpackManager]
---
# Bootstrap Agent Prompt

> Set up the feature branch and verify workspace readiness for Protocol v6 development.

---

## READ FIRST

1. `README.md`
2. `workpacks/CHANGELOG.md`
3. `workpacks/instances/01_workpack-manager_protocol-v6/00_request.md`
4. `workpacks/instances/01_workpack-manager_protocol-v6/01_plan.md`

## Context

Workpack: `01_workpack-manager_protocol-v6`
This prompt sets up the feature branch for Protocol v6 development.

## Delivery Mode

- Direct push (branch creation only).

## Objective

Create the feature branch `feature/workpack-protocol-v6` from `main` and verify that the workspace is ready for Protocol v6 development. Ensure the repository has proper structure, the existing schemas and templates are in place, and all downstream agents can start work immediately.

## Reference Points

- Branch naming convention: `feature/<workpack-slug>`
- Existing repo structure: `workpacks/`, `workpacks/_template/`, `workpacks/instances/`

## Implementation Requirements

- Create branch `feature/workpack-protocol-v6` from `main`.
- Verify that `workpacks/WORKPACK_META_SCHEMA.json` and `workpacks/WORKPACK_STATE_SCHEMA.json` exist.
- Verify that `workpacks/_template/` contains all expected template files including `workpack.meta.json` and `workpack.state.json`.
- Verify that `workpacks/instances/` directory exists and is ready for workpack instances.
- Commit the workpack scaffold as the first commit on the feature branch.

## Scope

### In Scope
- Branch creation
- Workspace structure verification
- Workpack scaffold commit

### Out of Scope
- Protocol specification content
- Schema finalization
- Tooling implementation

## Acceptance Criteria

- [ ] Feature branch exists and is based on `main`.
- [ ] Workpack scaffold is committed.
- [ ] Workspace structure is verified and ready.

## Verification

```bash
git branch --contains HEAD | grep feature/workpack-protocol-v6
ls workpacks/WORKPACK_META_SCHEMA.json
ls workpacks/WORKPACK_STATE_SCHEMA.json
ls workpacks/_template/workpack.meta.json
```

## Deliverables

- [ ] Feature branch created
- [ ] Workspace verified
- [ ] `outputs/A0_bootstrap.json` written
- [ ] `99_status.md` updated
