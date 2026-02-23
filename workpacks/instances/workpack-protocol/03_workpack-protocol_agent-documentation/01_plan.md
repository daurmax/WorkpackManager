# Execution Plan

## Summary

Create agent-optimized protocol documentation: a compact rule set (`AGENT_RULES.md`), formal state machine diagrams (`AGENT_STATE_MACHINE.md`), and a Python tool that generates structured context JSON for agents to consume before executing prompts.

requires_workpack: [02_workpack-protocol_verification-hardening, 02_workpack-protocol_project-config]

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Branch setup and context baseline | A0_bootstrap | - | XS |
| 2 | Write AGENT_RULES.md with numbered invariant rules | A1_agent_rules | 1 | M |
| 3 | Write AGENT_STATE_MACHINE.md with state diagrams and decision tree | A2_agent_state_machine | 1 | M |
| 4 | Build agent_context.py tool for structured context generation | A3_agent_context_tool | 2 | S |
| 5 | V1 gate and merge readiness review | V1_integration_meta | 3, 4 | S |
| 6 | Post-merge retrospective | R1_retrospective | 5 | S |

## DAG Dependencies

| Prompt Stem | depends_on | repos |
|-------------|------------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_agent_rules | [A0_bootstrap] | [WorkpackManager] |
| A2_agent_state_machine | [A0_bootstrap] | [WorkpackManager] |
| A3_agent_context_tool | [A1_agent_rules] | [WorkpackManager] |
| V1_integration_meta | [A2_agent_state_machine, A3_agent_context_tool] | [WorkpackManager] |
| R1_retrospective | [V1_integration_meta] | [WorkpackManager] |

## Parallelization Map

| Phase | Prompts | Mode |
|-------|---------|------|
| 1 | A0_bootstrap | Serial |
| 2 | A1_agent_rules, A2_agent_state_machine | Parallel |
| 3 | A3_agent_context_tool | Serial |
| 4 | V1_integration_meta | Serial |
| 5 | R1_retrospective | Serial |

## Branch Strategy

- Work branch: `feature/agent-documentation`
- Base branch: `main`
- Merge target: `main`
