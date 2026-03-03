---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A1_wire_execute_prompt

> Wire `workpackManager.executePrompt` to real orchestrated single-prompt execution with logging, cancellation, and state/tree updates.

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

Replace the current `executePrompt` placeholder command with production wiring that dispatches one selected prompt through `ExecutionOrchestrator`, persists runtime state updates, and provides clear user feedback in VS Code.

## Reference Points

- `src/commands/register-commands.ts` (`WORKPACK_MANAGER_COMMANDS.executePrompt`, `resolvePromptTarget`, command registration flow)
- `src/agents/orchestrator.ts` (`ExecutionOrchestrator`, orchestrator options, cancellation and timeout behavior)
- `src/agents/assignment.ts` (`AssignmentModel`, `loadWorkpackState`, `saveWorkpackStateAtomic`)
- `src/parser/workpack-discoverer.ts` and `src/parser/workpack-parser.ts` (workpack instance/meta/state loading)
- `src/commands/__tests__/commands.test.ts` (command wiring test coverage)

## Implementation Requirements

- Replace the `executePrompt` stub message (`Runtime execution wiring is pending`) with runtime execution logic.
- Resolve target prompt context from tree node or quick-pick fallback and map it to workpack folder/meta/state paths.
- Require `providerRegistry` to exist; if missing or empty, show an informative error and exit safely.
- Use existing `ExecutionOrchestrator` behavior for DAG and state handling. If a single-prompt entrypoint is missing, add a minimal adapter (`executeOne` or equivalent) without rewriting orchestration internals.
- Dispatch only the selected prompt while preserving dependency/status safety checks.
- Create or reuse a dedicated `OutputChannel` for execution logs and include per-prompt start/end/error entries.
- Wrap execution in `vscode.window.withProgress` with `cancellable: true`, bridge cancellation to an `AbortController`, and pass the signal into orchestration.
- Refresh the tree view when execution finishes (success, failure, or cancellation).
- Ensure all thrown errors are surfaced to the user and also logged to the output channel.

## Scope

### In Scope
- `workpackManager.executePrompt` runtime wiring
- Single-prompt orchestration adapter usage
- Output channel logging for single-prompt execution
- Cancellation wiring from VS Code progress UI to orchestration
- Command-level tests for executePrompt behavior

### Out of Scope
- `workpackManager.executeAll` command wiring (handled by `A2_wire_execute_all`)
- `CopilotProvider.maxPromptTokens` settings work (handled by `A3_provider_configuration`)
- `WorkpackDetailPanel` error boundary (handled by `A4_webview_error_boundary`)
- Orchestrator architecture rewrite

## Acceptance Criteria

- [ ] AC1: Running `workpackManager.executePrompt` dispatches the selected prompt via `ExecutionOrchestrator` and updates `workpack.state.json`.
- [ ] AC2: Command execution writes per-prompt runtime logs to an OutputChannel.
- [ ] AC3: Progress UI is cancellable and cancellation propagates through `AbortController` to dispatch logic.
- [ ] AC4: Missing/invalid provider configuration shows an informative error and does not crash the extension.
- [ ] AC5: Tree view refreshes automatically after command completion.
- [ ] AC6: Tests are added/updated to cover the executePrompt wiring path.

## Verification

```bash
npm run build
npm run test -- src/commands/__tests__/commands.test.ts
npm run test

# Manual verification
# 1) Run "Workpack: Execute Prompt" from a prompt node.
# 2) Confirm output channel logs start/completion (or error/cancel).
# 3) Confirm workpack.state.json prompt_status and execution_log are updated.
# 4) Confirm tree view status icon/description refreshes after execution.
```

## Deliverables

- [ ] `src/commands/register-commands.ts` updated with executePrompt runtime wiring
- [ ] Supporting orchestration adapter updates (if required) implemented with minimal surface change
- [ ] `src/commands/__tests__/commands.test.ts` updated with executePrompt coverage
- [ ] `outputs/A1_wire_execute_prompt.json` written
