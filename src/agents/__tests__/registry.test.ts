import { strict as assert } from "node:assert";
import { describe, it } from "vitest";
import { ProviderRegistry } from "../registry";
import type { AgentCapability, AgentProvider, PromptDispatchContext, ProviderId } from "../types";

function createMockProvider(
  id: ProviderId,
  capabilityOverrides: Partial<AgentCapability> = {},
  onDispose?: () => void
): AgentProvider {
  const capability: AgentCapability = {
    multiFileEdit: true,
    commandExecution: false,
    longRunning: false,
    maxPromptTokens: 8_000,
    tags: ["default"],
    ...capabilityOverrides,
  };

  return {
    id,
    displayName: `${id} provider`,
    capabilities(): AgentCapability {
      return capability;
    },
    async dispatch(_promptContent: string, _context: PromptDispatchContext) {
      return {
        success: true,
        summary: "Mock provider dispatched prompt.",
      };
    },
    async isAvailable() {
      return true;
    },
    dispose() {
      onDispose?.();
    },
  };
}

describe("provider registry", () => {
  it("registers a provider and supports retrieval/listing", () => {
    const registry = new ProviderRegistry();
    const provider = createMockProvider("codex");
    let registeredId: string | undefined;

    registry.on("registered", (registeredProvider: AgentProvider) => {
      registeredId = registeredProvider.id;
    });

    registry.register(provider);

    assert.equal(registry.get("codex"), provider);
    assert.deepEqual(registry.listAll(), [provider]);
    assert.equal(registeredId, "codex");
  });

  it("prevents duplicate provider registration by id", () => {
    const registry = new ProviderRegistry();

    registry.register(createMockProvider("copilot"));

    assert.throws(() => {
      registry.register(createMockProvider("copilot"));
    }, /already registered/);
  });

  it("discovers providers by capability filters", () => {
    const registry = new ProviderRegistry();
    const codex = createMockProvider("codex", {
      commandExecution: true,
      longRunning: true,
      maxPromptTokens: 24_000,
      tags: ["shell", "long-running"],
    });
    const copilot = createMockProvider("copilot", {
      commandExecution: false,
      longRunning: false,
      maxPromptTokens: 8_000,
      tags: ["editor"],
    });
    const claude = createMockProvider("claude", {
      multiFileEdit: false,
      commandExecution: true,
      longRunning: true,
      maxPromptTokens: 24_000,
      tags: ["analysis", "long-running"],
    });

    registry.register(codex);
    registry.register(copilot);
    registry.register(claude);

    const shellProviders = registry.findByCapability({
      commandExecution: true,
      tags: ["shell"],
    });
    const longRunningProviders = registry.findByCapability({
      longRunning: true,
      maxPromptTokens: 24_000,
      tags: ["long-running"],
    });

    assert.deepEqual(
      shellProviders.map((provider) => provider.id),
      ["codex"]
    );
    assert.deepEqual(
      longRunningProviders.map((provider) => provider.id).sort(),
      ["claude", "codex"]
    );
  });

  it("deregisters providers, disposes resources, and emits event", () => {
    const registry = new ProviderRegistry();
    let disposed = false;
    let deregisteredId: string | undefined;
    const provider = createMockProvider("codex", {}, () => {
      disposed = true;
    });

    registry.on("deregistered", (deregisteredProvider: AgentProvider) => {
      deregisteredId = deregisteredProvider.id;
    });

    registry.register(provider);
    const removed = registry.deregister("codex");

    assert.equal(removed, true);
    assert.equal(disposed, true);
    assert.equal(registry.get("codex"), undefined);
    assert.deepEqual(registry.listAll(), []);
    assert.equal(deregisteredId, "codex");
    assert.equal(registry.deregister("codex"), false);
  });

  it("findByCapability returns only matching providers", () => {
    const registry = new ProviderRegistry();
    const codex = createMockProvider("codex", {
      multiFileEdit: true,
      commandExecution: true,
      longRunning: true,
      maxPromptTokens: 32_000,
      tags: ["stable", "preferred"],
    });
    const copilot = createMockProvider("copilot", {
      multiFileEdit: true,
      commandExecution: false,
      longRunning: false,
      maxPromptTokens: 8_000,
      tags: ["stable"],
    });
    const claude = createMockProvider("claude", {
      multiFileEdit: false,
      commandExecution: true,
      longRunning: true,
      maxPromptTokens: 32_000,
      tags: ["experimental", "preferred"],
    });

    registry.register(codex);
    registry.register(copilot);
    registry.register(claude);

    const matches = registry.findByCapability({
      multiFileEdit: true,
      commandExecution: true,
      tags: ["stable", "preferred"],
    });

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.id, "codex");
  });

  it("listAvailable filters out providers where isAvailable returns false", async () => {
    const registry = new ProviderRegistry();
    const available = createMockProvider("copilot");
    const unavailable: AgentProvider = {
      ...createMockProvider("codex"),
      async isAvailable() {
        return false;
      },
    };

    registry.register(available);
    registry.register(unavailable);

    const result = await registry.listAvailable();
    assert.deepEqual(
      result.map((p) => p.id),
      ["copilot"]
    );
  });
});
