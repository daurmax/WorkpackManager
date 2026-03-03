import assert from "node:assert/strict";
import * as vscode from "vscode";
import { describe, afterEach, it } from "vitest";
import { CopilotProvider } from "../providers/copilot-provider";

async function* textStream(chunks: string[]): AsyncIterable<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

const baseDispatchContext = {
  workpackId: "workpack-manager",
  promptStem: "A3_provider_configuration",
  repos: ["WorkpackManager"]
};

const originalSelectChatModels = vscode.lm.selectChatModels;

afterEach(() => {
  vscode.lm.selectChatModels = originalSelectChatModels;
});

describe("copilot provider", () => {
  it("uses default maxPromptTokens when no configuration is provided", () => {
    const provider = new CopilotProvider();
    assert.equal(provider.capabilities().maxPromptTokens, 8_192);
    provider.dispose();
  });

  it("uses configured maxPromptTokens override", () => {
    const provider = new CopilotProvider({ maxPromptTokens: 256 });
    assert.equal(provider.capabilities().maxPromptTokens, 256);
    provider.dispose();
  });

  it("falls back to default maxPromptTokens for invalid values", () => {
    const providerWithZero = new CopilotProvider({ maxPromptTokens: 0 });
    const providerWithNaN = new CopilotProvider({ maxPromptTokens: Number.NaN });

    assert.equal(providerWithZero.capabilities().maxPromptTokens, 8_192);
    assert.equal(providerWithNaN.capabilities().maxPromptTokens, 8_192);

    providerWithZero.dispose();
    providerWithNaN.dispose();
  });

  it("applies configured maxPromptTokens to dispatch truncation", async () => {
    const capturedPrompts: string[] = [];
    (vscode.lm.selectChatModels as unknown as (...args: unknown[]) => Promise<unknown[]>) = async () =>
      [
        {
          async countTokens(): Promise<number> {
            return 200;
          },
          async sendRequest(messages: Array<{ content: string }>): Promise<{ text: AsyncIterable<string> }> {
            capturedPrompts.push(messages[0]?.content ?? "");
            return {
              text: textStream(['{"status":"ok"}'])
            };
          }
        }
      ];

    const provider = new CopilotProvider({ maxPromptTokens: 10 });
    const originalPrompt = "x".repeat(400);
    const result = await provider.dispatch(originalPrompt, baseDispatchContext);

    assert.equal(result.success, true);
    assert.deepEqual(result.output, { status: "ok" });
    assert.equal(capturedPrompts.length, 1);
    assert.equal(capturedPrompts[0].length <= originalPrompt.length, true);
    assert.equal(capturedPrompts[0].length < originalPrompt.length, true);

    provider.dispose();
  });
});
