# Execution Plan

## Summary

Set up a monorepo structure for WorkpackManager and create the `@workpack/protocol` npm package. The package bundles JSON schemas, templates, agent documentation, and provides a CLI `init` command. Also scaffold the `packages/extension/` directory for future VS Code extension development.

requires_workpack: [03_workpack-protocol_agent-documentation, 03_workpack-protocol_human-documentation]

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Branch setup and current structure audit | A0_bootstrap | - | XS |
| 2 | Set up monorepo workspace configuration | A1_monorepo_structure | 1 | M |
| 3 | Create protocol npm package with assets and exports | A2_protocol_package | 2 | M |
| 4 | Implement init CLI command for project bootstrapping | A3_init_command | 3 | M |
| 5 | Scaffold extension package directory structure | A4_extension_scaffold | 2 | S |
| 6 | V1 gate and merge readiness review | V1_integration_meta | 4, 5 | S |
| 7 | Post-merge retrospective | R1_retrospective | 6 | S |

## DAG Dependencies

| Prompt Stem | depends_on | repos |
|-------------|------------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_monorepo_structure | [A0_bootstrap] | [WorkpackManager] |
| A2_protocol_package | [A1_monorepo_structure] | [WorkpackManager] |
| A3_init_command | [A2_protocol_package] | [WorkpackManager] |
| A4_extension_scaffold | [A1_monorepo_structure] | [WorkpackManager] |
| V1_integration_meta | [A3_init_command, A4_extension_scaffold] | [WorkpackManager] |
| R1_retrospective | [V1_integration_meta] | [WorkpackManager] |

## Parallelization Map

| Phase | Prompts | Mode |
|-------|---------|------|
| 1 | A0_bootstrap | Serial |
| 2 | A1_monorepo_structure | Serial |
| 3 | A2_protocol_package, A4_extension_scaffold | Parallel |
| 4 | A3_init_command | Serial |
| 5 | V1_integration_meta | Serial |
| 6 | R1_retrospective | Serial |

## Branch Strategy

- Work branch: `feature/npm-distribution`
- Base branch: `main`
- Merge target: `main`
