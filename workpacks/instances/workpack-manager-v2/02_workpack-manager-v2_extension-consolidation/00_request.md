# Request

## Workpack Protocol Version

Workpack Protocol Version: 3.0.0

## Original Request

Request Type: `REFACTOR`
Short Slug: `extension-consolidation`

Consolidate the monorepo structure by resolving the `packages/extension/` scaffold ambiguity, extracting shared utilities duplicated across modules, and cleaning up stale Git branches from completed feature work.

Context from analysis:
- `packages/extension/` contains a 16-line stub (`activate()` no-op + `executePythonTool()` fire-and-forget) while all actual extension code lives in `src/` at the repository root. This creates confusion about the canonical source location.
- AJV schema validator caching is reimplemented in 3 places: `src/parser/workpack-parser.ts`, `src/validation/lint-rules.ts`, and `src/validation/migration.ts`. Each uses the same walk-parent-dirs + `Map<string, Promise<ValidateFunction>>` pattern.
- 17 local branches exist, many already merged to master (e.g., `feature/workpack-protocol-v6`, `feature/extension-agent-integration`, etc.).

Preferred Delivery Mode: `PR`
Target Base Branch: `master`

## Acceptance Criteria

- [ ] AC1: `packages/extension/` scaffold is either populated with real code (migrated from `src/`) OR removed with a clear rationale documented.
- [ ] AC2: A shared `SchemaValidatorCache` utility exists in a common location and is used by parser, lint-rules, and migration modules.
- [ ] AC3: All merged feature branches are deleted (local and remote) with a log of what was cleaned.
- [ ] AC4: No import path regressions — `tsc --noEmit` passes.
- [ ] AC5: All existing tests pass after refactoring.
- [ ] AC6: ESLint warnings do not increase.

## Constraints

- Do not break the existing `package.json` extension manifest (contributes, activationEvents, main entry point).
- Branch cleanup must not delete `master` or any unmerged branches.
- AJV cache extraction must maintain the same validation behavior (2020-12 draft, ajv-formats).

## Acceptance Criteria → Verification Mapping

| AC ID | Acceptance Criterion | How to Verify |
|-------|----------------------|---------------|
| AC1 | Extension scaffold resolved | Inspect `packages/extension/` — either has real code or is removed |
| AC2 | Shared SchemaValidatorCache | `grep -r "SchemaValidatorCache" src/` shows usage in 3+ modules |
| AC3 | Merged branches cleaned | `git branch -a` shows only active branches |
| AC4 | No import regressions | `npx tsc --noEmit` exits 0 |
| AC5 | Tests pass | `pnpm test` passes |
| AC6 | Lint stable | `npx eslint src/` warning count ≤ 33 |

## Delivery Mode

- [x] **PR-based** (default)
- [ ] **Direct push**

## Scope

### In Scope

- Resolve `packages/extension/` scaffold (remove or populate)
- Extract shared AJV validator cache utility
- Delete merged Git branches (local + remote)
- Update import paths as needed
- Verify build, lint, and tests

### Out of Scope

- Functional changes to extension behavior
- New features or commands
- Changes to the workpack protocol or schemas
- MCP server changes
