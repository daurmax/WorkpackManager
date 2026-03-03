import * as vscode from "vscode";
import type {
  AgentCapability,
  AgentProvider,
  PromptDispatchContext,
  PromptResult,
} from "../types";

const DEFAULT_TIMEOUT_MS = 120_000;
const APPROX_CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_PROMPT_TOKENS = 8_192;

export interface CopilotProviderConfig {
  maxPromptTokens?: number;
}

interface ExtendedPromptDispatchContext extends PromptDispatchContext {
  timeoutMs?: number;
  cancellationToken?: vscode.CancellationToken;
  abortSignal?: AbortSignal;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error.";
}

export class CopilotProvider implements AgentProvider {
  readonly id = "copilot";
  readonly displayName = "GitHub Copilot";
  private readonly activeCancellationSources = new Set<vscode.CancellationTokenSource>();
  private readonly maxPromptTokens: number;

  constructor(config: CopilotProviderConfig = {}) {
    this.maxPromptTokens = this.resolveMaxPromptTokens(config.maxPromptTokens);
  }

  capabilities(): AgentCapability {
    return {
      multiFileEdit: false,
      commandExecution: false,
      longRunning: false,
      maxPromptTokens: this.maxPromptTokens,
      tags: ["chat", "inline", "language-model"],
    };
  }

  async dispatch(promptContent: string, context: PromptDispatchContext): Promise<PromptResult> {
    const startedAt = Date.now();
    const cancellationSource = new vscode.CancellationTokenSource();
    this.activeCancellationSources.add(cancellationSource);

    const extendedContext = context as ExtendedPromptDispatchContext;
    const cleanupExternalCancellation = this.linkExternalCancellation(
      extendedContext,
      cancellationSource
    );
    const timeoutMs = this.resolveTimeoutMs(extendedContext);
    const timeoutHandle = setTimeout(() => {
      cancellationSource.cancel();
    }, timeoutMs);

    try {
      const model = await this.selectModel();
      if (!model) {
        return {
          success: false,
          summary: "Copilot model is not available.",
          error: "No VS Code chat model is currently available.",
          durationMs: Date.now() - startedAt,
        };
      }

      const normalizedPrompt = await this.truncatePromptIfNeeded(
        promptContent,
        model,
        cancellationSource.token
      );
      const messages = [vscode.LanguageModelChatMessage.User(normalizedPrompt)];
      const response = await model.sendRequest(messages, undefined, cancellationSource.token);

      let responseText = "";
      for await (const fragment of response.text) {
        responseText += fragment;
      }

      if (cancellationSource.token.isCancellationRequested) {
        return {
          success: false,
          summary: "Copilot request was cancelled.",
          error: "Prompt dispatch was cancelled.",
          durationMs: Date.now() - startedAt,
        };
      }

      return {
        success: true,
        output: this.parseResponseOutput(responseText),
        summary: "Copilot prompt dispatched successfully.",
        durationMs: Date.now() - startedAt,
      };
    } catch (error: unknown) {
      const wasCancelled =
        cancellationSource.token.isCancellationRequested || this.isCancellationError(error);
      if (wasCancelled) {
        return {
          success: false,
          summary: "Copilot request was cancelled.",
          error: "Prompt dispatch was cancelled.",
          durationMs: Date.now() - startedAt,
        };
      }

      return {
        success: false,
        summary: "Copilot prompt dispatch failed.",
        error: toErrorMessage(error),
        durationMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timeoutHandle);
      cleanupExternalCancellation();
      cancellationSource.dispose();
      this.activeCancellationSources.delete(cancellationSource);
    }
  }

  async isAvailable(): Promise<boolean> {
    const model = await this.selectModel();
    return model !== undefined;
  }

  dispose(): void {
    for (const source of this.activeCancellationSources) {
      source.cancel();
      source.dispose();
    }

    this.activeCancellationSources.clear();
  }

  private async selectModel(): Promise<vscode.LanguageModelChat | undefined> {
    const copilotModels = await this.trySelectModels({ vendor: "copilot" });
    if (copilotModels.length > 0) {
      return copilotModels[0];
    }

    const fallbackModels = await this.trySelectModels();
    return fallbackModels[0];
  }

  private async trySelectModels(
    selector?: vscode.LanguageModelChatSelector
  ): Promise<vscode.LanguageModelChat[]> {
    try {
      return await vscode.lm.selectChatModels(selector);
    } catch {
      return [];
    }
  }

  private resolveTimeoutMs(context: ExtendedPromptDispatchContext): number {
    if (
      context.timeoutMs === undefined ||
      !Number.isFinite(context.timeoutMs) ||
      context.timeoutMs <= 0
    ) {
      return DEFAULT_TIMEOUT_MS;
    }

    return context.timeoutMs;
  }

  private linkExternalCancellation(
    context: ExtendedPromptDispatchContext,
    localSource: vscode.CancellationTokenSource
  ): () => void {
    const cleanups: Array<() => void> = [];

    const { cancellationToken } = context;
    if (cancellationToken) {
      if (cancellationToken.isCancellationRequested) {
        localSource.cancel();
      } else {
        const disposable = cancellationToken.onCancellationRequested(() => {
          localSource.cancel();
        });
        cleanups.push(() => {
          disposable.dispose();
        });
      }
    }

    const { abortSignal } = context;
    if (abortSignal) {
      const abortHandler = () => {
        localSource.cancel();
      };

      if (abortSignal.aborted) {
        localSource.cancel();
      } else {
        abortSignal.addEventListener("abort", abortHandler, { once: true });
        cleanups.push(() => {
          abortSignal.removeEventListener("abort", abortHandler);
        });
      }
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  private async truncatePromptIfNeeded(
    promptContent: string,
    model: vscode.LanguageModelChat,
    cancellationToken: vscode.CancellationToken
  ): Promise<string> {
    const maxPromptTokens = this.maxPromptTokens;

    try {
      const countedTokens = await model.countTokens(promptContent, cancellationToken);
      if (countedTokens <= maxPromptTokens) {
        return promptContent;
      }

      console.warn(
        `[CopilotProvider] Prompt exceeds model token budget (${countedTokens} > ${maxPromptTokens}). Truncating.`
      );

      const truncatedLength = Math.max(
        1,
        Math.floor((promptContent.length * maxPromptTokens) / countedTokens)
      );
      return promptContent.slice(0, truncatedLength);
    } catch {
      const estimatedTokens = Math.ceil(promptContent.length / APPROX_CHARS_PER_TOKEN);
      if (estimatedTokens <= maxPromptTokens) {
        return promptContent;
      }

      console.warn(
        `[CopilotProvider] Prompt exceeds estimated token budget (${estimatedTokens} > ${maxPromptTokens}). Truncating.`
      );

      const maxCharacters = maxPromptTokens * APPROX_CHARS_PER_TOKEN;
      return promptContent.slice(0, maxCharacters);
    }
  }

  private resolveMaxPromptTokens(value: number | undefined): number {
    if (value === undefined || !Number.isFinite(value) || value <= 0) {
      return DEFAULT_MAX_PROMPT_TOKENS;
    }

    return Math.floor(value);
  }

  private parseResponseOutput(responseText: string): Record<string, unknown> {
    const trimmed = responseText.trim();
    if (trimmed.length === 0) {
      return { raw: "" };
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }

      return {
        raw: trimmed,
        parsed,
      };
    } catch {
      return {
        raw: trimmed,
      };
    }
  }

  private isCancellationError(error: unknown): boolean {
    const message = toErrorMessage(error).toLowerCase();
    return message.includes("cancel");
  }
}

export const copilotProvider: AgentProvider = new CopilotProvider();
