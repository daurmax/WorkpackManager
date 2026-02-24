---
depends_on: [A1_config_schema]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A2_config_tool_integration

> Implement `workpack.config.json` loading and integrate project-level settings into all Python tooling scripts.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/00_request.md`
2. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/01_plan.md`
3. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/workpack.state.json`
5. `workpacks/WORKPACK_CONFIG_SCHEMA.json`
6. `workpacks/tools/workpack_lint.py`
7. `workpacks/tools/workpack_scaffold.py`
8. `workpacks/tools/validate_workpack_files.py`
9. `workpacks/tools/validate_templates.py`
10. `workpacks/tools/tests/test_workpack_lint.py`
11. `workpacks/tools/tests/test_validate_workpack_files.py`

## Context

Workpack: `workpack-protocol/02_workpack-protocol_project-config`

## Delivery Mode

- PR-based

## Objective

Introduce a shared config-loading path for tooling so repositories can optionally define `workpack.config.json` at project root while preserving current behavior when config is absent.

This prompt owns integration of config into tool runtime behavior (`workpackDir`, `strictMode`, `protocolVersion`, `verifyCommands` visibility, and config detection messaging).

## Reference Points

- AC8-AC11 and AC14 from `00_request.md` are implemented here.
- Discovery mechanics already exist in:
  - `workpack_lint.py`: `get_workpacks_dir()`, `discover_workpack_paths()`, `main()`
  - `validate_workpack_files.py`: `get_workpacks_dir()`, `discover_workpack_paths()`, `main()`
- Scaffolding path assumptions exist in `workpack_scaffold.py` via `_workpacks_dir()` and `main()`.
- Template/schema validation entry point is `validate_templates.py`.

## Implementation Requirements

1. Create a shared config utility module in `workpacks/tools/` (for example `workpack_config.py`) and use it across all four tools.
2. Implement robust optional config loading:
   - Search for `workpack.config.json` from current working directory upward to repo/workspace root.
   - If found, load and validate against `WORKPACK_CONFIG_SCHEMA.json`.
   - If not found, apply defaults equivalent to current behavior.
3. Ensure explicit, user-visible messages:
   - Config found: include resolved config path and selected `workpackDir`.
   - Config missing: explicit fallback-to-default message.
4. Integrate config behavior per tool:
   - `workpack_lint.py`:
     - resolve workpacks root from `workpackDir`;
     - apply `strictMode` as default when `--strict` flag is not explicitly set;
     - enforce/interpret `protocolVersion` policy for lint execution.
   - `workpack_scaffold.py`:
     - resolve template/workpack base directory from configured `workpackDir`.
   - `validate_workpack_files.py`:
     - resolve discovery base from configured `workpackDir`;
     - align strict/default behavior with config.
   - `validate_templates.py`:
     - validate `WORKPACK_CONFIG_SCHEMA.json`;
     - if a repository-level `workpack.config.json` exists, validate it against schema.
5. Keep backward compatibility and no new dependencies:
   - Existing CLI usage must keep working without config.
   - Do not introduce new third-party packages.
6. Add/extend unit tests for:
   - config discovered vs config absent fallback;
   - configured `workpackDir` path resolution;
   - strict mode default behavior from config;
   - config detection messaging in command output.

## Scope

### In Scope
- Shared config loader implementation in tooling
- Integration into all required Python scripts
- Backward-compatible defaults and diagnostics
- Unit tests for config loading and runtime behavior

### Out of Scope
- Multi-root `discovery.roots` + `discovery.exclude` scanning behavior (A3)
- Non-Python tooling integration
- Editor/extension UX for config authoring

## Acceptance Criteria

- [ ] AC8: `workpack_lint.py` reads config and uses `workpackDir` for discovery.
- [ ] AC9: `workpack_lint.py` respects `strictMode` and `protocolVersion`.
- [ ] AC10: `workpack_scaffold.py` uses configured `workpackDir`.
- [ ] AC11: `validate_workpack_files.py` uses config settings.
- [ ] AC14: Tools clearly indicate config found vs defaults.
- [ ] AC15 (partial): Unit tests cover config loading and default fallback.

## Verification

```bash
python workpacks/tools/validate_templates.py
python workpacks/tools/workpack_lint.py --help
python workpacks/tools/workpack_scaffold.py --help
python workpacks/tools/validate_workpack_files.py --help
python -m pytest workpacks/tools/tests/ -k "config or strict or fallback" -v
```

## Handoff Output (JSON)

Write `outputs/A2_config_tool_integration.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "02_workpack-protocol_project-config",
  "prompt": "A2_config_tool_integration",
  "component": "tooling",
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
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [],
    "regression_added": false,
    "regression_notes": ""
  },
  "handoff": {
    "summary": "Config loader integrated into Python tools with backward-compatible defaults.",
    "next_steps": [
      "Proceed to A3_multi_workspace_discovery"
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

- [ ] Shared tool config utility module implemented and reused
- [ ] `workpack_lint.py`, `workpack_scaffold.py`, `validate_workpack_files.py`, `validate_templates.py` integrated with config
- [ ] Unit tests updated for config loading/integration behavior
- [ ] `outputs/A2_config_tool_integration.json` written
