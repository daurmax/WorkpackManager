---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A3_provider_configuration

> Make `CopilotProvider.maxPromptTokens` configurable via VS Code settings with safe defaults and regression test coverage.

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

Replace the hardcoded Copilot token budget (`8192`) with configuration-driven behavior sourced from `workpackManager.copilot.maxPromptTokens`, while preserving default behavior and keeping provider capability reporting/truncation logic consistent.

## Reference Points

- `src/agents/providers/copilot-provider.ts` (`capabilities()`, token truncation path, provider construction)
- `src/extension.ts` (`createProviderRegistry`, provider registration and settings read)
- `package.json` (`contributes.configuration.properties` for VS Code settings schema)
- `src/agents/__tests__/copilot-provider.test.ts` (provider capability and dispatch behavior tests)

## Implementation Requirements

- Add a new VS Code setting key `workpackManager.copilot.maxPromptTokens` in `package.json` with numeric type and default `8192`.
- Read `copilot.maxPromptTokens` from `vscode.workspace.getConfiguration("workpackManager")` during provider wiring.
- Pass the configured value into `CopilotProvider` through an explicit constructor/config parameter instead of relying on a module-level hardcoded constant.
- Normalize invalid values (missing, non-finite, or `<= 0`) back to `8192`.
- Ensure `capabilities().maxPromptTokens` reflects the resolved configured value and that prompt truncation uses that same value.
- Keep backwards-compatible behavior when no setting is provided.
- Add/update tests to cover default token limit behavior (`8192`), configured override behavior, and invalid value fallback behavior.
- Do not change unrelated provider behavior (model selection, cancellation semantics, dispatch output parsing).

## Scope

### In Scope
- Copilot max prompt token configuration plumbing
- VS Code settings schema update for Copilot token budget
- Copilot provider unit tests for configuration behavior

### Out of Scope
- `executePrompt` / `executeAll` command wiring (A1/A2)
- `CodexProvider` settings model
- Workpack detail panel error handling (A4)

## Acceptance Criteria

- [ ] AC1: `CopilotProvider` no longer hardcodes `maxPromptTokens` and can be configured from extension settings.
- [ ] AC2: `workpackManager.copilot.maxPromptTokens` is declared in `package.json` with default `8192`.
- [ ] AC3: Invalid setting values fall back to `8192` without throwing.
- [ ] AC4: `capabilities().maxPromptTokens` and truncation behavior both use the resolved configured value.
- [ ] AC5: Tests are added/updated to validate default, override, and fallback paths.

## Verification

```bash
npm run build
npm run test -- src/agents/__tests__/copilot-provider.test.ts
npm run test

# Manual verification
# 1) Set "workpackManager.copilot.maxPromptTokens" to a small value (for example 256).
# 2) Reload the extension host and run a Copilot-backed prompt dispatch.
# 3) Confirm provider capability display/logging reflects the configured token limit.
# 4) Set an invalid value (0 or negative) and confirm fallback to 8192 behavior.
```

## Deliverables

- [ ] `package.json` updated with `workpackManager.copilot.maxPromptTokens`
- [ ] `src/extension.ts` updated to read and pass Copilot token setting
- [ ] `src/agents/providers/copilot-provider.ts` updated for configuration-driven maxPromptTokens
- [ ] `src/agents/__tests__/copilot-provider.test.ts` updated with configuration coverage
- [ ] `outputs/A3_provider_configuration.json` written
