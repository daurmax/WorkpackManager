# Execution Plan

## Summary

Define a project-level configuration file (`workpack.config.json`) with JSON Schema, integrate it into all Python tools, and enhance workpack discovery to support multi-root workspaces and custom workpack directories.

requires_workpack: [01_workpack-protocol_prompt-lifecycle]

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Branch setup and baseline verification | A0_bootstrap | - | XS |
| 2 | Define WORKPACK_CONFIG_SCHEMA.json with all config fields | A1_config_schema | 1 | S |
| 3 | Implement config loader and integrate into all Python tools | A2_config_tool_integration | 2 | M |
| 4 | Enhanced multi-root workspace discovery with roots and exclude patterns | A3_multi_workspace_discovery | 3 | M |
| 5 | V1 integration gate and merge readiness review | V1_integration_meta | 4 | S |
| 6 | Post-merge retrospective | R1_retrospective | 5 | S |

## DAG Dependencies

| Prompt Stem | depends_on | repos |
|-------------|------------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_config_schema | [A0_bootstrap] | [WorkpackManager] |
| A2_config_tool_integration | [A1_config_schema] | [WorkpackManager] |
| A3_multi_workspace_discovery | [A2_config_tool_integration] | [WorkpackManager] |
| V1_integration_meta | [A3_multi_workspace_discovery] | [WorkpackManager] |
| R1_retrospective | [V1_integration_meta] | [WorkpackManager] |

## Parallelization Map

| Phase | Prompts | Mode |
|-------|---------|------|
| 1 | A0_bootstrap | Serial |
| 2 | A1_config_schema | Serial |
| 3 | A2_config_tool_integration | Serial |
| 4 | A3_multi_workspace_discovery | Serial |
| 4 | V1_integration_meta | Serial |
| 6 | R1_retrospective | Serial |

## Branch Strategy

- Work branch: `feature/project-config`
- Base branch: `main`
- Merge target: `main`
