import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "vitest";
import { ExecutionRegistry } from "../../agents/execution-registry";
import { ProviderRegistry } from "../../agents/registry";
import type { AgentCapability, AgentProvider, PromptDispatchContext, PromptResult } from "../../agents/types";
import type { WorkpackInstance } from "../../models";
import { registerCommands, WORKPACK_MANAGER_COMMANDS } from "../register-commands";

type CommandCallback = (...args: unknown[]) => unknown | Promise<unknown>;

interface MockDisposable {
  dispose(): void;
}

interface MockCancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): MockDisposable;
}

interface MockOutputChannel {
  name: string;
  lines: string[];
}

interface MockVscode {
  readonly commandMap: Map<string, CommandCallback>;
  readonly quickPickQueue: unknown[];
  readonly inputBoxQueue: Array<string | undefined>;
  readonly openedDocumentPaths: string[];
  readonly infoMessages: string[];
  readonly warningMessages: string[];
  readonly errorMessages: string[];
  readonly terminalCommands: string[];
  readonly outputChannels: MockOutputChannel[];
  readonly progressTitles: string[];
  readonly api: Parameters<typeof registerCommands>[1]["vscodeApi"];
}

const tempFolders: string[] = [];

function createMockProvider(id: string): AgentProvider {
  const capability: AgentCapability = {
    multiFileEdit: true,
    commandExecution: true,
    longRunning: true,
    maxPromptTokens: 64_000,
    tags: ["test"]
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
        summary: "ok"
      };
    },
    async isAvailable(): Promise<boolean> {
      return true;
    },
    dispose(): void {
      // No-op for tests.
    }
  };
}

function createMockVscode(workspaceFolderPaths: string[]): MockVscode {
  const commandMap = new Map<string, CommandCallback>();
  const quickPickQueue: unknown[] = [];
  const inputBoxQueue: Array<string | undefined> = [];
  const openedDocumentPaths: string[] = [];
  const infoMessages: string[] = [];
  const warningMessages: string[] = [];
  const errorMessages: string[] = [];
  const terminalCommands: string[] = [];
  const outputChannels: MockOutputChannel[] = [];
  const progressTitles: string[] = [];

  const api = {
    commands: {
      registerCommand(commandId: string, callback: CommandCallback): { dispose(): void } {
        commandMap.set(commandId, callback);
        return {
          dispose(): void {
            commandMap.delete(commandId);
          }
        };
      }
    },
    window: {
      async showQuickPick(items: unknown): Promise<unknown> {
        if (quickPickQueue.length > 0) {
          return quickPickQueue.shift();
        }

        const resolved = await Promise.resolve(items as unknown[]);
        return Array.isArray(resolved) && resolved.length > 0 ? resolved[0] : undefined;
      },
      async showInputBox(): Promise<string | undefined> {
        return inputBoxQueue.length > 0 ? inputBoxQueue.shift() : undefined;
      },
      async showInformationMessage(message: string): Promise<void> {
        infoMessages.push(message);
      },
      async showWarningMessage(message: string): Promise<void> {
        warningMessages.push(message);
      },
      async showErrorMessage(message: string): Promise<void> {
        errorMessages.push(message);
      },
      async showTextDocument(): Promise<void> {
        // No-op in tests.
      },
      createTerminal(): { show(preserveFocus?: boolean): void; sendText(commandLine: string): void } {
        return {
          show(): void {
            // No-op in tests.
          },
          sendText(commandLine: string): void {
            terminalCommands.push(commandLine);
          }
        };
      },
      createOutputChannel(name: string): { appendLine(value: string): void; show(): void; dispose(): void } {
        const channel: MockOutputChannel = {
          name,
          lines: []
        };
        outputChannels.push(channel);

        return {
          appendLine(value: string): void {
            channel.lines.push(value);
          },
          show(): void {
            // No-op in tests.
          },
          dispose(): void {
            // No-op in tests.
          }
        };
      },
      async withProgress(
        options: { title?: string },
        task: (
          progress: { report(value: { message?: string; increment?: number }): void },
          token: MockCancellationToken
        ) => Promise<unknown>
      ): Promise<unknown> {
        if (options.title) {
          progressTitles.push(options.title);
        }

        const listeners = new Set<() => void>();
        const token: MockCancellationToken = {
          isCancellationRequested: false,
          onCancellationRequested(listener: () => void): MockDisposable {
            listeners.add(listener);
            return {
              dispose(): void {
                listeners.delete(listener);
              }
            };
          }
        };

        return task(
          {
            report(): void {
              // No-op in tests.
            }
          },
          token
        );
      }
    },
    workspace: {
      workspaceFolders: workspaceFolderPaths.map((folderPath) => ({
        uri: { fsPath: folderPath }
      })),
      async openTextDocument(uri: { fsPath: string }): Promise<{ uri: { fsPath: string } }> {
        openedDocumentPaths.push(uri.fsPath);
        return { uri };
      }
    },
    Uri: {
      file(filePath: string): { fsPath: string } {
        return { fsPath: path.resolve(filePath) };
      }
    },
    ProgressLocation: {
      Notification: 15
    }
  } as unknown as Parameters<typeof registerCommands>[1]["vscodeApi"];

  return {
    commandMap,
    quickPickQueue,
    inputBoxQueue,
    openedDocumentPaths,
    infoMessages,
    warningMessages,
    errorMessages,
    terminalCommands,
    outputChannels,
    progressTitles,
    api
  };
}

function createMockContext(): Pick<Parameters<typeof registerCommands>[0], "subscriptions"> {
  return {
    subscriptions: []
  };
}

function getRegisteredCommand(
  commandMap: Map<string, CommandCallback>,
  commandId: string
): CommandCallback {
  const callback = commandMap.get(commandId);
  assert.ok(callback, `Expected command '${commandId}' to be registered.`);
  return callback;
}

async function createExecutionWorkpackFixture(
  workspaceRoot: string,
  workpackId: string,
  promptStems: Array<{ stem: string; dependsOn?: string[] }>
): Promise<{
  folderPath: string;
  statePath: string;
  instance: WorkpackInstance;
}> {
  const folderPath = path.join(workspaceRoot, "workpacks", "instances", workpackId);
  const promptsPath = path.join(folderPath, "prompts");
  const outputsPath = path.join(folderPath, "outputs");
  await mkdir(promptsPath, { recursive: true });
  await mkdir(outputsPath, { recursive: true });

  for (const prompt of promptStems) {
    await writeFile(path.join(promptsPath, `${prompt.stem}.md`), `# ${prompt.stem}\n`, "utf8");
  }

  const metaPayload = {
    id: workpackId,
    title: "Execution Test",
    summary: "Execution wiring tests",
    protocol_version: "3.0.0",
    workpack_version: "1.0.0",
    category: "feature",
    created_at: "2026-03-03",
    requires_workpack: [],
    tags: [],
    owners: [],
    repos: ["WorkpackManager"],
    delivery_mode: "pr",
    target_branch: "master",
    prompts: promptStems.map((prompt) => ({
      stem: prompt.stem,
      agent_role: `Run ${prompt.stem}`,
      depends_on: prompt.dependsOn ?? [],
      repos: ["WorkpackManager"],
      estimated_effort: "S"
    })),
    group: "workpack-manager-v2"
  };
  await writeFile(path.join(folderPath, "workpack.meta.json"), JSON.stringify(metaPayload, null, 2), "utf8");
  await writeFile(path.join(folderPath, "00_request.md"), "# request\n", "utf8");
  await writeFile(path.join(folderPath, "01_plan.md"), "# plan\n", "utf8");
  await writeFile(path.join(folderPath, "99_status.md"), "# status\n", "utf8");

  const statePath = path.join(folderPath, "workpack.state.json");
  const statePayload = {
    workpack_id: workpackId,
    overall_status: "not_started",
    last_updated: "2026-03-03T00:00:00Z",
    prompt_status: Object.fromEntries(
      promptStems.map((prompt) => [prompt.stem, { status: "pending" }])
    ),
    agent_assignments: {},
    blocked_by: [],
    execution_log: []
  };
  await writeFile(statePath, JSON.stringify(statePayload, null, 2), "utf8");

  const instance: WorkpackInstance = {
    folderPath,
    protocolVersion: "3.0.0",
    discoverySource: "auto",
    sourceProject: "WorkpackManager",
    meta: {
      id: workpackId,
      title: "Execution Test",
      summary: "Execution wiring tests",
      protocolVersion: "3.0.0",
      workpackVersion: "1.0.0",
      category: "feature",
      createdAt: "2026-03-03",
      requiresWorkpack: [],
      tags: [],
      owners: [],
      repos: ["WorkpackManager"],
      deliveryMode: "pr",
      targetBranch: "master",
      prompts: promptStems.map((prompt) => ({
        stem: prompt.stem,
        agentRole: `Run ${prompt.stem}`,
        dependsOn: prompt.dependsOn ?? [],
        repos: ["WorkpackManager"],
        estimatedEffort: "S"
      }))
    },
    state: {
      workpackId,
      overallStatus: "not_started",
      lastUpdated: "2026-03-03T00:00:00Z",
      promptStatus: Object.fromEntries(
        promptStems.map((prompt) => [prompt.stem, { status: "pending" as const }])
      ),
      agentAssignments: {},
      blockedBy: [],
      executionLog: []
    }
  };

  return { folderPath, statePath, instance };
}

afterEach(async () => {
  while (tempFolders.length > 0) {
    const folderPath = tempFolders.pop();
    if (!folderPath) {
      continue;
    }

    await rm(folderPath, { recursive: true, force: true });
  }
});

describe("commands", () => {
  it("registers all expected command IDs", () => {
    const mock = createMockVscode([]);
    const context = createMockContext();

    registerCommands(context, {
      vscodeApi: mock.api
    });

    const registeredIds = Array.from(mock.commandMap.keys()).sort();
    const expectedIds = Object.values(WORKPACK_MANAGER_COMMANDS).sort();
    assert.deepEqual(registeredIds, expectedIds);
  });

  it("createWorkpack scaffolds from template and opens request file", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cmd-create-workpack-"));
    tempFolders.push(workspaceRoot);

    const templateSourcePath = path.resolve(process.cwd(), "workpacks", "_template");
    const templateDestinationPath = path.join(workspaceRoot, "workpacks", "_template");
    await rm(path.join(workspaceRoot, "workpacks"), { recursive: true, force: true });
    await cp(templateSourcePath, templateDestinationPath, { recursive: true });

    const mock = createMockVscode([workspaceRoot]);
    mock.inputBoxQueue.push("a3-commands-test", "Command flow scaffold test summary.");

    const context = createMockContext();
    registerCommands(context, {
      vscodeApi: mock.api
    });

    const createCommand = getRegisteredCommand(
      mock.commandMap,
      WORKPACK_MANAGER_COMMANDS.createWorkpack
    );
    await createCommand();

    const workpackPath = path.join(workspaceRoot, "workpacks", "instances", "a3-commands-test");
    const metaPath = path.join(workpackPath, "workpack.meta.json");
    const requestPath = path.join(workpackPath, "00_request.md");
    const metaPayload = JSON.parse(await readFile(metaPath, "utf8")) as {
      id: string;
      category: string;
      summary: string;
    };

    assert.equal(metaPayload.id, "a3-commands-test");
    assert.equal(metaPayload.category, "feature");
    assert.equal(metaPayload.summary, "Command flow scaffold test summary.");
    assert.equal(mock.openedDocumentPaths.includes(path.resolve(requestPath)), true);
  });

  it("assignAgent updates workpack.state.json", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cmd-assign-agent-"));
    tempFolders.push(workspaceRoot);

    const workpackFolder = path.join(workspaceRoot, "workpacks", "instances", "wp-assign-test");
    const statePath = path.join(workpackFolder, "workpack.state.json");
    await mkdir(workpackFolder, { recursive: true });
    await writeFile(
      statePath,
      JSON.stringify(
        {
          workpack_id: "wp-assign-test",
          overall_status: "not_started",
          last_updated: "2026-02-26T00:00:00Z",
          prompt_status: {
            A0_bootstrap: { status: "pending" }
          },
          agent_assignments: {},
          blocked_by: [],
          execution_log: []
        },
        null,
        2
      ),
      "utf8"
    );

    const instance: WorkpackInstance = {
      folderPath: workpackFolder,
      protocolVersion: "2.0.0",
      discoverySource: "auto",
      sourceProject: "WorkpackManager",
      meta: {
        id: "wp-assign-test",
        title: "Assign Test",
        summary: "Assign test",
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
        prompts: [
          {
            stem: "A0_bootstrap",
            agentRole: "Bootstrap",
            dependsOn: [],
            repos: ["WorkpackManager"],
            estimatedEffort: "XS"
          }
        ]
      },
      state: null
    };

    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(createMockProvider("codex"));

    const mock = createMockVscode([workspaceRoot]);
    const context = createMockContext();
    registerCommands(context, {
      vscodeApi: mock.api,
      providerRegistry,
      discoverWorkpacksFn: async () => [instance]
    });

    const assignCommand = getRegisteredCommand(
      mock.commandMap,
      WORKPACK_MANAGER_COMMANDS.assignAgent
    );
    await assignCommand({
      contextValue: "prompt",
      workpackId: "wp-assign-test",
      folderPath: workpackFolder,
      promptStem: "A0_bootstrap"
    });

    const statePayload = JSON.parse(await readFile(statePath, "utf8")) as {
      agent_assignments: Record<string, string>;
      prompt_status: Record<string, { assigned_agent?: string }>;
    };

    assert.equal(statePayload.agent_assignments.A0_bootstrap, "codex");
    assert.equal(statePayload.prompt_status.A0_bootstrap.assigned_agent, "codex");
  });

  it("refreshTree invokes provider refresh", async () => {
    let refreshCount = 0;
    const mock = createMockVscode([]);
    const context = createMockContext();

    registerCommands(context, {
      vscodeApi: mock.api,
      treeProvider: {
        refresh(): void {
          refreshCount += 1;
        }
      }
    });

    const refreshCommand = getRegisteredCommand(
      mock.commandMap,
      WORKPACK_MANAGER_COMMANDS.refreshTree
    );
    await refreshCommand();

    assert.equal(refreshCount, 1);
  });

  it("lintWorkpack invokes diagnostics hook before running lint script", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cmd-lint-workpack-"));
    tempFolders.push(workspaceRoot);

    const workpackFolder = path.join(workspaceRoot, "workpacks", "instances", "wp-lint-test");
    const lintScriptPath = path.join(workspaceRoot, "workpacks", "tools", "workpack_lint.py");
    await mkdir(path.dirname(lintScriptPath), { recursive: true });
    await mkdir(workpackFolder, { recursive: true });
    await writeFile(lintScriptPath, "print('ok')\n", "utf8");

    const mock = createMockVscode([workspaceRoot]);
    const context = createMockContext();
    const lintedPaths: string[] = [];

    registerCommands(context, {
      vscodeApi: mock.api,
      onLintWorkpack: async (workpackPath: string) => {
        lintedPaths.push(workpackPath);
      }
    });

    const lintCommand = getRegisteredCommand(mock.commandMap, WORKPACK_MANAGER_COMMANDS.lintWorkpack);
    await lintCommand({
      contextValue: "workpack",
      workpackId: "wp-lint-test",
      folderPath: workpackFolder
    });

    assert.deepEqual(lintedPaths, [workpackFolder]);
    assert.equal(mock.terminalCommands.length, 1);
    assert.equal(mock.terminalCommands[0].includes("workpack_lint.py"), true);
  });

  it("executePrompt shows an error when provider registry is not configured", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cmd-execute-prompt-no-registry-"));
    tempFolders.push(workspaceRoot);

    const fixture = await createExecutionWorkpackFixture(workspaceRoot, "wp-execute-prompt", [
      { stem: "A1_wire_execute_prompt" }
    ]);
    const mock = createMockVscode([workspaceRoot]);
    const context = createMockContext();

    registerCommands(context, {
      vscodeApi: mock.api,
      discoverWorkpacksFn: async () => [fixture.instance]
    });

    const executePromptCommand = getRegisteredCommand(
      mock.commandMap,
      WORKPACK_MANAGER_COMMANDS.executePrompt
    );
    await executePromptCommand({
      contextValue: "prompt",
      workpackId: fixture.instance.meta.id,
      folderPath: fixture.folderPath,
      promptStem: "A1_wire_execute_prompt"
    });

    assert.equal(mock.errorMessages.length, 1);
    assert.match(mock.errorMessages[0], /Provider registry is not configured/i);
  });

  it("executePrompt dispatches selected prompt and writes execution logs", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cmd-execute-prompt-success-"));
    tempFolders.push(workspaceRoot);

    const fixture = await createExecutionWorkpackFixture(workspaceRoot, "wp-execute-prompt", [
      { stem: "A0_bootstrap" },
      { stem: "A1_wire_execute_prompt", dependsOn: ["A0_bootstrap"] }
    ]);
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(createMockProvider("codex"));

    const mock = createMockVscode([workspaceRoot]);
    let refreshCount = 0;
    const context = createMockContext();
    registerCommands(context, {
      vscodeApi: mock.api,
      providerRegistry,
      treeProvider: {
        refresh(): void {
          refreshCount += 1;
        }
      },
      discoverWorkpacksFn: async () => [fixture.instance]
    });

    const executePromptCommand = getRegisteredCommand(
      mock.commandMap,
      WORKPACK_MANAGER_COMMANDS.executePrompt
    );
    await executePromptCommand({
      contextValue: "prompt",
      workpackId: fixture.instance.meta.id,
      folderPath: fixture.folderPath,
      promptStem: "A1_wire_execute_prompt"
    });

    const statePayload = JSON.parse(await readFile(fixture.statePath, "utf8")) as {
      prompt_status: Record<string, { status: string }>;
    };

    assert.equal(statePayload.prompt_status.A1_wire_execute_prompt.status, "complete");
    assert.ok(refreshCount >= 1);
    assert.equal(mock.outputChannels.length >= 1, true);
    assert.equal(
      mock.outputChannels[0].lines.some((line) =>
        line.includes("Starting executePrompt for A1_wire_execute_prompt")
      ),
      true
    );
    assert.equal(
      mock.outputChannels[0].lines.some((line) => line.includes("A1_wire_execute_prompt: completed")),
      true
    );
    assert.equal(mock.progressTitles.includes("Execute Prompt: A1_wire_execute_prompt"), true);
  });

  it("stopPromptExecution aborts the active prompt run", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cmd-stop-prompt-"));
    tempFolders.push(workspaceRoot);

    const fixture = await createExecutionWorkpackFixture(workspaceRoot, "wp-stop-prompt", [
      { stem: "A0_bootstrap" }
    ]);
    const mock = createMockVscode([workspaceRoot]);
    const context = createMockContext();
    const executionRegistry = new ExecutionRegistry();
    const abortController = new AbortController();
    const run = executionRegistry.startRun({
      workpackId: fixture.instance.meta.id,
      promptStem: "A0_bootstrap",
      folderPath: fixture.folderPath,
      promptFilePath: path.join(fixture.folderPath, "prompts", "A0_bootstrap.md"),
      providerId: "codex",
      status: "in_progress",
      abortController
    });

    registerCommands(context, {
      vscodeApi: mock.api,
      executionRegistry,
      discoverWorkpacksFn: async () => [fixture.instance]
    });

    const stopCommand = getRegisteredCommand(
      mock.commandMap,
      WORKPACK_MANAGER_COMMANDS.stopPromptExecution
    );
    await stopCommand({
      contextValue: "activeAgent",
      workpackId: fixture.instance.meta.id,
      folderPath: fixture.folderPath,
      promptStem: "A0_bootstrap",
      runId: run.runId
    });

    assert.equal(abortController.signal.aborted, true);
    assert.equal(mock.infoMessages.includes("Stop requested for the selected prompt."), true);
  });

  it("retryPrompt reruns the selected prompt", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cmd-retry-prompt-"));
    tempFolders.push(workspaceRoot);

    const fixture = await createExecutionWorkpackFixture(workspaceRoot, "wp-retry-prompt", [
      { stem: "A0_bootstrap" }
    ]);
    const statePayload = JSON.parse(await readFile(fixture.statePath, "utf8")) as {
      prompt_status: Record<string, { status: string }>;
    };
    statePayload.prompt_status.A0_bootstrap.status = "blocked";
    await writeFile(fixture.statePath, JSON.stringify(statePayload, null, 2), "utf8");

    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(createMockProvider("codex"));

    const mock = createMockVscode([workspaceRoot]);
    const context = createMockContext();
    registerCommands(context, {
      vscodeApi: mock.api,
      providerRegistry,
      discoverWorkpacksFn: async () => [
        {
          ...fixture.instance,
          state: {
            ...fixture.instance.state!,
            promptStatus: {
              A0_bootstrap: { status: "blocked" }
            }
          }
        }
      ]
    });

    const retryCommand = getRegisteredCommand(
      mock.commandMap,
      WORKPACK_MANAGER_COMMANDS.retryPrompt
    );
    await retryCommand({
      contextValue: "prompt",
      workpackId: fixture.instance.meta.id,
      folderPath: fixture.folderPath,
      promptStem: "A0_bootstrap"
    });

    const updatedState = JSON.parse(await readFile(fixture.statePath, "utf8")) as {
      prompt_status: Record<string, { status: string }>;
    };

    assert.equal(updatedState.prompt_status.A0_bootstrap.status, "complete");
    assert.equal(mock.progressTitles.includes("Retry Prompt: A0_bootstrap"), true);
  });

  it("provideAgentInput submits user input to waiting runs", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cmd-provide-input-"));
    tempFolders.push(workspaceRoot);

    const fixture = await createExecutionWorkpackFixture(workspaceRoot, "wp-provide-input", [
      { stem: "A0_bootstrap" }
    ]);
    const mock = createMockVscode([workspaceRoot]);
    mock.inputBoxQueue.push("approve and continue");
    const context = createMockContext();
    const executionRegistry = new ExecutionRegistry();
    let receivedInput: string | undefined;
    const run = executionRegistry.startRun({
      workpackId: fixture.instance.meta.id,
      promptStem: "A0_bootstrap",
      folderPath: fixture.folderPath,
      promptFilePath: path.join(fixture.folderPath, "prompts", "A0_bootstrap.md"),
      providerId: "codex",
      status: "human_input_required",
      inputRequest: "Need approval",
      humanInputHandler: async (input) => {
        receivedInput = input;
      }
    });

    registerCommands(context, {
      vscodeApi: mock.api,
      executionRegistry,
      discoverWorkpacksFn: async () => [fixture.instance]
    });

    const provideInputCommand = getRegisteredCommand(
      mock.commandMap,
      WORKPACK_MANAGER_COMMANDS.provideAgentInput
    );
    await provideInputCommand({
      contextValue: "activeAgent",
      workpackId: fixture.instance.meta.id,
      folderPath: fixture.folderPath,
      promptStem: "A0_bootstrap",
      runId: run.runId
    });

    assert.equal(receivedInput, "approve and continue");
    assert.equal(executionRegistry.getRun(run.runId)?.status, "queued");
    assert.equal(mock.infoMessages.includes("Input submitted for A0_bootstrap."), true);
  });

  it("executeAll dispatches ready prompts and updates state", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cmd-execute-all-success-"));
    tempFolders.push(workspaceRoot);

    const fixture = await createExecutionWorkpackFixture(workspaceRoot, "wp-execute-all", [
      { stem: "A0_bootstrap" },
      { stem: "A1_wire_execute_prompt", dependsOn: ["A0_bootstrap"] }
    ]);
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(createMockProvider("codex"));

    const mock = createMockVscode([workspaceRoot]);
    let refreshCount = 0;
    const context = createMockContext();
    registerCommands(context, {
      vscodeApi: mock.api,
      providerRegistry,
      treeProvider: {
        refresh(): void {
          refreshCount += 1;
        }
      },
      discoverWorkpacksFn: async () => [fixture.instance]
    });

    const executeAllCommand = getRegisteredCommand(mock.commandMap, WORKPACK_MANAGER_COMMANDS.executeAll);
    await executeAllCommand({
      contextValue: "workpack",
      workpackId: fixture.instance.meta.id,
      folderPath: fixture.folderPath
    });

    const statePayload = JSON.parse(await readFile(fixture.statePath, "utf8")) as {
      prompt_status: Record<string, { status: string }>;
    };

    assert.equal(statePayload.prompt_status.A0_bootstrap.status, "complete");
    assert.equal(statePayload.prompt_status.A1_wire_execute_prompt.status, "complete");
    assert.ok(refreshCount >= 1);
    assert.equal(mock.progressTitles.includes(`Execute All: ${fixture.instance.meta.id}`), true);
  });

  it("executeAll returns info when no prompts are ready", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cmd-execute-all-no-ready-"));
    tempFolders.push(workspaceRoot);

    const fixture = await createExecutionWorkpackFixture(workspaceRoot, "wp-execute-all-none", [
      { stem: "A0_bootstrap" }
    ]);

    const statePayload = JSON.parse(await readFile(fixture.statePath, "utf8")) as {
      prompt_status: Record<string, { status: string }>;
    };
    statePayload.prompt_status.A0_bootstrap.status = "complete";
    await writeFile(fixture.statePath, JSON.stringify(statePayload, null, 2), "utf8");

    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(createMockProvider("codex"));
    const mock = createMockVscode([workspaceRoot]);
    const context = createMockContext();

    registerCommands(context, {
      vscodeApi: mock.api,
      providerRegistry,
      discoverWorkpacksFn: async () => [
        {
          ...fixture.instance,
          state: {
            ...fixture.instance.state!,
            promptStatus: {
              A0_bootstrap: { status: "complete" }
            },
            overallStatus: "complete"
          }
        }
      ]
    });

    const executeAllCommand = getRegisteredCommand(mock.commandMap, WORKPACK_MANAGER_COMMANDS.executeAll);
    await executeAllCommand({
      contextValue: "workpack",
      workpackId: fixture.instance.meta.id,
      folderPath: fixture.folderPath
    });

    assert.equal(mock.infoMessages.some((message) => message.includes("No ready prompts")), true);
  });

  it("package.json contains expected context menu when clauses", async () => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packagePayload = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      contributes: {
        menus: {
          "view/title": Array<{ command: string; when: string }>;
          "view/item/context": Array<{ command: string; when: string }>;
        };
      };
    };

    const titleMenus = packagePayload.contributes.menus["view/title"];
    const contextMenus = packagePayload.contributes.menus["view/item/context"];
    const refreshEntry = titleMenus.find(
      (entry) => entry.command === WORKPACK_MANAGER_COMMANDS.refreshTree
    );

    assert.ok(refreshEntry);
    assert.equal(refreshEntry.when, "view == workpackManager");

    const expectedWhenByCommand: Record<string, string> = {
      [WORKPACK_MANAGER_COMMANDS.openRequest]: "viewItem == workpack",
      [WORKPACK_MANAGER_COMMANDS.openPlan]: "viewItem == workpack",
      [WORKPACK_MANAGER_COMMANDS.openStatus]: "viewItem == workpack",
      [WORKPACK_MANAGER_COMMANDS.openPixelRoom]: "viewItem == workpack",
      [WORKPACK_MANAGER_COMMANDS.viewDetails]: "viewItem == workpack",
      [WORKPACK_MANAGER_COMMANDS.lintWorkpack]: "viewItem == workpack",
      [WORKPACK_MANAGER_COMMANDS.executeAll]: "viewItem == workpack",
      [WORKPACK_MANAGER_COMMANDS.assignAgent]: "viewItem =~ /^prompt\\./",
      [WORKPACK_MANAGER_COMMANDS.executePrompt]: "viewItem == prompt.pending",
      [WORKPACK_MANAGER_COMMANDS.stopPromptExecution]: "viewItem == prompt.queued || viewItem == prompt.inProgress || viewItem == prompt.humanInputRequired || viewItem == activeAgent.queued || viewItem == activeAgent.inProgress || viewItem == activeAgent.humanInputRequired",
      [WORKPACK_MANAGER_COMMANDS.retryPrompt]: "viewItem == prompt.blocked || viewItem == prompt.failed || viewItem == prompt.cancelled",
      [WORKPACK_MANAGER_COMMANDS.provideAgentInput]: "viewItem == prompt.humanInputRequired || viewItem == activeAgent.humanInputRequired"
    };

    for (const [commandId, whenClause] of Object.entries(expectedWhenByCommand)) {
      const entry = contextMenus.find((candidate) => candidate.command === commandId);
      assert.ok(entry, `Expected view/item/context entry for ${commandId}`);
      assert.equal(entry.when, whenClause);
    }
  });
});
