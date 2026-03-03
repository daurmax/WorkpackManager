# Request

## Workpack Protocol Version

Workpack Protocol Version: 3.0.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `test-coverage-hardening`

Increase test coverage for under-tested modules to reach 85%+ across all measured source files, and add integration tests for the extension lifecycle (command registration, tree provider startup, diagnostic publication).

Current coverage gaps from analysis:
- `src/state/reconciliation-engine.ts` — **58.5%** statements (target: 85%+)
- `src/state/output-scanner.ts` — **68%** statements (target: 85%+)
- `src/parser/workpack-parser.ts` — **75.66%** statements, **59%** branches (target: 85%+ statements, 75%+ branches)
- `src/views/status-icons.ts` — **94%** stmts but **57%** branches (target: 75%+ branches)
- `src/views/workpack-tree-item.ts` — **73%** statements (target: 85%+)

Overall project coverage is 75.6%, above the 60% threshold but well below production-quality targets.

Preferred Delivery Mode: `PR`
Target Base Branch: `master`

## Acceptance Criteria

- [ ] AC1: `reconciliation-engine.ts` achieves ≥85% statement coverage and ≥75% branch coverage.
- [ ] AC2: `output-scanner.ts` achieves ≥85% statement coverage and ≥75% branch coverage.
- [ ] AC3: `workpack-parser.ts` achieves ≥85% statement coverage and ≥75% branch coverage.
- [ ] AC4: `status-icons.ts` achieves ≥75% branch coverage.
- [ ] AC5: `workpack-tree-item.ts` achieves ≥85% statement coverage.
- [ ] AC6: Integration test suite exists covering command registration and tree provider lifecycle.
- [ ] AC7: Overall project coverage reaches ≥80% statements.
- [ ] AC8: vitest coverage thresholds updated to reflect new minimums.
- [ ] AC9: No existing tests are broken or removed.

## Constraints

- Tests must use the existing vitest + `src/__mocks__/vscode.ts` mock infrastructure.
- No changes to production code logic unless fixing actual bugs uncovered during testing.
- Integration tests should use the VS Code test runner (`@vscode/test-electron`) where VS Code API is needed.

## Acceptance Criteria → Verification Mapping

| AC ID | Acceptance Criterion | How to Verify |
|-------|----------------------|---------------|
| AC1 | reconciliation-engine ≥85% stmts | `pnpm test:coverage` — check report |
| AC2 | output-scanner ≥85% stmts | `pnpm test:coverage` — check report |
| AC3 | workpack-parser ≥85% stmts, ≥75% branches | `pnpm test:coverage` — check report |
| AC4 | status-icons ≥75% branches | `pnpm test:coverage` — check report |
| AC5 | workpack-tree-item ≥85% stmts | `pnpm test:coverage` — check report |
| AC6 | Integration tests exist | `pnpm test:extension` passes |
| AC7 | Overall ≥80% stmts | `pnpm test:coverage` — "All files" row |
| AC8 | Thresholds updated | Check `vitest.config.ts` thresholds |
| AC9 | No tests broken | `pnpm test` — 0 failures |

## Delivery Mode

- [x] **PR-based** (default)
- [ ] **Direct push**

## Scope

### In Scope

- Unit tests for `reconciliation-engine.ts` edge cases (drift types, overall status aggregation)
- Unit tests for `output-scanner.ts` (error paths, missing fields, empty directories)
- Unit tests for `workpack-parser.ts` (schema validation branches, legacy fallback, grouped discovery)
- Unit tests for `status-icons.ts` (all branch paths for icon/theme resolution)
- Unit tests for `workpack-tree-item.ts` (all TreeItemKind variants)
- Integration test for extension activation and command registration
- Update vitest coverage thresholds

### Out of Scope

- Tests for Python tooling (separate test infrastructure)
- E2E tests requiring a running VS Code window
- Performance/load testing
- Coverage for agent provider implementations (CodexProvider, CopilotProvider)
