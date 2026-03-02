import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "vitest";
import type { PromptEntry, WorkpackMeta } from "../../models";
import { AssignmentModel } from "../assignment";
import { ExecutionOrchestrator } from "../orchestrator";
import { ProviderRegistry } from "../registry";
import type {
  AgentCapability,
  AgentProvider,
  PromptDispatchContext,
  PromptResult,
  ProviderId,
} from "../types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createPrompt(stem: string, dependsOn: string[] = []): PromptEntry {
  return {
    stem,
    agentRole: `Agent for ${stem}`,
    dependsOn,
    repos: ["WorkpackManager"],
    estimatedEffort: "M",
  };
}

function createMeta(id: string, prompts: PromptEntry[]): WorkpackMeta {
  return {
    id,
    title: `Title ${id}`,
    summary: `Summary ${id}`,
    protocolVersion: "2.0.0",
    workpackVersion: "1.0.0",
    category: "feature",
    createdAt: "2026-02-26",
    requiresWorkpack: [],
    tags: [],
    owners: [],
    repos: ["WorkpackManager"],
    deliveryMode: "pr",
    targetBranch: "main",
    prompts,
  };
}

function createMockProvider(
  id: ProviderId,
  dispatchHandler: (promptContent: string, context: PromptDispatchContext) => Promise<PromptResult>
): AgentProvider {
  const capability: AgentCapability = {
    multiFileEdit: true,
    commandExecution: true,
    longRunning: true,
    maxPromptTokens: 32_000,
    tags: ["shell", "orchestrator"],
  };

  return {
    id,
    displayName: `${id} provider`,
    capabilities(): AgentCapability {
      return capability;
    },
    async dispatch(promptContent: string, context: PromptDispatchContext): Promise<PromptResult> {
      return dispatchHandler(promptContent, context);
    },
    async isAvailable(): Promise<boolean> {
      return true;
    },
    dispose(): void {
      // No-op for tests.
    },
  };
}

class MockProvider implements AgentProvider {
  readonly id = "mock";
  readonly displayName = "Mock Agent";
  readonly dispatchedPrompts: string[] = [];

  capabilities(): AgentCapability {
    return {
      multiFileEdit: false,
      commandExecution: false,
      longRunning: false,
      maxPromptTokens: 1_000,
      tags: ["test"],
    };
  }

  async dispatch(_promptContent: string, context: PromptDispatchContext): Promise<PromptResult> {
    this.dispatchedPrompts.push(context.promptStem);
    return {
      success: true,
      summary: "Mock result",
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  dispose(): void {
    // No-op for tests.
  }
}

async function createWorkpackFixture(
  meta: WorkpackMeta,
  assignments: Record<string, string> = {}
): Promise<{ folderPath: string; stateFilePath: string }> {
  const folderPath = await mkdtemp(path.join(os.tmpdir(), "orchestrator-test-"));
  const promptsPath = path.join(folderPath, "prompts");
  await mkdir(promptsPath, { recursive: true });

  for (const prompt of meta.prompts) {
    await writeFile(
      path.join(promptsPath, `${prompt.stem}.md`),
      `# ${prompt.stem}\n\nPrompt body for ${prompt.stem}.`,
      "utf8"
    );
  }

  const promptStatus = Object.fromEntries(
    meta.prompts.map((prompt) => [
      prompt.stem,
      {
        status: "pending",
        assigned_agent: assignments[prompt.stem],
      },
    ])
  );

  const stateFilePath = path.join(folderPath, "workpack.state.json");
  await writeFile(
    stateFilePath,
    JSON.stringify(
      {
        workpack_id: meta.id,
        overall_status: "not_started",
        last_updated: "2026-02-26T00:00:00Z",
        prompt_status: promptStatus,
        agent_assignments: assignments,
        blocked_by: [],
        execution_log: [],
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    folderPath,
    stateFilePath,
  };
}

async function readPromptStatuses(
  stateFilePath: string
): Promise<Record<string, { status: string; blocked_reason?: string }>> {
  const raw = JSON.parse(await readFile(stateFilePath, "utf8")) as {
    prompt_status: Record<string, { status: string; blocked_reason?: string }>;
  };

  return raw.prompt_status;
}

const tempFolders: string[] = [];

afterEach(async () => {
  while (tempFolders.length > 0) {
    const folderPath = tempFolders.pop();
    if (!folderPath) {
      continue;
    }

    await rm(folderPath, { recursive: true, force: true });
  }
});

describe("execution orchestrator", () => {
  it("registers and dispatches a minimal MockProvider without core changes", async () => {
    const meta = createMeta("wp-mock-provider", [createPrompt("A")]);
    const setup = await createWorkpackFixture(meta, { A: "mock" });
    tempFolders.push(setup.folderPath);

    const mockProvider = new MockProvider();
    const registry = new ProviderRegistry();
    registry.register(mockProvider);

    const assignment = new AssignmentModel(setup.stateFilePath, registry);
    const orchestrator = new ExecutionOrchestrator(registry, assignment, {
      maxParallel: 1,
      continueOnError: false,
      timeoutMs: 2_000,
    });

    const summary = await orchestrator.execute(meta, setup.stateFilePath);
    const promptStatuses = await readPromptStatuses(setup.stateFilePath);

    assert.equal(summary.completed, 1);
    assert.equal(summary.failed, 0);
    assert.equal(summary.skipped, 0);
    assert.deepEqual(mockProvider.dispatchedPrompts, ["A"]);
    assert.equal(summary.results.A.success, true);
    assert.equal(summary.results.A.summary, "Mock result");
    assert.equal(promptStatuses.A.status, "complete");
  });

  it("executes a linear chain A -> B -> C", async () => {
    const meta = createMeta("wp-linear", [
      createPrompt("A"),
      createPrompt("B", ["A"]),
      createPrompt("C", ["B"]),
    ]);
    const setup = await createWorkpackFixture(meta, { A: "codex", B: "codex", C: "codex" });
    tempFolders.push(setup.folderPath);

    const dispatchOrder: string[] = [];
    const registry = new ProviderRegistry();
    registry.register(
      createMockProvider("codex", async (_promptContent, context) => {
        dispatchOrder.push(context.promptStem);
        return {
          success: true,
          summary: `Completed ${context.promptStem}`,
        };
      })
    );

    const assignment = new AssignmentModel(setup.stateFilePath, registry);
    const orchestrator = new ExecutionOrchestrator(registry, assignment, {
      maxParallel: 2,
      continueOnError: false,
      timeoutMs: 2_000,
    });

    const summary = await orchestrator.execute(meta, setup.stateFilePath);
    const promptStatuses = await readPromptStatuses(setup.stateFilePath);

    assert.equal(summary.completed, 3);
    assert.equal(summary.failed, 0);
    assert.equal(summary.skipped, 0);
    assert.deepEqual(dispatchOrder, ["A", "B", "C"]);
    assert.equal(promptStatuses.A.status, "complete");
    assert.equal(promptStatuses.B.status, "complete");
    assert.equal(promptStatuses.C.status, "complete");
  });

  it("executes parallel-ready prompts A -> [B, C] -> D", async () => {
    const meta = createMeta("wp-parallel", [
      createPrompt("A"),
      createPrompt("B", ["A"]),
      createPrompt("C", ["A"]),
      createPrompt("D", ["B", "C"]),
    ]);
    const setup = await createWorkpackFixture(meta, {
      A: "codex",
      B: "codex",
      C: "codex",
      D: "codex",
    });
    tempFolders.push(setup.folderPath);

    const startedAt: Record<string, number> = {};
    const endedAt: Record<string, number> = {};
    let inflight = 0;
    let maxInflight = 0;

    const registry = new ProviderRegistry();
    registry.register(
      createMockProvider("codex", async (_promptContent, context) => {
        inflight += 1;
        maxInflight = Math.max(maxInflight, inflight);
        startedAt[context.promptStem] = Date.now();

        const promptDelay = context.promptStem === "B" || context.promptStem === "C" ? 80 : 20;
        await delay(promptDelay);

        endedAt[context.promptStem] = Date.now();
        inflight -= 1;

        return {
          success: true,
          summary: `Completed ${context.promptStem}`,
        };
      })
    );

    const assignment = new AssignmentModel(setup.stateFilePath, registry);
    const orchestrator = new ExecutionOrchestrator(registry, assignment, {
      maxParallel: 2,
      continueOnError: false,
      timeoutMs: 2_000,
    });

    const summary = await orchestrator.execute(meta, setup.stateFilePath);

    assert.equal(summary.completed, 4);
    assert.equal(summary.failed, 0);
    assert.equal(summary.skipped, 0);
    assert.ok(maxInflight >= 2);
    assert.ok((startedAt.D ?? 0) >= (endedAt.B ?? Number.MAX_SAFE_INTEGER));
    assert.ok((startedAt.D ?? 0) >= (endedAt.C ?? Number.MAX_SAFE_INTEGER));
  });

  it("detects and rejects cyclic DAG", async () => {
    const meta = createMeta("wp-cycle", [
      createPrompt("A", ["C"]),
      createPrompt("B", ["A"]),
      createPrompt("C", ["B"]),
    ]);
    const setup = await createWorkpackFixture(meta);
    tempFolders.push(setup.folderPath);

    const registry = new ProviderRegistry();
    registry.register(
      createMockProvider("codex", async (_promptContent, context) => ({
        success: true,
        summary: `Completed ${context.promptStem}`,
      }))
    );

    const assignment = new AssignmentModel(setup.stateFilePath, registry);
    const orchestrator = new ExecutionOrchestrator(registry, assignment, {
      maxParallel: 1,
      continueOnError: false,
      timeoutMs: 2_000,
    });

    assert.throws(() => orchestrator.validateDAG(meta), /Cycle detected/);
  });

  it("stops on error when continueOnError is false", async () => {
    const meta = createMeta("wp-stop-on-error", [
      createPrompt("A"),
      createPrompt("B", ["A"]),
      createPrompt("C"),
    ]);
    const setup = await createWorkpackFixture(meta, {
      A: "codex",
      B: "codex",
      C: "codex",
    });
    tempFolders.push(setup.folderPath);

    const dispatchOrder: string[] = [];
    const registry = new ProviderRegistry();
    registry.register(
      createMockProvider("codex", async (_promptContent, context) => {
        dispatchOrder.push(context.promptStem);

        if (context.promptStem === "A") {
          return {
            success: false,
            summary: "A failed",
            error: "simulated failure",
          };
        }

        return {
          success: true,
          summary: `Completed ${context.promptStem}`,
        };
      })
    );

    const assignment = new AssignmentModel(setup.stateFilePath, registry);
    const orchestrator = new ExecutionOrchestrator(registry, assignment, {
      maxParallel: 1,
      continueOnError: false,
      timeoutMs: 2_000,
    });

    const summary = await orchestrator.execute(meta, setup.stateFilePath);
    const promptStatuses = await readPromptStatuses(setup.stateFilePath);

    assert.equal(summary.completed, 0);
    assert.equal(summary.failed, 1);
    assert.equal(summary.skipped, 2);
    assert.deepEqual(dispatchOrder, ["A"]);
    assert.equal(promptStatuses.A.status, "blocked");
    assert.equal(promptStatuses.B.status, "skipped");
    assert.equal(promptStatuses.C.status, "skipped");
  });

  it("continues on error when continueOnError is true", async () => {
    const meta = createMeta("wp-continue-on-error", [
      createPrompt("A"),
      createPrompt("B", ["A"]),
      createPrompt("C"),
    ]);
    const setup = await createWorkpackFixture(meta, {
      A: "codex",
      B: "codex",
      C: "codex",
    });
    tempFolders.push(setup.folderPath);

    const dispatchedPrompts: string[] = [];
    const registry = new ProviderRegistry();
    registry.register(
      createMockProvider("codex", async (_promptContent, context) => {
        dispatchedPrompts.push(context.promptStem);

        if (context.promptStem === "A") {
          return {
            success: false,
            summary: "A failed",
            error: "simulated failure",
          };
        }

        return {
          success: true,
          summary: `Completed ${context.promptStem}`,
        };
      })
    );

    const assignment = new AssignmentModel(setup.stateFilePath, registry);
    const orchestrator = new ExecutionOrchestrator(registry, assignment, {
      maxParallel: 2,
      continueOnError: true,
      timeoutMs: 2_000,
    });

    const summary = await orchestrator.execute(meta, setup.stateFilePath);
    const promptStatuses = await readPromptStatuses(setup.stateFilePath);

    assert.equal(summary.completed, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.skipped, 1);
    assert.ok(dispatchedPrompts.includes("A"));
    assert.ok(dispatchedPrompts.includes("C"));
    assert.ok(!dispatchedPrompts.includes("B"));
    assert.equal(promptStatuses.A.status, "blocked");
    assert.equal(promptStatuses.B.status, "skipped");
    assert.equal(promptStatuses.C.status, "complete");
  });

  it("respects timeout per prompt dispatch", async () => {
    const meta = createMeta("wp-timeout", [createPrompt("A")]);
    const setup = await createWorkpackFixture(meta, { A: "codex" });
    tempFolders.push(setup.folderPath);

    const registry = new ProviderRegistry();
    registry.register(
      createMockProvider("codex", async () => {
        await delay(200);
        return {
          success: true,
          summary: "Unexpected success",
        };
      })
    );

    const assignment = new AssignmentModel(setup.stateFilePath, registry);
    const orchestrator = new ExecutionOrchestrator(registry, assignment, {
      maxParallel: 1,
      continueOnError: false,
      timeoutMs: 50,
    });

    const summary = await orchestrator.execute(meta, setup.stateFilePath);
    const promptStatuses = await readPromptStatuses(setup.stateFilePath);

    assert.equal(summary.completed, 0);
    assert.equal(summary.failed, 1);
    assert.equal(summary.skipped, 0);
    assert.equal(promptStatuses.A.status, "blocked");
    assert.match(summary.results.A.error ?? "", /Timed out/);
  });

  it("skips prompts with unsatisfied dependencies", async () => {
    const meta = createMeta("wp-unsatisfied", [createPrompt("A", ["MISSING_PROMPT"])]);
    const setup = await createWorkpackFixture(meta, { A: "codex" });
    tempFolders.push(setup.folderPath);

    const dispatchedPrompts: string[] = [];
    const registry = new ProviderRegistry();
    registry.register(
      createMockProvider("codex", async (_promptContent, context) => {
        dispatchedPrompts.push(context.promptStem);
        return {
          success: true,
          summary: `Completed ${context.promptStem}`,
        };
      })
    );

    const assignment = new AssignmentModel(setup.stateFilePath, registry);
    const orchestrator = new ExecutionOrchestrator(registry, assignment, {
      maxParallel: 1,
      continueOnError: false,
      timeoutMs: 2_000,
    });

    const summary = await orchestrator.execute(meta, setup.stateFilePath);
    const promptStatuses = await readPromptStatuses(setup.stateFilePath);

    assert.equal(summary.completed, 0);
    assert.equal(summary.failed, 0);
    assert.equal(summary.skipped, 1);
    assert.deepEqual(dispatchedPrompts, []);
    assert.equal(promptStatuses.A.status, "skipped");
  });
});
