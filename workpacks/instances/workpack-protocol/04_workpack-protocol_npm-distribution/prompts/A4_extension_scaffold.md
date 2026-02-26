---
depends_on: [A1_monorepo_structure]
repos: [WorkpackManager]
---
# Extension Scaffold Agent Prompt

> Scaffold the `packages/extension/` directory with a VS Code extension skeleton: `package.json`, TypeScript activation entry point, and Python tool integration stub.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/00_request.md`
2. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/01_plan.md`
3. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/workpack.state.json`
5. `packages/extension/` — directory created by A1_monorepo_structure
6. VS Code extension API documentation (for `package.json` `contributes` structure)

## Context

Workpack: `workpack-protocol/04_workpack-protocol_npm-distribution`

## Delivery Mode

- PR-based

## Objective

Create a basic VS Code extension skeleton under `packages/extension/`. This is intentionally minimal — full extension development is handled by the `workpack-manager` group workpacks. The scaffold must:

1. Have a valid VS Code extension `package.json` with proper metadata.
2. Have a TypeScript activation entry point (`src/extension.ts`).
3. Include a stub for invoking Python tools from the extension.
4. Compile without errors.

## Reference Points

- VS Code extension manifest (`contributes`, `activationEvents`, `engines.vscode`)
- `workpacks/tools/` — Python tool scripts that the extension will eventually invoke
- `packages/extension/` — target directory

## Implementation Requirements

1. Create `packages/extension/package.json`:
   ```json
   {
     "name": "workpack-manager",
     "displayName": "Workpack Manager",
     "description": "VS Code extension for managing workpack protocol workpacks",
     "version": "0.0.1",
     "engines": { "vscode": "^1.85.0" },
     "categories": ["Other"],
     "activationEvents": [],
     "main": "./out/extension.js",
     "contributes": {},
     "scripts": {
       "compile": "tsc -p ./",
       "watch": "tsc -watch -p ./"
     },
     "devDependencies": {
       "@types/vscode": "^1.85.0",
       "typescript": "^5.3.0"
     }
   }
   ```
2. Create `packages/extension/tsconfig.json`:
   - Target: `ES2022`, module: `commonjs`, outDir: `./out`, rootDir: `./src`, strict mode enabled.
3. Create `packages/extension/src/extension.ts`:
   - `activate(context)` function that logs "Workpack Manager extension activated".
   - `deactivate()` function (empty).
   - Stub function `executePythonTool(toolName: string, args: string[])` that spawns a Python child process (using `child_process.spawn`). Implementation is a placeholder — just the function signature and a TODO comment.
4. Create `packages/extension/.vscodeignore` with standard ignores (`src/`, `node_modules/`, `.gitignore`, `tsconfig.json`).
5. Verify TypeScript compiles: `cd packages/extension && npx tsc --noEmit` (after installing devDependencies).

## Scope

### In Scope
- `packages/extension/package.json` (AC10)
- TypeScript activation entry point (AC11)
- Python tool integration stub (AC11)
- `tsconfig.json` and `.vscodeignore`

### Out of Scope
- Full extension functionality (workpack-manager group scope)
- UI contributions (commands, tree views, etc.)
- Publishing to VS Code Marketplace
- Testing framework setup

## Acceptance Criteria

- [ ] AC10: `packages/extension/package.json` exists with proper VS Code extension metadata.
- [ ] AC11: Extension scaffold has activation entry point and Python tool execution stub.
- [ ] AC12: All existing workpack instances, tests, and tools work without modification after restructure.

## Verification

```bash
# Package.json exists and is valid
node -e "const p=require('./packages/extension/package.json'); console.log(p.name, p.engines.vscode)"

# TypeScript source exists
test -f packages/extension/src/extension.ts && echo "OK"

# TypeScript compiles (after npm install)
cd packages/extension && npm install && npx tsc --noEmit

# Existing tests unaffected
python -m pytest workpacks/tools/tests/ -v
```

## Handoff Output (JSON)

Write `outputs/A4_extension_scaffold.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "04_workpack-protocol_npm-distribution",
  "prompt": "A4_extension_scaffold",
  "component": "vscode-extension",
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
      "packages/extension/package.json",
      "packages/extension/tsconfig.json",
      "packages/extension/src/extension.ts",
      "packages/extension/.vscodeignore"
    ],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "cd packages/extension && npx tsc --noEmit", "result": "pass", "notes": "TypeScript compiles" },
      { "cmd": "python -m pytest workpacks/tools/tests/ -v", "result": "pass", "notes": "No regressions" }
    ],
    "regression_added": false,
    "regression_notes": "Scaffold only, no functional code to test"
  },
  "handoff": {
    "summary": "VS Code extension scaffold created with TypeScript entry point and Python tool stub.",
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

- [ ] `packages/extension/package.json` created
- [ ] `packages/extension/tsconfig.json` created
- [ ] `packages/extension/src/extension.ts` created with activation + Python stub
- [ ] `packages/extension/.vscodeignore` created
- [ ] TypeScript compiles without errors
- [ ] `outputs/A4_extension_scaffold.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
