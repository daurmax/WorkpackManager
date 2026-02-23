---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Protocol Specification Agent Prompt

> Write the Workpack Protocol v6 specification document covering metadata/state split, field semantics, and backward compatibility.

---

## READ FIRST

1. `workpacks/README.md` (if exists, or reference project's README)
2. `workpacks/CHANGELOG.md`
3. `workpacks/WORKPACK_META_SCHEMA.json`
4. `workpacks/WORKPACK_STATE_SCHEMA.json`
5. `workpacks/instances/workpack-manager_protocol-v6_01/00_request.md`
6. `workpacks/instances/workpack-manager_protocol-v6_01/01_plan.md`

## Context

Workpack: `workpack-manager_protocol-v6_01`
This prompt produces the protocol specification document — the authoritative reference for Protocol v6.

## Delivery Mode

- PR-based.

## Objective

Create a comprehensive protocol specification document (`workpacks/PROTOCOL_SPEC.md`) that defines Workpack Protocol v6. The spec must cover: the rationale for the metadata/state split, field-by-field semantics for `workpack.meta.json` and `workpack.state.json`, the relationship between markdown files and JSON files, agent interaction patterns, and backward compatibility with v5.

The document serves as the single source of truth for anyone implementing tooling that consumes workpacks (VS Code extension, CI pipelines, CLI tools).

## Reference Points

- **Existing protocol documentation**: The reference project (`FurlanPronunciationService/workpacks/README.md`) serves as the v5 baseline. Build on its conventions.
- **Schema definitions**: `WORKPACK_META_SCHEMA.json` and `WORKPACK_STATE_SCHEMA.json` define the data model. The spec must explain the *why* behind each field.
- **CHANGELOG**: `workpacks/CHANGELOG.md` lists v6 changes. The spec must expand on each.

## Implementation Requirements

- Create `workpacks/PROTOCOL_SPEC.md` with the following sections:
  - **Protocol Overview**: Purpose, version history, design philosophy.
  - **File Layout**: Required and optional files per workpack instance.
  - **Metadata/State Split**: Rationale (why two files), ownership rules (who writes what, when), consistency expectations.
  - **workpack.meta.json Reference**: Field-by-field documentation with examples. Which fields are required vs optional. How `prompts` array mirrors the DAG.
  - **workpack.state.json Reference**: Field-by-field documentation. Status transitions. Execution log semantics. Agent assignment tracking.
  - **Relationship to Markdown Files**: How `00_request.md`, `01_plan.md`, `99_status.md` relate to the JSON files. Consistency expectations.
  - **Backward Compatibility**: How v5 workpacks are handled. What happens when meta.json is absent.
  - **Tooling Contract**: What linter checks for, what scaffold generates, what extension expects.
  - **Cross-Workpack Dependencies**: How `requires_workpack` works, resolution semantics, blocked state.
  - **Agent Interaction Patterns**: How agents read/write state, output JSON expectations.
- Also create or update `workpacks/README.md` adapted for this repository (not a copy of the reference project's domain-specific README, but a project-agnostic version).

## Contracts

New files to create:

| File | Purpose |
|------|---------|
| `workpacks/PROTOCOL_SPEC.md` | Authoritative protocol v6 specification |
| `workpacks/README.md` | Project-agnostic workpack system overview |

## Subagent Strategy

- Subagent 1: Draft the PROTOCOL_SPEC.md sections on metadata/state split and field references.
- Subagent 2: Draft the README.md adapted for project-agnostic use.

## Task Tracking

Use a todo list to track each section of the spec document.

## Scope

### In Scope
- Protocol specification document
- README.md for the workpack system
- Field-level documentation with examples

### Out of Scope
- Schema implementation (handled by A2)
- Tooling implementation (handled by A3, A4)
- Adoption guide (handled by A6)

## Acceptance Criteria

- [ ] `PROTOCOL_SPEC.md` exists and covers all listed sections.
- [ ] Field semantics match the JSON Schema definitions.
- [ ] Backward compatibility rules are explicit.
- [ ] README.md is project-agnostic and references PROTOCOL_SPEC.md.

## Verification

```bash
test -f workpacks/PROTOCOL_SPEC.md
test -f workpacks/README.md
# Verify no domain-specific references (e.g., FurlanPronunciationService)
grep -ri "FurlanPronunciation" workpacks/PROTOCOL_SPEC.md && echo "FAIL: domain leak" || echo "PASS"
```

## Handoff Output (JSON)

```json
{
  "schema_version": "1.1",
  "workpack": "workpack-manager_protocol-v6_01",
  "prompt": "A1_protocol_spec",
  "component": "docs",
  "delivery_mode": "pr",
  "branch": { "base": "main", "work": "feature/workpack-protocol-v6", "merge_target": "main" },
  "changes": { "files_modified": [], "files_created": ["workpacks/PROTOCOL_SPEC.md", "workpacks/README.md"], "contracts_changed": [], "breaking_change": false },
  "verification": { "commands": [] },
  "handoff": { "summary": "", "next_steps": [], "known_issues": [] },
  "repos": ["WorkpackManager"],
  "execution": { "model": "", "tokens_in": 0, "tokens_out": 0, "duration_ms": 0 }
}
```

## Deliverables

- [ ] `workpacks/PROTOCOL_SPEC.md` created
- [ ] `workpacks/README.md` created or updated
- [ ] `outputs/A1_protocol_spec.json` written
- [ ] `99_status.md` updated
- [ ] `workpack.state.json` updated
