---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A1_config_schema

> Define the `workpack.config.json` schema contract (`WORKPACK_CONFIG_SCHEMA.json`) and wire schema validation into template checks.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/00_request.md`
2. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/01_plan.md`
3. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/workpack.state.json`
5. `workpacks/WORKPACK_META_SCHEMA.json`
6. `workpacks/WORKPACK_STATE_SCHEMA.json`
7. `workpacks/tools/validate_templates.py`

## Context

Workpack: `workpack-protocol/02_workpack-protocol_project-config`

## Delivery Mode

- PR-based

## Objective

Create and enforce the project configuration schema used by `workpack.config.json`. This prompt is responsible for the config contract (field definitions, defaults, and constraints) and for integrating schema-level validation into existing template/schema checks.

## Reference Points

- `00_request.md` AC1-AC7 define the mandatory config fields and defaults.
- Existing schema conventions in `WORKPACK_META_SCHEMA.json` and `WORKPACK_STATE_SCHEMA.json` must be followed (`draft/2020-12`, `additionalProperties: false`, descriptive metadata).
- `workpacks/tools/validate_templates.py` is the current central schema/template validator and must include the new schema.

## Implementation Requirements

1. Create `workpacks/WORKPACK_CONFIG_SCHEMA.json` as valid JSON Schema (`$schema: draft/2020-12`) with `type: object` and `additionalProperties: false`.
2. Encode the required config model:
   - `workpackDir`: string, default `"workpacks"`.
   - `verifyCommands`: object with optional string fields `build`, `test`, `lint`; no extra keys.
   - `protocolVersion`: string version policy field (semver format).
   - `strictMode`: boolean, default `false`.
   - `discovery`: object with:
     - `roots`: array of strings, default `[]`.
     - `exclude`: array of strings (glob patterns), default `[]`.
     - `additionalProperties: false`.
3. Keep the file backward compatible:
   - Schema must allow omitted optional fields so tools can apply runtime defaults.
   - Do not force repositories to add `workpack.config.json`.
4. Update `workpacks/tools/validate_templates.py`:
   - Include `WORKPACK_CONFIG_SCHEMA.json` in schema validation list.
   - Fail validation when schema is missing/invalid, consistent with existing schema checks.
5. Add or update tests in `workpacks/tools/tests/` to verify:
   - The new schema file is loaded and draft-valid.
   - Valid sample config passes.
   - Invalid config samples fail for wrong types and unknown keys.

## Scope

### In Scope
- `WORKPACK_CONFIG_SCHEMA.json` creation and constraints
- Schema validation tooling updates (`validate_templates.py`)
- Tests covering config schema validity and key field constraints

### Out of Scope
- Runtime config loading in tooling scripts (A2)
- Discovery root/exclude execution behavior (A3)
- Workpack instance feature implementation

## Acceptance Criteria

- [ ] AC1: `WORKPACK_CONFIG_SCHEMA.json` exists and is valid JSON Schema.
- [ ] AC2: Schema supports `workpackDir` (string, default `"workpacks"`).
- [ ] AC3: Schema supports `verifyCommands` (`build`, `test`, `lint` as strings).
- [ ] AC4: Schema supports `protocolVersion` (string).
- [ ] AC5: Schema supports `strictMode` (boolean, default `false`).
- [ ] AC6: Schema supports `discovery.roots` (string array).
- [ ] AC7: Schema supports `discovery.exclude` (string array).

## Verification

```bash
python -c "import json; json.load(open('workpacks/WORKPACK_CONFIG_SCHEMA.json', encoding='utf-8'))"
python workpacks/tools/validate_templates.py
python -m pytest workpacks/tools/tests/ -k "config or schema" -v
```

## Handoff Output (JSON)

Write `outputs/A1_config_schema.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "02_workpack-protocol_project-config",
  "prompt": "A1_config_schema",
  "component": "schema",
  "delivery_mode": "pr",
  "branch": {
    "base": "main",
    "work": "feature/project-config",
    "merge_target": "main"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": [
      "<COMMIT_SHA>"
    ],
    "branch_verified": false
  },
  "changes": {
    "files_modified": [],
    "files_created": [],
    "contracts_changed": [
      "workpacks/WORKPACK_CONFIG_SCHEMA.json"
    ],
    "breaking_change": false
  },
  "verification": {
    "commands": [],
    "regression_added": false,
    "regression_notes": ""
  },
  "handoff": {
    "summary": "Config schema and schema validation integration completed.",
    "next_steps": [
      "Proceed to A2_config_tool_integration"
    ],
    "known_issues": []
  },
  "repos": [
    "WorkpackManager"
  ],
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

- [ ] `workpacks/WORKPACK_CONFIG_SCHEMA.json` created
- [ ] `workpacks/tools/validate_templates.py` updated to validate config schema
- [ ] Tests for config schema validation added/updated
- [ ] `outputs/A1_config_schema.json` written
