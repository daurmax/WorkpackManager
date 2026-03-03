# Request

## Workpack Protocol Version

Workpack Protocol Version: 3.0.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `execution-wiring`

Wire the existing `ExecutionOrchestrator` (from `src/agents/orchestrator.ts`) to the `executePrompt` and `executeAll` VS Code commands, which are currently stubs displaying "Runtime execution wiring is pending". This is the critical missing piece that makes the extension actually functional for dispatching agent work.

Additionally:
- Make `CopilotProvider.maxPromptTokens` configurable via VS Code settings instead of the hardcoded `8192`.
- Add an error boundary to `WorkpackDetailPanel` so malformed workpack data doesn't produce broken HTML.

Context from analysis:
- `ExecutionOrchestrator` in `src/agents/orchestrator.ts` supports DAG validation, auto-assignment, batch dispatch with `maxParallel` concurrency, `timeoutMs` per prompt, `continueOnError` mode, and `AbortController` cancellation.
- `registerCommands()` in `src/commands/register-commands.ts` has placeholder implementations for `executePrompt` and `executeAll`.
- `CopilotProvider` in `src/agents/providers/copilot-provider.ts` hardcodes `maxPromptTokens: 8192`.
- `WorkpackDetailPanel` in `src/views/workpack-detail-panel.ts` renders HTML without error handling for malformed data.

Preferred Delivery Mode: `PR`
Target Base Branch: `master`

## Acceptance Criteria

- [ ] AC1: `workpackManager.executePrompt` command dispatches a single prompt via `ExecutionOrchestrator` and updates `workpack.state.json` on completion.
- [ ] AC2: `workpackManager.executeAll` command dispatches all ready prompts (DAG-resolved) via `ExecutionOrchestrator` with progress reporting.
- [ ] AC3: Execution output is captured in a VS Code OutputChannel with per-prompt log entries.
- [ ] AC4: Cancellation via `AbortController` is wired to a VS Code cancellation token (progress dialog cancel button).
- [ ] AC5: `CopilotProvider.maxPromptTokens` reads from `workpackManager.copilot.maxPromptTokens` setting with `8192` default.
- [ ] AC6: `WorkpackDetailPanel` renders a safe fallback UI when workpack data is malformed or missing.
- [ ] AC7: Existing tests continue to pass; new tests cover the wiring logic.
- [ ] AC8: Tree view refreshes automatically after prompt execution completes.

## Constraints

- Must use existing `ExecutionOrchestrator` API — no rewrite of the orchestration layer.
- Must handle the case where no provider is available (show informative error).
- Error boundary must not swallow errors silently — log them to the output channel.

## Acceptance Criteria → Verification Mapping

| AC ID | Acceptance Criterion | How to Verify |
|-------|----------------------|---------------|
| AC1 | executePrompt dispatches single prompt | Manual test: run command on a prompt tree item, verify state.json updated |
| AC2 | executeAll dispatches ready prompts | Manual test: verify batch execution with DAG ordering |
| AC3 | Output captured in OutputChannel | Observe output panel during execution |
| AC4 | Cancellation wired | Cancel mid-execution, verify abort propagated |
| AC5 | maxPromptTokens configurable | Set setting, verify CopilotProvider respects it |
| AC6 | Error boundary renders fallback | Open detail panel for malformed workpack |
| AC7 | Tests pass | `pnpm test` passes |
| AC8 | Tree refreshes after execution | Observe tree view status icons update |

## Delivery Mode

- [x] **PR-based** (default)
- [ ] **Direct push**

## Scope

### In Scope

- Wire `executePrompt` command to `ExecutionOrchestrator.executeOne()`
- Wire `executeAll` command to `ExecutionOrchestrator.executeAll()`
- Progress reporting with cancellation
- OutputChannel integration
- `CopilotProvider` maxPromptTokens configuration
- `WorkpackDetailPanel` error boundary
- Unit tests for wiring logic

### Out of Scope

- Rewrite of `ExecutionOrchestrator` internals
- New agent provider implementations
- Changes to the workpack protocol or schemas
- WebviewPanel redesign
