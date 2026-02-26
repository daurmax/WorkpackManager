# Manual Prompt - Workpack Migration

Use this prompt to migrate one existing workpack to a specific protocol target.

## Fill Before Running

- Target workpack path: `<workpacks/instances/<group>/<workpack-id>>`
- Target workpack id: `<workpack-id>`
- Source protocol version (current): `<2.0.0|2.1.0|2.2.0|2.2.1|3.0.0>`
- Target protocol version: `<3.0.0 or custom>`
- Repositories: `[<REPO_NAME>]`
- Migration mode: `<pr|direct_push>`
- Additional constraints/context: `<optional>`

## Prompt To Run

---
repos: [<REPO_NAME>]
---
# Workpack Migration Task

Migrate workpack `<workpack-id>` at `<workpack-path>` from protocol `<source-version>` to `<target-version>`.

## Required Inputs

- Workpack path: `<workpack-path>`
- Workpack id: `<workpack-id>`
- Source version: `<source-version>`
- Target version: `<target-version>`
- Delivery mode: `<pr|direct_push>`
- Additional constraints: `<optional>`

## Required Actions

1. Read and align:
   - `<workpack-path>/00_request.md`
   - `<workpack-path>/01_plan.md`
   - `<workpack-path>/workpack.meta.json`
   - `<workpack-path>/workpack.state.json`
   - `<workpack-path>/99_status.md`
2. Apply migration changes needed for the target version:
   - update protocol references
   - keep backward compatibility where required
   - preserve historical execution data (`execution_log` append-only)
3. Update prompt/front-matter and output contracts if required by target version.
4. Update workpack status/state to reflect migration execution.
5. Produce/update output artifact:
   - `<workpack-path>/outputs/A4_workpack_modernization.json`

## Verification Commands

```bash
python workpacks/tools/validate_templates.py
python workpacks/tools/workpack_lint.py
```

## Deliverables

- Updated workpack files for `<target-version>`
- Migration evidence in output JSON
- Updated `workpack.state.json` and `99_status.md`
