import * as vscode from "vscode";
import type { AgentRunSnapshot, ExecutionRegistry } from "../agents/execution-registry";
import { getPromptThemeIcon, getPromptStatusIcon } from "./status-icons";

function getActiveAgentContextValue(status: AgentRunSnapshot["status"]): string {
  if (status === "queued") {
    return "activeAgent.queued";
  }

  if (status === "in_progress") {
    return "activeAgent.inProgress";
  }

  if (status === "human_input_required") {
    return "activeAgent.humanInputRequired";
  }

  if (status === "complete") {
    return "activeAgent.complete";
  }

  if (status === "failed") {
    return "activeAgent.failed";
  }

  return "activeAgent.cancelled";
}

function formatDuration(startedAt: string): string {
  const elapsedMs = Math.max(0, Date.now() - Date.parse(startedAt));
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export class ActiveAgentTreeItem extends vscode.TreeItem {
  constructor(public readonly run: AgentRunSnapshot) {
    super(run.promptStem, vscode.TreeItemCollapsibleState.None);

    const statusIcon = getPromptStatusIcon(run.status);
    this.id = `active-agent:${run.runId}`;
    this.contextValue = getActiveAgentContextValue(run.status);
    this.description = `${run.providerId ?? "unassigned"} · ${formatDuration(run.startedAt)}`;
    this.tooltip = [
      `${run.workpackId} / ${run.promptStem}`,
      `Status: ${statusIcon.label}`,
      `Agent: ${run.providerId ?? "unassigned"}`,
      run.summary ? `Summary: ${run.summary}` : undefined,
      run.error ? `Error: ${run.error}` : undefined,
      run.inputRequest ? `Input: ${run.inputRequest}` : undefined,
    ]
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      .join("\n");
    this.iconPath = getPromptThemeIcon(run.status);

    if (run.promptFilePath) {
      const fileUri = vscode.Uri.file(run.promptFilePath);
      this.resourceUri = fileUri;
      this.command = {
        command: "vscode.open",
        title: "Open Prompt",
        arguments: [fileUri],
      };
    }
  }

  get workpackId(): string {
    return this.run.workpackId;
  }

  get promptStem(): string {
    return this.run.promptStem;
  }

  get folderPath(): string | undefined {
    return this.run.folderPath;
  }

  get filePath(): string | undefined {
    return this.run.promptFilePath;
  }

  get runId(): string {
    return this.run.runId;
  }
}

export class ActiveAgentsTreeProvider implements vscode.TreeDataProvider<ActiveAgentTreeItem>, vscode.Disposable {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ActiveAgentTreeItem | undefined>();
  private readonly registrySubscription: vscode.Disposable;

  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly executionRegistry: ExecutionRegistry) {
    this.registrySubscription = this.executionRegistry.onDidChangeRuns(() => {
      this.refresh();
    });
  }

  dispose(): void {
    this.registrySubscription.dispose();
    this._onDidChangeTreeData.dispose();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ActiveAgentTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ActiveAgentTreeItem): Promise<ActiveAgentTreeItem[]> {
    if (element) {
      return [];
    }

    return this.executionRegistry.listActiveRuns().map((run) => new ActiveAgentTreeItem(run));
  }
}