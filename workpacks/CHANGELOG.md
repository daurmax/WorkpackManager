# Workpack Protocol Changelog

All notable changes to the Workpack Protocol are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] - 2026-02-26

### ⚠️ Major Version

This is a **major** release introducing agent interoperability, coordination infrastructure, execution sandboxing, and persistent knowledge management. All additions are backward-compatible with 2.x workpacks — no existing required fields are removed or renamed.

### Added

- **MCP Server Integration** (`packages/mcp-server/`): Read-only Model Context Protocol server exposing workpack data through standardized resources (`workpack://list`, `workpack://{id}/meta`, `workpack://{id}/state`, `workpack://{id}/next-prompts`) and tools (`list_workpacks`, `get_workpack_detail`, `get_next_prompts`). Enables AI agents and editor extensions to discover and inspect workpacks without direct file parsing. Uses stdio transport.
- **Event Stream** (`WORKPACK_EVENT_SCHEMA.json`): Append-only JSONL event log for cross-workpack coordination. 18 event types covering workpack lifecycle (`workpack.*`), prompt transitions (`prompt.*`), agent assignment (`agent.*`), output tracking (`output.*`), and dependency resolution (`dependency.*`).
- **Execution Environment** (`executionEnvironment` in `workpack.config.json`): Declarative sandboxing and resource constraint hints including `sandbox` mode (none/container/vm/nsjail), `networkAccess`, `maxConcurrentAgents`, `timeoutSeconds`, `allowedCommands`, and `deniedPaths`.
- **Model Preference** (`model_preference` in `prompts[]` items in `workpack.meta.json`): Optional string field for routing prompts to preferred LLM models. Informational for orchestrators.
- **Cross-Workpack Knowledge References** (`lessons_from` in `workpack.meta.json`): Optional string array referencing workpack IDs with relevant retrospective learnings. Informational only — creates no execution dependencies.
- **Knowledge Base / Memory** (`workpacks/memory/`, `WORKPACK_MEMORY_SCHEMA.json`): Persistent, searchable knowledge base for lessons extracted from completed workpack retrospectives. Append-only JSONL format with 8 categories (pattern, anti-pattern, tooling, estimation, dependency, process, architecture, testing). Includes `workpack_memory.py` CLI tool for extraction, reporting, validation, and search.
- **`WORKPACK_EVENT_SCHEMA.json`**: New JSON Schema for event stream entries.
- **`WORKPACK_MEMORY_SCHEMA.json`**: New JSON Schema for knowledge base entries.

### Fixed

- **State machine consistency**: `AGENT_STATE_MACHINE.md` workpack-level diagram now includes the `review` state; prompt-level diagram uses `blocked` (matching the schema) instead of the previously undefined `failed`.

### Changed

- **`PROTOCOL_SPEC.md`**: Major restructuring with new sections for Event Stream (§6), Execution Environment (§9.4), MCP Server Integration (§12), Knowledge Base (§13), and Migration 2.x → 3.0.0 (§8.6). Version history updated. Section numbering revised (14 top-level sections).
- **`WORKPACK_META_SCHEMA.json`**: Added `model_preference` to `prompts[]` items and `lessons_from` at top level.
- **`WORKPACK_CONFIG_SCHEMA.json`**: Added `executionEnvironment` object with sandboxing and constraint fields.
- **`WORKPACK_GROUP_SCHEMA.json`**: `protocol_version` enum extended with `"3.0.0"`.
- **`docs/INTEGRATION.md`**: Configuration reference updated with `executionEnvironment` fields and example.

### Backward Compatibility

- All 2.x workpacks remain valid without modification.
- New fields (`model_preference`, `lessons_from`, `executionEnvironment`) are optional.
- New schemas (`WORKPACK_EVENT_SCHEMA`, `WORKPACK_MEMORY_SCHEMA`) are additive.
- Tooling detects protocol version per workpack and applies the matching rule set.
- The `memory/` directory and MCP server are opt-in infrastructure.

### Migration

See `PROTOCOL_SPEC.md` §8.6 for the 2.x → 3.0.0 migration checklist. Key steps: update `protocol_version` to `"3.0.0"`, update `00_request.md` version header. All new features are opt-in.

---

## [2.2.1] - 2026-02-23

### ⚠️ Breaking Changes

- **`A5_*` verification gate removed**: The `A5_integration_meta` prompt pattern is no longer accepted as a verification gate. All workpacks MUST use `V#_*` prompts (e.g. `V1_integration_meta`) for verification gates. The linter now emits `ERR_NO_VERIFICATION` if no `V#_*` prompt is found, regardless of `A5_*` presence.

### Changed

- **`PROTOCOL_SPEC.md`**: Removed all `A5_*` references from verification gate documentation. Section 10.5 and 10.7 now reference only V-series prompts.
- **`workpack_lint.py`**: `ERR_NO_VERIFICATION` now requires `V#_*` prompt exclusively; `A5_*` no longer satisfies the verification gate check.
- **`workpack_scaffold.py`**: Removed `A5` from `TEMPLATE_MAP`; integration meta fallback now resolves to `V1_integration_meta.md`.
- **`validate_templates.py`**: Template file list updated from `A5_integration_meta.md` to `V1_integration_meta.md`.
- **`V1_integration_meta.md` template**: All internal references updated to use `V1_integration_meta` stem.
- **`ADOPTION_GUIDE.md`**: Updated prompt listing and merge gate reference to `V1_integration_meta`.
- **Template files**: `01_plan.md`, `PROMPT_STYLE_GUIDE.md`, `R_retrospective.md` updated to reference `V1_integration_meta`.

### Migration

Workpacks using `A5_integration_meta` must rename the prompt file to `V1_integration_meta` and update all references in `workpack.meta.json`, `workpack.state.json`, `01_plan.md`, `99_status.md`, and prompt front-matter `depends_on` arrays.

---

## [2.2.0] - 2026-02-23

### Added

- **B-series Dependency DAG**: B-series fix prompts can now declare `depends_on` in YAML front-matter and in the `workpack.meta.json` `prompts` array, enabling partial ordering and parallelization of bug fixes. The integration/verification prompt (V1) is expected to produce a B-series DAG (parallel/serial phase map plus directed edges) alongside the B-series prompt list.
- **Per-Prompt Commit Tracking**: Each A-series and B-series prompt must commit its file changes on the work branch before writing its `output.json`. Commit SHA(s) produced are recorded in `artifacts.commit_shas` in the output JSON.
- **`artifacts.branch_verified` field in `WORKPACK_OUTPUT_SCHEMA.json`**: Boolean field set by the integration prompt to record the result of commit verification (SHA existence, file match against `change_details`, absence of undeclared changes).
- **Integration Commit Verification**: V-series integration prompts must verify that each declared commit SHA exists on the work branch, that files modified in each commit match those declared in `change_details`, and that no undeclared file modifications are present.
- **Legacy-to-Modern Workpack Migration**: `PROTOCOL_SPEC.md` now documents a repeatable, backward-compatible upgrade method for workpacks created against protocol 2.0.0 or 2.1.0 to migrate to 2.2.0+. Migration is procedural and non-destructive.
- **`M_bug_report.md`**: New maintenance template prompt for capturing defects with structured context sufficient for downstream B-series generation.
- **`M_task_change.md`**: New maintenance template prompt for safely adding or modifying a workpack task while preserving DAG consistency.
- **New Linter Checks**:
  - B-series DAG: validates no cycles and no unknown `depends_on` references among B-series prompts within `workpack.meta.json`.
  - Commit tracking: warns when a completed output JSON for a 2.2.0+ workpack has an empty `artifacts.commit_shas` array.

### Changed

- **`WORKPACK_OUTPUT_SCHEMA.json`**: `artifacts` object is now **required** for protocol >= 2.2.0; `artifacts.commit_shas` array has `minItems: 1` constraint. Added `artifacts.branch_verified` boolean.
- **`WORKPACK_META_SCHEMA.json`**: Relaxed `stem` pattern in the `prompts` array to allow dynamically-added B-series entries (e.g. `B1_*`, `B2_*`).
- **`01_plan.md` template**: Extended with a B-series DAG section to record the dependency graph and parallelization map for bug-fix prompts discovered at the V1 gate.
- **`PROMPT_STYLE_GUIDE.md`**: Updated with commit tracking conventions (when and how to commit, what to record in `artifacts.commit_shas`) and B-series DAG authoring guidance.
- **`V1_integration_meta.md` template** (renamed from `A5_integration_meta.md`): Updated with commit verification steps (SHA existence check, file-match audit against `change_details`, undeclared-change detection). The integration gate prompt is now a V-series prompt (`V1_integration_meta`) instead of an A-series prompt, reflecting its verification role.
- **`PROTOCOL_SPEC.md`**: Updated to document B-series DAG semantics, per-prompt commit tracking requirements, and the legacy workpack migration method.

### Backward Compatibility

- `artifacts.commit_shas` is required only for workpacks declaring `protocol_version >= 2.2.0`; existing 2.0.0 and 2.1.0 workpacks remain valid without this field.
- B-series `depends_on` is optional; an empty or absent array defaults to no dependencies (prompt is free to run in any order or in parallel).
- Legacy migration is procedural and non-destructive; no automated rewriting of existing workpacks is performed.

---

## [2.1.0] - 2026-02-23

### Added

- **Workpack Groups**: `instances/` can now contain group directories alongside standalone workpacks. A group is a directory containing multiple related workpacks plus `group.meta.json` and `GROUP.md`. Validated against `WORKPACK_GROUP_SCHEMA.json`.
- **`group.meta.json`**: Machine-readable group metadata with formal execution DAG — phases (parallel/serial), directed edges, and workpack inventory. Enables tooling to understand execution order across workpacks.
- **`GROUP.md`**: Human-readable companion with dependency graph visualization, phase execution plan, edge rationale, and naming convention.
- **`WORKPACK_GROUP_SCHEMA.json`**: JSON Schema for group metadata.
- **`group` field in `workpack.meta.json`**: Optional field linking a workpack to its parent group.

### Changed

- **Workpack Naming Convention**: Date prefix removed from workpack folder names.
  - **Standalone workpacks**: `<slug>` (kebab-case slug only).
  - **Grouped workpacks**: `<NN>_<group-id>_<slug>` where `NN` is the two-digit execution phase number. Workpacks with the same `NN` may run in parallel.
- **`id` pattern in WORKPACK_META_SCHEMA.json**: Updated from `YYYY-MM-DD_category_slug` to `^[a-z0-9][a-z0-9_-]+$`.
- **`created_at` field**: Remains in `workpack.meta.json` as metadata but is no longer encoded in the folder name.
- **Linter rule WP001**: Updated to validate new naming convention.

### Backward Compatibility

- Workpacks using the old `YYYY-MM-DD_category_slug` naming are still supported by the linter (legacy pattern detected and warned).
- The `created_at` field is still required in `workpack.meta.json`.
- Standalone workpacks (not in a group) continue to work as before, just without the date prefix.

---

## [2.0.0] - 2026-02-23

### ⚠️ Breaking Changes

This is a **major** release. Workpacks without `workpack.meta.json` are treated as 1.x legacy and linted with a reduced check set.

### Added

- **`workpack.meta.json`**: Machine-readable static metadata file for each workpack instance. Contains identity, dependencies, tags, owners, prompt index, and delivery configuration. Validated against `WORKPACK_META_SCHEMA.json`.
- **`workpack.state.json`**: Machine-readable runtime state file, separated from static metadata. Contains overall status, per-prompt status, agent assignments, blocked-by references, and an append-only execution log. Validated against `WORKPACK_STATE_SCHEMA.json`.
- **Metadata/State Split**: Static metadata (`workpack.meta.json`) is version-controlled and stable. Mutable runtime state (`workpack.state.json`) is updated by agents and tooling during execution. This separation enables tooling (VS Code extensions, CI) to index workpacks without parsing markdown.
- **Prompt Index in Metadata**: `workpack.meta.json` includes a `prompts` array with machine-readable DAG (stem, depends_on, repos, estimated_effort), duplicating the human-readable DAG in `01_plan.md` for programmatic access.
- **Agent Assignment Tracking**: `workpack.state.json` includes `agent_assignments` and per-prompt `assigned_agent` fields, enabling tooling to track which agent (copilot, codex, human) is responsible for each prompt.
- **Execution Log**: `workpack.state.json` includes an append-only `execution_log` array for audit trail of state transitions.
- **New Linter Checks**:
  - `ERR_MISSING_META`: Workpack missing `workpack.meta.json` → ERROR
  - `WARN_META_ID_MISMATCH`: `workpack.meta.json` id does not match folder name → WARNING
  - `WARN_META_PROMPTS_DRIFT`: Prompt index in meta.json does not match actual prompt files → WARNING
  - `WARN_STATE_DRIFT`: `workpack.state.json` overall_status inconsistent with prompt_status → WARNING

### Changed

- **Template**: `_template/` now includes `workpack.meta.json` and `workpack.state.json` skeleton files.
- **Linter**: Extended to validate meta.json and state.json against their schemas and cross-check consistency.
- **Scaffold Tool**: Now generates `workpack.meta.json` alongside prompt files when scaffolding a new workpack.

### Backward Compatibility

- Protocol 2.0.0 is **backward-compatible** with 1.x. Workpacks without `workpack.meta.json` / `workpack.state.json` are treated as 1.x and linted accordingly. The new files are additive.
- All 1.4.0 conventions (YAML front-matter, DAG dependencies, execution cost, R-series, etc.) remain in effect.
- `99_status.md` remains the human-readable status file. `workpack.state.json` is the machine-readable complement, not a replacement.

### Lifecycle

```
A0 → A1–A4 (parallel, DAG-ordered) → A5/V1 (verify) → [B-series] → V2 (V-loop) → MERGE → R1 (retrospective)
```

State transitions tracked in `workpack.state.json` execution_log.

---

## [1.4.0] - 2026-02-11

### ⚠️ Breaking Changes

This is a **hard-break** release. The folder layout has changed: workpack instances now live under `workpacks/instances/` instead of directly under `workpacks/`. Existing 1.3.0 workpacks should be migrated using `MIGRATION_PROMPT.md`.

### Added

- **Instances Subfolder**: Workpack instances are now stored under `workpacks/instances/` to separate protocol files from instance data. The linter scans both `instances/` and the legacy top-level layout.
- **DAG Dependency Graph**: Prompts may declare `depends_on` in YAML front-matter. The linter validates no circular dependencies exist (`ERR_DAG_CYCLE`) and warns on unknown references (`WARN_DAG_UNKNOWN_DEP`).
- **Prompt Scaffolding Tool**: `workpack_scaffold.py` reads `01_plan.md` and auto-generates skeleton prompt files with correct YAML front-matter, reducing manual boilerplate.
- **Execution Cost Tracking**: Output JSON gains an `execution` block with `model`, `tokens_in`, `tokens_out`, `duration_ms` fields. The linter warns when completed outputs lack it (`WARN_MISSING_EXECUTION`).
- **Multi-Repo Awareness**: Prompts declare `repos` in YAML front-matter specifying which repositories they touch. The linter warns on empty `repos` for A/B-series prompts (`WARN_MISSING_REPOS`).
- **Structured Change Details**: Output JSON gains `change_details` array with per-file `repo`, `file`, `action`, `lines_added`, `lines_removed`.
- **R-Series Retrospective**: New `R_retrospective.md` template for post-merge lessons learned, cost analysis, and prompt quality assessment.
- **Cross-Workpack References**: `01_plan.md` template gains `requires_workpack` field for declaring dependencies between workpacks.
- **Machine-Verifiable Acceptance Criteria**: `00_request.md` template gains structured `## Acceptance Criteria (machine-verifiable)` section with `type: test_pass | file_exists | lint_clean` entries.
- **New Linter Checks**:
  - `ERR_DAG_CYCLE`: Circular dependency in `depends_on` graph → ERROR
  - `WARN_DAG_UNKNOWN_DEP`: `depends_on` references non-existent prompt → WARNING
  - `WARN_MISSING_REPOS`: A/B-series prompt with empty `repos: []` → WARNING
  - `WARN_MISSING_EXECUTION`: Completed output JSON without `execution` block → WARNING

### Changed

- **Folder Layout**: `workpacks/YYYY-MM-DD_*` moved to `workpacks/instances/YYYY-MM-DD_*`.
- **Linter Scan Path**: Linter now scans `workpacks/instances/` first, then falls back to top-level for legacy workpacks.
- **WORKPACK_OUTPUT_SCHEMA.json**: Added `repos`, `execution`, and `change_details` fields.
- **00_request.md Template**: Added machine-verifiable acceptance criteria section.
- **01_plan.md Template**: Added `requires_workpack` and DAG sections.
- **99_status.md Template**: Added R-series tracking section and execution cost summary.
- **All Prompt Templates**: Added YAML front-matter with `depends_on` and `repos` fields.
- **MIGRATION_PROMPT.md**: Updated for 1.3.0→1.4.0 migration path.

### Lifecycle

```
A0 → A1–A4 (parallel, DAG-ordered) → A5/V1 (verify) → [B-series] → V2 (V-loop) → MERGE → R1 (retrospective)
```

### Migration

Use `MIGRATION_PROMPT.md` to convert existing workpacks. Key changes: move instances to `instances/` subfolder, add YAML front-matter to prompts, add `execution` block to output JSONs.

---

## [1.3.0] - 2026-02-09

### ⚠️ Breaking Changes

This is a **hard-break** release. Existing 1.2.0 workpacks are considered legacy and should be migrated using `MIGRATION_PROMPT.md`.

### Added

- **V-Series (Verification Prompts)**: New prompt series dedicated to verification gates.
  - Every workpack **MUST** include at least one verification prompt (`V#_*.md`). The linter emits `ERR_NO_VERIFICATION` if none is found.
  - `V_bugfix_verify.md` template: lightweight, iterative post-bugfix verification gate (V-loop).
- **V-Loop Paradigm**: After B-series fixes are applied, a single `V2_bugfix_verify.md` prompt is executed iteratively until all bugs are confirmed resolved. Output JSON tracks `"iteration"` count and `"b_series_resolved"` / `"b_series_remaining"` arrays.
- **B-Series Severity Field**: `## Severity` section is now **mandatory** in all B-series prompts. Values: `blocker`, `major`, `minor`. Output JSON gains `"severity"` field.
- **B-Series Budget Warning**: The linter emits `WARN_B_SERIES_BUDGET` when a workpack has >5 B-series prompts, and `WARN_B_SERIES_RESCOPE` when >8. V-loop output must include `"b_series_budget_warning"` flag.
- **Protocol Version Consistency Check**: Linter verifies that `00_request.md`, `01_plan.md`, and `99_status.md` all reference the same protocol version. Emits `WARN_VERSION_MISMATCH` on inconsistency.
- **Subagent Parallelization Guidance**: All A-series and V-series templates now include a `## Subagent Strategy` section encouraging agents to spawn subagents for parallelizable subtasks within a single prompt.
- **Task Tracking Guidance**: All prompt templates now include a `## Task Tracking` section encouraging agents to maintain a structured todo list for multi-step work.
- **Linter Virtual Environment**: `workpack_lint.py` now auto-creates and re-runs inside a Python virtual environment (`tools/.venv/`) when invoked outside one, ensuring isolation and reproducibility.
- **CHANGELOG Enforcement**: Generation and migration prompts now instruct agents to update `workpacks/CHANGELOG.md` when introducing protocol version changes.
- **New Linter Checks**:
  - `ERR_NO_VERIFICATION`: No `V#_*` prompt present → ERROR
  - `WARN_BUGFIX_NO_VERIFY`: B-series prompts present but no `V#_*` prompt → WARNING
  - `WARN_B_SERIES_BUDGET`: >5 B-series prompts → WARNING
  - `WARN_B_SERIES_RESCOPE`: >8 B-series prompts → WARNING (suggests re-scoping)
  - `ERR_SEVERITY_MISSING`: B-series prompt without `## Severity` section → ERROR
  - `WARN_VERSION_MISMATCH`: Protocol version inconsistency across workpack files → WARNING

### Changed

- **V1 as Fixed Role**: `V1_integration_meta.md` is now a **fixed role name** for the integration verification gate.
- **01_plan.md Template**: Now includes V-loop phase in parallelization map and B-series severity table.
- **99_status.md Template**: Now includes V-Series tracking section alongside A-Series and B-Series.
- **B_template.md**: Added mandatory `## Severity` section and severity guidance.
- **PROMPT_STYLE_GUIDE.md**: Added V-series documentation and subagent parallelization section.
- **WORKPACK_OUTPUT_SCHEMA.json**: Added optional `severity`, `iteration`, `b_series_resolved`, `b_series_remaining`, `b_series_budget_warning` fields.
- **MIGRATION_PROMPT.md**: Updated for 1.2.0→1.3.0 migration path.

### Lifecycle

```
A0 → A1–A4 (parallel) → V1 (verify) → [B-series] → V2 (V-loop) → MERGE
```

### Migration

Use `MIGRATION_PROMPT.md` to convert existing workpacks. Key changes: add `## Severity` to B-series prompts, add V2_bugfix_verify if B-series exist.

---

## [1.2.0] - 2026-01-31

### ⚠️ Breaking Changes

This is a **hard-break** release. Existing 1.1.0 workpacks are considered legacy and should be migrated using `MIGRATION_PROMPT.md`.

### Added

- **Agent-Centric Prompt Philosophy**: Prompts now describe *what* to implement using semantic references, not *how* by embedding code. Agents are implementers, not copy-pasters.
- **PROMPT_STYLE_GUIDE.md**: Comprehensive guide for writing agent-centric prompts with valid/invalid examples.
- **Integration Agent as Merge Reviewer**: A5 now executes mandatory test suites and validates that all agents followed directives before allowing merge.
- **Linter Code-Block Detection**: `workpack_lint.py` now detects code blocks in prompts and emits warnings (errors in 1.3.0+).
- **MIGRATION_PROMPT.md**: General-purpose migration prompt to convert any workpack version to latest.
- **Standard Verification Checklist**: A5 has a standard checklist plus custom workpack-specific checks.

### Changed

- **Template Prompt Structure**: New architecture with sections:
  - `## Objective` — High-level goal description
  - `## Reference Points` — Semantic references to existing code patterns (method names, class patterns, NOT line numbers)
  - `## Implementation Requirements` — Behavioral specifications, NOT code
  - `## Contracts` — Interface/DTO signatures or references to existing files
  - `## Verification` — Commands and criteria, NOT implementation
- **WORKPACK_GENERATION_PROMPT.md**: Now agent-centric, includes anti-patterns section, 80/20 rule for code snippets.
- **WORKPACK_BUG_REPORT_PROMPT.md**: Now agent-centric, describes expected vs observed behavior without proposing fix code.
- **WORKPACK_META_PROMPT.txt**: Added `NO_CODE_BLOCKS` constraint and semantic reference instructions.

### Removed

- **Inline Code Blocks in Prompts**: Prompts should NOT contain complete code implementations. Max 20% of prompt can be signatures/interfaces.
- **Line Number References**: Use semantic references (e.g. `HandleRequest method in RequestService`) instead of fragile line numbers.

### Migration

Use `MIGRATION_PROMPT.md` to convert existing workpacks. Migration uncertainties are collected in a `MIGRATION_NOTES.md` file within the workpack.

---

## [1.1.0] - 2026-01-24

### Added

- **Structured Handoff Outputs**: Every completed prompt must produce `outputs/<PROMPT>.json` conforming to `WORKPACK_OUTPUT_SCHEMA.json`.
- **Linter Validation**: `tools/workpack_lint.py` validates workpacks for:
  - Required `outputs/` directory
  - JSON output for each completed prompt
  - Schema conformance
  - Field value consistency
- **Output JSON Schema**: `WORKPACK_OUTPUT_SCHEMA.json` with required fields for traceability.
- **B-Series Prompts**: Post-implementation bug fix prompts with naming convention `B#_<component>_<description>.md`.
- **99_status.md**: Formalized status tracking with completion markers.
- **Protocol Version Declaration**: `Workpack Protocol Version: <semver>` in `00_request.md`.

### Changed

- **Completion Rules**: A prompt is only complete when BOTH status marker exists AND output JSON is created.
- **Acceptance Criteria Mapping**: `00_request.md` now includes AC → Verification mapping table.

---

## [1.0.0] - 2026-01-22

### Added

- **Initial Workpack Structure**: Folder-based organization with `00_request.md`, `01_plan.md`, `prompts/`, `99_status.md`.
- **Naming Convention**: `YYYY-MM-DD_<category>_<short-slug>` folder naming.
- **A-Series Prompts**: A0 (bootstrap), A1–A4 (implementation agents), A5 (integration).
- **Template Directory**: `_template/` with reusable scaffolds.
- **WORKPACK_GENERATION_PROMPT.md**: Meta-prompt for generating workpacks.
- **WORKPACK_META_PROMPT.txt**: Single-file router for agent workflows.

### Notes

- 1.0.0 workpacks do not require structured outputs.
- No linter validation for 1.0.0.
