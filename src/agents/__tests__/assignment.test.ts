import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "vitest";
import { AssignmentModel, type PromptMeta } from "../assignment";
import { ProviderRegistry } from "../registry";
import type {
  AgentCapability,
  AgentProvider,
  PromptDispatchContext,
  PromptResult,
  ProviderId,
} from "../types";

function createMockProvider(
  id: ProviderId,
  capabilityOverrides: Partial<AgentCapability> = {}
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
    async dispatch(_promptContent: string, _context: PromptDispatchContext): Promise<PromptResult> {
      return {
        success: true,
        summary: "mock dispatch",
      };
    },
    async isAvailable(): Promise<boolean> {
      return true;
    },
    dispose(): void {
      // No-op for tests.
    },
  };
}

function createPrompt(
  stem: string,
  agentRole: string,
  overrides: Partial<Omit<PromptMeta, "stem" | "agentRole">> = {}
): PromptMeta {
  return {
    stem,
    agentRole,
    dependsOn: [],
    repos: ["WorkpackManager"],
    estimatedEffort: "M",
    ...overrides,
  };
}

async function createStateFile(folderPath: string): Promise<string> {
  const stateFilePath = path.join(folderPath, "workpack.state.json");
  await writeFile(
    stateFilePath,
    JSON.stringify(
      {
        workpack_id: "wp-assignment-test",
        overall_status: "not_started",
        last_updated: "2026-02-26T00:00:00Z",
        prompt_status: {},
        agent_assignments: {},
        blocked_by: [],
        execution_log: [],
      },
      null,
      2
    ),
    "utf8"
  );

  return stateFilePath;
}

const tempFolders: string[] = [];

afterEach(async () => {
  while (tempFolders.length > 0) {
    const folder = tempFolders.pop();
    if (!folder) {
      continue;
    }

    await rm(folder, { recursive: true, force: true });
  }
});

describe("assignment model", () => {
  it("assigns a provider to a prompt", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "assignment-test-"));
    tempFolders.push(folder);
    const stateFilePath = await createStateFile(folder);
    const registry = new ProviderRegistry();
    registry.register(createMockProvider("codex"));

    const model = new AssignmentModel(stateFilePath, registry);
    await model.load();
    await model.assign("A1_provider_interface", "codex");

    assert.equal(model.getAssignment("A1_provider_interface"), "codex");
  });

  it("rejects assignment with unknown provider id", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "assignment-test-"));
    tempFolders.push(folder);
    const stateFilePath = await createStateFile(folder);
    const registry = new ProviderRegistry();

    const model = new AssignmentModel(stateFilePath, registry);
    await model.load();

    await assert.rejects(
      async () => model.assign("A1_provider_interface", "unknown-provider"),
      /Unknown provider/
    );
  });

  it("auto-assigns unassigned prompts based on capabilities", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "assignment-test-"));
    tempFolders.push(folder);
    const stateFilePath = await createStateFile(folder);
    const registry = new ProviderRegistry();

    registry.register(
      createMockProvider("codex", {
        commandExecution: true,
        longRunning: true,
        maxPromptTokens: 32_000,
        tags: ["shell", "orchestrator"],
      })
    );
    registry.register(
      createMockProvider("copilot", {
        commandExecution: false,
        longRunning: false,
        maxPromptTokens: 8_000,
        tags: ["docs", "editor"],
      })
    );

    const model = new AssignmentModel(stateFilePath, registry);
    await model.load();

    const assigned = await model.autoAssign([
      createPrompt("A_shell", "Shell command orchestrator", { estimatedEffort: "L" }),
      createPrompt("A_docs", "docs editor", { estimatedEffort: "S" }),
    ]);

    assert.equal(assigned.A_shell, "codex");
    assert.equal(assigned.A_docs, "copilot");
  });

  it("persists and reloads assignments from JSON state file", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "assignment-test-"));
    tempFolders.push(folder);
    const stateFilePath = await createStateFile(folder);
    const registry = new ProviderRegistry();
    registry.register(createMockProvider("codex"));

    const model = new AssignmentModel(stateFilePath, registry);
    await model.load();
    await model.assign("A1_provider_interface", "codex");
    await model.save();

    const reloadedModel = new AssignmentModel(stateFilePath, registry);
    await reloadedModel.load();

    assert.equal(reloadedModel.getAssignment("A1_provider_interface"), "codex");

    const persistedState = JSON.parse(await readFile(stateFilePath, "utf8")) as {
      agent_assignments: Record<string, string>;
    };
    assert.equal(persistedState.agent_assignments.A1_provider_interface, "codex");
  });

  it("unassigns a prompt provider mapping", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "assignment-test-"));
    tempFolders.push(folder);
    const stateFilePath = await createStateFile(folder);
    const registry = new ProviderRegistry();
    registry.register(createMockProvider("codex"));

    const model = new AssignmentModel(stateFilePath, registry);
    await model.load();
    await model.assign("A1_provider_interface", "codex");
    await model.unassign("A1_provider_interface");

    assert.equal(model.getAssignment("A1_provider_interface"), undefined);
  });
});
