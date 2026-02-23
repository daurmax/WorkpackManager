# Request

## Workpack Protocol Version

Workpack Protocol Version: 2.0.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `extension-validation-quality`

Design and implement the validation, testing, and quality assurance infrastructure for the WorkpackManager VS Code extension and the reusable workpack protocol. This includes the test strategy and framework setup, protocol-level workpack validation (lint integration), drift detection between workpack state and actual artifacts, and migration/backward compatibility tooling for protocol version transitions.

This workpack integrates outputs from all prior workpacks and provides the quality backbone for the entire project.

Constraints and notes:

- Depends on WP01 (core data models, parser), WP02 (agent layer), WP03 (UX layer).
- Uses Vitest (or Mocha) for unit/integration testing.
- Linter validates structural correctness of workpack instances.
- Drift detector reconciles `workpack.state.json` against actual file system artifacts and `99_status.md`.
- Protocol migration tool upgrades v5 workpacks to v6 format (adds `workpack.meta.json`/`workpack.state.json`).
- Primary repo: `WorkpackManager`.

Preferred Delivery Mode: `PR`
Target Base Branch: `main`

## Acceptance Criteria

- [ ] AC1: Test framework (Vitest or Mocha) is configured with coverage reporting.
- [ ] AC2: Unit tests exist for all core modules (models, parser, state, agents, views, commands).
- [ ] AC3: Workpack linter validates: folder naming, required files, JSON schema compliance, DAG consistency.
- [ ] AC4: Lint results are surfaced as VS Code diagnostics (Problems panel).
- [ ] AC5: Drift detector identifies: orphaned outputs, missing outputs, state/status mismatch, prompt files without meta entry.
- [ ] AC6: Migration tool converts v5 workpacks to v6 (generates meta.json and state.json from markdown frontmatter).
- [ ] AC7: Migration is non-destructive (original files preserved, new files added).
- [ ] AC8: Integration tests verify end-to-end: parse → lint → detect drift → report.
- [ ] AC9: CI configuration (GitHub Actions) runs lint, type check, tests, and coverage on PR.

## Constraints

- Linter must not modify workpack files (read-only analysis).
- Migration tool must produce valid v6 JSON (validated against schemas).
- Drift detection must handle partial states gracefully (incomplete workpacks).

## Acceptance Criteria → Verification Mapping

| AC ID | Criterion | How to Verify |
|-------|-----------|---------------|
| AC1 | Test framework configured | `npm test` runs and produces coverage report |
| AC2 | Unit tests exist | `npm test` with >80% coverage on core modules |
| AC3 | Linter validates | Unit tests for each lint rule |
| AC4 | VS Code diagnostics | Integration test with mock workspace |
| AC5 | Drift detector works | Unit tests with synthetic workpack state |
| AC6 | Migration tool works | Integration test on a v5 workpack fixture |
| AC7 | Non-destructive migration | Verify original files untouched after migration |
| AC8 | End-to-end integration | Integration test pipeline |
| AC9 | CI configuration | GitHub Actions workflow file validates |

## Delivery Mode

- [x] PR-based (default)
- [ ] Direct push

## Scope

### In Scope

- Test framework configuration
- Unit and integration test suites
- Workpack linter (structural + schema + DAG validation)
- VS Code diagnostics integration for lint results
- Drift detection (state vs artifacts)
- Protocol v5 → v6 migration tool
- CI/CD configuration (GitHub Actions)

### Out of Scope

- End-to-end testing with real AI agents
- Performance benchmarking
- Publication/marketplace packaging
