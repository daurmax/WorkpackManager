import * as path from "node:path";
import * as vscode from "vscode";
import type { WorkpackInstance } from "../models";
import { parseWorkpackInstance } from "../parser/workpack-parser";
import { scanOutputs } from "../state/output-scanner";
import { getReadyPrompts } from "../graph/dependency-resolver";
import { getPromptStatusIcon, getWorkpackStatusIcon } from "./status-icons";

const PANEL_VIEW_TYPE = "workpackManager.detailPanel";
const REFRESH_DEBOUNCE_MS = 200;
const OUTPUT_CHANNEL_NAME = "Workpack Manager";

export interface WebviewMessage {
  command: "openFile" | "assignAgent" | "executePrompt";
  payload: { filePath?: string; promptStem?: string };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getNonce(): string {
  const possibleCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  for (let index = 0; index < 32; index += 1) {
    nonce += possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
  }

  return nonce;
}

function toStatusClass(status: string): string {
  return status.replaceAll("_", "-");
}

function isWebviewMessage(message: unknown): message is WebviewMessage {
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return false;
  }

  const candidate = message as Record<string, unknown>;
  const payload = candidate.payload;

  if (!["openFile", "assignAgent", "executePrompt"].includes(String(candidate.command))) {
    return false;
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return false;
  }

  const typedPayload = payload as Record<string, unknown>;
  const filePath = typedPayload.filePath;
  const promptStem = typedPayload.promptStem;

  return (
    (filePath === undefined || typeof filePath === "string") &&
    (promptStem === undefined || typeof promptStem === "string")
  );
}

export class WorkpackDetailPanel {
  public static currentPanel: WorkpackDetailPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private workpack: WorkpackInstance;
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private refreshTimer: NodeJS.Timeout | undefined;
  private outputChannel: vscode.OutputChannel | undefined;
  private disposed = false;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, workpack: WorkpackInstance) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.workpack = workpack;

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

    this.recreateFileWatcher();
    this.update();
  }

  public static createOrShow(extensionUri: vscode.Uri, workpack: WorkpackInstance): void {
    const codiconRoot = vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode", "codicons", "dist");

    if (WorkpackDetailPanel.currentPanel) {
      WorkpackDetailPanel.currentPanel.workpack = workpack;
      WorkpackDetailPanel.currentPanel.recreateFileWatcher();
      WorkpackDetailPanel.currentPanel.panel.reveal(vscode.ViewColumn.Active);
      WorkpackDetailPanel.currentPanel.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PANEL_VIEW_TYPE,
      `Workpack: ${WorkpackDetailPanel.getWorkpackTitle(workpack)}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri, vscode.Uri.file(workpack.folderPath), codiconRoot],
      },
    );

    WorkpackDetailPanel.currentPanel = new WorkpackDetailPanel(panel, extensionUri, workpack);
  }

  private recreateFileWatcher(): void {
    this.fileWatcher?.dispose();

    const pattern = new vscode.RelativePattern(this.workpack.folderPath, "**/*");
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    const queueRefresh = (): void => {
      this.scheduleRefresh();
    };

    this.fileWatcher.onDidCreate(queueRefresh, this, this.disposables);
    this.fileWatcher.onDidChange(queueRefresh, this, this.disposables);
    this.fileWatcher.onDidDelete(queueRefresh, this, this.disposables);
    this.disposables.push(this.fileWatcher);
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
      };
      this.update();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[workpack-detail-panel] Unable to refresh ${this.getWorkpackId(this.workpack)}: ${detail}`);
    }
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isWebviewMessage(message)) {
      return;
    }

    if (message.command === "openFile") {
      const filePath = message.payload.filePath;
      if (!filePath) {
        return;
      }

      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.workpack.folderPath, filePath);
      const fileUri = vscode.Uri.file(resolvedPath);
      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document, { preview: false });
      return;
    }

    if (message.command === "assignAgent" && message.payload.promptStem) {
      await vscode.commands.executeCommand(
        "workpackManager.assignAgent",
        this.workpack.meta.id,
        message.payload.promptStem,
      );
      return;
    }

    if (message.command === "executePrompt" && message.payload.promptStem) {
      await vscode.commands.executeCommand(
        "workpackManager.executePrompt",
        this.workpack.meta.id,
        message.payload.promptStem,
      );
    }
  }

  private update(): void {
    this.panel.title = `Workpack: ${WorkpackDetailPanel.getWorkpackTitle(this.workpack)}`;
    this.panel.webview.html = this.getHtmlContent(this.workpack);
  }

  private getHtmlContent(workpack: WorkpackInstance): string {
    try {
      const nonce = getNonce();
      const codiconHref = this.panel.webview
        .asWebviewUri(
          vscode.Uri.joinPath(this.extensionUri, "node_modules", "@vscode", "codicons", "dist", "codicon.css"),
        )
        .toString();
      const outputScan = scanOutputs(path.join(workpack.folderPath, "outputs"));
      const prompts = workpack.meta.prompts;
      const state = workpack.state;
      const blockedBy = new Set(state?.blockedBy ?? []);
      const dependencies = workpack.meta.requiresWorkpack;

      const promptStatuses = prompts.map((prompt) => state?.promptStatus[prompt.stem]?.status ?? "pending");
      const completedPromptCount = promptStatuses.filter(
        (status) => status === "complete" || status === "skipped",
      ).length;
      const blockedPromptCount = promptStatuses.filter((status) => status === "blocked").length;
      const inProgressPromptCount = promptStatuses.filter((status) => status === "in_progress").length;
      const readyPrompts = state ? getReadyPrompts(workpack.meta, state) : [];

    const dependencyRows = dependencies.length
      ? dependencies
          .map((dependencyId) => {
            const blocked = blockedBy.has(dependencyId);
            const statusClass = blocked ? "blocked" : "complete";
            const statusLabel = blocked ? "Blocked" : "Unblocked";
            const icon = blocked ? "error" : "check";

            return `
              <li class="dependency-row">
                <span class="codicon codicon-${icon}" aria-hidden="true"></span>
                <code>${escapeHtml(dependencyId)}</code>
                <span class="badge badge--${statusClass}">${statusLabel}</span>
              </li>
            `;
          })
          .join("")
      : '<p class="empty-state">No cross-workpack dependencies declared.</p>';

    const promptRows = prompts
      .map((prompt) => {
        const promptState = state?.promptStatus[prompt.stem];
        const status = promptState?.status ?? "pending";
        const assignedAgent = promptState?.assignedAgent ?? state?.agentAssignments[prompt.stem] ?? "Unassigned";
        const statusIcon = getPromptStatusIcon(status);
        const icon = statusIcon.codicon;
        const statusLabel = statusIcon.label;

        return `
          <tr>
            <td><code>${escapeHtml(prompt.stem)}</code></td>
            <td>${escapeHtml(prompt.agentRole)}</td>
            <td>
              <span class="status-chip">
                <span class="codicon codicon-${icon}" aria-hidden="true"></span>
                <span class="badge badge--${toStatusClass(status)}">${statusLabel}</span>
              </span>
            </td>
            <td>${escapeHtml(assignedAgent)}</td>
            <td>${escapeHtml(prompt.estimatedEffort)}</td>
            <td class="actions-cell">
              <button class="action" data-command="assignAgent" data-prompt-stem="${escapeHtml(prompt.stem)}">Assign</button>
              <button class="action" data-command="executePrompt" data-prompt-stem="${escapeHtml(prompt.stem)}">Run</button>
            </td>
          </tr>
        `;
      })
      .join("");

    const outputRows = outputScan.artifacts
      .slice()
      .sort((left, right) => left.promptStem.localeCompare(right.promptStem))
      .map((artifact) => {
        const outputStatusClass = artifact.isValidJson ? "complete" : "blocked";
        const outputStatusLabel = artifact.isValidJson ? "Valid" : "Invalid";
        const outputStatusIcon = artifact.isValidJson ? "pass-filled" : "error";

        return `
          <li class="output-row">
            <span class="codicon codicon-${outputStatusIcon}" aria-hidden="true"></span>
            <a href="#" class="file-link" data-command="openFile" data-file-path="${escapeHtml(artifact.filePath)}">
              ${escapeHtml(`${artifact.promptStem}.json`)}
            </a>
            <span class="badge badge--${outputStatusClass}">${outputStatusLabel}</span>
          </li>
        `;
      })
      .join("");

    const outputsMarkup =
      outputRows.length > 0 ? outputRows : '<p class="empty-state">No output JSON files discovered.</p>';

    const overallStatus = state?.overallStatus ?? "unknown";
    const overallStatusIcon = getWorkpackStatusIcon(overallStatus);
    const metadataTags = workpack.meta.tags.length > 0 ? workpack.meta.tags.join(", ") : "None";
    const metadataOwners = workpack.meta.owners.length > 0 ? workpack.meta.owners.join(", ") : "None";
    const metadataRepos = workpack.meta.repos.length > 0 ? workpack.meta.repos.join(", ") : "None";

      return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; font-src ${this.panel.webview.cspSource}; img-src ${this.panel.webview.cspSource} data:; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <link href="${codiconHref}" rel="stylesheet" />
    <title>${escapeHtml(workpack.meta.title)}</title>
    <style>
      :root {
        color-scheme: light dark;
      }

      body {
        margin: 0;
        padding: 0;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
      }

      .container {
        display: grid;
        gap: 12px;
        padding: 16px;
      }

      .section {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        background: var(--vscode-sideBar-background);
        padding: 12px;
      }

      .section h2 {
        margin: 0 0 10px;
        font-size: 13px;
        font-weight: 600;
      }

      .header-title {
        margin: 0;
        font-size: 20px;
        line-height: 1.35;
      }

      .header-subtitle {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
        align-items: center;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11px;
        line-height: 1.4;
        border: 1px solid transparent;
      }

      .badge--not-started,
      .badge--pending,
      .badge--unknown {
        background: color-mix(in srgb, var(--vscode-disabledForeground) 20%, transparent);
        border-color: var(--vscode-disabledForeground);
      }

      .badge--in-progress {
        background: color-mix(in srgb, var(--vscode-charts-blue) 20%, transparent);
        border-color: var(--vscode-charts-blue);
      }

      .badge--blocked,
      .badge--abandoned {
        background: color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent);
        border-color: var(--vscode-errorForeground);
      }

      .badge--review {
        background: color-mix(in srgb, var(--vscode-editorInfo-foreground) 20%, transparent);
        border-color: var(--vscode-editorInfo-foreground);
      }

      .badge--complete,
      .badge--skipped {
        background: color-mix(in srgb, var(--vscode-testing-iconPassed) 20%, transparent);
        border-color: var(--vscode-testing-iconPassed);
      }

      .badge--category {
        background: color-mix(in srgb, var(--vscode-editorWarning-foreground) 20%, transparent);
        border-color: var(--vscode-editorWarning-foreground);
      }

      .status-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .metadata-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 8px 12px;
      }

      .metadata-entry {
        display: grid;
        gap: 2px;
      }

      .metadata-label {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 8px;
      }

      .summary-value {
        font-size: 20px;
        font-weight: 600;
        line-height: 1.1;
      }

      .summary-label {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
      }

      .dependency-list,
      .outputs-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }

      .dependency-row,
      .output-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .empty-state {
        margin: 0;
        color: var(--vscode-descriptionForeground);
      }

      .prompt-table {
        width: 100%;
        border-collapse: collapse;
      }

      .prompt-table th,
      .prompt-table td {
        text-align: left;
        padding: 7px 8px;
        border-bottom: 1px solid var(--vscode-panel-border);
        vertical-align: top;
      }

      .prompt-table th {
        color: var(--vscode-descriptionForeground);
        font-weight: 600;
        font-size: 11px;
      }

      .actions-cell {
        white-space: nowrap;
      }

      .action {
        border: 1px solid var(--vscode-button-border);
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border-radius: 4px;
        padding: 3px 8px;
        margin-right: 6px;
        cursor: pointer;
      }

      .action:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }

      .file-link {
        color: var(--vscode-textLink-foreground);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    </style>
  </head>
  <body>
    <main class="container" id="app">
      <section class="section">
        <h1 class="header-title">${escapeHtml(workpack.meta.title)}</h1>
        <div class="header-subtitle">
          <span>ID <code>${escapeHtml(workpack.meta.id)}</code></span>
          <span class="badge badge--category">${escapeHtml(workpack.meta.category)}</span>
          <span>Protocol <code>${escapeHtml(workpack.protocolVersion)}</code></span>
          <span>Workpack Version <code>${escapeHtml(workpack.meta.workpackVersion)}</code></span>
        </div>
      </section>

      <section class="section">
        <h2>Metadata</h2>
        <div class="metadata-grid">
          <div class="metadata-entry">
            <span class="metadata-label">Tags</span>
            <span>${escapeHtml(metadataTags)}</span>
          </div>
          <div class="metadata-entry">
            <span class="metadata-label">Owners</span>
            <span>${escapeHtml(metadataOwners)}</span>
          </div>
          <div class="metadata-entry">
            <span class="metadata-label">Repos</span>
            <span>${escapeHtml(metadataRepos)}</span>
          </div>
          <div class="metadata-entry">
            <span class="metadata-label">Delivery Mode</span>
            <span>${escapeHtml(workpack.meta.deliveryMode)}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Plan Summary</h2>
        <div class="summary-grid">
          <div>
            <div class="summary-value">${prompts.length}</div>
            <div class="summary-label">Prompts</div>
          </div>
          <div>
            <div class="summary-value">${completedPromptCount}</div>
            <div class="summary-label">Completed</div>
          </div>
          <div>
            <div class="summary-value">${inProgressPromptCount}</div>
            <div class="summary-label">In Progress</div>
          </div>
          <div>
            <div class="summary-value">${blockedPromptCount}</div>
            <div class="summary-label">Blocked</div>
          </div>
          <div>
            <div class="summary-value">${readyPrompts.length}</div>
            <div class="summary-label">Ready</div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Status</h2>
        <span class="status-chip">
          <span class="codicon codicon-${overallStatusIcon.codicon}" aria-hidden="true"></span>
          <span class="badge badge--${toStatusClass(overallStatus)}">${overallStatusIcon.label}</span>
        </span>
      </section>

      <section class="section">
        <h2>Dependencies</h2>
        ${dependencies.length > 0 ? `<ul class="dependency-list">${dependencyRows}</ul>` : dependencyRows}
      </section>

      <section class="section">
        <h2>Prompt Table</h2>
        <table class="prompt-table">
          <thead>
            <tr>
              <th>Prompt</th>
              <th>Agent Role</th>
              <th>Status</th>
              <th>Assigned Agent</th>
              <th>Effort</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${promptRows}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Outputs</h2>
        ${outputRows.length > 0 ? `<ul class="outputs-list">${outputsMarkup}</ul>` : outputsMarkup}
      </section>
    </main>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const app = document.getElementById("app");

      if (app) {
        app.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) {
            return;
          }

          const actionElement = target.closest("[data-command]");
          if (!actionElement) {
            return;
          }

          event.preventDefault();
          const command = actionElement.getAttribute("data-command");
          if (!command) {
            return;
          }

          const filePath = actionElement.getAttribute("data-file-path") || undefined;
          const promptStem = actionElement.getAttribute("data-prompt-stem") || undefined;

          vscode.postMessage({
            command,
            payload: { filePath, promptStem }
          });
        });
      }
    </script>
  </body>
</html>`;
    } catch (error) {
      this.logRenderError(error, workpack);
      return this.getFallbackHtmlContent(workpack, error);
    }
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

  private logRenderError(error: unknown, workpack: WorkpackInstance): void {
    const detail = error instanceof Error
      ? `${error.message}${error.stack ? `\n${error.stack}` : ""}`
      : String(error);
    const message = `[workpack-detail-panel] Unable to render details for ${this.getWorkpackId(
      workpack,
    )}: ${detail}`;

    this.getOutputChannel().appendLine(message);
    console.error(message);
  }

  private getFallbackHtmlContent(workpack: WorkpackInstance, error: unknown): string {
    const nonce = getNonce();
    const title = WorkpackDetailPanel.getWorkpackTitle(workpack);
    const workpackId = this.getWorkpackId(workpack);
    const detail = error instanceof Error ? error.message : String(error);

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        margin: 0;
        padding: 16px;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-font-family);
      }

      .card {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 12px;
        background: var(--vscode-sideBar-background);
      }

      h1 {
        margin: 0 0 8px;
        font-size: 18px;
      }

      p {
        margin: 0 0 8px;
      }

      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        color: var(--vscode-errorForeground);
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Unable to render workpack details</h1>
      <p>Workpack: <code>${escapeHtml(workpackId)}</code></p>
      <p>This workpack contains malformed data. Check the <code>${escapeHtml(
        OUTPUT_CHANNEL_NAME,
      )}</code> output channel for full diagnostics.</p>
      <pre>${escapeHtml(detail)}</pre>
    </main>
    <script nonce="${nonce}">
      // Keep script block to satisfy CSP nonce consistency in webview snapshots.
    </script>
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
    WorkpackDetailPanel.currentPanel = undefined;

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    this.fileWatcher?.dispose();
    this.fileWatcher = undefined;
    this.outputChannel?.dispose();
    this.outputChannel = undefined;

    const disposables = this.disposables;
    this.disposables = [];
    for (const disposable of disposables) {
      disposable.dispose();
    }

    if (disposePanel) {
      this.panel.dispose();
    }
  }
}
