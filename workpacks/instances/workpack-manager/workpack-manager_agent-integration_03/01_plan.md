# Plan

## Summary

This workpack builds the agent integration layer: a stable `AgentProvider` interface, a provider registry for dynamic registration, initial Copilot and Codex provider implementations, an assignment model that persists in `workpack.state.json`, and a DAG-aware execution orchestrator. The layer is designed to be extensible without modifying core extension code.

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Create feature branch and verify core architecture is available | A0_bootstrap | - | XS |
| 2 | Define AgentProvider interface, capability model, and provider registry | A1_provider_interface | 1 | M |
| 3 | Implement CopilotProvider using VS Code language model API | A2_copilot_provider | 2 | M |
| 4 | Implement CodexProvider using OpenAI API conventions | A3_codex_provider | 2 | M |
| 5 | Implement assignment model and DAG-aware execution orchestrator | A4_assignment_orchestrator | 2 | L |
| 6 | Run V1 verification gate | A5_integration_meta | 2, 3, 4, 5 | M |
| 7 | Post-merge retrospective | R1_retrospective | 6 and merge | S |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h.

## DAG Dependencies (v6)

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_provider_interface | [A0_bootstrap] | [WorkpackManager] |
| A2_copilot_provider | [A1_provider_interface] | [WorkpackManager] |
| A3_codex_provider | [A1_provider_interface] | [WorkpackManager] |
| A4_assignment_orchestrator | [A1_provider_interface] | [WorkpackManager] |
| A5_integration_meta | [A1_provider_interface, A2_copilot_provider, A3_codex_provider, A4_assignment_orchestrator] | [WorkpackManager] |
| R1_retrospective | [A5_integration_meta] | [WorkpackManager] |

## Cross-Workpack References (v6)

requires_workpack: [workpack-manager_core-architecture_02]

## Parallelization Map

```
Phase 0 (sequential):
  └── A0_bootstrap

Phase 1 (sequential):
  └── A1_provider_interface

Phase 2 (parallel):
  ├── A2_copilot_provider          ─┐
  ├── A3_codex_provider            ─┤
  └── A4_assignment_orchestrator   ─┘

Phase 3 (sequential — V1 gate):
  └── A5_integration_meta

Phase 4 (post-merge):
  └── R1_retrospective
```

## Branch Strategy

| Component | Branch Name | Base Branch | PR Target |
|-----------|-------------|-------------|-----------|
| Feature root | `feature/extension-agent-integration` | `main` | `main` |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| VS Code language model API changes or is restricted | Medium | High | Abstract behind the provider interface; feature-gate Copilot provider |
| Codex API deprecation or renaming | Medium | Medium | Use generic OpenAI client; provider is swappable |
| Orchestrator complexity with large DAGs | Low | Medium | Benchmark with synthetic DAGs; use simple topological dispatch |
| Agent execution failures leave orphaned state | Medium | Medium | Implement timeout and retry logic in orchestrator |

## Security and Tool Safety

- No API keys stored in code. Use VS Code SecretStorage API.
- No secrets in prompts, outputs, or workpack files.
- Provider implementations must sanitize prompt content before dispatch.

## Handoff Outputs Plan (Protocol v6)

- Each completed prompt writes `outputs/<PROMPT>.json`.
- A5 validates all outputs before merge.
- `workpack.state.json` updated after each prompt completion.
