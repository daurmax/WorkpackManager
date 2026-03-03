# Plan

## Summary

Prepare WorkpackManager for public release. Configure VSIX packaging with marketplace metadata, prepare `@workpack/protocol` for npm publication, create GitHub Actions CI/CD pipelines for automated validation and release, and polish documentation and assets for marketplace listing.

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Create feature branch, audit current packaging state | A0_bootstrap | - | XS |
| 2 | Configure VSIX packaging: .vscodeignore, build scripts, icon, marketplace metadata | A1_vsix_packaging | 1 | M |
| 3 | Prepare @workpack/protocol for npm: files field, private:false, README, bin exports | A2_npm_publish_protocol | 1 | S |
| 4 | Create GitHub Actions workflows for CI and release | A3_ci_release_pipeline | 2, 3 | M |
| 5 | Restructure README for marketplace, update CHANGELOG, add badges | A4_readme_marketplace | 2 | S |
| 6 | Verification: VSIX builds, npm pack, CI YAML valid, README sections | V1_integration_meta | 4, 5 | S |
| 7 | Post-merge retrospective | R1_retrospective | 6 | XS |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h, XL >8h.

## DAG Dependencies

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_vsix_packaging | [A0_bootstrap] | [WorkpackManager] |
| A2_npm_publish_protocol | [A0_bootstrap] | [WorkpackManager] |
| A3_ci_release_pipeline | [A1_vsix_packaging, A2_npm_publish_protocol] | [WorkpackManager] |
| A4_readme_marketplace | [A1_vsix_packaging] | [WorkpackManager] |
| V1_integration_meta | [A3_ci_release_pipeline, A4_readme_marketplace] | [WorkpackManager] |
| R1_retrospective | [V1_integration_meta] | [WorkpackManager] |

## Cross-Workpack References

requires_workpack:
  - 01_workpack-manager-v2_execution-wiring
  - 02_workpack-manager-v2_extension-consolidation
  - 02_workpack-manager-v2_test-coverage-hardening

All prior workpacks must be merged before publishing to ensure the extension is feature-complete, clean, and well-tested.

## Parallelization Map

```
Phase 0 (sequential):  A0_bootstrap
Phase 1 (parallel):    A1_vsix_packaging, A2_npm_publish_protocol
Phase 2 (parallel):    A3_ci_release_pipeline, A4_readme_marketplace
Phase 3 (sequential):  V1_integration_meta (V1 gate)
Phase 4 (conditional): B-series → V2 (V-loop)
Phase 5 (post-merge):  R1_retrospective
```

### B-series DAG (post-verification)

Populate this section only if V1 generates B-series bug-fix prompts.

## Branch Strategy

| Component | Branch Name | Base Branch | PR Target |
|-----------|-------------|-------------|-----------|
| Feature | feature/marketplace-publishing | master | master |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| vsce version incompatibility with current package.json | Low | Medium | Pin vsce version in devDependencies; test locally before CI |
| Publisher ID not configured | Medium | Low | Document publisher setup steps; CI can skip publish on missing token |
| npm scope @workpack not available | Low | High | Check npm registry early; have fallback unscoped name |
| Missing extension icon blocks VSIX | Low | Low | Create simple placeholder icon; replace with designed version later |

## Security and Tool Safety

- No secrets hardcoded in CI workflows — use GitHub Secrets for `VSCE_PAT` and `NPM_TOKEN`.
- `.vscodeignore` must exclude `workpacks/instances/` to prevent leaking workpack state.
- No telemetry or data collection added in this workpack.

## Handoff Outputs Plan

- Each completed prompt writes `outputs/<PROMPT>.json`.
- Schema: `workpacks/WORKPACK_OUTPUT_SCHEMA.json`.
- Output JSON MUST include `repos`, `execution`, and `change_details`.
- V1 validates all outputs before merge.
- `workpack.state.json` is updated after each prompt completion.
