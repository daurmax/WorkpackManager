---
depends_on: [A5_integration_meta]
repos: [WorkpackManager]
---
# Retrospective Agent Prompt

> Capture lessons learned, execution cost summary, and estimation accuracy after merge.

---

## READ FIRST

1. All output JSONs in `outputs/`
2. `workpacks/instances/01_workpack-manager_protocol-v6/01_plan.md`
3. `workpacks/instances/01_workpack-manager_protocol-v6/99_status.md`

## Context

Workpack: `01_workpack-manager_protocol-v6`
Execute this prompt AFTER the workpack is merged to main.

## Objective

Summarize what went well, what didn't, capture execution cost from all output JSONs, rate estimation accuracy (planned effort vs actual), and propose improvements for future workpacks.

## Deliverables

- [ ] `outputs/R1_retrospective.json` written
- [ ] `99_status.md` updated with retrospective complete
- [ ] `workpack.state.json` updated with R1 complete
