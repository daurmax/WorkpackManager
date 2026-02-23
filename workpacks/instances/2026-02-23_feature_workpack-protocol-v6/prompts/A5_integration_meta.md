---
depends_on: [A1_protocol_spec, A2_schemas_and_templates, A3_tooling_linter, A4_tooling_scaffold, A6_adoption_guide]
repos: [WorkpackManager]
---
# Integration and Verification Agent Prompt (V1 Gate)

> Validate all Protocol v6 deliverables, run linter, verify schema compliance, and authorize merge.

---

## READ FIRST

1. `workpacks/instances/2026-02-23_feature_workpack-protocol-v6/00_request.md`
2. `workpacks/instances/2026-02-23_feature_workpack-protocol-v6/01_plan.md`
3. `workpacks/PROTOCOL_SPEC.md`
4. `workpacks/WORKPACK_META_SCHEMA.json`
5. `workpacks/WORKPACK_STATE_SCHEMA.json`
6. All output JSONs in `outputs/`

## Context

Workpack: `2026-02-23_feature_workpack-protocol-v6`
This is the V1 verification gate. Do NOT implement features. Validate everything.

## Delivery Mode

- PR-based.

## Objective

Validate that all Protocol v6 deliverables are complete, consistent, and meet acceptance criteria. Run the linter against all workpack instances. Verify schema compliance. Cross-check all acceptance criteria from `00_request.md`. Authorize or block merge.

## Implementation Requirements

- Validate all output JSONs from completed prompts against `WORKPACK_OUTPUT_SCHEMA.json`.
- Run `python workpacks/tools/workpack_lint.py --strict` and verify clean output.
- Validate `workpack.meta.json` in all instances against `WORKPACK_META_SCHEMA.json`.
- Validate `workpack.state.json` in all instances against `WORKPACK_STATE_SCHEMA.json`.
- Verify PROTOCOL_SPEC.md exists and covers all required sections.
- Verify adoption guide exists and is actionable.
- Verify templates are project-agnostic (no domain-specific references).
- Verify CHANGELOG.md has v6 entry.
- Cross-check every AC from `00_request.md` against actual deliverables.
- If all checks pass → authorize merge with summary.
- If any check fails → generate B-series prompts with `## Severity` classification.

## Subagent Strategy

- Subagent 1: Run linter and schema validation commands.
- Subagent 2: Cross-check acceptance criteria.
- Subagent 3: Scan templates for domain-specific references.

## Task Tracking

Maintain a checklist of each AC being verified.

## Acceptance Criteria

- [ ] All output JSONs are valid.
- [ ] Linter passes with --strict.
- [ ] All schemas are valid JSON Schema 2020-12.
- [ ] All templates validate against schemas.
- [ ] No domain-specific references in templates.
- [ ] All ACs from 00_request.md are met.

## Verification

```bash
python workpacks/tools/workpack_lint.py --strict
python -c "
import json, jsonschema, glob
meta_schema = json.load(open('workpacks/WORKPACK_META_SCHEMA.json'))
for f in glob.glob('workpacks/instances/*/workpack.meta.json'):
    meta = json.load(open(f))
    jsonschema.validate(meta, meta_schema)
    print(f'VALID: {f}')
"
```

## Stop Conditions

- If a critical schema error is found that requires redesign, escalate to human.
- If >3 B-series issues found, suggest re-scoping.

## Deliverables

- [ ] Verification report in `outputs/A5_integration_meta.json`
- [ ] Merge authorized or B-series prompts generated
- [ ] `99_status.md` updated
- [ ] `workpack.state.json` updated
