import * as vscode from "vscode";
import type { WorkpackInstance } from "../models";
import type { LobbySceneState, LobbySettingsState } from "../models/pixel-office";
import { buildLobbySceneState } from "./pixel-office/lobby-scene-builder";
import { buildLobbyHtml } from "./pixel-office/render-lobby";
import { discoverWorkpacks } from "../parser/workpack-discoverer";
import { WORKPACK_MANAGER_COMMANDS } from "../commands/register-commands";
import { parseWorkpackInstance } from "../parser/workpack-parser";

const PANEL_VIEW_TYPE = "workpackManager.lobbyPanel";
const REFRESH_DEBOUNCE_MS = 300;

export interface WorkpackLobbyPanelOptions {
  extensionUri: vscode.Uri;
}

interface LobbyWebviewMessage {
  type: string;
  workpackId?: string;
  settings?: {
    codexApiKey: string | null;
    codexBaseUrl: string;
    codexModel: string;
    copilotMaxPromptTokens: number;
  };
}

function isLobbyWebviewMessage(message: unknown): message is LobbyWebviewMessage {
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return false;
  }
  const candidate = message as Record<string, unknown>;
  return typeof candidate.type === "string";
}

function readCurrentSettings(): LobbySettingsState {
  const configuration = vscode.workspace.getConfiguration("workpackManager");
  const rawKey = configuration.get<string>("codex.apiKey", "");
  return {
    codexApiKey: rawKey,
    codexBaseUrl: configuration.get<string>("codex.baseUrl", "https://api.openai.com/v1"),
    codexModel: configuration.get<string>("codex.model", "gpt-4o"),
    copilotMaxPromptTokens: configuration.get<number>("copilot.maxPromptTokens", 8_192),
  };
}

function getAllWorkspacePaths(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
}

export class WorkpackLobbyPanel {
  public static currentPanel: WorkpackLobbyPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private refreshTimer: NodeJS.Timeout | undefined;
  private disposed = false;
  private htmlInitialized = false;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.onDidDispose(() => this.disposeInternal(false), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message: unknown) => void this.handleMessage(message),
      null,
      this.disposables,
    );

    this.setupFileWatcher();
    void this.initialRender();
  }

  public static createOrShow(extensionUri: vscode.Uri): void {
    if (WorkpackLobbyPanel.currentPanel) {
      WorkpackLobbyPanel.currentPanel.panel.reveal(vscode.ViewColumn.Active);
      void WorkpackLobbyPanel.currentPanel.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PANEL_VIEW_TYPE,
      "Pixel Office Lobby",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [extensionUri] },
    );

    WorkpackLobbyPanel.currentPanel = new WorkpackLobbyPanel(panel, extensionUri);
  }

  private setupFileWatcher(): void {
    const watcher = vscode.workspace.createFileSystemWatcher("**/workpacks/instances/**/*");
    const queueRefresh = () => this.scheduleRefresh();
    this.disposables.push(
      watcher,
      watcher.onDidCreate(queueRefresh),
      watcher.onDidChange(queueRefresh),
      watcher.onDidDelete(queueRefresh),
    );
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => void this.refresh(), REFRESH_DEBOUNCE_MS);
  }

  private async buildScene(): Promise<LobbySceneState> {
    const paths = getAllWorkspacePaths();
    let workpacks: WorkpackInstance[] = [];
    if (paths.length > 0) {
      workpacks = await discoverWorkpacks(paths);
    }
    return buildLobbySceneState(workpacks, { settings: readCurrentSettings() });
  }

  private async initialRender(): Promise<void> {
    const scene = await this.buildScene();
    this.panel.webview.html = buildLobbyHtml(this.panel.webview, scene);
    this.htmlInitialized = true;
  }

  private async refresh(): Promise<void> {
    if (this.disposed) return;
    const scene = await this.buildScene();
    if (!this.htmlInitialized) {
      this.panel.webview.html = buildLobbyHtml(this.panel.webview, scene);
      this.htmlInitialized = true;
      return;
    }
    await this.panel.webview.postMessage({ type: "LobbySceneUpdate", scene });
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isLobbyWebviewMessage(message)) return;

    if (message.type === "OpenRoom" && typeof message.workpackId === "string") {
      await this.openRoom(message.workpackId);
      return;
    }

    if (message.type === "SaveSettings" && message.settings) {
      await this.saveSettings(message.settings);
      return;
    }
  }

  private async openRoom(workpackId: string): Promise<void> {
    const paths = getAllWorkspacePaths();
    if (paths.length === 0) return;

    const workpacks = await discoverWorkpacks(paths);
    const target = workpacks.find((w) => w.meta.id === workpackId);
    if (!target) {
      await vscode.window.showWarningMessage(`Workpack '${workpackId}' not found.`);
      return;
    }

    const workpack = await parseWorkpackInstance(target.folderPath);
    await vscode.commands.executeCommand(WORKPACK_MANAGER_COMMANDS.openPixelRoom, {
      contextValue: "workpack",
      workpackId: workpack.meta.id,
      folderPath: workpack.folderPath,
    });
  }

  private async saveSettings(settings: {
    codexApiKey: string | null;
    codexBaseUrl: string;
    codexModel: string;
    copilotMaxPromptTokens: number;
  }): Promise<void> {
    const configuration = vscode.workspace.getConfiguration("workpackManager");
    if (settings.codexApiKey !== null) {
      await configuration.update("codex.apiKey", settings.codexApiKey, vscode.ConfigurationTarget.Global);
    }
    await configuration.update("codex.baseUrl", settings.codexBaseUrl, vscode.ConfigurationTarget.Global);
    await configuration.update("codex.model", settings.codexModel, vscode.ConfigurationTarget.Global);
    await configuration.update(
      "copilot.maxPromptTokens",
      settings.copilotMaxPromptTokens,
      vscode.ConfigurationTarget.Global,
    );
  }

  public dispose(): void {
    this.disposeInternal(true);
  }

  private disposeInternal(disposePanel: boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    WorkpackLobbyPanel.currentPanel = undefined;

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }

    if (disposePanel) {
      this.panel.dispose();
    }
  }
}
