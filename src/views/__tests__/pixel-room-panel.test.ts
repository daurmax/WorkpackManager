import { strict as assert } from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import { describe, it } from "vitest";
import type { AgentRunSnapshot } from "../../agents/execution-registry";
import type { WorkpackInstance } from "../../models";
import { WorkpackPixelRoomPanel } from "../workpack-pixel-room-panel";

interface MockDisposable {
  dispose(): void;
}

class MockOutputChannel implements MockDisposable {
  public readonly lines: string[] = [];

  appendLine(value: string): void {
    this.lines.push(value);
  }

  dispose(): void {
    // No-op for tests.
  }
}

class MockWebview {
  html = "";
  readonly cspSource = "vscode-webview://mock";
  readonly postMessageCalls: unknown[] = [];
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

  async postMessage(message: unknown): Promise<boolean> {
    this.postMessageCalls.push(message);
    return true;
  }
}

class MockWebviewPanel implements MockDisposable {
  readonly webview = new MockWebview();
  revealCalls = 0;
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
    const listeners = this.disposeListeners.slice();
    this.disposeListeners.length = 0;
    for (const listener of listeners) {
      listener();
    }
  }
}

class MockFileSystemWatcher implements MockDisposable {
  onDidCreate(): MockDisposable {
    return { dispose(): void {} };
  }

  onDidChange(): MockDisposable {
    return { dispose(): void {} };
  }

  onDidDelete(): MockDisposable {
    return { dispose(): void {} };
  }

  dispose(): void {
    // No-op for tests.
  }
}

class MockExecutionRegistry {
  private readonly listeners: Array<() => void | Promise<void>> = [];

  constructor(private runs: AgentRunSnapshot[] = []) {}

  listRuns(): AgentRunSnapshot[] {
    return this.runs;
  }

  onDidChangeRuns(listener: () => void | Promise<void>): MockDisposable {
    this.listeners.push(listener);

    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }

  async setRuns(runs: AgentRunSnapshot[]): Promise<void> {
    this.runs = runs;
    await Promise.all(this.listeners.map((listener) => listener()));
  }
}

async function waitForTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function withMockedPanel<T>(
  run: (context: { createdPanels: MockWebviewPanel[]; extensionUri: vscode.Uri }) => Promise<T>,
): Promise<T> {
  const createdPanels: MockWebviewPanel[] = [];
  const extensionUri = vscode.Uri.file(path.resolve(process.cwd()));
  const windowApi = vscode.window as unknown as {
    createWebviewPanel: typeof vscode.window.createWebviewPanel;
    createOutputChannel?: typeof vscode.window.createOutputChannel;
  };
  const workspaceApi = vscode.workspace as unknown as {
    createFileSystemWatcher: typeof vscode.workspace.createFileSystemWatcher;
  };
  const originalCreateWebviewPanel = windowApi.createWebviewPanel;
  const originalCreateOutputChannel = windowApi.createOutputChannel;
  const originalCreateFileSystemWatcher = workspaceApi.createFileSystemWatcher;

  windowApi.createWebviewPanel = ((_: string, title: string) => {
    const panel = new MockWebviewPanel(title);
    createdPanels.push(panel);
    return panel as unknown as ReturnType<typeof vscode.window.createWebviewPanel>;
  }) as typeof vscode.window.createWebviewPanel;
  windowApi.createOutputChannel = (() => new MockOutputChannel() as unknown as vscode.OutputChannel) as unknown as typeof vscode.window.createOutputChannel;
  workspaceApi.createFileSystemWatcher = (() => new MockFileSystemWatcher() as unknown as vscode.FileSystemWatcher) as typeof vscode.workspace.createFileSystemWatcher;

  try {
    return await run({ createdPanels, extensionUri });
  } finally {
    windowApi.createWebviewPanel = originalCreateWebviewPanel;
    if (originalCreateOutputChannel) {
      windowApi.createOutputChannel = originalCreateOutputChannel;
    }
    workspaceApi.createFileSystemWatcher = originalCreateFileSystemWatcher;
    (WorkpackPixelRoomPanel.currentPanel as { dispose(): void } | undefined)?.dispose();
  }
}

function createWorkpackFixture(id: string, title: string): WorkpackInstance {
  const folderPath = path.resolve(process.cwd(), "workpacks", "instances", "workpack-manager-v3-pixel-office-ui");

  return {
    folderPath,
    protocolVersion: "3.0.0",
    discoverySource: "auto",
    sourceProject: "WorkpackManager",
    meta: {
      id,
      title,
      summary: "Pixel room test fixture",
      protocolVersion: "3.0.0",
      workpackVersion: "1.0.0",
      category: "feature",
      createdAt: "2026-03-12",
      requiresWorkpack: [],
      tags: ["pixel"],
      owners: [],
      repos: ["WorkpackManager"],
      deliveryMode: "pr",
      targetBranch: "master",
      prompts: [
        {
          stem: "A1_pixel_room_shell",
          agentRole: "Build the room shell",
          dependsOn: [],
          repos: ["WorkpackManager"],
          estimatedEffort: "L",
        },
      ],
    },
    state: {
      workpackId: id,
      overallStatus: "in_progress",
      lastUpdated: "2026-03-12T10:43:56Z",
      promptStatus: {
        A1_pixel_room_shell: {
          status: "in_progress",
          assignedAgent: "codex",
        },
      },
      agentAssignments: {
        A1_pixel_room_shell: "codex",
      },
      blockedBy: [],
      executionLog: [],
    },
  };
}

describe("workpack pixel room panel", () => {
  it("renders initial pixel room html", async () => {
    await withMockedPanel(async ({ createdPanels, extensionUri }) => {
      const workpack = createWorkpackFixture("pixel-room-a", "Pixel Room A");
      WorkpackPixelRoomPanel.createOrShow(extensionUri, workpack);

      const panel = createdPanels[0];
      assert.ok(panel.webview.html.includes("Pixel Room A"));
      assert.ok(panel.webview.html.includes("00_request.md"));
      assert.ok(panel.webview.html.includes("A1_pixel_room_shell"));
    });
  });

  it("reuses the existing panel and posts a selection change update", async () => {
    await withMockedPanel(async ({ createdPanels, extensionUri }) => {
      const first = createWorkpackFixture("pixel-room-a", "Pixel Room A");
      const second = createWorkpackFixture("pixel-room-b", "Pixel Room B");

      WorkpackPixelRoomPanel.createOrShow(extensionUri, first);
      WorkpackPixelRoomPanel.createOrShow(extensionUri, second);

      const panel = createdPanels[0];
      assert.equal(createdPanels.length, 1);
      assert.equal(panel.revealCalls, 1);
      assert.equal(panel.title, "Pixel Room: Pixel Room B");
      assert.equal(panel.webview.postMessageCalls.length, 1);

      const sceneUpdate = panel.webview.postMessageCalls[0] as {
        type: string;
        reason: string;
        scene: { workpackId: string };
      };
      assert.equal(sceneUpdate.type, "SceneUpdate");
      assert.equal(sceneUpdate.reason, "selection_change");
      assert.equal(sceneUpdate.scene.workpackId, "pixel-room-b");
    });
  });

  it("posts desk status changes and avatar transitions for runtime updates", async () => {
    await withMockedPanel(async ({ createdPanels, extensionUri }) => {
      const workpack = createWorkpackFixture("pixel-room-a", "Pixel Room A");
      const completionTimestamp = new Date().toISOString();
      const executionRegistry = new MockExecutionRegistry([
        {
          runId: "run-1",
          workpackId: workpack.meta.id,
          promptStem: "A1_pixel_room_shell",
          providerId: "codex",
          status: "in_progress",
          startedAt: "2026-03-12T10:44:00Z",
          updatedAt: "2026-03-12T10:44:30Z",
        },
      ]);

      WorkpackPixelRoomPanel.createOrShow(extensionUri, workpack, {
        executionRegistry: executionRegistry as never,
      });

      const panel = createdPanels[0];
      panel.webview.postMessageCalls.length = 0;

      await executionRegistry.setRuns([
        {
          runId: "run-1",
          workpackId: workpack.meta.id,
          promptStem: "A1_pixel_room_shell",
          providerId: "codex",
          status: "complete",
          startedAt: "2026-03-12T10:44:00Z",
          updatedAt: completionTimestamp,
          completedAt: completionTimestamp,
        },
      ]);
      await waitForTick();

      assert.equal(panel.webview.postMessageCalls.length, 2);

      const deskStatusChange = panel.webview.postMessageCalls[0] as {
        type: string;
        status: string;
        runId: string;
      };
      const avatarTransition = panel.webview.postMessageCalls[1] as {
        type: string;
        from: string;
        avatar: { animationState: string; run: { status: string }; currentStationId?: string };
      };

      assert.equal(deskStatusChange.type, "DeskStatusChange");
      assert.equal(deskStatusChange.status, "complete");
      assert.equal(deskStatusChange.runId, "run-1");

      assert.equal(avatarTransition.type, "AvatarTransition");
      assert.equal(avatarTransition.from, "working");
      assert.equal(avatarTransition.avatar.animationState, "walking_to_board");
      assert.equal(avatarTransition.avatar.run.status, "complete");
      assert.equal(avatarTransition.avatar.currentStationId, "station:output-board");
    });
  });
});
