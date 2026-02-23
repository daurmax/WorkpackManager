# Plan

## Summary

<!-- One paragraph summarizing all work -->

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Task | A0_bootstrap | - | XS |
| 2 | Task | A1_xxx | 1 | M |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h, XL >8h.

## DAG Dependencies (v6)

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [] |

## Cross-Workpack References (v6)

requires_workpack: []

## Parallelization Map

```
Phase 0 (sequential):  A0_bootstrap
Phase 1 (parallel):    A1, A2, A3, A4
Phase 2 (sequential):  A5_integration_meta (V1 gate)
Phase 3 (conditional): B-series → V2 (V-loop)
Phase 4 (post-merge):  R1_retrospective
```

## Branch Strategy

| Component | Branch | Base | PR Target |
|-----------|--------|------|-----------|
| Feature | feature/<slug> | main | main |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Risk 1 | Med | High | Strategy |

## Security and Tool Safety

- No secrets in prompts or outputs.
- Limit writes to repository workspace only.

## Handoff Outputs Plan (Protocol v6)

- Each completed prompt writes `outputs/<PROMPT>.json`.
- Schema: `workpacks/WORKPACK_OUTPUT_SCHEMA.json`.
- Output JSON MUST include `repos`, `execution`, and `change_details`.
- A5 validates all outputs before merge.
- `workpack.state.json` is updated after each prompt completion.
