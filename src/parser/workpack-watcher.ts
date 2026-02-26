import * as vscode from "vscode";
import type { WorkpackInstance } from "../models";
import { discoverWorkpacks, getManualWorkpackFolders } from "./workpack-discoverer";

const DEFAULT_DEBOUNCE_MS = 250;

export interface WorkpackWatcherOptions {
  workspaceFolders?: string[];
  debounceMs?: number;
  onWorkpacksChanged: (instances: WorkpackInstance[]) => void | Promise<void>;
}

export class WorkpackWatcher implements vscode.Disposable {
  private readonly onWorkpacksChanged: WorkpackWatcherOptions["onWorkpacksChanged"];
  private readonly debounceMs: number;
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly watchers: vscode.FileSystemWatcher[] = [];
  private debounceTimer: NodeJS.Timeout | undefined;
  private reindexQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: WorkpackWatcherOptions) {
    this.onWorkpacksChanged = options.onWorkpacksChanged;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  async start(): Promise<void> {
    this.initializeWatchers();
    await this.triggerReindex();
  }

  async refreshWatchers(): Promise<void> {
    this.clearWatchers();
    this.initializeWatchers();
    await this.triggerReindex();
  }

  async triggerReindex(): Promise<void> {
    const workspaceFolders = this.options.workspaceFolders ?? this.getWorkspaceFoldersFromVSCode();
    const instances = await discoverWorkpacks(workspaceFolders);
    await this.onWorkpacksChanged(instances);
  }

  dispose(): void {
    this.clearWatchers();
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }

    this.subscriptions.length = 0;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  private getWorkspaceFoldersFromVSCode(): string[] {
    return (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
  }

  private initializeWatchers(): void {
    const workspaceFolders = this.options.workspaceFolders ?? this.getWorkspaceFoldersFromVSCode();
    for (const workspaceFolder of workspaceFolders) {
      this.registerWatcher(new vscode.RelativePattern(workspaceFolder, "workpacks/instances/**/*"));
    }

    for (const manualFolder of getManualWorkpackFolders()) {
      this.registerWatcher(new vscode.RelativePattern(manualFolder, "**/*"));
    }

    this.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        void this.refreshWatchers();
      })
    );
  }

  private registerWatcher(pattern: vscode.GlobPattern): void {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate(() => this.scheduleReindex(), this, this.subscriptions);
    watcher.onDidChange(() => this.scheduleReindex(), this, this.subscriptions);
    watcher.onDidDelete(() => this.scheduleReindex(), this, this.subscriptions);
    this.watchers.push(watcher);
    this.subscriptions.push(watcher);
  }

  private clearWatchers(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }

    this.watchers.length = 0;
  }

  private scheduleReindex(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.reindexQueue = this.reindexQueue.then(async () => {
        await this.triggerReindex();
      });
    }, this.debounceMs);
  }
}
