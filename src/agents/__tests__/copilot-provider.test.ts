import { strict as assert } from "node:assert";
import Module from "node:module";
import { describe, it } from "vitest";
import type { AgentProvider, PromptDispatchContext } from "../types";

type ModuleLoad = (request: string, parent: NodeModule | null, isMain: boolean) => unknown;

interface MockCancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

interface MockLanguageModel {
  countTokens(prompt: string, token: unknown): Promise<number>;
  sendRequest(
    messages: unknown[],
    options: unknown,
    token: unknown
  ): Promise<{ text: AsyncIterable<string> }>;
}

class MockCancellationTokenSource {
  private readonly listeners = new Set<() => void>();
  cancelCalled = false;
  disposeCalled = false;
  readonly token: MockCancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: (listener: () => void) => {
      this.listeners.add(listener);
      return {
        dispose: () => {
          this.listeners.delete(listener);
        },
      };
    },
  };

  constructor(private readonly instances: MockCancellationTokenSource[]) {
    this.instances.push(this);
  }

  cancel(): void {
    this.cancelCalled = true;
    this.token.isCancellationRequested = true;
    for (const listener of this.listeners) {
      listener();
    }
  }

  dispose(): void {
    this.disposeCalled = true;
    this.listeners.clear();
  }
}

async function* textStream(chunks: string[]): AsyncIterable<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function createMockVscode(
  selectChatModels: (selector?: { vendor?: string }) => Promise<MockLanguageModel[]>,
  tokenSourceInstances: MockCancellationTokenSource[]
): unknown {
  return {
    lm: {
      selectChatModels,
    },
    LanguageModelChatMessage: {
      User(content: string) {
        return { role: "user", content };
      },
    },
    CancellationTokenSource: class extends MockCancellationTokenSource {
      constructor() {
        super(tokenSourceInstances);
      }
    },
  };
}

async function withMockedVscode<T>(
  mockVscode: unknown,
  run: (providerModule: { CopilotProvider: new () => AgentProvider }) => Promise<T>
): Promise<T> {
  const moduleWithLoad = Module as unknown as { _load: ModuleLoad };
  const originalLoad = moduleWithLoad._load;

  moduleWithLoad._load = (request: string, parent: NodeModule | null, isMain: boolean): unknown => {
    if (request === "vscode") {
      return mockVscode;
    }

    return originalLoad(request, parent, isMain);
  };

  const providerModulePath = require.resolve("../providers/copilot-provider");
  delete require.cache[providerModulePath];

  try {
    const providerModule = require(providerModulePath) as { CopilotProvider: new () => AgentProvider };
    return await run(providerModule);
  } finally {
    delete require.cache[providerModulePath];
    moduleWithLoad._load = originalLoad;
  }
}

const baseDispatchContext: PromptDispatchContext = {
  workpackId: "workpack-manager",
  promptStem: "A2_copilot_provider",
  repos: ["WorkpackManager"],
};

describe("copilot provider", () => {
  it("returns expected capabilities", async () => {
    const mockVscode = createMockVscode(async () => [], []);

    await withMockedVscode(mockVscode, async ({ CopilotProvider }) => {
      const provider = new CopilotProvider();
      assert.deepEqual(provider.capabilities(), {
        multiFileEdit: false,
        commandExecution: false,
        longRunning: false,
        maxPromptTokens: 8_192,
        tags: ["chat", "inline", "language-model"],
      });
      provider.dispose();
    });
  });

  it("dispatches and returns parsed JSON output", async () => {
    const model: MockLanguageModel = {
      async countTokens() {
        return 8;
      },
      async sendRequest(_messages, _options, _token) {
        return {
          text: textStream(['{"status":"ok","source":"copilot"}']),
        };
      },
    };

    const mockVscode = createMockVscode(async () => [model], []);

    await withMockedVscode(mockVscode, async ({ CopilotProvider }) => {
      const provider = new CopilotProvider();
      const result = await provider.dispatch("Return JSON", baseDispatchContext);

      assert.equal(result.success, true);
      assert.deepEqual(result.output, { status: "ok", source: "copilot" });
      assert.equal(typeof result.durationMs, "number");
      assert.equal(result.summary.length > 0, true);

      provider.dispose();
    });
  });

  it("returns false from isAvailable when no models are found", async () => {
    const mockVscode = createMockVscode(async () => [], []);

    await withMockedVscode(mockVscode, async ({ CopilotProvider }) => {
      const provider = new CopilotProvider();
      const available = await provider.isAvailable();
      assert.equal(available, false);
      provider.dispose();
    });
  });

  it("creates and passes a cancellation token to sendRequest", async () => {
    const tokenSourceInstances: MockCancellationTokenSource[] = [];
    let capturedToken: unknown;

    const model: MockLanguageModel = {
      async countTokens() {
        return 16;
      },
      async sendRequest(_messages, _options, token) {
        capturedToken = token;
        return {
          text: textStream(["plain text response"]),
        };
      },
    };

    const mockVscode = createMockVscode(async () => [model], tokenSourceInstances);

    await withMockedVscode(mockVscode, async ({ CopilotProvider }) => {
      const provider = new CopilotProvider();
      const result = await provider.dispatch("Return plain text", baseDispatchContext);

      assert.equal(result.success, true);
      assert.equal(tokenSourceInstances.length, 1);
      assert.equal(capturedToken, tokenSourceInstances[0]?.token);
      assert.equal(tokenSourceInstances[0]?.disposeCalled, true);

      provider.dispose();
    });
  });

  it("handles dispatch errors gracefully", async () => {
    const model: MockLanguageModel = {
      async countTokens() {
        return 12;
      },
      async sendRequest() {
        throw new Error("simulated send failure");
      },
    };

    const mockVscode = createMockVscode(async () => [model], []);

    await withMockedVscode(mockVscode, async ({ CopilotProvider }) => {
      const provider = new CopilotProvider();
      const result = await provider.dispatch("This request should fail", baseDispatchContext);

      assert.equal(result.success, false);
      assert.match(result.error ?? "", /simulated send failure/);
      assert.equal(result.summary.length > 0, true);

      provider.dispose();
    });
  });
});
