import { strict as assert } from "node:assert";
import * as vscode from "vscode";
import { beforeEach, describe, it, vi } from "vitest";

const activationMocks = vi.hoisted(() => {
  const registerCommands = vi.fn();

  const treeProviderCtor = vi.fn();
  const treeProviderInstances: Array<{
    refresh: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }> = [];

  class DiscovererWorkpackParser {}

  class WorkpackTreeProvider {
    readonly refresh = vi.fn();
    readonly dispose = vi.fn();

    constructor(
      parser: unknown,
      workspacePath: string,
      options: { watchFileSystem: boolean }
    ) {
      treeProviderCtor(parser, workspacePath, options);
      treeProviderInstances.push(this);
    }
  }

  const diagnosticInstances: Array<{
    publishDiagnostics: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }> = [];

  class WorkpackDiagnosticProvider {
    readonly publishDiagnostics = vi.fn(async () => undefined);
    readonly dispose = vi.fn();

    constructor() {
      diagnosticInstances.push(this);
    }
  }

  return {
    registerCommands,
    treeProviderCtor,
    treeProviderInstances,
    diagnosticInstances,
    DiscovererWorkpackParser,
    WorkpackTreeProvider,
    WorkpackDiagnosticProvider
  };
});

vi.mock("../commands", () => ({
  registerCommands: activationMocks.registerCommands
}));

vi.mock("../views", () => ({
  DiscovererWorkpackParser: activationMocks.DiscovererWorkpackParser,
  WorkpackTreeProvider: activationMocks.WorkpackTreeProvider
}));

vi.mock("../validation", () => ({
  WorkpackDiagnosticProvider: activationMocks.WorkpackDiagnosticProvider
}));

import { activate } from "../extension";

interface TestContext {
  subscriptions: Array<{ dispose(): void }>;
}

interface TestVscodeWorkspace {
  workspaceFolders: Array<{ uri: { fsPath: string } }>;
  getConfiguration(section: string): {
    get<T>(key: string, defaultValue: T): T;
  };
}

interface TestVscodeWindow {
  createTreeView(
    id: string,
    options: { treeDataProvider: unknown; showCollapseAll: boolean }
  ): { dispose(): void };
}

function createContext(): TestContext {
  return {
    subscriptions: []
  };
}

describe("extension activation integration", () => {
  beforeEach(() => {
    activationMocks.registerCommands.mockReset();
    activationMocks.treeProviderCtor.mockReset();
    activationMocks.treeProviderInstances.length = 0;
    activationMocks.diagnosticInstances.length = 0;
  });

  it("wires tree provider, command registration, and diagnostics callback on activate", async () => {
    const workspace = vscode.workspace as unknown as TestVscodeWorkspace;
    workspace.workspaceFolders = [{ uri: { fsPath: "C:/workspace" } }];
    workspace.getConfiguration = vi.fn((_section: string) => ({
      get<T>(_key: string, defaultValue: T): T {
        return defaultValue;
      }
    }));

    const createTreeViewMock = vi.fn(() => ({
      dispose(): void {}
    }));
    const windowApi = vscode.window as unknown as TestVscodeWindow;
    windowApi.createTreeView = createTreeViewMock;

    const context = createContext();
    activate(context as unknown as Parameters<typeof activate>[0]);

    assert.equal(activationMocks.treeProviderCtor.mock.calls.length, 1);
    const [parserArg, workspacePathArg, optionsArg] = activationMocks.treeProviderCtor.mock.calls[0];
    assert.ok(parserArg instanceof activationMocks.DiscovererWorkpackParser);
    assert.equal(workspacePathArg, "C:/workspace");
    assert.deepEqual(optionsArg, { watchFileSystem: true });

    assert.equal(createTreeViewMock.mock.calls.length, 1);
    const [viewId, treeViewOptions] = createTreeViewMock.mock.calls[0] as [
      string,
      { treeDataProvider: unknown; showCollapseAll: boolean }
    ];
    assert.equal(viewId, "workpackManager");
    assert.equal(treeViewOptions.treeDataProvider, activationMocks.treeProviderInstances[0]);
    assert.equal(treeViewOptions.showCollapseAll, true);

    assert.equal(context.subscriptions.length, 4);
    assert.equal(context.subscriptions[0], activationMocks.treeProviderInstances[0]);
    assert.equal(context.subscriptions[2], activationMocks.diagnosticInstances[0]);

    assert.equal(activationMocks.registerCommands.mock.calls.length, 1);
    const [registeredContext, registerOptions] = activationMocks.registerCommands.mock.calls[0] as [
      TestContext,
      {
        vscodeApi: unknown;
        treeProvider: unknown;
        providerRegistry: { listAll(): Array<{ id: string }> };
        onLintWorkpack(workpackFolderPath: string): Promise<void>;
      }
    ];

    assert.equal(registeredContext, context);
    assert.equal(registerOptions.vscodeApi, vscode);
    assert.equal(registerOptions.treeProvider, activationMocks.treeProviderInstances[0]);
    assert.deepEqual(
      registerOptions.providerRegistry.listAll().map((provider) => provider.id).sort(),
      ["codex", "copilot"]
    );

    await registerOptions.onLintWorkpack("C:/workspace/workpacks/instances/demo");
    assert.deepEqual(
      activationMocks.diagnosticInstances[0].publishDiagnostics.mock.calls,
      [["C:/workspace/workpacks/instances/demo"]]
    );

    assert.equal(registerOptions.providerRegistry.listAll().length, 2);
    context.subscriptions[3].dispose();
    assert.equal(registerOptions.providerRegistry.listAll().length, 0);
  });

  it("disables filesystem watch mode when no workspace is open", () => {
    const workspace = vscode.workspace as unknown as TestVscodeWorkspace;
    workspace.workspaceFolders = [];
    workspace.getConfiguration = vi.fn((_section: string) => ({
      get<T>(_key: string, defaultValue: T): T {
        return defaultValue;
      }
    }));

    const windowApi = vscode.window as unknown as TestVscodeWindow;
    windowApi.createTreeView = vi.fn(() => ({
      dispose(): void {}
    }));

    const context = createContext();
    activate(context as unknown as Parameters<typeof activate>[0]);

    assert.equal(activationMocks.treeProviderCtor.mock.calls.length, 1);
    const [, workspacePathArg, optionsArg] = activationMocks.treeProviderCtor.mock.calls[0];
    assert.equal(workspacePathArg, "");
    assert.deepEqual(optionsArg, { watchFileSystem: false });
  });
});
