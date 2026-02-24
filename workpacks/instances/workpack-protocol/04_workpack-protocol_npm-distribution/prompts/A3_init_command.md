---
depends_on: [A2_protocol_package]
repos: [WorkpackManager]
---
# Init CLI Command Agent Prompt

> Implement the `npx @workpack/protocol init` CLI command that bootstraps workpack infrastructure in any project by copying schemas, templates, and creating a starter config.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/00_request.md`
2. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/01_plan.md`
3. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/workpack.state.json`
5. `packages/protocol/package.json` — `bin` field pointing to init script
6. `packages/protocol/schemas/`, `packages/protocol/templates/` — assets to copy

## Context

Workpack: `workpack-protocol/04_workpack-protocol_npm-distribution`

## Delivery Mode

- PR-based

## Objective

Create `packages/protocol/bin/init.js` — the CLI script invoked by `npx @workpack/protocol init`. This command bootstraps workpack infrastructure in a target project by:

1. Creating a `workpacks/` directory (or custom path via `--dir`).
2. Copying JSON schemas into `workpacks/`.
3. Copying the `_template/` directory.
4. Copying Python tool scripts.
5. Creating a starter `workpack.config.json`.
6. Supporting `--protocol-version` to stamp the version.

## Reference Points

- `packages/protocol/package.json` — `bin.workpack-init` entry
- `packages/protocol/schemas/` — schema files to copy
- `packages/protocol/templates/` — template files to copy
- `packages/protocol/tools/` — Python tool scripts to copy
- npm `bin` script conventions

## Implementation Requirements

1. Create `packages/protocol/bin/init.js`:
   - Shebang: `#!/usr/bin/env node`
   - Parse CLI arguments (use `process.argv` or minimal arg parsing — no external deps):
     - `--dir <path>` — target directory for workpack infrastructure (default: `workpacks/`)
     - `--protocol-version <version>` — version to stamp in config (default: read from package.json)
     - `--help` — usage information
   - Create target directory if it doesn't exist.
   - Copy schemas: `schemas/*.json` → `<dir>/`.
   - Copy templates: `templates/` → `<dir>/_template/`.
   - Copy tool scripts: `tools/` → `<dir>/tools/`.
   - Create `<dir>/workpack.config.json` with:
     ```json
     {
       "protocol_version": "<version>",
       "instance_dir": "instances",
       "schemas": { "meta": "WORKPACK_META_SCHEMA.json", "state": "WORKPACK_STATE_SCHEMA.json" }
     }
     ```
   - Print summary of created files.
   - Exit 0 on success, 1 on error.
2. Make the script work with `npx @workpack/protocol init` (via package.json `bin` field).
3. Create integration test:
   - `packages/protocol/tests/test-init.js` (or shell script)
   - Runs init in a temp directory, verifies expected files exist.
   - Can be run with `node packages/protocol/tests/test-init.js`.
4. No external dependencies (Node.js built-in `fs`, `path` only).
5. Must work with Node.js 18+.

## Scope

### In Scope
- `bin/init.js` implementation (AC6, AC7, AC8, AC9)
- `--dir` and `--protocol-version` flags
- Integration test
- No external dependencies

### Out of Scope
- npm package definition (A2_protocol_package, already done)
- Extension scaffold (A4_extension_scaffold)
- Actual npm publishing
- Post-init project customization

## Acceptance Criteria

- [ ] AC6: `npx @workpack/protocol init` creates a `workpacks/` directory structure in the current project.
- [ ] AC7: Init command copies schemas, templates, tool scripts, and creates starter `workpack.config.json`.
- [ ] AC8: Init command supports `--dir <path>` flag for custom workpack directory.
- [ ] AC9: Init command supports `--protocol-version <version>` flag.

## Verification

```bash
# Run init in a temp directory
mkdir /tmp/test-init && cd /tmp/test-init
node ../../packages/protocol/bin/init.js

# Check files were created
ls workpacks/
ls workpacks/_template/
cat workpacks/workpack.config.json

# Test with custom dir
node ../../packages/protocol/bin/init.js --dir custom-wp
ls custom-wp/

# Test with version flag
node ../../packages/protocol/bin/init.js --dir versioned-wp --protocol-version 3.0.0
cat versioned-wp/workpack.config.json

# Integration test
node packages/protocol/tests/test-init.js
```

## Handoff Output (JSON)

Write `outputs/A3_init_command.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "04_workpack-protocol_npm-distribution",
  "prompt": "A3_init_command",
  "component": "init-cli",
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
    "files_created": ["packages/protocol/bin/init.js", "packages/protocol/tests/test-init.js"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "node packages/protocol/tests/test-init.js", "result": "pass", "notes": "" },
      { "cmd": "node packages/protocol/bin/init.js --help", "result": "pass", "notes": "" }
    ],
    "regression_added": true,
    "regression_notes": "Integration test for init command"
  },
  "handoff": {
    "summary": "Init CLI command implemented with --dir and --protocol-version flags.",
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

- [ ] `packages/protocol/bin/init.js` created
- [ ] `--dir` flag working
- [ ] `--protocol-version` flag working
- [ ] `--help` output
- [ ] Integration test created and passing
- [ ] `outputs/A3_init_command.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
