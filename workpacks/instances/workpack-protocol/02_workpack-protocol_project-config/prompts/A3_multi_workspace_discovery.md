---
depends_on: [A2_config_tool_integration]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A3_multi_workspace_discovery

> Implement config-driven multi-root discovery and exclude-pattern filtering across workpack discovery flows.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/00_request.md`
2. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/01_plan.md`
3. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/02_workpack-protocol_project-config/workpack.state.json`
5. `workpacks/WORKPACK_CONFIG_SCHEMA.json`
6. `workpacks/tools/workpack_lint.py`
7. `workpacks/tools/validate_workpack_files.py`
8. `workpacks/tools/workpack_scaffold.py`
9. `workpacks/tools/tests/test_workpack_lint.py`
10. `workpacks/tools/tests/test_validate_workpack_files.py`

## Context

Workpack: `workpack-protocol/02_workpack-protocol_project-config`

## Delivery Mode

- PR-based

## Objective

Extend discovery logic so tooling can scan additional roots declared in `workpack.config.json` (`discovery.roots`) while excluding configured paths (`discovery.exclude`) and preserving current default behavior.

This prompt is the dedicated implementation slice for multi-root discovery semantics and exclusion filtering.

## Reference Points

- AC12 and AC13 from `00_request.md` are owned by this prompt.
- Existing discovery entry points:
  - `workpack_lint.py`: `discover_workpack_paths(scan_targets)`
  - `validate_workpack_files.py`: `discover_workpack_paths(scan_targets)`
- Config contract for `discovery` is defined in `WORKPACK_CONFIG_SCHEMA.json` from A1.
- Config loading and default fallback from A2 must be reused (do not duplicate parser logic).

## Implementation Requirements

1. Build a normalized scan target set from config:
   - Default root based on `workpackDir` behavior from A2.
   - Additional roots from `discovery.roots`.
   - Resolve relative paths against repository/workspace root.
   - De-duplicate and keep deterministic scan order.
2. Implement exclude filtering using `discovery.exclude` glob patterns:
   - Apply excludes before registering discovered workpack paths.
   - Excludes must work for both directory segments and full relative paths.
   - Keep hidden/internal skip logic (`_` and `.` prefixed segments) compatible with current behavior.
3. Update discovery consumers:
   - `workpack_lint.py` and `validate_workpack_files.py` must both honor configured roots and exclude patterns.
   - Any helper introduced in A2 should be reused to avoid discovery drift.
4. Preserve backward compatibility:
   - No config file: same discovery behavior as before.
   - Invalid/missing roots: warn clearly but continue with remaining valid roots.
5. Add tests covering:
   - multi-root discovery across at least two separate roots;
   - include + exclude interactions;
   - fallback behavior with no `workpack.config.json`;
   - exclusion of paths that would otherwise match `00_request.md`.
6. Ensure command output makes discovery inputs visible (scan targets and applied excludes) to simplify debugging.

## Scope

### In Scope
- Multi-root discovery logic for Python tooling
- Configured exclusion pattern handling
- Unit tests for discovery roots/exclude combinations

### Out of Scope
- Config schema definition (A1)
- Base config loader integration (A2)
- Retrospective and merge gate prompts

## Acceptance Criteria

- [ ] AC12: Multi-root workspace discovery scans paths declared in `discovery.roots`.
- [ ] AC13: Discovery excludes paths matching `discovery.exclude` patterns.
- [ ] AC15 (partial): Unit tests cover discovery with config roots and exclude patterns.

## Verification

```bash
python workpacks/tools/workpack_lint.py --help
python workpacks/tools/validate_workpack_files.py --help
python -m pytest workpacks/tools/tests/ -k "discovery or roots or exclude" -v
python -m pytest workpacks/tools/tests/ -v
```

## Handoff Output (JSON)

Write `outputs/A3_multi_workspace_discovery.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "02_workpack-protocol_project-config",
  "prompt": "A3_multi_workspace_discovery",
  "component": "discovery",
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
    "summary": "Multi-root and exclude-aware discovery implemented and verified.",
    "next_steps": [
      "Proceed to V1_integration_meta"
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

- [ ] Multi-root and exclude filtering implemented in discovery paths
- [ ] Discovery behavior tests for roots/exclude added or updated
- [ ] `outputs/A3_multi_workspace_discovery.json` written
