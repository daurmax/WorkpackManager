import type {
  AgentCapability,
  AgentProvider,
  PromptDispatchContext,
  PromptResult,
} from "../types";

const codexCapabilities: AgentCapability = {
  multiFileEdit: true,
  commandExecution: true,
  longRunning: true,
  maxPromptTokens: 32_000,
  tags: ["openai", "codex"],
};

export const codexProvider: AgentProvider = {
  id: "codex",
  displayName: "OpenAI Codex",
  capabilities(): AgentCapability {
    return codexCapabilities;
  },
  async dispatch(
    _promptContent: string,
    _context: PromptDispatchContext
  ): Promise<PromptResult> {
    return {
      success: false,
      summary: "Codex provider dispatch is not implemented yet.",
      error: "Provider dispatch stub.",
    };
  },
  async isAvailable(): Promise<boolean> {
    return false;
  },
  dispose(): void {
    // No resources to dispose in bootstrap stub.
  },
};
