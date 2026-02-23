---
depends_on: [A5_integration_meta]
repos: [WorkpackManager]
---
# Bugfix Agent Prompt (B1)

> Restore schema-aligned, meta-first parsing behavior for protocol 2.0.0 workpacks.

---

## READ FIRST

1. `workpacks/instances/workpack-manager/02_workpack-manager_core-architecture/outputs/A5_integration_meta.json`
2. `workpacks/WORKPACK_META_SCHEMA.json`
3. `workpacks/WORKPACK_STATE_SCHEMA.json`
4. `src/models/`
5. `src/parser/workpack-parser.ts`
6. `src/test/parser/`

## Context

Workpack: `02_workpack-manager_core-architecture`
Gate blocker from A5: parser rejects schema-valid `protocol_version: "2.0.0"` and incorrectly falls back to markdown parsing.

## Objective

Implement parser/schema alignment so schema-valid `workpack.meta.json` is accepted as primary for protocol 2.0.0 workpacks, and markdown fallback is used only for legacy scenarios where metadata is absent/unparseable.

## Required Fixes

- Update protocol version parsing/typing assumptions to align with WP00 schema constraints.
- Keep v5 fallback support without downgrading schema-valid metadata flows.
- Add runtime validation for parsed `workpack.meta.json` and `workpack.state.json` against WP00 JSON schemas.
- Add or update parser tests to cover:
  - schema-valid semver protocol values (for example `2.0.0`)
  - invalid schema payload rejection with non-crashing warnings
  - legacy fallback path preserved for markdown-only workpacks

## Verification

```bash
npx tsc --noEmit
npm test -- --grep "parser|schema"
npm run lint
```

## Deliverables

- [ ] `outputs/B1_parser_schema_alignment.json`
- [ ] `99_status.md` updated
- [ ] `workpack.state.json` updated
