import { strict as assert } from "node:assert";
import Module from "node:module";
import * as path from "node:path";
import { describe, it } from "vitest";
import type { WorkpackInstance } from "../../models";

type ModuleLoad = (request: string, parent: NodeModule | null, isMain: boolean) => unknown;

interface MockDisposable {
  dispose(): void;
}

class MockOutputChannel implements MockDisposable {
  public readonly lines: string[] = [];
  public disposed = false;

  constructor(public readonly name: string) {}

  appendLine(value: string): void {
    this.lines.push(value);
  }

  dispose(): void {
    this.disposed = true;
  }
}

class MockUri {
  constructor(public readonly fsPath: string) {}

  static file(fsPath: string): MockUri {
    return new MockUri(fsPath);
  }

  static joinPath(base: MockUri, ...segments: string[]): MockUri {
    return new MockUri(path.join(base.fsPath, ...segments));
  }
}

class MockThemeColor {
  constructor(public readonly id: string) {}
}

class MockThemeIcon {
  constructor(
    public readonly id: string,
    public readonly color?: MockThemeColor,
  ) {}
}

class MockWebview {
  html = "";
  readonly cspSource = "vscode-webview://mock";
  private readonly messageListeners: Array<(message: unknown) => void | Promise<void>> = [];

  onDidReceiveMessage(
    listener: (message: unknown) => void | Promise<void>,
    thisArg?: unknown,
    disposables?: MockDisposable[],
  ): MockDisposable {
    const wrapped = thisArg ? listener.bind(thisArg as object) : listener;
    this.messageListeners.push(wrapped);

    const disposable: MockDisposable = {
      dispose: () => {
        const index = this.messageListeners.indexOf(wrapped);
        if (index >= 0) {
          this.messageListeners.splice(index, 1);
        }
      },
    };

    disposables?.push(disposable);
    return disposable;
  }

  asWebviewUri(uri: MockUri): string {
    return `webview-resource:${uri.fsPath}`;
  }

  async fireMessage(message: unknown): Promise<void> {
    for (const listener of this.messageListeners) {
      await listener(message);
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 0);
    });
  }
}

class MockFileSystemWatcher implements MockDisposable {
  private readonly createListeners: Array<() => void> = [];
  private readonly changeListeners: Array<() => void> = [];
  private readonly deleteListeners: Array<() => void> = [];
  disposed = false;

  onDidCreate(listener: () => void, thisArg?: unknown, disposables?: MockDisposable[]): MockDisposable {
    return this.registerListener(this.createListeners, listener, thisArg, disposables);
  }

  onDidChange(listener: () => void, thisArg?: unknown, disposables?: MockDisposable[]): MockDisposable {
    return this.registerListener(this.changeListeners, listener, thisArg, disposables);
  }

  onDidDelete(listener: () => void, thisArg?: unknown, disposables?: MockDisposable[]): MockDisposable {
    return this.registerListener(this.deleteListeners, listener, thisArg, disposables);
  }

  dispose(): void {
    this.disposed = true;
    this.createListeners.length = 0;
    this.changeListeners.length = 0;
    this.deleteListeners.length = 0;
  }

  private registerListener(
    target: Array<() => void>,
    listener: () => void,
    thisArg?: unknown,
    disposables?: MockDisposable[],
  ): MockDisposable {
    const wrapped = thisArg ? listener.bind(thisArg as object) : listener;
    target.push(wrapped);

    const disposable: MockDisposable = {
      dispose: () => {
        const index = target.indexOf(wrapped);
        if (index >= 0) {
          target.splice(index, 1);
        }
      },
    };

    disposables?.push(disposable);
    return disposable;
  }
}

class MockWebviewPanel implements MockDisposable {
  public readonly webview = new MockWebview();
  public revealCalls = 0;
  public disposed = false;
  private readonly disposeListeners: Array<() => void> = [];

  constructor(public title: string) {}

  reveal(): void {
    this.revealCalls += 1;
  }

  onDidDispose(listener: () => void, thisArg?: unknown, disposables?: MockDisposable[]): MockDisposable {
    const wrapped = thisArg ? listener.bind(thisArg as object) : listener;
    this.disposeListeners.push(wrapped);

    const disposable: MockDisposable = {
      dispose: () => {
        const index = this.disposeListeners.indexOf(wrapped);
        if (index >= 0) {
          this.disposeListeners.splice(index, 1);
        }
      },
    };

    disposables?.push(disposable);
    return disposable;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    const listeners = this.disposeListeners.slice();
    this.disposeListeners.length = 0;
    for (const listener of listeners) {
      listener();
    }
  }
}

class MockRelativePattern {
  constructor(
    public readonly base: string,
    public readonly pattern: string,
  ) {}
}

interface MockVscodeContext {
  extensionUri: MockUri;
  createdPanels: MockWebviewPanel[];
  createdWatchers: MockFileSystemWatcher[];
  outputChannels: MockOutputChannel[];
  openTextDocumentCalls: MockUri[];
  showTextDocumentCalls: unknown[];
  executeCommandCalls: Array<unknown[]>;
  vscode: unknown;
}

function createMockVscodeContext(): MockVscodeContext {
  const createdPanels: MockWebviewPanel[] = [];
  const createdWatchers: MockFileSystemWatcher[] = [];
  const outputChannels: MockOutputChannel[] = [];
  const openTextDocumentCalls: MockUri[] = [];
  const showTextDocumentCalls: unknown[] = [];
  const executeCommandCalls: Array<unknown[]> = [];
  const extensionUri = MockUri.file(path.resolve(process.cwd()));

  const vscode = {
    ViewColumn: {
      Active: 1,
    },
    Uri: MockUri,
    ThemeColor: MockThemeColor,
    ThemeIcon: MockThemeIcon,
    RelativePattern: MockRelativePattern,
    commands: {
      executeCommand: async (...args: unknown[]) => {
        executeCommandCalls.push(args);
      },
    },
    workspace: {
      createFileSystemWatcher: (_pattern: unknown) => {
        const watcher = new MockFileSystemWatcher();
        createdWatchers.push(watcher);
        return watcher;
      },
      openTextDocument: async (uri: MockUri) => {
        openTextDocumentCalls.push(uri);
        return { uri };
      },
    },
    window: {
      createWebviewPanel: (
        _viewType: string,
        title: string,
        _column: number,
        _options: Record<string, unknown>,
      ) => {
        const panel = new MockWebviewPanel(title);
        createdPanels.push(panel);
        return panel;
      },
      showTextDocument: async (document: unknown) => {
        showTextDocumentCalls.push(document);
      },
      createOutputChannel: (name: string) => {
        const channel = new MockOutputChannel(name);
        outputChannels.push(channel);
        return channel;
      },
    },
  };

  return {
    extensionUri,
    createdPanels,
    createdWatchers,
    outputChannels,
    openTextDocumentCalls,
    showTextDocumentCalls,
    executeCommandCalls,
    vscode,
  };
}

async function withMockedVscode<T>(
  run: (deps: {
    WorkpackDetailPanel: {
      currentPanel: unknown;
      createOrShow(extensionUri: unknown, workpack: WorkpackInstance): void;
    };
    context: MockVscodeContext;
  }) => Promise<T>,
): Promise<T> {
  const moduleWithLoad = Module as unknown as { _load: ModuleLoad };
  const originalLoad = moduleWithLoad._load;
  const context = createMockVscodeContext();

  moduleWithLoad._load = (request: string, parent: NodeModule | null, isMain: boolean): unknown => {
    if (request === "vscode") {
      return context.vscode;
    }

    return originalLoad(request, parent, isMain);
  };

  const modulePath = require.resolve("../workpack-detail-panel");
  delete require.cache[modulePath];

  try {
    const imported = require(modulePath) as {
      WorkpackDetailPanel: {
        currentPanel: unknown;
        createOrShow(extensionUri: unknown, workpack: WorkpackInstance): void;
      };
    };
    return await run({
      WorkpackDetailPanel: imported.WorkpackDetailPanel,
      context,
    });
  } finally {
    delete require.cache[modulePath];
    moduleWithLoad._load = originalLoad;
  }
}

function createWorkpackFixture(): WorkpackInstance {
  return {
    folderPath: path.resolve(
      process.cwd(),
      "workpacks",
      "instances",
      "workpack-manager",
      "03_workpack-manager_extension-ux",
    ),
    protocolVersion: "2.0.0",
    discoverySource: "auto",
    sourceProject: "WorkpackManager",
    meta: {
      id: "03_workpack-manager_extension-ux",
      group: "workpack-manager",
      title: "VS Code Extension UX Layer",
      summary: "Build tree view, detail webview, and command UX.",
      protocolVersion: "2.0.0",
      workpackVersion: "1.0.0",
      category: "feature",
      createdAt: "2026-02-23",
      requiresWorkpack: ["02_workpack-manager_core-architecture"],
      tags: ["extension", "ux"],
      owners: ["team-ux"],
      repos: ["WorkpackManager"],
      deliveryMode: "pr",
      targetBranch: "main",
      prompts: [
        {
          stem: "A0_bootstrap",
          agentRole: "Bootstrap",
          dependsOn: [],
          repos: ["WorkpackManager"],
          estimatedEffort: "XS",
        },
        {
          stem: "A2_detail_panel",
          agentRole: "Detail Panel",
          dependsOn: ["A0_bootstrap"],
          repos: ["WorkpackManager"],
          estimatedEffort: "M",
        },
      ],
    },
    state: {
      workpackId: "03_workpack-manager_extension-ux",
      overallStatus: "in_progress",
      lastUpdated: "2026-02-26T10:00:00Z",
      promptStatus: {
        A0_bootstrap: { status: "complete", assignedAgent: "codex" },
        A2_detail_panel: { status: "in_progress", assignedAgent: "codex" },
      },
      agentAssignments: {
        A2_detail_panel: "codex",
      },
      blockedBy: ["02_workpack-manager_core-architecture"],
      executionLog: [],
      notes: null,
    },
  };
}

describe("workpack detail panel", () => {
  it("getHtmlContent includes workpack title", async () => {
    await withMockedVscode(async ({ WorkpackDetailPanel, context }) => {
      const workpack = createWorkpackFixture();
      WorkpackDetailPanel.createOrShow(context.extensionUri, workpack);

      const panelInstance = WorkpackDetailPanel.currentPanel as {
        getHtmlContent(workpack: WorkpackInstance): string;
        dispose(): void;
      };
      const html = panelInstance.getHtmlContent(workpack);

      assert.equal(html.includes(workpack.meta.title), true);
      panelInstance.dispose();
    });
  });

  it("getHtmlContent includes all prompt rows", async () => {
    await withMockedVscode(async ({ WorkpackDetailPanel, context }) => {
      const workpack = createWorkpackFixture();
      WorkpackDetailPanel.createOrShow(context.extensionUri, workpack);

      const panelInstance = WorkpackDetailPanel.currentPanel as {
        getHtmlContent(workpack: WorkpackInstance): string;
        dispose(): void;
      };
      const html = panelInstance.getHtmlContent(workpack);

      for (const prompt of workpack.meta.prompts) {
        assert.equal(html.includes(prompt.stem), true);
      }

      panelInstance.dispose();
    });
  });

  it("getHtmlContent includes correct status badges", async () => {
    await withMockedVscode(async ({ WorkpackDetailPanel, context }) => {
      const workpack = createWorkpackFixture();
      WorkpackDetailPanel.createOrShow(context.extensionUri, workpack);

      const panelInstance = WorkpackDetailPanel.currentPanel as {
        getHtmlContent(workpack: WorkpackInstance): string;
        dispose(): void;
      };
      const html = panelInstance.getHtmlContent(workpack);

      assert.equal(html.includes("badge--in-progress"), true);
      assert.equal(html.includes(">In Progress<"), true);
      assert.equal(html.includes("badge--complete"), true);

      panelInstance.dispose();
    });
  });

  it("renders fallback html and logs to output channel for malformed data", async () => {
    await withMockedVscode(async ({ WorkpackDetailPanel, context }) => {
      const workpack = createWorkpackFixture();
      const malformedWorkpack = {
        ...workpack,
        meta: {
          ...workpack.meta,
          prompts: null as unknown as typeof workpack.meta.prompts,
        },
      } as WorkpackInstance;

      assert.doesNotThrow(() => {
        WorkpackDetailPanel.createOrShow(context.extensionUri, malformedWorkpack);
      });

      const panel = context.createdPanels[0];
      assert.equal(panel?.webview.html.includes("Unable to render workpack details"), true);
      assert.equal(context.outputChannels.length, 1);
      assert.equal(
        context.outputChannels[0]?.lines.some((line) => line.includes("Unable to render details for")),
        true,
      );

      const panelInstance = WorkpackDetailPanel.currentPanel as { dispose(): void };
      panelInstance.dispose();
    });
  });

  it("message handling dispatches openFile correctly", async () => {
    await withMockedVscode(async ({ WorkpackDetailPanel, context }) => {
      const workpack = createWorkpackFixture();
      const targetFile = path.join(workpack.folderPath, "outputs", "A2_detail_panel.json");

      WorkpackDetailPanel.createOrShow(context.extensionUri, workpack);
      const panel = context.createdPanels[0];

      await panel.webview.fireMessage({
        command: "openFile",
        payload: { filePath: targetFile },
      });

      assert.equal(context.openTextDocumentCalls.length, 1);
      assert.equal(context.openTextDocumentCalls[0]?.fsPath, targetFile);
      assert.equal(context.showTextDocumentCalls.length, 1);

      const panelInstance = WorkpackDetailPanel.currentPanel as { dispose(): void };
      panelInstance.dispose();
    });
  });

  it("panel disposes without errors", async () => {
    await withMockedVscode(async ({ WorkpackDetailPanel, context }) => {
      const workpack = createWorkpackFixture();
      WorkpackDetailPanel.createOrShow(context.extensionUri, workpack);

      const panelInstance = WorkpackDetailPanel.currentPanel as { dispose(): void };
      assert.doesNotThrow(() => {
        panelInstance.dispose();
        panelInstance.dispose();
      });
      assert.equal(context.createdWatchers.every((watcher) => watcher.disposed), true);
    });
  });
});
