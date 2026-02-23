---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Monorepo Structure Agent Prompt

> Set up the monorepo workspace configuration with `packages/protocol/` and `packages/extension/` directories, root workspace config, and verify no existing paths break.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/00_request.md`
2. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/01_plan.md`
3. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/04_workpack-protocol_npm-distribution/workpack.state.json`
5. Current root directory structure (ls the repo root)
6. `workpacks/tools/` — existing Python tooling that must not break

## Context

Workpack: `workpack-protocol/04_workpack-protocol_npm-distribution`

## Delivery Mode

- PR-based

## Objective

Restructure the repository into a monorepo layout by creating the `packages/` directory with `protocol/` and `extension/` subdirectories, and configuring workspace tooling. This is the foundation for the npm package and VS Code extension. Critical constraint: all existing file paths (`workpacks/`, tools, instances) must continue to work unchanged.

## Reference Points

- Current repo root structure (README.md, workpacks/)
- `pnpm-workspace.yaml` or root `package.json` workspaces — npm/pnpm workspace standards
- `workpacks/tools/` — must remain functional at current paths

## Implementation Requirements

1. Create directory structure:
   ```
   packages/
     protocol/      # npm package (A2 will populate)
     extension/     # VS Code extension scaffold (A4 will populate)
   ```
2. Create root workspace configuration — choose ONE:
   - **Option A (pnpm)**: Create `pnpm-workspace.yaml` with `packages: ["packages/*"]`.
   - **Option B (npm)**: Create root `package.json` with `"workspaces": ["packages/*"]`.
   - Prefer pnpm workspaces if no root `package.json` exists yet.
3. Create root `package.json` (if not exists) with:
   - `"private": true`
   - `"name": "workpack-manager"`
   - `"workspaces"` or reference to `pnpm-workspace.yaml`
4. Verify existing paths:
   - `workpacks/` directory unchanged
   - `workpacks/tools/*.py` scripts still runnable
   - `workpacks/instances/` structure intact
   - All existing tests pass
5. Update `README.md` with a monorepo structure overview section (AC13).

## Scope

### In Scope
- `packages/protocol/` and `packages/extension/` directory creation (AC1)
- Root workspace configuration (AC2)
- README.md monorepo overview (AC13)
- Regression verification (AC12)

### Out of Scope
- npm package content (A2_protocol_package)
- Init CLI command (A3_init_command)
- Extension scaffold files (A4_extension_scaffold)
- Publishing workflows (later in A2/A3)

## Acceptance Criteria

- [ ] AC1: Monorepo root has `packages/protocol/` and `packages/extension/` directories.
- [ ] AC2: Root `package.json` (or `pnpm-workspace.yaml`) declares workspaces.
- [ ] AC12: All existing workpack instances, tests, and tools work without modification after restructure.
- [ ] AC13: README.md updated with monorepo structure overview and distribution instructions.

## Verification

```bash
# Directories exist
test -d packages/protocol && test -d packages/extension && echo "OK"

# Workspace config exists
test -f pnpm-workspace.yaml || (node -e "const p=require('./package.json'); console.log(p.workspaces)" 2>/dev/null) && echo "OK"

# Existing tools still work
python workpacks/tools/workpack_lint.py --help
python -m pytest workpacks/tools/tests/ -v
```

## Handoff Output (JSON)

Write `outputs/A1_monorepo_structure.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "04_workpack-protocol_npm-distribution",
  "prompt": "A1_monorepo_structure",
  "component": "monorepo",
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
    "files_modified": ["README.md"],
    "files_created": ["packages/protocol/.gitkeep", "packages/extension/.gitkeep", "pnpm-workspace.yaml", "package.json"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "test -d packages/protocol && test -d packages/extension && echo OK", "result": "pass", "notes": "" },
      { "cmd": "python -m pytest workpacks/tools/tests/ -v", "result": "pass", "notes": "No regressions" }
    ],
    "regression_added": false,
    "regression_notes": "Structural change, verified by existing tests"
  },
  "handoff": {
    "summary": "Monorepo structure created with packages/protocol/ and packages/extension/.",
    "next_steps": ["Proceed to A2_protocol_package and A4_extension_scaffold (parallel)"],
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

- [ ] `packages/protocol/` directory created
- [ ] `packages/extension/` directory created
- [ ] Root workspace configuration (pnpm-workspace.yaml or package.json workspaces)
- [ ] README.md updated with monorepo overview
- [ ] Existing tests still pass
- [ ] `outputs/A1_monorepo_structure.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
