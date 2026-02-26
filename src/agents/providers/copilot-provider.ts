import type {
  AgentCapability,
  AgentProvider,
  PromptDispatchContext,
  PromptResult,
} from "../types";

const copilotCapabilities: AgentCapability = {
  multiFileEdit: true,
  commandExecution: false,
  longRunning: false,
  maxPromptTokens: 16_000,
  tags: ["github", "copilot"],
};

export const copilotProvider: AgentProvider = {
  id: "copilot",
  displayName: "GitHub Copilot",
  capabilities(): AgentCapability {
    return copilotCapabilities;
  },
  async dispatch(
    _promptContent: string,
    _context: PromptDispatchContext
  ): Promise<PromptResult> {
    return {
      success: false,
      summary: "Copilot provider dispatch is not implemented yet.",
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
