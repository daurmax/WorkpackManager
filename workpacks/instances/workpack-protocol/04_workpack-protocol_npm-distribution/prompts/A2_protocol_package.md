---
depends_on: [A1_monorepo_structure]
repos: [WorkpackManager]
---
# Protocol npm Package Agent Prompt

> Create the `@workpack/protocol` npm package under `packages/protocol/` with JSON schemas, templates, agent docs, proper `exports` map, and `files` configuration.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/00_request.md`
2. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/01_plan.md`
3. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/workpack.state.json`
5. `workpacks/WORKPACK_META_SCHEMA.json`, `WORKPACK_STATE_SCHEMA.json`, `WORKPACK_OUTPUT_SCHEMA.json`, `WORKPACK_GROUP_SCHEMA.json` — schemas to include
6. `workpacks/_template/` — template files to include

## Context

Workpack: `workpack-protocol/04_workpack-protocol_npm-distribution`

## Delivery Mode

- PR-based

## Objective

Create the `@workpack/protocol` npm package under `packages/protocol/`. This package distributes all protocol assets (JSON schemas, templates, agent documentation) so any project can install and use them. The package must:

1. Have a correct `package.json` with `name`, `version`, `exports`, `files`, and `bin` fields.
2. Include all JSON schemas, the `_template/` directory, and agent documentation files.
3. Include `workpack.config.json` JSON Schema (from project-config workpack).
4. Be publishable with `npm pack` / `npm publish`.

## Reference Points

- `workpacks/WORKPACK_META_SCHEMA.json` — schema to package
- `workpacks/WORKPACK_STATE_SCHEMA.json` — schema to package
- `workpacks/WORKPACK_OUTPUT_SCHEMA.json` — schema to package
- `workpacks/WORKPACK_GROUP_SCHEMA.json` — schema to package
- `workpacks/_template/` — template directory to package
- `workpacks/AGENT_RULES.md`, `workpacks/AGENT_STATE_MACHINE.md` — agent docs to package
- `packages/protocol/` — directory created by A1

## Implementation Requirements

1. Create `packages/protocol/package.json`:
   ```json
   {
     "name": "@workpack/protocol",
     "version": "0.1.0",
     "description": "Workpack protocol schemas, templates, and agent documentation",
     "type": "module",
     "exports": {
       "./schemas/*": "./schemas/*.json",
       "./templates/*": "./templates/*",
       "./agent-docs/*": "./agent-docs/*"
     },
     "bin": {
       "workpack-init": "./bin/init.js"
     },
     "files": ["schemas/", "templates/", "agent-docs/", "bin/", "tools/"],
     "keywords": ["workpack", "protocol", "ai-agent", "schemas"],
     "license": "MIT",
     "engines": { "node": ">=18" }
   }
   ```
2. Copy/symlink protocol assets into package structure:
   - `packages/protocol/schemas/` — all `WORKPACK_*_SCHEMA.json` files
   - `packages/protocol/templates/` — contents of `workpacks/_template/`
   - `packages/protocol/agent-docs/` — `AGENT_RULES.md`, `AGENT_STATE_MACHINE.md`
   - `packages/protocol/tools/` — Python tool scripts (as distributable assets, not executable via Node)
3. Create `packages/protocol/README.md` with package description, installation, and usage.
4. Verify with `npm pack --dry-run` that all expected files are included.
5. Create `.github/workflows/publish-protocol.yml` — manual-trigger workflow for npm publish (AC14).

## Scope

### In Scope
- `packages/protocol/package.json` creation (AC3)
- Schema, template, and agent-doc asset copying (AC4, AC5)
- Package README
- Publish workflow (AC14)
- `npm pack --dry-run` verification

### Out of Scope
- Init CLI command implementation (A3_init_command)
- Extension scaffold (A4_extension_scaffold)
- Actual npm publishing (manual trigger only)
- Python tool packaging (stay in workpacks/tools/)

## Acceptance Criteria

- [ ] AC3: `packages/protocol/package.json` has correct name (`@workpack/protocol`), version, `exports`, and `files` fields.
- [ ] AC4: Protocol package includes: all JSON schemas, `_template/` directory, `AGENT_RULES.md`, `AGENT_STATE_MACHINE.md`.
- [ ] AC5: Protocol package includes `workpack.config.json` JSON Schema.
- [ ] AC14: `.github/workflows/` includes publish workflow for the npm package (manual trigger).

## Verification

```bash
# Package.json valid
node -e "const p=require('./packages/protocol/package.json'); console.log(p.name, p.version)"

# Dry-run pack
cd packages/protocol && npm pack --dry-run

# Schemas present
ls packages/protocol/schemas/

# Templates present
ls packages/protocol/templates/

# Publish workflow exists
test -f .github/workflows/publish-protocol.yml && echo "OK"
```

## Handoff Output (JSON)

Write `outputs/A2_protocol_package.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "04_workpack-protocol_npm-distribution",
  "prompt": "A2_protocol_package",
  "component": "npm-package",
  "delivery_mode": "pr",
  "branch": {
    "base": "main",
    "work": "feature/npm-distribution",
    "merge_target": "main"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": ["<COMMIT_SHA>"],
    "branch_verified": false
  },
  "changes": {
    "files_modified": [],
    "files_created": [
      "packages/protocol/package.json",
      "packages/protocol/README.md",
      "packages/protocol/schemas/WORKPACK_META_SCHEMA.json",
      "packages/protocol/schemas/WORKPACK_STATE_SCHEMA.json",
      "packages/protocol/schemas/WORKPACK_OUTPUT_SCHEMA.json",
      "packages/protocol/schemas/WORKPACK_GROUP_SCHEMA.json",
      ".github/workflows/publish-protocol.yml"
    ],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "cd packages/protocol && npm pack --dry-run", "result": "pass", "notes": "All files included" }
    ],
    "regression_added": false,
    "regression_notes": "New package, no existing tests affected"
  },
  "handoff": {
    "summary": "@workpack/protocol npm package created with schemas, templates, and agent docs.",
    "next_steps": ["Proceed to A3_init_command"],
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

- [ ] `packages/protocol/package.json` created with correct fields
- [ ] `packages/protocol/schemas/` populated with all JSON schemas
- [ ] `packages/protocol/templates/` populated from `_template/`
- [ ] `packages/protocol/agent-docs/` populated
- [ ] `packages/protocol/README.md` created
- [ ] `.github/workflows/publish-protocol.yml` created
- [ ] `npm pack --dry-run` succeeds
- [ ] `outputs/A2_protocol_package.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
