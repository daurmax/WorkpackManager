import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { ProviderRegistry } from "../../agents/registry";
import type { AgentCapability, AgentProvider, PromptDispatchContext, PromptResult } from "../../agents/types";
import type { WorkpackInstance } from "../../models";
import { registerCommands, WORKPACK_MANAGER_COMMANDS } from "../register-commands";

type CommandCallback = (...args: unknown[]) => unknown | Promise<unknown>;

interface CommandRegistration {
  id: string;
  callback: CommandCallback;
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
      [WORKPACK_MANAGER_COMMANDS.viewDetails]: "viewItem == workpack",
      [WORKPACK_MANAGER_COMMANDS.lintWorkpack]: "viewItem == workpack",
      [WORKPACK_MANAGER_COMMANDS.executeAll]: "viewItem == workpack",
      [WORKPACK_MANAGER_COMMANDS.assignAgent]: "viewItem == prompt",
      [WORKPACK_MANAGER_COMMANDS.executePrompt]: "viewItem == prompt"
    };

    for (const [commandId, whenClause] of Object.entries(expectedWhenByCommand)) {
      const entry = contextMenus.find((candidate) => candidate.command === commandId);
      assert.ok(entry, `Expected view/item/context entry for ${commandId}`);
      assert.equal(entry.when, whenClause);
    }
  });
});
