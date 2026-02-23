# Plan

## Summary

This workpack defines Workpack Protocol v6, introducing `workpack.meta.json` for machine-readable static metadata and `workpack.state.json` for mutable runtime state. It produces JSON Schemas, updated templates, tooling updates (linter + scaffold), a protocol specification document, and an adoption guide for integrating workpacks into external projects. All changes are backward-compatible with Protocol v5.

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Create feature branch and verify workspace readiness | A0_bootstrap | - | XS |
| 2 | Write protocol v6 specification document with metadata/state split rationale | A1_protocol_spec | 1 | M |
| 3 | Finalize JSON Schemas (meta, state) and validate templates against them | A2_schemas_and_templates | 1 | M |
| 4 | Update linter for v6 checks (meta presence, id consistency, prompt drift) | A3_tooling_linter | 2, 3 | M |
| 5 | Update scaffold tool to generate workpack.meta.json and workpack.state.json | A4_tooling_scaffold | 2, 3 | S |
| 6 | Write adoption guide for integrating workpacks into external projects | A6_adoption_guide | 2 | M |
| 7 | Run V1 verification gate and merge readiness review | A5_integration_meta | 2, 3, 4, 5, 6 | M |
| 8 | Post-merge retrospective | R1_retrospective | 7 and merge | S |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h.

## DAG Dependencies (v6)

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_protocol_spec | [A0_bootstrap] | [WorkpackManager] |
| A2_schemas_and_templates | [A0_bootstrap] | [WorkpackManager] |
| A3_tooling_linter | [A1_protocol_spec, A2_schemas_and_templates] | [WorkpackManager] |
| A4_tooling_scaffold | [A1_protocol_spec, A2_schemas_and_templates] | [WorkpackManager] |
| A6_adoption_guide | [A1_protocol_spec] | [WorkpackManager] |
| A5_integration_meta | [A1_protocol_spec, A2_schemas_and_templates, A3_tooling_linter, A4_tooling_scaffold, A6_adoption_guide] | [WorkpackManager] |
| R1_retrospective | [A5_integration_meta] | [WorkpackManager] |

## Cross-Workpack References (v6)

requires_workpack: []

This is the foundation workpack. No external dependencies.

## Parallelization Map

```
Phase 0 (sequential):
  └── A0_bootstrap

Phase 1 (parallel):
  ├── A1_protocol_spec      ─┐
  └── A2_schemas_and_templates ─┘

Phase 2 (parallel):
  ├── A3_tooling_linter          ─┐
  ├── A4_tooling_scaffold        ─┤
  └── A6_adoption_guide          ─┘

Phase 3 (sequential — V1 gate):
  └── A5_integration_meta
        ├── PASS → MERGE ✅
        └── FAIL → Phase 4

Phase 4 (conditional — bug fixes):
  ├── B-series → V2_bugfix_verify (V-loop)

Phase 5 (post-merge):
  └── R1_retrospective
```

## Branch Strategy

| Component | Branch Name | Base Branch | PR Target |
|-----------|-------------|-------------|-----------|
| Feature root | `feature/workpack-protocol-v6` | `main` | `main` |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schema design too rigid for future needs | Medium | High | Use additionalProperties: false only where warranted; keep extension points |
| Adoption guide too abstract for real use | Medium | Medium | Include concrete examples with a sample project |
| Linter changes break v5 workpack validation | Low | High | Run linter against v5-style test fixtures before merge |
| Template bloat discourages adoption | Low | Medium | Keep templates minimal; document optional fields clearly |

## Security and Tool Safety

- No secrets in prompts, outputs, or schemas.
- Limit writes to repository workspace only.
- Schemas and templates must not contain executable code.

## Handoff Outputs Plan (Protocol v6)

- Each completed prompt writes `outputs/<PROMPT>.json`.
- Schema: `workpacks/WORKPACK_OUTPUT_SCHEMA.json`.
- Output JSON MUST include `repos`, `execution`, and `change_details`.
- A5 validates all outputs before merge.
- `workpack.state.json` is updated after each prompt completion.
