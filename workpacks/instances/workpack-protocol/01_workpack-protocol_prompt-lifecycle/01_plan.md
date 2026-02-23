# Plan

## Summary

This workpack delivers two complementary enhancements to the Workpack Protocol prompt lifecycle: (1) B-series bug-fix prompts gain a dependency DAG so that fix ordering and parallelization are explicit, and (2) every prompt must commit changes and record commit SHAs in its output.json, with the integration prompt verifying commit existence and file consistency. Both features target protocol version 2.2.0 and are backward compatible with 2.0.0/2.1.0 workpacks.

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Bootstrap: branch, baseline verification, read current spec and schemas | A0_bootstrap | - | XS |
| 2 | B-series DAG: spec, schemas, templates, linter checks | A1_b_series_dag | 1 | M |
| 3 | Commit tracking: output schema, spec, templates | A2_commit_tracking | 1 | M |
| 4 | Integration verification: extend A5 template and spec for commit + B-DAG checks | A3_integration_verification | 2, 3 | S |
| 5 | V1 integration gate: compile, test, lint, cross-check all ACs | A5_integration_meta | 4 | S |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h, XL >8h.

## DAG Dependencies

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_b_series_dag | [A0_bootstrap] | [WorkpackManager] |
| A2_commit_tracking | [A0_bootstrap] | [WorkpackManager] |
| A3_integration_verification | [A1_b_series_dag, A2_commit_tracking] | [WorkpackManager] |
| A5_integration_meta | [A3_integration_verification] | [WorkpackManager] |

## Cross-Workpack References

requires_workpack: []

## Parallelization Map

```
Phase 0 (sequential):  A0_bootstrap
Phase 1 (parallel):    A1_b_series_dag ‖ A2_commit_tracking
Phase 2 (sequential):  A3_integration_verification
Phase 3 (sequential):  A5_integration_meta (V1 gate)
Phase 4 (conditional): B-series → V2 (V-loop)
Phase 5 (post-merge):  R1_retrospective
```

A1 and A2 are independent features that can be developed in parallel. A3 synthesizes both and updates the integration pattern. A4 is the final verification gate.

## Branch Strategy

| Component | Branch | Base | PR Target |
|-----------|--------|------|-----------|
| Feature | feature/workpack-protocol-evolution | main | main |

## Detailed Task Breakdown

### A1_b_series_dag — B-series Dependency DAG

**Spec changes** (`PROTOCOL_SPEC.md`):
- Add section on B-series DAG support under the B-series description.
- B-series prompts MAY declare `depends_on` in YAML front-matter (same syntax as A-series).
- The integration/verification prompt that *generates* B-series prompts MUST also produce a B-series dependency plan (which can go in parallel, which are sequential).
- The `01_plan.md` template gains a "B-series DAG" section (populated post-V1 if bugs are found).

**Schema changes** (`WORKPACK_META_SCHEMA.json`):
- The `prompts[].stem` pattern already allows B-stems (`^[A-Z][A-Za-z0-9]*(?:_[a-z0-9][a-z0-9_]*)+$`). Verify it works.
- No schema change needed if the pattern already matches `B1_some_fix`.

**Template changes**:
- `01_plan.md`: Add a "### B-series DAG (post-verification)" section stub.
- `PROMPT_STYLE_GUIDE.md`: Document that B-series prompts should include `depends_on` front-matter.

**Linter changes** (`workpack_lint.py`):
- Validate B-series `depends_on` references (no cycles, no unknown stems).
- Existing A-series DAG validation code should be extended to also cover B-series.

### A2_commit_tracking — Per-Prompt Commit Tracking

**Spec changes** (`PROTOCOL_SPEC.md`):
- Add "Commit Tracking" section under the agent interaction protocol.
- Each prompt that modifies files MUST commit before writing output.json.
- Commit message convention: `<type>(<workpack-slug>/<prompt-stem>): <summary>`.
- The `output.json` MUST include `artifacts.commit_shas` (array of SHA strings).
- The `branch.work` field MUST match the actual branch where commits were made.

**Schema changes** (`WORKPACK_OUTPUT_SCHEMA.json`):
- Move `artifacts` from optional to `required`.
- Within `artifacts`, make `commit_shas` required with `minItems: 1`.
- These requirements apply only when `schema_version` is `"1.2"` or higher (bump schema version).
- Add `artifacts.branch_verified` boolean (set by integration prompt after verification).

**Template changes**:
- Integration prompt template: Add commit verification section.

**Linter changes** (`workpack_lint.py`):
- For completed prompts (protocol ≥ 2.2.0), warn if `artifacts.commit_shas` is empty or missing.

### A3_integration_verification — Integration Prompt Enhancements

**Spec changes** (`PROTOCOL_SPEC.md`):
- Document integration prompt responsibilities for commit verification.
- Integration prompt MUST: (a) verify each commit SHA exists on the work branch; (b) diff the commit to cross-check files against `change_details`; (c) report discrepancies.

**Template changes**:
- Update the A5/integration prompt template or style guide to include Git verification commands.
- Suggested verification commands: `git log --oneline <branch>`, `git show --stat <sha>`, cross-reference with `change_details`.

### A5_integration_meta — V1 Gate

Standard integration prompt: compile, test, lint, cross-check all ACs.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Backward compatibility break in output schema | Med | High | Version-gate `artifacts` requirement to schema_version ≥ 1.2 / protocol ≥ 2.2.0 |
| B-series DAG over-engineering | Low | Med | Keep it simple: reuse existing `depends_on` mechanism, no new syntax |
| Commit tracking too rigid for agents | Low | Med | Allow `commit_shas: []` for prompts that make no file changes (e.g., pure verification) |

## Security and Tool Safety

- No secrets in prompts or outputs.
- Limit writes to repository workspace only.
- Commit SHAs are public repository data, not sensitive.

## Handoff Outputs Plan

- Each completed prompt writes `outputs/<PROMPT>.json`.
- Schema: `workpacks/WORKPACK_OUTPUT_SCHEMA.json`.
- Output JSON MUST include `repos`, `execution`, and `change_details`.
- A5 validates all outputs before merge authorization.
- `workpack.state.json` is updated after each prompt completion.
