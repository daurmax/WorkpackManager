# Request

## Workpack Protocol Version

Workpack Protocol Version: 3.0.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `marketplace-publishing`

Prepare the WorkpackManager extension for VS Code Marketplace publication and the @workpack/protocol package for npm registry publication. Set up CI/CD pipelines for automated release builds, VSIX packaging, and npm publish workflows.

Currently:
- The extension has no `.vscodeignore`, no VSIX build script, no marketplace metadata (icon, categories, gallery banner).
- `@workpack/protocol` (packages/protocol) is at v0.1.0 with `private: true` — not published to npm.
- No CI/CD pipeline exists for automated releases.
- README is developer-oriented, not marketplace-optimized.

Preferred Delivery Mode: `PR`
Target Base Branch: `master`

## Acceptance Criteria

- [ ] AC1: `vsce package` produces a valid `.vsix` file that installs cleanly in VS Code.
- [ ] AC2: `.vscodeignore` excludes source, tests, coverage, workpack instances, and dev files.
- [ ] AC3: `package.json` contains marketplace metadata: publisher, icon, categories, galleryBanner, repository, bugs.
- [ ] AC4: `@workpack/protocol` is publishable to npm (`npm pack` produces correct tarball with schemas + bin + templates).
- [ ] AC5: GitHub Actions workflow exists for: (a) PR validation (build+test), (b) release on tag push (VSIX + npm).
- [ ] AC6: README.md includes marketplace-friendly sections: Features, Quick Start, Commands, Settings, Contributing.
- [ ] AC7: CHANGELOG.md follows Keep a Changelog format and is up to date.
- [ ] AC8: Extension icon (128x128 PNG) exists in `resources/`.

## Constraints

- Publisher ID must be configured but actual marketplace/npm publish is manual for first release.
- CI pipelines target GitHub Actions (`.github/workflows/`).
- No paid services or external CI providers.
- `packages/protocol` must have `private: false` and correct `files` field before publish.

## Acceptance Criteria → Verification Mapping

| AC ID | Acceptance Criterion | How to Verify |
|-------|----------------------|---------------|
| AC1 | Valid VSIX | `vsce package` exits 0, VSIX installs in VS Code |
| AC2 | .vscodeignore correct | Inspect VSIX contents (`vsce ls`) — no src/, tests/, workpacks/instances/ |
| AC3 | Marketplace metadata | JSON schema check on package.json required fields |
| AC4 | Protocol npm-ready | `npm pack --dry-run` in packages/protocol — correct file list |
| AC5 | CI workflows exist | `.github/workflows/ci.yml` + `release.yml` present, YAML valid |
| AC6 | README marketplace-ready | Section headers present: Features, Quick Start, Commands, Settings |
| AC7 | CHANGELOG up to date | Contains Unreleased section or latest version entry |
| AC8 | Extension icon exists | `resources/icon.png` exists, dimensions 128x128 |

## Delivery Mode

- [x] **PR-based** (default)
- [ ] **Direct push**

## Scope

### In Scope

- VSIX packaging configuration (`.vscodeignore`, build scripts)
- Marketplace metadata in root `package.json`
- Extension icon creation/placeholder
- `@workpack/protocol` npm publish preparation (`files` field, `private: false`, README)
- GitHub Actions CI/CD workflows (build, test, release)
- README restructuring for marketplace listing
- CHANGELOG consolidation

### Out of Scope

- Actual marketplace/npm publication (first release is manual)
- Signing or attestation of packages
- Auto-update mechanisms
- Telemetry integration
- Web extension support (`vscode.dev`)
- MCP server (Python) packaging/distribution (separate pyproject.toml workflow)
