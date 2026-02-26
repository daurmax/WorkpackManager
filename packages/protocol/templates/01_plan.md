# Plan

## Summary

<!-- One paragraph summarizing all work -->

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Task | A0_bootstrap | - | XS |
| 2 | Task | A1_xxx | 1 | M |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h, XL >8h.

## DAG Dependencies

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [] |

## Cross-Workpack References

requires_workpack: []

## Parallelization Map

```
Phase 0 (sequential):  A0_bootstrap
Phase 1 (parallel):    A1, A2, A3, A4
Phase 2 (sequential):  V1_integration_meta (V1 gate)
Phase 3 (conditional): B-series → V2 (V-loop)
Phase 4 (post-merge):  R1_retrospective
```

### B-series DAG (post-verification)

Populate this section only if V1 generates B-series bug-fix prompts.

| B Prompt | depends_on | DAG Depth | Parallel Group | Notes |
|----------|------------|-----------|----------------|-------|
| B1_example_fix | [] | 0 | P0 | First independent fix |
| B2_followup_fix | [B1_example_fix] | 1 | P1 | Runs after B1 |
| B3_parallel_fix | [] | 0 | P0 | Can run in parallel with B1 |

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

## Handoff Outputs Plan

- Each completed prompt writes `outputs/<PROMPT>.json`.
- Schema: `workpacks/WORKPACK_OUTPUT_SCHEMA.json`.
- Output JSON MUST include `repos`, `execution`, and `change_details`.
- A5 validates all outputs before merge.
- `workpack.state.json` is updated after each prompt completion.
