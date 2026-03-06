---
depends_on: [A1_vsix_packaging, A2_npm_publish_protocol]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A3_ci_release_pipeline

> Implement GitHub Actions CI/release automation for PR validation and tag-based delivery of VSIX artifacts and `@workpack/protocol` publish steps.

---

## READ FIRST

1. `workpacks/instances/workpack-manager-v2/03_workpack-manager-v2_marketplace-publishing/00_request.md`
2. `workpacks/instances/workpack-manager-v2/03_workpack-manager-v2_marketplace-publishing/01_plan.md`
3. `workpacks/instances/workpack-manager-v2/03_workpack-manager-v2_marketplace-publishing/workpack.meta.json`
4. `workpacks/instances/workpack-manager-v2/03_workpack-manager-v2_marketplace-publishing/workpack.state.json`

## Context

Workpack: `workpack-manager-v2/03_workpack-manager-v2_marketplace-publishing`

## Delivery Mode

- PR-based

## Objective

Create or update GitHub Actions workflows so the repository has a reliable CI gate for pull requests and a release pipeline triggered by version tags. The release path must package the extension VSIX, validate protocol package contents, and support publish steps using repository secrets while keeping first-release behavior manually controlled.

## Reference Points

- `workpacks/instances/workpack-manager-v2/03_workpack-manager-v2_marketplace-publishing/00_request.md` (AC5, constraints, verification mapping)
- `workpacks/instances/workpack-manager-v2/03_workpack-manager-v2_marketplace-publishing/01_plan.md` (A3 scope and dependencies)
- `.github/workflows/ci.yml` (existing baseline CI workflow)
- `.github/workflows/publish-protocol.yml` (existing protocol publish flow to consolidate or align)
- `package.json` scripts (`build`, `lint`, `test`, `package:vsix`)
- `packages/protocol/package.json` publish readiness (`private: false`, `files`, `publishConfig`)

## Implementation Requirements

1. Ensure a PR validation workflow exists at `.github/workflows/ci.yml` and is wired for this workpack branch strategy:
   - Trigger on `pull_request` to `master`.
   - Trigger on push to `master`.
2. CI validation job must run the core quality gates in clean environment:
   - `npm ci`
   - `npm run build`
   - `npm run lint`
   - `npm run test`
3. CI must include packaging readiness checks required by marketplace/npm publishing:
   - `npm run package:vsix` (or equivalent `vsce package`) to verify extension packaging.
   - `npm --prefix packages/protocol pack --dry-run` to verify protocol package contents.
4. Add a dedicated release workflow at `.github/workflows/release.yml`:
   - Trigger on tag push (semver pattern such as `v*`).
   - Also expose `workflow_dispatch` for controlled/manual release runs.
5. Release workflow must build and publish artifacts in ordered jobs:
   - Build/test gate before any publish step.
   - Package VSIX and upload it as workflow artifact.
   - Validate protocol tarball before publish.
6. Release publish steps must be secret-gated and safe:
   - Use `NPM_TOKEN` for npm publish.
   - Use `VSCE_PAT` for Marketplace publish.
   - Never hardcode credentials.
   - Keep first release manual: publish jobs must require explicit opt-in (for example, `workflow_dispatch` input flag or guarded condition) instead of unconditional publish on every tag.
7. If existing workflow files become redundant (for example `publish-protocol.yml`), either:
   - Refactor them to avoid duplicate publish paths, or
   - Remove/replace them within the same PR while preserving clear single-source release flow.
8. Keep workflow permissions minimal (`contents: read` by default; elevate only where required, e.g. release artifact/publication steps).
9. Do not modify application/runtime feature code in this prompt; scope is CI/CD pipeline and related release automation only.

## Scope

### In Scope
- GitHub Actions CI workflow updates (`.github/workflows/ci.yml`)
- GitHub Actions release workflow creation (`.github/workflows/release.yml`)
- VSIX build artifact steps and protocol `npm pack --dry-run`/publish path
- Secret wiring and publish gating logic for first manual release safety

### Out of Scope
- Marketplace listing content updates (README/CHANGELOG handled by `A4_readme_marketplace`)
- Protocol package metadata/schema changes (handled by `A2_npm_publish_protocol`)
- Actual credential provisioning in GitHub settings (document expectations only)
- Manual first publish execution outside CI workflow definitions

## Acceptance Criteria

- [ ] AC1: `.github/workflows/ci.yml` validates PRs with build, lint, test, VSIX packaging check, and protocol `npm pack --dry-run`.
- [ ] AC2: `.github/workflows/release.yml` exists and triggers on version tags (`v*`) plus `workflow_dispatch`.
- [ ] AC3: Release workflow produces a VSIX artifact and runs protocol packaging verification before publish steps.
- [ ] AC4: npm and Marketplace publish steps are gated by secrets (`NPM_TOKEN`, `VSCE_PAT`) and explicit manual-control condition for first release safety.
- [ ] AC5: No secrets are hardcoded and workflow permissions remain least-privilege.

## Verification

```bash
npm ci
npm run build
npm run lint
npm run test
npm run package:vsix
npm --prefix packages/protocol pack --dry-run
npx --yes actionlint .github/workflows/ci.yml .github/workflows/release.yml
rg -n "NPM_TOKEN|VSCE_PAT|workflow_dispatch|tags" .github/workflows/ci.yml .github/workflows/release.yml
```

## Handoff Output (JSON)

Write `outputs/A3_ci_release_pipeline.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "03_workpack-manager-v2_marketplace-publishing",
  "prompt": "A3_ci_release_pipeline",
  "component": "ci-release-pipeline",
  "delivery_mode": "pr",
  "branch": {
    "base": "master",
    "work": "feature/marketplace-publishing",
    "merge_target": "master"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": [
      "<COMMIT_SHA>"
    ],
    "branch_verified": false
  },
  "changes": {
    "files_modified": [
      ".github/workflows/ci.yml"
    ],
    "files_created": [
      ".github/workflows/release.yml"
    ],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      {
        "cmd": "npm run build",
        "result": "pass",
        "notes": ""
      },
      {
        "cmd": "npm run test",
        "result": "pass",
        "notes": ""
      },
      {
        "cmd": "npm run package:vsix",
        "result": "pass",
        "notes": ""
      },
      {
        "cmd": "npm --prefix packages/protocol pack --dry-run",
        "result": "pass",
        "notes": ""
      }
    ],
    "regression_added": false,
    "regression_notes": ""
  },
  "handoff": {
    "summary": "CI and release workflows implemented with secret-gated publish paths for VSIX and protocol release.",
    "next_steps": [
      "Run A4_readme_marketplace",
      "Run V1_integration_meta"
    ],
    "known_issues": []
  },
  "repos": [
    "WorkpackManager"
  ],
  "execution": {
    "model": "<MODEL_ID>",
    "tokens_in": 0,
    "tokens_out": 0,
    "duration_ms": 0
  },
  "change_details": [],
  "notes": ""
}
```

## Deliverables

- [ ] `.github/workflows/ci.yml` updated for PR validation and packaging checks
- [ ] `.github/workflows/release.yml` created for tag-based release flow
- [ ] Existing publish workflow(s) reconciled to avoid duplicate/conflicting release paths
- [ ] Publish steps require `NPM_TOKEN` / `VSCE_PAT` and explicit first-release manual control
- [ ] `outputs/A3_ci_release_pipeline.json` written
