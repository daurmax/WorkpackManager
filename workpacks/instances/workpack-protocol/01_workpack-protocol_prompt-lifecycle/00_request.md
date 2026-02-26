# Request

## Workpack Protocol Version

Workpack Protocol Version: 2.1.0

## Original Request

Request Type: `FEATURE`
Short Slug: `prompt-lifecycle`

Three protocol enhancements to the prompt execution lifecycle:

### 1. B-series Dependency DAG

Currently, when the integration gate (A5/V1) identifies bugs and generates B-series fix prompts, these prompts are treated as a flat, unordered list. In practice, some bugs may be parallelizable while others have dependencies (e.g., B2 depends on B1's fix before it can proceed). The protocol should support declaring a dependency DAG among B-series prompts, analogous to how A-series prompts already support `depends_on` in their YAML front-matter and in `workpack.meta.json`.

This means:

- The integration/verification prompt (A5) that generates B-series prompts must also produce a B-series DAG (dependencies + parallelization map).
- The plan (`01_plan.md`) should be extendable with B-series DAG information post-verification.
- The `workpack.meta.json` prompts array should accommodate dynamically-added B-series entries with `depends_on`.
- The linter should validate B-series DAG consistency (no cycles, no unknown deps).

### 2. Per-Prompt Commit Tracking

Currently, prompts apply file changes but there is no protocol requirement to commit those changes or to record the commit SHA. This makes it difficult for the integration prompt to verify what was actually applied vs. what was declared.

The protocol should require:

- Each prompt (A-series, B-series) MUST commit its changes on the work branch before writing its `output.json`.
- The `output.json` MUST include the commit SHA(s) produced by the prompt.
- The `output.json` already has a `branch` object and `artifacts.commit_shas` - these should become **required** (not optional).
- The integration prompt (A5 and V-series) MUST verify:
  - That each declared commit SHA exists on the work branch.
  - That the files modified in each commit match the `change_details` declared in the corresponding `output.json`.
  - That no undeclared file modifications exist in the commits.
- This creates a verifiable audit trail from prompt execution to actual repository changes.

### 3. Legacy-to-Modern Workpack Upgrade Path + Maintenance Prompts

Workpacks created against older protocol generations (for example 2.0.0 and 2.1.0) currently do not have a standardized modernization workflow. The protocol should define a repeatable method to upgrade legacy workpacks to the current standard (target: 2.2.0+), including required file updates and sequencing.

In addition, the template prompt set should include operational prompts for maintenance activities:

- A dedicated bug-report prompt to capture defects with enough structure for later B-series generation.
- A dedicated task-change prompt to safely add or modify a workpack task while preserving DAG consistency.

The upgrade path and maintenance prompts should be documented and integrated into the normal lifecycle so teams can evolve existing workpacks without ad-hoc edits.

## Acceptance Criteria

- [ ] AC1: `PROTOCOL_SPEC.md` documents B-series DAG support with examples.
- [ ] AC2: `PROTOCOL_SPEC.md` documents per-prompt commit tracking requirements.
- [ ] AC3: `WORKPACK_OUTPUT_SCHEMA.json` makes `artifacts` required, and within it `commit_shas` required with `minItems: 1`.
- [ ] AC4: `WORKPACK_OUTPUT_SCHEMA.json` adds `artifacts.branch_verified` boolean (set by integration prompt).
- [ ] AC5: `WORKPACK_META_SCHEMA.json` allows B-series prompts in the `prompts` array via relaxed `stem` pattern.
- [ ] AC6: B-series prompts can declare `depends_on` in YAML front-matter and in `workpack.meta.json`.
- [ ] AC7: Linter validates B-series DAG (no cycles, no unknown deps, severity present).
- [ ] AC8: Linter validates that completed prompts have non-empty `commit_shas` in their output.
- [ ] AC9: Integration prompt template (`A5` / `A*_integration_meta`) includes commit verification steps.
- [ ] AC10: Templates updated: `01_plan.md` extended with B-series DAG section; `PROMPT_STYLE_GUIDE.md` updated.
- [ ] AC11: `CHANGELOG.md` updated with version 2.2.0 documenting all core features.
- [ ] AC12: All existing linter tests still pass; new tests cover B-series DAG and commit tracking validation.
- [ ] AC13: `PROTOCOL_SPEC.md` documents a legacy-to-modern workpack migration method (2.0.0/2.1.0 -> 2.2.0+).
- [ ] AC14: New template prompt for structured bug reporting is added and documented.
- [ ] AC15: New template prompt for adding/modifying workpack tasks is added and documented.
- [ ] AC16: This workpack includes a dedicated A-series prompt for modernization + maintenance prompt rollout.

## Constraints

- Backward compatible: existing workpacks (2.0.0, 2.1.0) must still lint and parse.
- No breaking changes to `workpack.meta.json` or `workpack.state.json` required fields.
- `artifacts.commit_shas` becomes required only for protocol version >= 2.2.0.
- B-series DAG is optional (empty `depends_on` defaults to depends-on-nothing / free to run).
- Migration guidance must be procedural and backward compatible, not a destructive rewrite of existing workpacks.

## Acceptance Criteria -> Verification Mapping

| AC ID | Criterion | How to Verify |
|-------|-----------|---------------|
| AC1 | B-series DAG in spec | Manual review of `PROTOCOL_SPEC.md` |
| AC2 | Commit tracking in spec | Manual review of `PROTOCOL_SPEC.md` |
| AC3 | `artifacts` required | `python -c "import json; s=json.load(open('workpacks/WORKPACK_OUTPUT_SCHEMA.json')); assert 'artifacts' in s['required']"` |
| AC4 | `artifacts.branch_verified` field | Schema inspection |
| AC5 | B-series stems allowed | `python workpacks/tools/workpack_lint.py` (no false positive on B-stems) |
| AC6 | B-series `depends_on` works | Linter accepts B-series with depends_on |
| AC7 | B-series DAG validation | Linter test with cyclic B-series deps |
| AC8 | Commit SHA validation | Linter test with missing commit_shas |
| AC9 | Integration template updated | Manual review |
| AC10 | Templates updated | `python workpacks/tools/validate_templates.py` |
| AC11 | Changelog updated | Manual review |
| AC12 | Tests pass | `python -m pytest workpacks/tools/tests/ -v` |
| AC13 | Legacy upgrade method documented | Manual review of `PROTOCOL_SPEC.md` |
| AC14 | Bug-report prompt template added | `python workpacks/tools/validate_templates.py` + file existence check |
| AC15 | Task-change prompt template added | `python workpacks/tools/validate_templates.py` + file existence check |
| AC16 | Modernization A-series prompt added to this workpack | Manual review of workpack instance files |

## Delivery Mode

- [x] PR-based (default)
- [ ] Direct push

## Scope

### In Scope

- Protocol specification updates (`PROTOCOL_SPEC.md`)
- Schema changes (`WORKPACK_OUTPUT_SCHEMA.json`, `WORKPACK_META_SCHEMA.json`)
- Template updates (`01_plan.md`, `PROMPT_STYLE_GUIDE.md`, integration prompt template)
- Legacy modernization method documentation for existing workpacks
- New maintenance prompt templates (bug reporting, task add/modify)
- Linter updates (`workpack_lint.py`, new checks)
- Linter tests (`test_workpack_lint.py`, new test cases)
- Changelog entry (version 2.2.0)

### Out of Scope

- VS Code extension changes (the extension will consume these in a future workpack)
- Runtime enforcement (Git operations are the agent's responsibility; the protocol defines the contract)
- Remote/CI verification of commit SHAs (local verification only)
- Automatic full-rewrite migration tooling for arbitrary historical custom workpacks
