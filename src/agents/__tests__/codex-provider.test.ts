import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";
import { CodexProvider, type CodexProviderConfig } from "../providers/codex-provider";
import type { PromptDispatchContext } from "../types";

const defaultConfig: CodexProviderConfig = {
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
  maxResponseTokens: 256,
  requestTimeoutMs: 120_000,
};

const defaultContext: PromptDispatchContext = {
  workpackId: "wp-01",
  promptStem: "A3_codex_provider",
  repos: ["WorkpackManager"],
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createProvider(
  key: string | undefined = "test-api-key",
  configOverrides: Partial<CodexProviderConfig> = {}
): CodexProvider {
  return new CodexProvider(
    {
      ...defaultConfig,
      ...configOverrides,
    },
    async () => key
  );
}

describe("codex provider", () => {
  it("dispatches prompt and returns parsed JSON output", async () => {
    globalThis.fetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) => {
      assert.equal(String(input), "https://api.openai.com/v1/chat/completions");
      assert.equal(init?.method, "POST");
      assert.equal(init?.headers && (init.headers as Record<string, string>).Authorization, "Bearer test-api-key");

      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "gpt-4o");
      assert.equal(body.max_tokens, 256);
      assert.equal(body.messages[0].role, "user");
      assert.equal(body.messages[0].content, "Implement A3");

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"status\":\"ok\",\"provider\":\"codex\"}",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }) as typeof fetch;

    const provider = createProvider();
    const result = await provider.dispatch("Implement A3", defaultContext);

    assert.equal(result.success, true);
    assert.equal(result.summary, "Codex prompt completed successfully.");
    assert.deepEqual(result.output, {
      status: "ok",
      provider: "codex",
    });
    assert.equal(typeof result.durationMs, "number");
  });

  it("isAvailable returns false when API key is missing", async () => {
    const provider = createProvider("");
    const available = await provider.isAvailable();
    assert.equal(available, false);
  });

  it("classifies 401 responses as authentication failures", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Invalid authentication credentials",
          },
        }),
        { status: 401 }
      )) as typeof fetch;

    const provider = createProvider();
    const result = await provider.dispatch("prompt", defaultContext);

    assert.equal(result.success, false);
    assert.match(String(result.error), /Authentication failed \(401\)/);
  });

  it("classifies 429 responses and includes retry-after hint", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Too many requests",
          },
        }),
        {
          status: 429,
          headers: {
            "retry-after": "12",
          },
        }
      )) as typeof fetch;

    const provider = createProvider();
    const result = await provider.dispatch("prompt", defaultContext);

    assert.equal(result.success, false);
    assert.match(String(result.error), /Rate limited \(429\)/);
    assert.match(String(result.error), /12s/);
  });

  it("classifies 500 responses as transient upstream errors", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Service unavailable",
          },
        }),
        { status: 500 }
      )) as typeof fetch;

    const provider = createProvider();
    const result = await provider.dispatch("prompt", defaultContext);

    assert.equal(result.success, false);
    assert.match(String(result.error), /Transient upstream error \(500\)/);
  });

  it("supports custom OpenAI-compatible baseUrl values", async () => {
    let requestedUrl = "";

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "{\"ok\":true}" } }],
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const provider = createProvider("test-api-key", {
      baseUrl:
        "https://example.openai.azure.com/openai/deployments/workpack?api-version=2024-10-21",
    });

    const result = await provider.dispatch("prompt", defaultContext);

    assert.equal(result.success, true);
    assert.equal(
      requestedUrl,
      "https://example.openai.azure.com/openai/deployments/workpack/chat/completions?api-version=2024-10-21"
    );
  });

  it("returns timeout errors when the request aborts", async () => {
    globalThis.fetch = ((
      _: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        assert.ok(signal, "AbortSignal should be provided to fetch");

        signal.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted.");
          abortError.name = "AbortError";
          reject(abortError);
        });
      })) as typeof fetch;

    const provider = createProvider("test-api-key", { requestTimeoutMs: 25 });
    const result = await provider.dispatch("prompt", defaultContext);

    assert.equal(result.success, false);
    assert.equal(result.summary, "Codex request timed out.");
    assert.match(String(result.error), /25ms/);
  });

  it("exposes expected capabilities", () => {
    const provider = createProvider();
    assert.deepEqual(provider.capabilities(), {
      multiFileEdit: true,
      commandExecution: true,
      longRunning: true,
      maxPromptTokens: 128_000,
      tags: ["openai", "codex", "completion"],
    });
  });
});
