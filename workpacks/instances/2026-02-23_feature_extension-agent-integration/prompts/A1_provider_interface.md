---
prompt_id: A1_provider_interface
workpack: 2026-02-23_feature_extension-agent-integration
agent_role: Provider interface and registry architect
depends_on:
  - A0_bootstrap
repos:
  - WorkpackManager
estimated_effort: M
---

# A1 – AgentProvider Interface, Capability Model, and Provider Registry

## Objective

Design and implement the core abstractions for the agent integration layer: the `AgentProvider` interface, the `AgentCapability` model, and the `ProviderRegistry` that manages provider lifecycle.

## Deliverables

### 1. AgentProvider Interface (`src/agents/types.ts`)

```typescript
/**
 * Unique identifier for an agent provider (e.g., 'copilot', 'codex', 'claude').
 */
export type ProviderId = string;

/**
 * What a provider can do.
 */
export interface AgentCapability {
  /** Can this provider handle multi-file edits? */
  multiFileEdit: boolean;
  /** Can this provider execute shell commands? */
  commandExecution: boolean;
  /** Can this provider handle long-running prompts (>5 min)? */
  longRunning: boolean;
  /** Maximum prompt length in tokens (approximate). */
  maxPromptTokens: number;
  /** Free-form capability tags for extensibility. */
  tags: string[];
}

/**
 * Result of dispatching a prompt to an agent.
 */
export interface PromptResult {
  success: boolean;
  /** Structured output (if any). */
  output?: Record<string, unknown>;
  /** Human-readable summary. */
  summary: string;
  /** Error message if success is false. */
  error?: string;
  /** Execution duration in milliseconds. */
  durationMs?: number;
}

/**
 * The core abstraction that every agent provider must implement.
 * Provider implementations must NOT depend on VS Code API types
 * in the interface signature (only in their internal implementation).
 */
export interface AgentProvider {
  /** Unique provider identifier. */
  readonly id: ProviderId;
  /** Human-readable name. */
  readonly displayName: string;
  /** Provider capability descriptor. */
  capabilities(): AgentCapability;
  /**
   * Dispatch a prompt to the agent.
   * @param promptContent - The prompt text to send.
   * @param context - Additional context (workpack ID, prompt stem, etc.).
   * @returns A promise resolving to the prompt result.
   */
  dispatch(promptContent: string, context: PromptDispatchContext): Promise<PromptResult>;
  /**
   * Check if the provider is available and configured.
   * @returns true if the provider can accept prompts.
   */
  isAvailable(): Promise<boolean>;
  /**
   * Dispose resources held by this provider.
   */
  dispose(): void;
}

export interface PromptDispatchContext {
  workpackId: string;
  promptStem: string;
  repos: string[];
  dependencyOutputs?: Record<string, unknown>;
}
```

### 2. ProviderRegistry (`src/agents/registry.ts`)

Requirements:
- Register providers by `ProviderId`.
- Prevent duplicate registration (throw if ID exists).
- Discover providers by ID or by required capability.
- List all registered providers.
- Deregister providers (for testing/disposal).
- Emit events on registration/deregistration.

```typescript
export class ProviderRegistry {
  private readonly providers = new Map<ProviderId, AgentProvider>();

  register(provider: AgentProvider): void { /* ... */ }
  deregister(id: ProviderId): boolean { /* ... */ }
  get(id: ProviderId): AgentProvider | undefined { /* ... */ }
  listAll(): AgentProvider[] { /* ... */ }
  findByCapability(filter: Partial<AgentCapability>): AgentProvider[] { /* ... */ }
}
```

### 3. Unit Tests (`src/agents/__tests__/registry.test.ts`)

- Register a mock provider.
- Prevent duplicate registration.
- Discover by capability filter.
- Deregister and verify removal.
- `findByCapability` returns only matching providers.

## Constraints

- Interface types must not import from `vscode` namespace.
- `AgentCapability` must be extensible via `tags` without breaking the interface.
- All method signatures must be async-safe (return `Promise` where I/O is involved).

## Output

Write `outputs/A1_provider_interface.json`:

```json
{
  "workpack_id": "2026-02-23_feature_extension-agent-integration",
  "prompt_id": "A1_provider_interface",
  "status": "complete",
  "summary": "AgentProvider interface, AgentCapability, PromptResult, ProviderRegistry implemented with full unit tests.",
  "files_changed": [
    "src/agents/types.ts",
    "src/agents/registry.ts",
    "src/agents/__tests__/registry.test.ts"
  ]
}
```

## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Unit tests pass: `npm test -- --grep registry`.
- [ ] `AgentProvider` interface has no `vscode` import.
