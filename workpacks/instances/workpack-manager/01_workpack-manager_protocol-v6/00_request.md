# Request

## Workpack Protocol Version

Workpack Protocol Version: 2.0.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `workpack-protocol-v6`

Define and implement Workpack Protocol v6 — the reusable workpack framework that introduces machine-readable metadata (`workpack.meta.json`), runtime state separation (`workpack.state.json`), updated templates, JSON Schema definitions, and tooling updates. This workpack establishes the protocol foundation that the VS Code extension (and any future tooling) will consume.

The protocol must be project-agnostic: it should work in any Git repository, not just the WorkpackManager project. The agent roles (A1–A6) are conventions, not hardcoded domain bindings. Templates must be adaptable to arbitrary project structures.

Constraints and notes:

- Backward-compatible with Protocol v5 (additive changes only)
- `workpack.meta.json` is static metadata; `workpack.state.json` is mutable runtime state
- `99_status.md` remains the human-readable complement to `workpack.state.json`
- Templates must include the new files
- Linter and scaffold tool must be updated to handle v6
- Adoption guide must explain how to introduce workpacks into an existing project
- Primary repo: `WorkpackManager`

Preferred Delivery Mode: `PR`
Target Base Branch: `main`

## Acceptance Criteria

- [ ] AC1: `WORKPACK_META_SCHEMA.json` is a valid JSON Schema and covers all required fields (id, title, summary, protocol_version, workpack_version, category, created_at, requires_workpack, tags, owners, repos, delivery_mode, target_branch, prompts).
- [ ] AC2: `WORKPACK_STATE_SCHEMA.json` is a valid JSON Schema covering overall_status, per-prompt status, agent_assignments, blocked_by, and execution_log.
- [ ] AC3: `workpack.meta.json` template is included in `_template/` and validates against the schema.
- [ ] AC4: `workpack.state.json` template is included in `_template/` and validates against the schema.
- [ ] AC5: Protocol specification document clearly defines the metadata/state split rationale and field semantics.
- [ ] AC6: All existing v5 conventions (YAML front-matter, DAG, execution cost, R-series) remain functional.
- [ ] AC7: Linter validates `workpack.meta.json` presence and consistency (id matches folder, prompts match files).
- [ ] AC8: Scaffold tool generates `workpack.meta.json` when creating a new workpack.
- [ ] AC9: Adoption guide provides step-by-step instructions for adding workpacks to an existing project.
- [ ] AC10: CHANGELOG.md documents v6 changes with migration notes.
- [ ] AC11: Template prompt files are project-agnostic (no hardcoded domain references).

## Constraints

- No breaking changes to v5 workpack structure. v6 is purely additive.
- Schemas must use JSON Schema draft 2020-12.
- No secrets, tokens, or credentials in any files.
- Templates must not assume any specific programming language or framework.

## Acceptance Criteria → Verification Mapping

| AC ID | Acceptance Criterion | How to Verify |
|-------|----------------------|---------------|
| AC1 | Meta schema valid and complete | Validate schema with `jsonschema` library; check all required fields |
| AC2 | State schema valid and complete | Validate schema with `jsonschema` library; check required fields |
| AC3 | Meta template validates | `python -c "import json, jsonschema; ..."` against meta schema |
| AC4 | State template validates | `python -c "import json, jsonschema; ..."` against state schema |
| AC5 | Protocol spec is clear and complete | Human review of protocol document |
| AC6 | v5 conventions preserved | Workpack linter passes on v5-style workpacks |
| AC7 | Linter handles v6 | `python workpacks/tools/workpack_lint.py` passes with v6 checks |
| AC8 | Scaffold generates meta.json | `python workpacks/tools/workpack_scaffold.py <workpack>` produces meta |
| AC9 | Adoption guide exists and is actionable | File exists and covers setup steps |
| AC10 | CHANGELOG updated | `CHANGELOG.md` has v6 entry |
| AC11 | Templates are project-agnostic | Grep for domain-specific references returns none |

## Delivery Mode

- [x] PR-based (default)
- [ ] Direct push

## Scope

### In Scope

- Protocol v6 specification document
- JSON Schema definitions (meta, state, output)
- Template files (including workpack.meta.json and workpack.state.json)
- Linter updates for v6 validation
- Scaffold tool updates for v6 generation
- Adoption guide for external projects
- CHANGELOG update

### Out of Scope

- VS Code extension implementation (separate workpack)
- Agent provider implementations (separate workpack)
- UI components (separate workpack)
