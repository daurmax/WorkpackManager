import * as vscode from "vscode";
import type { ExecutionRegistry } from "../agents/execution-registry";
import type { ProviderRegistry } from "../agents/registry";
import type { WorkpackInstance } from "../models";
import type { PromptActionKind, PromptDesk, SceneState } from "../models/pixel-office";
import { WORKPACK_MANAGER_COMMANDS } from "../commands/register-commands";
import type {
  PixelOfficeHostMessage,
  PixelOfficeWebviewMessage,
  SceneUpdateReason,
} from "./pixel-office";
import { buildPixelRoomHtml, buildPixelOfficeSceneState, deriveAvatarTransitions } from "./pixel-office";
import { parseWorkpackInstance } from "../parser/workpack-parser";

const PANEL_VIEW_TYPE = "workpackManager.pixelRoomPanel";
const REFRESH_DEBOUNCE_MS = 200;
const OUTPUT_CHANNEL_NAME = "Workpack Manager Pixel Room";
const PROMPT_ACTION_KINDS: PromptActionKind[] = [
  "open_prompt",
  "execute",
  "stop",
  "retry",
  "provide_input",
  "open_output",
];

export interface WorkpackPixelRoomPanelOptions {
  executionRegistry?: Pick<ExecutionRegistry, "listRuns" | "onDidChangeRuns">;
  providerRegistry?: Pick<ProviderRegistry, "listAll" | "listAvailable">;
}

function isPixelOfficeWebviewMessage(message: unknown): message is PixelOfficeWebviewMessage {
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return false;
  }

  const candidate = message as Record<string, unknown>;
  if (typeof candidate.type !== "string") {
    return false;
  }

  if (candidate.type === "DeskClicked") {
    return (
      typeof candidate.deskId === "string" &&
      typeof candidate.promptStem === "string" &&
      (candidate.button === "primary" || candidate.button === "secondary")
    );
  }

  if (candidate.type === "DeskHovered") {
    return (
      typeof candidate.deskId === "string" &&
      typeof candidate.promptStem === "string" &&
      typeof candidate.hovered === "boolean"
    );
  }

  if (candidate.type === "AgentAssignRequested") {
    return (
      typeof candidate.deskId === "string" &&
      typeof candidate.promptStem === "string" &&
      typeof candidate.providerId === "string"
    );
  }

  if (candidate.type === "PromptActionRequested") {
    return (
      typeof candidate.deskId === "string" &&
      typeof candidate.promptStem === "string" &&
      typeof candidate.action === "string" &&
      PROMPT_ACTION_KINDS.includes(candidate.action as PromptActionKind)
    );
  }

  return false;
}

function disposeAll(disposables: vscode.Disposable[]): void {
  while (disposables.length > 0) {
    disposables.pop()?.dispose();
  }
}

export class WorkpackPixelRoomPanel {
  public static currentPanel: WorkpackPixelRoomPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private workpack: WorkpackInstance;
  private executionRegistry?: Pick<ExecutionRegistry, "listRuns" | "onDidChangeRuns">;
  private providerRegistry?: Pick<ProviderRegistry, "listAll" | "listAvailable">;
  private refreshTimer: NodeJS.Timeout | undefined;
  private outputChannel: vscode.OutputChannel | undefined;
  private runtimeSubscription: vscode.Disposable | undefined;
  private disposed = false;
  private htmlInitialized = false;
  private lastScene: SceneState | undefined;
  private cachedAvailableProviderIds: Set<string> | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly fileWatcherDisposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    workpack: WorkpackInstance,
    options: WorkpackPixelRoomPanelOptions = {},
  ) {
    this.panel = panel;
    this.workpack = workpack;
    this.executionRegistry = options.executionRegistry;
    this.providerRegistry = options.providerRegistry;

    this.panel.onDidDispose(
      () => {
        this.disposeInternal(false);
      },
      null,
      this.disposables,
    );

    this.panel.webview.onDidReceiveMessage(
      (message: unknown) => {
        void this.handleMessage(message);
      },
      null,
      this.disposables,
    );

    this.bindExecutionRegistry();
    this.recreateFileWatcher();
    this.update("initial");
    void this.refreshAvailableProviders();
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    workpack: WorkpackInstance,
    options: WorkpackPixelRoomPanelOptions = {},
  ): void {
    if (WorkpackPixelRoomPanel.currentPanel) {
      WorkpackPixelRoomPanel.currentPanel.workpack = workpack;
      WorkpackPixelRoomPanel.currentPanel.executionRegistry = options.executionRegistry;
      WorkpackPixelRoomPanel.currentPanel.providerRegistry = options.providerRegistry;
      WorkpackPixelRoomPanel.currentPanel.bindExecutionRegistry();
      WorkpackPixelRoomPanel.currentPanel.recreateFileWatcher();
      WorkpackPixelRoomPanel.currentPanel.panel.reveal(vscode.ViewColumn.Active);
      WorkpackPixelRoomPanel.currentPanel.update("selection_change");
      void WorkpackPixelRoomPanel.currentPanel.refreshAvailableProviders();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PANEL_VIEW_TYPE,
      `Pixel Room: ${WorkpackPixelRoomPanel.getWorkpackTitle(workpack)}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    WorkpackPixelRoomPanel.currentPanel = new WorkpackPixelRoomPanel(panel, workpack, options);
  }

  private bindExecutionRegistry(): void {
    this.runtimeSubscription?.dispose();
    this.runtimeSubscription = undefined;

    if (!this.executionRegistry) {
      return;
    }

    this.runtimeSubscription = this.executionRegistry.onDidChangeRuns(() => {
      void this.handleRuntimeRegistryChange();
    });
  }

  private recreateFileWatcher(): void {
    disposeAll(this.fileWatcherDisposables);

    const pattern = new vscode.RelativePattern(this.workpack.folderPath, "**/*");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const queueRefresh = (): void => {
      this.scheduleRefresh();
    };

    this.fileWatcherDisposables.push(
      watcher,
      watcher.onDidCreate(queueRefresh, this),
      watcher.onDidChange(queueRefresh, this),
      watcher.onDidDelete(queueRefresh, this),
    );
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      void this.reloadWorkpackFromDisk();
    }, REFRESH_DEBOUNCE_MS);
  }

  private async reloadWorkpackFromDisk(): Promise<void> {
    try {
      const parsed = await parseWorkpackInstance(this.workpack.folderPath);
      this.workpack = {
        ...parsed,
        discoverySource: this.workpack.discoverySource,
        sourceProject: this.workpack.sourceProject,
      };
      await this.postSceneUpdate("workpack_refresh");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[workpack-pixel-room-panel] Unable to refresh ${this.getWorkpackId(this.workpack)}: ${detail}`);
    }
  }

  private buildScene() {
    const allProviders = this.providerRegistry?.listAll() ?? [];
    const availableIds = this.cachedAvailableProviderIds;
    const filteredProviders = availableIds
      ? allProviders.filter((p) => availableIds.has(p.id))
      : allProviders;
    return buildPixelOfficeSceneState(this.workpack, {
      availableProviders: filteredProviders.map((provider) => ({
        id: provider.id,
        label: provider.displayName,
      })) ?? [],
      reducedMotion: this.isReducedMotionEnabled(),
      runtimeRuns: this.executionRegistry?.listRuns() ?? [],
    });
  }

  private async refreshAvailableProviders(): Promise<void> {
    if (!this.providerRegistry?.listAvailable) {
      return;
    }
    const available = await this.providerRegistry.listAvailable();
    const ids = new Set(available.map((p) => p.id));
    const changed = !this.cachedAvailableProviderIds ||
      ids.size !== this.cachedAvailableProviderIds.size ||
      [...ids].some((id) => !this.cachedAvailableProviderIds!.has(id));
    if (changed) {
      this.cachedAvailableProviderIds = ids;
      if (this.htmlInitialized) {
        void this.postSceneUpdate("runtime_refresh");
      }
    }
  }

  private isReducedMotionEnabled(): boolean {
    const workspaceApi = vscode.workspace as typeof vscode.workspace & {
      getConfiguration?: typeof vscode.workspace.getConfiguration;
    };

    if (typeof workspaceApi.getConfiguration !== "function") {
      return false;
    }

    return workspaceApi.getConfiguration("workbench").get<string>("reduceMotion", "auto") === "on";
  }

  private async postHostMessage(message: PixelOfficeHostMessage): Promise<void> {
    try {
      await this.panel.webview.postMessage(message);
    } catch (error) {
      this.logRenderError(error);
      this.panel.webview.html = this.getFallbackHtmlContent(error);
      this.htmlInitialized = true;
    }
  }

  private async handleRuntimeRegistryChange(): Promise<void> {
    const nextScene = this.buildScene();

    if (!this.htmlInitialized || !this.lastScene) {
      await this.postSceneUpdate("runtime_refresh", nextScene);
      return;
    }

    const previousScene = this.lastScene;
    const avatarTransitions = deriveAvatarTransitions(previousScene.room.avatars, nextScene.room.avatars)
      .map((transition) => ({
        type: "AvatarTransition" as const,
        avatar: transition.avatar,
        from: transition.from,
        occurredAt: nextScene.generatedAt,
        removeAfterMs: transition.removeAfterMs,
      }));

    this.lastScene = nextScene;

    // Desk interactions and hover previews depend on the full desk view model,
    // so runtime changes publish the fresh scene before any incremental avatar updates.
    await this.postSceneUpdate("runtime_refresh", nextScene);

    for (const message of avatarTransitions) {
      await this.postHostMessage(message);
    }
  }

  private update(reason: SceneUpdateReason): void {
    this.panel.title = `Pixel Room: ${WorkpackPixelRoomPanel.getWorkpackTitle(this.workpack)}`;
    const scene = this.buildScene();
    this.lastScene = scene;

    if (!this.htmlInitialized) {
      this.panel.webview.html = this.getHtmlContent(scene);
      this.htmlInitialized = true;
      return;
    }

    void this.postSceneUpdate(reason, scene);
  }

  private getHtmlContent(scene: SceneState): string {
    try {
      return buildPixelRoomHtml(this.panel.webview, scene);
    } catch (error) {
      this.logRenderError(error);
      return this.getFallbackHtmlContent(error);
    }
  }

  private async postSceneUpdate(reason: SceneUpdateReason, scene: SceneState = this.buildScene()): Promise<void> {
    if (!this.htmlInitialized) {
      this.update(reason);
      return;
    }

    this.lastScene = scene;
    await this.postHostMessage({
      type: "SceneUpdate",
      scene,
      reason,
    });
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isPixelOfficeWebviewMessage(message)) {
      return;
    }

    if (message.type === "DeskClicked" || message.type === "DeskHovered") {
      return;
    }

    const scene = this.buildScene();
    const desk = this.getDesk(scene, message.deskId, message.promptStem);
    if (!desk) {
      return;
    }

    if (message.type === "AgentAssignRequested") {
      const providerAvailable = scene.providers.some((provider) => provider.id === message.providerId);
      if (!providerAvailable) {
        return;
      }

      await vscode.commands.executeCommand(WORKPACK_MANAGER_COMMANDS.assignAgent, {
        contextValue: "prompt",
        workpackId: this.workpack.meta.id,
        folderPath: this.workpack.folderPath,
        promptStem: desk.promptStem,
        providerId: message.providerId,
      });
      this.scheduleRefresh();
      return;
    }

    if (!this.isDeskActionAllowed(desk, message.action)) {
      return;
    }

    await this.dispatchPromptAction(desk, message.action);
  }

  private getDesk(scene: SceneState, deskId: string, promptStem: string): PromptDesk | undefined {
    return scene.room.desks.find((desk) => desk.id === deskId && desk.promptStem === promptStem);
  }

  private isDeskActionAllowed(desk: PromptDesk, action: PromptActionKind): boolean {
    return (
      desk.actions.some((item) => item.action === action) ||
      desk.preview.links.some((link) => link.action === action)
    );
  }

  private async dispatchPromptAction(desk: PromptDesk, action: PromptActionKind): Promise<void> {
    if (action === "open_prompt" && desk.promptFilePath) {
      await this.openFile(desk.promptFilePath);
      return;
    }

    if (action === "open_output" && desk.outputPath) {
      await this.openFile(desk.outputPath);
      return;
    }

    const commandId = this.getCommandIdForAction(action);
    if (!commandId) {
      return;
    }

    await vscode.commands.executeCommand(commandId, {
      contextValue: "prompt",
      workpackId: this.workpack.meta.id,
      folderPath: this.workpack.folderPath,
      promptStem: desk.promptStem,
      runId: desk.latestRunId,
    });
    this.scheduleRefresh();
  }

  private getCommandIdForAction(action: PromptActionKind): string | undefined {
    if (action === "execute") {
      return WORKPACK_MANAGER_COMMANDS.executePrompt;
    }

    if (action === "stop") {
      return WORKPACK_MANAGER_COMMANDS.stopPromptExecution;
    }

    if (action === "retry") {
      return WORKPACK_MANAGER_COMMANDS.retryPrompt;
    }

    if (action === "provide_input") {
      return WORKPACK_MANAGER_COMMANDS.provideAgentInput;
    }

    return undefined;
  }

  private async openFile(filePath: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(document, { preview: false });
  }

  private static getWorkpackTitle(workpack: WorkpackInstance): string {
    const title = (workpack as unknown as { meta?: { title?: unknown } }).meta?.title;
    if (typeof title !== "string" || title.trim().length === 0) {
      return "Unknown Workpack";
    }

    return title;
  }

  private getWorkpackId(workpack: WorkpackInstance): string {
    const id = (workpack as unknown as { meta?: { id?: unknown } }).meta?.id;
    if (typeof id !== "string" || id.trim().length === 0) {
      return "unknown-workpack";
    }

    return id;
  }

  private getOutputChannel(): vscode.OutputChannel {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    }

    return this.outputChannel;
  }

  private logRenderError(error: unknown): void {
    const detail = error instanceof Error
      ? `${error.message}${error.stack ? `\n${error.stack}` : ""}`
      : String(error);
    const message = `[workpack-pixel-room-panel] Unable to render ${this.getWorkpackId(this.workpack)}: ${detail}`;

    this.getOutputChannel().appendLine(message);
    console.error(message);
  }

  private getFallbackHtmlContent(error: unknown): string {
    const detail = error instanceof Error ? error.message : String(error);

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pixel Room Unavailable</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: #120f19;
        color: #f7ebc8;
        font-family: "Courier New", monospace;
      }

      .card {
        border: 4px solid #3e314f;
        background: #241d2f;
        padding: 16px;
      }

      h1 {
        margin: 0 0 12px;
        font-size: 20px;
        text-transform: uppercase;
      }

      p,
      pre {
        margin: 0 0 10px;
      }

      pre {
        white-space: pre-wrap;
        color: #e26068;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Pixel Room Unavailable</h1>
      <p>Workpack: <code>${this.getWorkpackId(this.workpack)}</code></p>
      <p>Check the <code>${OUTPUT_CHANNEL_NAME}</code> output channel for full diagnostics.</p>
      <pre>${detail}</pre>
    </main>
  </body>
</html>`;
  }

  public dispose(): void {
    this.disposeInternal(true);
  }

  private disposeInternal(disposePanel: boolean): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    WorkpackPixelRoomPanel.currentPanel = undefined;

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    this.runtimeSubscription?.dispose();
    this.runtimeSubscription = undefined;
    this.outputChannel?.dispose();
    this.outputChannel = undefined;
    disposeAll(this.fileWatcherDisposables);

    const disposables = this.disposables;
    this.disposables.length = 0;
    for (const disposable of disposables) {
      disposable.dispose();
    }

    if (disposePanel) {
      this.panel.dispose();
    }
  }
}
