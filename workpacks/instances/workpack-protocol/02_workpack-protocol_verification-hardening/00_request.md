# Request

## Workpack Protocol Version

Workpack Protocol Version: 2.2.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `verification-hardening`

Build a unified verification system that programmatically enforces ALL protocol invariants declared in PROTOCOL_SPEC.md. Currently, only approximately half of the formal invariants are checked by tooling (identity checks, schema validation, prompt drift, basic state drift). This workpack closes every gap by adding checks for: legal state transitions, markdown-JSON synchronization, output artifact validation, commit SHA verification, prompt style conformance, and pre-commit/CI integration. All checks are consolidated into a single `workpack verify` command with category-based filtering and structured reporting.

The Python tooling in `workpacks/tools/` is extended (not replaced) to cover the full invariant surface.

Constraints and notes:

- Depends on completed protocol 2.2.0 (prompt-lifecycle workpack).
- All checks are implemented in Python (tools stay Python).
- No modification of existing invariants — only enforcement of what PROTOCOL_SPEC already declares.
- Must not break backward compatibility with pre-2.2.0 workpacks.
- `workpack verify` must be usable from CLI and CI without VS Code.
- Primary repo: `WorkpackManager`.

Preferred Delivery Mode: `PR`
Target Base Branch: `main`

## Acceptance Criteria

- [ ] AC1: State transition validator detects illegal workpack-level transitions (e.g., `not_started` → `complete` without `in_progress`).
- [ ] AC2: State transition validator detects illegal prompt-level transitions (e.g., `pending` → `complete` without `in_progress`).
- [ ] AC3: Execution log validator detects non-monotonic timestamps and missing required events.
- [ ] AC4: Markdown-JSON sync checker detects drift between `01_plan.md` WBS and `meta.prompts[]`.
- [ ] AC5: Markdown-JSON sync checker detects drift between `99_status.md` completion markers and `state.prompt_status`.
- [ ] AC6: Output artifact checker validates that `outputs/<stem>.json` exists for every `complete` prompt.
- [ ] AC7: Output artifact checker validates that files declared in `changes.files_created` and `changes.files_modified` exist on disk.
- [ ] AC8: Commit verification tool checks that `artifacts.commit_shas` SHAs exist on the work branch (2.2.0+ workpacks only).
- [ ] AC9: Commit verification tool cross-references `change_details[].file` against `git show --stat`.
- [ ] AC10: Prompt style linter validates required sections per PROMPT_STYLE_GUIDE.md.
- [ ] AC11: Prompt style linter validates YAML front-matter structure (`depends_on`, `repos`).
- [ ] AC12: Pre-commit hook template exists and runs quick verification.
- [ ] AC13: CI workflow template (GitHub Actions) exists and runs full verification.
- [ ] AC14: Unified `workpack verify` command with `--category` filter, `--strict`, `--json` output modes.
- [ ] AC15: All new checks have unit tests with >90% branch coverage.
- [ ] AC16: Existing tests remain passing.

## Constraints

- Read-only analysis: verification tools must never modify workpack files.
- Backward compatible: pre-2.2.0 workpacks must not fail on checks they can't satisfy.
- Git operations are optional: commit verification gracefully degrades when `.git` is absent.
- No new Python dependencies beyond `jsonschema` (already used).

## Acceptance Criteria → Verification Mapping

| AC ID | Criterion | How to Verify |
|-------|-----------|---------------|
| AC1 | Workpack state transitions | Unit test with illegal transition fixtures |
| AC2 | Prompt state transitions | Unit test with illegal transition fixtures |
| AC3 | Execution log validation | Unit test with non-monotonic timestamps |
| AC4 | Plan ↔ meta sync | Unit test with deliberate drift |
| AC5 | Status ↔ state sync | Unit test with deliberate drift |
| AC6 | Output existence | Unit test with missing outputs |
| AC7 | Change file existence | Unit test with declared but missing files |
| AC8 | Commit SHA existence | Unit test with mock git log |
| AC9 | Change details vs git | Unit test with mock git show |
| AC10 | Prompt sections | Unit test with non-conforming prompts |
| AC11 | YAML front-matter | Unit test with invalid front-matter |
| AC12 | Pre-commit hook | Hook file exists and is executable |
| AC13 | CI workflow | YAML validates as GitHub Actions syntax |
| AC14 | Unified command | Integration test with category filter |
| AC15 | Test coverage | `python -m pytest --cov` |
| AC16 | Existing tests | `python -m pytest workpacks/tools/tests/ -v` |

## Delivery Mode

- [x] PR-based (default)
- [ ] Direct push

## Scope

### In Scope

- State transition validation (workpack and prompt level)
- Execution log integrity checks (monotonicity, append-only detection, required events)
- Markdown ↔ JSON synchronization checks (plan↔meta, status↔state)
- Output artifact validation (existence, schema, referenced files on disk)
- Commit SHA verification tool (git log check, change_details cross-reference)
- Prompt style linting (required sections, YAML front-matter)
- Pre-commit hook and CI workflow templates
- Unified `workpack verify` command with category filtering and JSON output
- Unit tests for all new checks

### Out of Scope

- Automatic fix/repair of detected issues (future work)
- VS Code integration of verification results (extension workpack scope)
- Changes to the protocol specification itself
- Performance optimization of large-scale verification
