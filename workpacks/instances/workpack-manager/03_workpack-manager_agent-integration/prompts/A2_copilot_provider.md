---
prompt_id: A2_copilot_provider
workpack: 03_workpack-manager_agent-integration
agent_role: GitHub Copilot provider implementer
depends_on:
  - A1_provider_interface
repos:
  - WorkpackManager
estimated_effort: M
---

# A2 – CopilotProvider Implementation

## Objective

Implement the `CopilotProvider` class that adapts GitHub Copilot's VS Code language model API to the `AgentProvider` interface defined in A1.

## Background

VS Code exposes language model access through:
- `vscode.lm.selectChatModels()` — discover available models.
- `vscode.LanguageModelChat.sendRequest()` — dispatch a prompt.
- `vscode.LanguageModelChatMessage` — structured prompt messages.

The provider must wrap these APIs behind the `AgentProvider` interface so that upper layers never depend on `vscode` types directly.

## Deliverables

### 1. CopilotProvider (`src/agents/providers/copilot-provider.ts`)

```typescript
import { AgentProvider, AgentCapability, PromptResult, PromptDispatchContext } from '../types';

export class CopilotProvider implements AgentProvider {
  readonly id = 'copilot';
  readonly displayName = 'GitHub Copilot';

  capabilities(): AgentCapability {
    return {
      multiFileEdit: false,
      commandExecution: false,
      longRunning: false,
      maxPromptTokens: 8192,
      tags: ['chat', 'inline', 'language-model'],
    };
  }

  async dispatch(promptContent: string, context: PromptDispatchContext): Promise<PromptResult> {
    // 1. Select the best available chat model via vscode.lm.selectChatModels().
    // 2. Build LanguageModelChatMessage array from promptContent.
    // 3. Call model.sendRequest(messages).
    // 4. Accumulate response fragments.
    // 5. Parse structured output from response text.
    // 6. Return PromptResult with success/error.
    // Handle: model not available, cancellation, token limits.
  }

  async isAvailable(): Promise<boolean> {
    // Check if at least one chat model is available via selectChatModels.
    // Return false if the Copilot extension is not installed or model list is empty.
  }

  dispose(): void {
    // Clean up any active cancellation tokens.
  }
}
```

### 2. Implementation Requirements

| Concern | Approach |
|---------|----------|
| Model selection | Use `vscode.lm.selectChatModels({ vendor: 'copilot' })`. Fall back to any available model if vendor filter returns empty. |
| Cancellation | Create `CancellationTokenSource`. Cancel on timeout or user cancel. |
| Token limit | Truncate prompt if it exceeds `maxPromptTokens`. Log a warning. |
| Error handling | Catch API errors, return `PromptResult { success: false, error: message }`. |
| Response parsing | Attempt JSON parse of response text. If not JSON, wrap in `{ raw: text }`. |
| Streaming | Accumulate response stream into a single string before parsing. |

### 3. Unit Tests (`src/agents/__tests__/copilot-provider.test.ts`)

- Mock `vscode.lm.selectChatModels` to return a fake model.
- Verify `dispatch()` returns a valid `PromptResult` shape.
- Verify `isAvailable()` returns false when no models are available.
- Verify cancellation token is created and passed through.
- Verify `capabilities()` returns expected values.

## Constraints

- The `vscode` import is allowed ONLY inside `copilot-provider.ts` (not in `types.ts`).
- No hardcoded model names; discover dynamically.
- Must gracefully handle the case where the Copilot extension is not installed.

## Output

Write `outputs/A2_copilot_provider.json`:

```json
{
  "workpack_id": "03_workpack-manager_agent-integration",
  "prompt_id": "A2_copilot_provider",
  "status": "complete",
  "summary": "CopilotProvider implemented using vscode.lm API with full unit tests.",
  "files_changed": [
    "src/agents/providers/copilot-provider.ts",
    "src/agents/__tests__/copilot-provider.test.ts"
  ]
}
```

## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Unit tests pass (mocked vscode API).
- [ ] `isAvailable()` returns false when no models are found.
- [ ] `dispatch()` handles errors gracefully.
