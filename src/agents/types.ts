/**
 * Unique identifier for an agent provider (e.g., "copilot", "codex", "claude").
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

export interface PromptDispatchContext {
  workpackId: string;
  promptStem: string;
  repos: string[];
  dependencyOutputs?: Record<string, unknown>;
  abortSignal?: AbortSignal;
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
