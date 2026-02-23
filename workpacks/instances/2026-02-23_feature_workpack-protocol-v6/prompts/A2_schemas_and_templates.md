---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Schemas and Templates Agent Prompt

> Finalize JSON Schemas for meta/state/output, update all template files, and validate templates against schemas.

---

## READ FIRST

1. `workpacks/WORKPACK_META_SCHEMA.json`
2. `workpacks/WORKPACK_STATE_SCHEMA.json`
3. `workpacks/WORKPACK_OUTPUT_SCHEMA.json`
4. `workpacks/_template/` (all files)
5. `workpacks/instances/2026-02-23_feature_workpack-protocol-v6/00_request.md`

## Context

Workpack: `2026-02-23_feature_workpack-protocol-v6`
This prompt owns schema finalization and template completeness for Protocol v6.

## Delivery Mode

- PR-based.

## Objective

Review and finalize the three JSON Schema definitions (`WORKPACK_META_SCHEMA.json`, `WORKPACK_STATE_SCHEMA.json`, `WORKPACK_OUTPUT_SCHEMA.json`). Ensure all template files in `_template/` validate against their respective schemas. Update prompt templates to be project-agnostic. Ensure the `_template/` folder is a complete, ready-to-copy scaffold for new workpacks in any project.

## Reference Points

- **Existing schemas**: The three JSON Schema files already exist with draft content. Review for completeness, consistency, and JSON Schema 2020-12 compliance.
- **Reference template**: The FurlanPronunciationService `_template/` folder provides the v5 baseline. Adapt to v6 by adding `workpack.meta.json` and `workpack.state.json`.
- **Output schema reference**: The output schema from the reference project covers v5 fields. Verify v6 additions are present.

## Implementation Requirements

- Validate all three schemas are self-consistent and use JSON Schema draft 2020-12 correctly.
- Ensure `_template/workpack.meta.json` validates against `WORKPACK_META_SCHEMA.json` (after replacing placeholder values).
- Ensure `_template/workpack.state.json` validates against `WORKPACK_STATE_SCHEMA.json`.
- Create or update prompt template files in `_template/prompts/`:
  - `A0_bootstrap.md` — bootstrap template
  - `A5_integration_meta.md` — verification gate template
  - `B_template.md` — bug fix template
  - `V_bugfix_verify.md` — V-loop template
  - `R_retrospective.md` — retrospective template
  - `PROMPT_STYLE_GUIDE.md` — style guide (adapted for project-agnostic use)
- Remove any domain-specific references (FurlanPronunciationService, pytest, mypy, etc.) from templates. Use generic placeholders.
- Add a `_template/README.md` explaining how to use the template.

## Subagent Strategy

- Subagent 1: Schema validation and consistency checks.
- Subagent 2: Template file creation and updates.
- Subagent 3: Write validation script that checks templates against schemas.

## Scope

### In Scope
- Schema review and finalization
- Template file completeness
- Template validation against schemas
- Project-agnostic prompt templates

### Out of Scope
- Protocol specification prose (A1)
- Linter implementation (A3)
- Scaffold implementation (A4)

## Acceptance Criteria

- [ ] All three schemas are valid JSON Schema 2020-12.
- [ ] Template `workpack.meta.json` validates against meta schema (with placeholder substitution).
- [ ] Template `workpack.state.json` validates against state schema.
- [ ] All prompt templates include v6 YAML front-matter.
- [ ] Templates contain no domain-specific references.
- [ ] `_template/README.md` exists with usage instructions.

## Verification

```bash
python -c "
import json, jsonschema
schema = json.load(open('workpacks/WORKPACK_META_SCHEMA.json'))
jsonschema.Draft202012Validator.check_schema(schema)
print('Meta schema: VALID')
"
python -c "
import json, jsonschema
schema = json.load(open('workpacks/WORKPACK_STATE_SCHEMA.json'))
jsonschema.Draft202012Validator.check_schema(schema)
print('State schema: VALID')
"
```

## Deliverables

- [ ] Schemas finalized
- [ ] All template files updated
- [ ] `_template/README.md` created
- [ ] Validation script passes
- [ ] `outputs/A2_schemas_and_templates.json` written
- [ ] `99_status.md` updated
