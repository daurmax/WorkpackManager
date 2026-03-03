---
depends_on: [A1_wire_execute_prompt]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A2_wire_execute_all

> Wire `workpackManager.executeAll` to orchestrated batch execution with DAG-aware dispatch, progress/cancellation, output logging, and tree refresh.

---

## READ FIRST

1. `workpacks/instances/workpack-manager-v2/01_workpack-manager-v2_execution-wiring/00_request.md`
2. `workpacks/instances/workpack-manager-v2/01_workpack-manager-v2_execution-wiring/01_plan.md`
3. `workpacks/instances/workpack-manager-v2/01_workpack-manager-v2_execution-wiring/workpack.meta.json`
4. `workpacks/instances/workpack-manager-v2/01_workpack-manager-v2_execution-wiring/workpack.state.json`

## Context

Workpack: `workpack-manager-v2/01_workpack-manager-v2_execution-wiring`

## Delivery Mode

- PR-based

## Objective

Replace the current `executeAll` placeholder command with production runtime wiring that executes a selected workpack through `ExecutionOrchestrator`, reports progress in VS Code, and persists/reflects state changes for all dispatched prompts.

## Reference Points

- `src/commands/register-commands.ts` (`WORKPACK_MANAGER_COMMANDS.executeAll`, `resolveWorkpackFolderPath`, command registration flow)
- `src/agents/orchestrator.ts` (`ExecutionOrchestrator`, `execute`, orchestrator options and cancellation behavior)
- `src/agents/assignment.ts` (`AssignmentModel`, `loadWorkpackState`, `saveWorkpackStateAtomic`)
- `src/parser/workpack-parser.ts` (`parseWorkpackMeta`, `parseWorkpackState`, `parseWorkpackInstance`)
- `src/commands/__tests__/commands.test.ts` (command wiring and behavior test coverage)

## Implementation Requirements

- Replace the `executeAll` stub message (`Runtime execution wiring is pending`) with real orchestration flow.
- Resolve the target workpack from tree node context first, with quick-pick fallback when command is run without a node.
- Require `providerRegistry` to be available and non-empty before execution; show an informative error and exit safely otherwise.
- Load workpack metadata/state and execute using existing `ExecutionOrchestrator` behavior (DAG validation, ready-prompt resolution, assignment/state persistence). Do not rewrite orchestrator internals.
- Wire command execution through `vscode.window.withProgress` (`cancellable: true`) and bridge cancellation token to an `AbortController` passed into orchestration.
- Add or reuse an execution `OutputChannel`; log run start, per-prompt outcomes (success/blocked/skipped), cancellation, and final summary.
- Ensure errors are surfaced to users via `showErrorMessage` and also written to the output channel.
- Refresh the tree provider after execution completes, fails, or is cancelled so prompt/workpack statuses update immediately.
- Preserve graceful behavior when there are no ready prompts (informational message, no crash).
- Add/update tests for the execute-all command path, including provider-missing guard and successful orchestration invocation.

## Scope

### In Scope
- `workpackManager.executeAll` runtime command wiring
- Batch orchestration dispatch integration via `ExecutionOrchestrator`
- Progress UI + cancellation propagation
- Output channel logging for batch execution
- Command-level tests covering execute-all flow

### Out of Scope
- `workpackManager.executePrompt` wiring changes (handled by `A1_wire_execute_prompt`)
- `CopilotProvider.maxPromptTokens` configuration (handled by `A3_provider_configuration`)
- `WorkpackDetailPanel` error boundary changes (handled by `A4_webview_error_boundary`)
- Orchestrator architecture rewrite

## Acceptance Criteria

- [ ] AC1: Running `workpackManager.executeAll` dispatches all DAG-ready prompts for the selected workpack via `ExecutionOrchestrator`.
- [ ] AC2: Execution progress is shown in a cancellable VS Code progress UI, and cancellation propagates through `AbortController`.
- [ ] AC3: Execution logs are emitted to an OutputChannel with per-prompt entries and final summary.
- [ ] AC4: Missing/empty provider registry is handled gracefully with an informative message and no crash.
- [ ] AC5: `workpack.state.json` reflects execution results and tree view refreshes automatically after completion.
- [ ] AC6: Tests are added/updated to cover execute-all wiring and core guard paths.

## Verification

```bash
npm run build
npm run test -- src/commands/__tests__/commands.test.ts
npm run test

# Manual verification
# 1) Run "Workpack: Execute All Ready Prompts" from a workpack node.
# 2) Observe progress UI and verify cancel button aborts in-flight execution.
# 3) Inspect output channel for batch start, per-prompt outcome logs, and final summary.
# 4) Confirm workpack.state.json prompt_status / execution_log updates and tree refresh.
```

## Deliverables

- [ ] `src/commands/register-commands.ts` updated with executeAll runtime wiring
- [ ] Supporting execution helpers/adapters updated only as needed (minimal surface change)
- [ ] `src/commands/__tests__/commands.test.ts` updated with executeAll coverage
- [ ] `outputs/A2_wire_execute_all.json` written
