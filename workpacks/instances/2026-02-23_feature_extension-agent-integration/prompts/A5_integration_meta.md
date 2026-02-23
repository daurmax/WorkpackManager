---
prompt_id: A5_integration_meta
workpack: 2026-02-23_feature_extension-agent-integration
agent_role: V1 verification gate
depends_on:
  - A1_provider_interface
  - A2_copilot_provider
  - A3_codex_provider
  - A4_assignment_orchestrator
repos:
  - WorkpackManager
estimated_effort: M
---

# A5 – V1 Verification Gate: Agent Integration Layer

## Objective

Run a comprehensive verification pass across all agent integration deliverables from A1–A4. Ensure the entire layer compiles, tests pass, integration points are sound, and extensibility is demonstrated.

## Verification Checklist

### 1. Compilation and Type Safety

```bash
npx tsc --noEmit
```

- [ ] 0 errors, 0 warnings in strict mode.
- [ ] No `any` types in public API surfaces.

### 2. Unit Tests

```bash
npm test -- --grep "agents"
```

- [ ] All provider registry tests pass.
- [ ] All Copilot provider tests pass (mocked).
- [ ] All Codex provider tests pass (mocked).
- [ ] All assignment model tests pass.
- [ ] All orchestrator tests pass.
- [ ] All DAG utility tests pass.

### 3. Interface Compliance

Verify `AgentProvider` interface:

- [ ] No `vscode` imports in `types.ts`.
- [ ] `dispatch()` returns `Promise<PromptResult>`.
- [ ] `isAvailable()` returns `Promise<boolean>`.
- [ ] `capabilities()` returns `AgentCapability`.
- [ ] `dispose()` exists.

### 4. Extensibility Test

Create a minimal `MockProvider` in tests that implements `AgentProvider`:

```typescript
class MockProvider implements AgentProvider {
  readonly id = 'mock';
  readonly displayName = 'Mock Agent';
  capabilities() { return { multiFileEdit: false, commandExecution: false, longRunning: false, maxPromptTokens: 1000, tags: ['test'] }; }
  async dispatch() { return { success: true, summary: 'Mock result' }; }
  async isAvailable() { return true; }
  dispose() {}
}
```

- [ ] `MockProvider` registers successfully without any core changes.
- [ ] Orchestrator dispatches to `MockProvider` correctly.

### 5. State Persistence

- [ ] Assignment writes to `workpack.state.json` are correct JSON.
- [ ] Assignment reads back correctly after write.
- [ ] `prompt_status` updates reflect execution results.

### 6. Security

- [ ] No API keys in source code.
- [ ] `CodexProvider` uses injected key resolver (not hardcoded).
- [ ] No secrets logged (check for console.log/console.error patterns).

### 7. API Surface Review

Check barrel export (`src/agents/index.ts`):

- [ ] Exports: `AgentProvider`, `AgentCapability`, `PromptResult`, `PromptDispatchContext`.
- [ ] Exports: `ProviderRegistry`.
- [ ] Exports: `CopilotProvider`, `CodexProvider`.
- [ ] Exports: `AssignmentModel`, `ExecutionOrchestrator`.
- [ ] No internal utilities leaked to public API.

## Acceptance Criteria Coverage

| AC | Status | Evidence |
|----|--------|----------|
| AC1: AgentProvider interface | ✅/❌ | `src/agents/types.ts` |
| AC2: CopilotProvider | ✅/❌ | `src/agents/providers/copilot-provider.ts` |
| AC3: CodexProvider | ✅/❌ | `src/agents/providers/codex-provider.ts` |
| AC4: Provider registry | ✅/❌ | `src/agents/registry.ts` + tests |
| AC5: Assignments persist | ✅/❌ | `src/agents/assignment.ts` + tests |
| AC6: DAG-aware dispatch | ✅/❌ | `src/agents/orchestrator.ts` + tests |
| AC7: Extensibility | ✅/❌ | MockProvider test |
| AC8: Capabilities queryable | ✅/❌ | `findByCapability()` + tests |
| AC9: Tests pass | ✅/❌ | `npm test` |

## Output

Write `outputs/A5_integration_meta.json`:

```json
{
  "workpack_id": "2026-02-23_feature_extension-agent-integration",
  "prompt_id": "A5_integration_meta",
  "status": "complete",
  "summary": "All 9 acceptance criteria verified. Build passes, tests pass, extensibility confirmed.",
  "files_changed": [],
  "verification_results": {
    "tsc_errors": 0,
    "test_pass_rate": "100%",
    "ac_coverage": "9/9"
  }
}
```

## Gate

- [ ] All ACs verified ✅.
- [ ] PR is ready for review.
- [ ] `99_status.md` updated with results.
