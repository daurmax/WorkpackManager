---
prompt_id: A3_codex_provider
workpack: 2026-02-23_feature_extension-agent-integration
agent_role: Codex/OpenAI provider implementer
depends_on:
  - A1_provider_interface
repos:
  - WorkpackManager
estimated_effort: M
---

# A3 – CodexProvider Implementation

## Objective

Implement the `CodexProvider` class that adapts OpenAI's API (Codex-class models) to the `AgentProvider` interface defined in A1.

## Background

The Codex provider uses the OpenAI REST API (or compatible endpoints) to dispatch prompts. Credentials are stored securely using VS Code's `SecretStorage` API and configured via extension settings.

## Deliverables

### 1. CodexProvider (`src/agents/providers/codex-provider.ts`)

```typescript
import { AgentProvider, AgentCapability, PromptResult, PromptDispatchContext } from '../types';

export interface CodexProviderConfig {
  /** OpenAI API base URL (default: https://api.openai.com/v1). */
  baseUrl: string;
  /** Model identifier (e.g., 'gpt-4o', 'codex'). */
  model: string;
  /** Maximum tokens for response. */
  maxResponseTokens: number;
}

export class CodexProvider implements AgentProvider {
  readonly id = 'codex';
  readonly displayName = 'OpenAI Codex';
  private config: CodexProviderConfig;
  private apiKeyResolver: () => Promise<string | undefined>;

  constructor(config: CodexProviderConfig, apiKeyResolver: () => Promise<string | undefined>) {
    this.config = config;
    this.apiKeyResolver = apiKeyResolver;
  }

  capabilities(): AgentCapability {
    return {
      multiFileEdit: true,
      commandExecution: true,
      longRunning: true,
      maxPromptTokens: 128000,
      tags: ['openai', 'codex', 'completion'],
    };
  }

  async dispatch(promptContent: string, context: PromptDispatchContext): Promise<PromptResult> {
    // 1. Resolve API key from SecretStorage.
    // 2. Build HTTP request to baseUrl/chat/completions.
    // 3. Send request with promptContent as user message.
    // 4. Parse response JSON.
    // 5. Extract content from response choices.
    // 6. Return PromptResult.
    // Handle: missing API key, HTTP errors, rate limits, timeouts.
  }

  async isAvailable(): Promise<boolean> {
    // Return true if API key is configured and a test request succeeds.
    // Optionally: only check if key is non-empty (fast check).
  }

  dispose(): void {
    // Clean up HTTP connections if any.
  }
}
```

### 2. Implementation Requirements

| Concern | Approach |
|---------|----------|
| API key storage | Resolve via injected `apiKeyResolver` callback (backed by VS Code `SecretStorage`). Never store key in memory longer than needed. |
| HTTP client | Use Node.js `fetch` (available in VS Code 1.83+). No external HTTP dependencies. |
| Request format | OpenAI chat/completions format: `{ model, messages: [{ role: 'user', content }], max_tokens }`. |
| Response parsing | Extract `choices[0].message.content`. Attempt JSON parse. |
| Error handling | Classify errors: `401` → bad key, `429` → rate limited (include retry-after), `5xx` → transient. |
| Timeout | Configurable timeout (default 120s). Abort via `AbortController`. |
| Rate limiting | Respect `Retry-After` header. Expose retry info in `PromptResult.error`. |

### 3. Configuration (`package.json` contribution)

```json
{
  "workpackManager.codex.baseUrl": {
    "type": "string",
    "default": "https://api.openai.com/v1",
    "description": "OpenAI API base URL"
  },
  "workpackManager.codex.model": {
    "type": "string",
    "default": "gpt-4o",
    "description": "Model identifier"
  },
  "workpackManager.codex.maxResponseTokens": {
    "type": "number",
    "default": 4096,
    "description": "Maximum response tokens"
  }
}
```

### 4. Unit Tests (`src/agents/__tests__/codex-provider.test.ts`)

- Mock `fetch` to return a valid OpenAI response.
- Verify `dispatch()` returns expected `PromptResult`.
- Verify `isAvailable()` returns false when API key is missing.
- Verify error classification for 401, 429, 500 responses.
- Verify timeout handling via `AbortController`.
- Verify `capabilities()` returns expected values.

## Constraints

- No hardcoded API keys. Use injected resolver.
- No external HTTP dependencies (use native `fetch`).
- Provider must work with any OpenAI-compatible API (Azure OpenAI, local servers, etc.).

## Output

Write `outputs/A3_codex_provider.json`:

```json
{
  "workpack_id": "2026-02-23_feature_extension-agent-integration",
  "prompt_id": "A3_codex_provider",
  "status": "complete",
  "summary": "CodexProvider implemented with configurable endpoint, SecretStorage-backed auth, and error classification.",
  "files_changed": [
    "src/agents/providers/codex-provider.ts",
    "src/agents/__tests__/codex-provider.test.ts"
  ]
}
```

## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Unit tests pass (mocked fetch).
- [ ] API key is never logged or stored in plain text.
- [ ] Provider works with custom `baseUrl` (Azure OpenAI compatible).
