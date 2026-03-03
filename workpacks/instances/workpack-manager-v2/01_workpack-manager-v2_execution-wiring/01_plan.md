# Plan

## Summary

Wire the existing ExecutionOrchestrator to the executePrompt and executeAll VS Code commands. Add progress reporting with cancellation, OutputChannel logging, configurable CopilotProvider maxPromptTokens, and an error boundary for WorkpackDetailPanel. This transforms the extension from a read-only viewer into a functional agent dispatch tool.

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Create feature branch, verify build and tests pass | A0_bootstrap | - | XS |
| 2 | Wire executePrompt command to ExecutionOrchestrator single-prompt dispatch | A1_wire_execute_prompt | 1 | M |
| 3 | Wire executeAll command to ExecutionOrchestrator batch dispatch with progress | A2_wire_execute_all | 2 | M |
| 4 | Make CopilotProvider maxPromptTokens configurable via VS Code settings | A3_provider_configuration | 1 | S |
| 5 | Add error boundary to WorkpackDetailPanel for malformed data | A4_webview_error_boundary | 1 | S |
| 6 | Verification gate: all commands functional, tests pass, no regressions | V1_integration_meta | 2, 3, 4, 5 | M |
| 7 | Post-merge retrospective | R1_retrospective | 6 | S |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h, XL >8h.

## DAG Dependencies

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_wire_execute_prompt | [A0_bootstrap] | [WorkpackManager] |
| A2_wire_execute_all | [A1_wire_execute_prompt] | [WorkpackManager] |
| A3_provider_configuration | [A0_bootstrap] | [WorkpackManager] |
| A4_webview_error_boundary | [A0_bootstrap] | [WorkpackManager] |
| V1_integration_meta | [A1_wire_execute_prompt, A2_wire_execute_all, A3_provider_configuration, A4_webview_error_boundary] | [WorkpackManager] |
| R1_retrospective | [V1_integration_meta] | [WorkpackManager] |

## Cross-Workpack References

requires_workpack: []

Depends implicitly on `03_workpack-manager_agent-integration` and `03_workpack-manager_extension-ux` (both complete/review). No formal cross-workpack dependency needed since their code is already merged to master.

## Parallelization Map

```
Phase 0 (sequential):  A0_bootstrap
Phase 1 (sequential):  A1_wire_execute_prompt
Phase 2 (parallel):    A2_wire_execute_all, A3_provider_configuration, A4_webview_error_boundary
Phase 3 (sequential):  V1_integration_meta (V1 gate)
Phase 4 (conditional): B-series → V2 (V-loop)
Phase 5 (post-merge):  R1_retrospective
```

### B-series DAG (post-verification)

Populate this section only if V1 generates B-series bug-fix prompts.

## Branch Strategy

| Component | Branch Name | Base Branch | PR Target |
|-----------|-------------|-------------|-----------|
| Feature | feature/execution-wiring | master | master |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ExecutionOrchestrator API doesn't match command context shape | Low | Medium | A1 maps TreeItem context to orchestrator input; adapter pattern if needed |
| CopilotProvider language model API unavailable in test environment | Medium | Low | Mock vscode.lm in tests; test configuration reading separately |
| Cancellation race conditions during batch execution | Medium | Medium | Use AbortController with proper cleanup; test timeout scenarios |

## Security and Tool Safety

- No secrets in prompts or outputs.
- API keys for CodexProvider resolved at runtime via environment variables, never stored.
- Limit writes to repository workspace only.

## Handoff Outputs Plan

- Each completed prompt writes `outputs/<PROMPT>.json`.
- Schema: `workpacks/WORKPACK_OUTPUT_SCHEMA.json`.
- Output JSON MUST include `repos`, `execution`, and `change_details`.
- V1 validates all outputs before merge.
- `workpack.state.json` is updated after each prompt completion.
