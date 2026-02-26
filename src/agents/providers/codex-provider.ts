import type {
  AgentCapability,
  AgentProvider,
  PromptDispatchContext,
  PromptResult,
} from "../types";

export interface CodexProviderConfig {
  /**
   * OpenAI API base URL (for example: https://api.openai.com/v1).
   * This can also be an OpenAI-compatible endpoint.
   */
  baseUrl: string;
  /** Model identifier (for example: gpt-4o). */
  model: string;
  /** Maximum number of tokens to generate. */
  maxResponseTokens: number;
  /** Request timeout in milliseconds (default: 120_000). */
  requestTimeoutMs?: number;
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
  };
}

const DEFAULT_TIMEOUT_MS = 120_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorString(status: number, headers: Headers, payload: unknown): string {
  const apiErrorMessage = extractApiErrorMessage(payload);

  if (status === 401) {
    const reason = apiErrorMessage ?? "invalid or missing API key.";
    return `Authentication failed (401): ${reason}`;
  }

  if (status === 429) {
    const retryAfter = parseRetryAfterSeconds(headers.get("retry-after"));
    const retryHint =
      retryAfter !== undefined ? ` Retry after approximately ${retryAfter}s.` : "";
    const reason = apiErrorMessage ?? "rate limit exceeded.";
    return `Rate limited (429): ${reason}${retryHint}`;
  }

  if (status >= 500 && status <= 599) {
    const reason = apiErrorMessage ?? "upstream service is temporarily unavailable.";
    return `Transient upstream error (${status}): ${reason}`;
  }

  if (apiErrorMessage) {
    return `Request failed (${status}): ${apiErrorMessage}`;
  }

  return `Request failed with status ${status}.`;
}

function extractApiErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const errorValue = payload.error;
  if (isRecord(errorValue) && typeof errorValue.message === "string") {
    return errorValue.message.trim();
  }

  return undefined;
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }

  const parsedDate = Date.parse(value);
  if (Number.isNaN(parsedDate)) {
    return undefined;
  }

  const secondsUntilRetry = Math.ceil((parsedDate - Date.now()) / 1000);
  return Math.max(secondsUntilRetry, 0);
}

function normalizeCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");

  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, "");
    url.pathname = `${pathname}/chat/completions`;
    return url.toString();
  } catch {
    return `${trimmed}/chat/completions`;
  }
}

function extractMessageContent(payload: unknown): string | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    return undefined;
  }

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return undefined;
  }

  const content = firstChoice.message.content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (!Array.isArray(content)) {
    return undefined;
  }

  const joined = content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (isRecord(part) && typeof part.text === "string") {
        return part.text;
      }

      return "";
    })
    .join("\n")
    .trim();

  return joined.length > 0 ? joined : undefined;
}

function parsePromptOutput(rawContent: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawContent) as unknown;
    if (isRecord(parsed)) {
      return parsed;
    }

    return { raw: parsed };
  } catch {
    return { raw: rawContent };
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export class CodexProvider implements AgentProvider {
  readonly id = "codex";
  readonly displayName = "OpenAI Codex";

  private readonly config: CodexProviderConfig;
  private readonly apiKeyResolver: () => Promise<string | undefined>;
  private readonly activeControllers = new Set<AbortController>();

  constructor(config: CodexProviderConfig, apiKeyResolver: () => Promise<string | undefined>) {
    this.config = config;
    this.apiKeyResolver = apiKeyResolver;
  }

  capabilities(): AgentCapability {
    return {
      multiFileEdit: true,
      commandExecution: true,
      longRunning: true,
      maxPromptTokens: 128_000,
      tags: ["openai", "codex", "completion"],
    };
  }

  async dispatch(
    promptContent: string,
    _context: PromptDispatchContext
  ): Promise<PromptResult> {
    const startTime = Date.now();

    const apiKey = await this.apiKeyResolver();
    if (!apiKey?.trim()) {
      return {
        success: false,
        summary: "Codex request failed.",
        error: "Missing API key for Codex provider.",
        durationMs: Date.now() - startTime,
      };
    }

    const controller = new AbortController();
    this.activeControllers.add(controller);

    const timeoutMs = this.config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(normalizeCompletionsUrl(this.config.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: "user", content: promptContent }],
          max_tokens: this.config.maxResponseTokens,
        }),
        signal: controller.signal,
      });

      const rawBody = await response.text();
      let parsedBody: unknown;
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody) as unknown;
        } catch {
          parsedBody = undefined;
        }
      }

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          summary: "Codex request failed.",
          error: toErrorString(response.status, response.headers, parsedBody),
          durationMs,
        };
      }

      const content = extractMessageContent(parsedBody as OpenAiChatCompletionResponse);
      if (!content) {
        return {
          success: false,
          summary: "Codex response could not be parsed.",
          error: "The provider response did not include message content.",
          durationMs,
        };
      }

      return {
        success: true,
        summary: "Codex prompt completed successfully.",
        output: parsePromptOutput(content),
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (isAbortError(error)) {
        return {
          success: false,
          summary: "Codex request timed out.",
          error: `Request timed out after ${timeoutMs}ms.`,
          durationMs,
        };
      }

      return {
        success: false,
        summary: "Codex request failed.",
        error: error instanceof Error ? error.message : "Unknown network error.",
        durationMs,
      };
    } finally {
      clearTimeout(timeoutHandle);
      this.activeControllers.delete(controller);
    }
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = await this.apiKeyResolver();
    return Boolean(apiKey?.trim());
  }

  dispose(): void {
    for (const controller of this.activeControllers) {
      controller.abort();
    }
    this.activeControllers.clear();
  }
}
