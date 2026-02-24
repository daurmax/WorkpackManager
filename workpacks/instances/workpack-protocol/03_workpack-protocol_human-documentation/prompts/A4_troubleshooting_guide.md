---
depends_on: [A1_concepts_guide]
repos: [WorkpackManager]
---
# Troubleshooting Guide Agent Prompt

> Write `docs/TROUBLESHOOTING.md` — a problem/solution catalog with at least 10 entries organized by category (schema errors, DAG issues, state drift, tooling failures).

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/00_request.md`
2. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/01_plan.md`
3. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/workpack.state.json`
5. `workpacks/PROTOCOL_SPEC.md` — invariants that commonly trigger errors
6. `workpacks/tools/workpack_lint.py` — linter error messages to document

## Context

Workpack: `workpack-protocol/03_workpack-protocol_human-documentation`

## Delivery Mode

- PR-based

## Objective

Create `docs/TROUBLESHOOTING.md` — a categorized catalog of common problems encountered when using the workpack protocol, with symptoms, causes, and resolution steps. The document must:

1. Contain at least 10 documented problems (AC7).
2. Organize problems by category: Schema Errors, DAG Issues, State Drift, Tooling Failures, Commit Tracking Issues.
3. Each entry follows a consistent structure: problem, symptoms, cause, resolution (AC8).
4. Reference verification tooling commands where applicable.

## Reference Points

- `workpacks/tools/workpack_lint.py` — common linter errors and warnings
- `workpacks/tools/validate_workpack_files.py` — file validation errors
- `workpacks/WORKPACK_META_SCHEMA.json` — schema validation errors
- `workpacks/WORKPACK_STATE_SCHEMA.json` — state validation errors
- `docs/CONCEPTS.md` (from A1) — link for background concepts

## Implementation Requirements

1. Create `docs/TROUBLESHOOTING.md` with the following structure:
   - **Header**: Purpose and how to use this document.
   - **Category: Schema Errors** (≥ 2 entries):
     - Invalid `workpack.meta.json` (missing required fields, wrong types).
     - Invalid `workpack.state.json` (invalid status enum, missing prompts).
   - **Category: DAG Issues** (≥ 2 entries):
     - Circular dependency in `depends_on`.
     - Missing dependency (referenced prompt does not exist).
   - **Category: State Drift** (≥ 2 entries):
     - `01_plan.md` WBS out of sync with `workpack.meta.json` prompts.
     - `99_status.md` not reflecting actual `workpack.state.json` status.
   - **Category: Tooling Failures** (≥ 2 entries):
     - Scaffold tool creates incomplete structure.
     - Lint tool false positive on valid workpack.
   - **Category: Commit Tracking** (≥ 2 entries):
     - Missing commit SHA in `change_details`.
     - SHA references non-existent commit.
2. Each entry must follow this template:
   ```markdown
   ### Problem: <short title>
   **Symptoms**: What the user sees.
   **Cause**: Why it happens.
   **Resolution**: Step-by-step fix.
   ```
3. Include at least **10 entries** total across all categories.
4. Cross-reference `CONCEPTS.md`, `QUICKSTART.md`, `INTEGRATION.md` (AC9).
5. Place file at `docs/TROUBLESHOOTING.md`.

## Scope

### In Scope
- `docs/TROUBLESHOOTING.md` creation (AC7, AC8)
- At least 10 problem entries
- Five categories minimum
- Cross-references (AC9)

### Out of Scope
- Concept explanations (A1_concepts_guide)
- Step-by-step getting started (A2_quickstart_guide)
- Integration scenarios (A3_integration_guide)
- Auto-remediation tooling

## Acceptance Criteria

- [ ] AC7: `docs/TROUBLESHOOTING.md` exists with at least 10 documented problems.
- [ ] AC8: Each troubleshooting entry has: problem description, symptoms, likely cause, resolution steps.
- [ ] AC9: All docs cross-reference each other via relative links.
- [ ] AC11: No broken links across documentation.
- [ ] AC12: Language level: accessible to developers without prior workpack knowledge.

## Verification

```bash
# File exists
test -f docs/TROUBLESHOOTING.md && echo "OK"

# Count problem entries (at least 10)
grep -c "^### Problem:" docs/TROUBLESHOOTING.md

# Each entry has the required subsections
grep -c "Symptoms\|Cause\|Resolution" docs/TROUBLESHOOTING.md

# Cross-references present
grep -c "CONCEPTS\|QUICKSTART\|INTEGRATION" docs/TROUBLESHOOTING.md
```

## Handoff Output (JSON)

Write `outputs/A4_troubleshooting_guide.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "03_workpack-protocol_human-documentation",
  "prompt": "A4_troubleshooting_guide",
  "component": "human-docs",
  "delivery_mode": "pr",
  "branch": {
    "base": "main",
    "work": "feature/human-documentation",
    "merge_target": "main"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": ["<COMMIT_SHA>"],
    "branch_verified": false
  },
  "changes": {
    "files_modified": [],
    "files_created": ["docs/TROUBLESHOOTING.md"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "test -f docs/TROUBLESHOOTING.md && echo OK", "result": "pass", "notes": "" },
      { "cmd": "grep -c '^### Problem:' docs/TROUBLESHOOTING.md", "result": "pass", "notes": "≥10 entries" }
    ],
    "regression_added": false,
    "regression_notes": "Documentation file, no code tests"
  },
  "handoff": {
    "summary": "TROUBLESHOOTING.md created with 10+ categorized problem/solution entries.",
    "next_steps": ["Proceed to V1_integration_meta"],
    "known_issues": []
  },
  "repos": ["WorkpackManager"],
  "execution": {
    "model": "<MODEL_ID>",
    "tokens_in": 0,
    "tokens_out": 0,
    "duration_ms": 0
  },
  "change_details": [],
  "notes": ""
}
```

## Deliverables

- [ ] `docs/TROUBLESHOOTING.md` created
- [ ] At least 10 problem entries across 5 categories
- [ ] Consistent entry structure (Problem/Symptoms/Cause/Resolution)
- [ ] Cross-references to sibling docs
- [ ] `outputs/A4_troubleshooting_guide.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
