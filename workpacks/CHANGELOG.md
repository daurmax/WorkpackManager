# Workpack Protocol Changelog

All notable changes to the Workpack Protocol are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [6.1] - 2026-02-23

### Added

- **Workpack Groups**: `instances/` can now contain group directories alongside standalone workpacks. A group is a directory containing multiple related workpacks plus `group.meta.json` and `GROUP.md`. Validated against `WORKPACK_GROUP_SCHEMA.json`.
- **`group.meta.json`**: Machine-readable group metadata with formal execution DAG — phases (parallel/serial), directed edges, and workpack inventory. Enables tooling to understand execution order across workpacks.
- **`GROUP.md`**: Human-readable companion with dependency graph visualization, phase execution plan, edge rationale, and naming convention.
- **`WORKPACK_GROUP_SCHEMA.json`**: JSON Schema for group metadata.
- **`group` field in `workpack.meta.json`**: Optional field linking a workpack to its parent group.

### Changed

- **Workpack Naming Convention**: Date prefix removed from workpack folder names.
  - **Standalone workpacks**: `<slug>` (kebab-case slug only).
  - **Grouped workpacks**: `<group-id>_<slug>_<NN>` where `NN` is the two-digit execution phase number. Workpacks with the same `NN` may run in parallel.
- **`id` pattern in WORKPACK_META_SCHEMA.json**: Updated from `YYYY-MM-DD_category_slug` to `^[a-z0-9][a-z0-9_-]+$`.
- **`created_at` field**: Remains in `workpack.meta.json` as metadata but is no longer encoded in the folder name.
- **Linter rule WP001**: Updated to validate new naming convention.

### Backward Compatibility

- Workpacks using the old `YYYY-MM-DD_category_slug` naming are still supported by the linter (legacy pattern detected and warned).
- The `created_at` field is still required in `workpack.meta.json`.
- Standalone workpacks (not in a group) continue to work as before, just without the date prefix.

---

## [6.0] - 2026-02-23

### Added

- **`workpack.meta.json`**: Machine-readable static metadata file for each workpack instance. Contains identity, dependencies, tags, owners, prompt index, and delivery configuration. Validated against `WORKPACK_META_SCHEMA.json`.
- **`workpack.state.json`**: Machine-readable runtime state file, separated from static metadata. Contains overall status, per-prompt status, agent assignments, blocked-by references, and an append-only execution log. Validated against `WORKPACK_STATE_SCHEMA.json`.
- **Metadata/State Split**: Static metadata (`workpack.meta.json`) is version-controlled and stable. Mutable runtime state (`workpack.state.json`) is updated by agents and tooling during execution. This separation enables tooling (VS Code extensions, CI) to index workpacks without parsing markdown.
- **Prompt Index in Metadata**: `workpack.meta.json` includes a `prompts` array with machine-readable DAG (stem, depends_on, repos, estimated_effort), duplicating the human-readable DAG in `01_plan.md` for programmatic access.
- **Agent Assignment Tracking**: `workpack.state.json` includes `agent_assignments` and per-prompt `assigned_agent` fields, enabling tooling to track which agent (copilot, codex, human) is responsible for each prompt.
- **Execution Log**: `workpack.state.json` includes an append-only `execution_log` array for audit trail of state transitions.
- **New Linter Checks (v6)**:
  - `ERR_MISSING_META`: Workpack missing `workpack.meta.json` → ERROR
  - `WARN_META_ID_MISMATCH`: `workpack.meta.json` id does not match folder name → WARNING
  - `WARN_META_PROMPTS_DRIFT`: Prompt index in meta.json does not match actual prompt files → WARNING
  - `WARN_STATE_DRIFT`: `workpack.state.json` overall_status inconsistent with prompt_status → WARNING

### Changed

- **Protocol Version**: Bumped to 6.
- **Template**: `_template/` now includes `workpack.meta.json` and `workpack.state.json` skeleton files.
- **Linter**: Extended to validate meta.json and state.json against their schemas and cross-check consistency.
- **Scaffold Tool**: Now generates `workpack.meta.json` alongside prompt files when scaffolding a new workpack.

### Backward Compatibility

- Protocol v6 is **backward-compatible** with v5. Workpacks without `workpack.meta.json` / `workpack.state.json` are treated as v5 and linted accordingly. The new files are additive.
- All v5 conventions (YAML front-matter, DAG dependencies, execution cost, R-series, etc.) remain in effect.
- `99_status.md` remains the human-readable status file. `workpack.state.json` is the machine-readable complement, not a replacement.

### Lifecycle (v6)

```
A0 → A1–A4 (parallel, DAG-ordered) → A5/V1 (verify) → [B-series] → V2 (V-loop) → MERGE → R1 (retrospective)
```

State transitions tracked in `workpack.state.json` execution_log.

---

## [5.0] - 2026-02-11

Inherited from FurlanPronunciationService. See that project's CHANGELOG for v1–v5 history.

### Summary of v5

- Instances subfolder (`workpacks/instances/`)
- DAG dependencies (`depends_on` YAML front-matter)
- Multi-repo awareness (`repos` front-matter)
- Execution cost tracking (`execution` block in output JSON)
- R-series retrospective (post-merge)
- Cross-workpack references (`requires_workpack`)
- Scaffold tool (`workpack_scaffold.py`)
