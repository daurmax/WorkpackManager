import * as path from "node:path";
import * as vscode from "vscode";
import { buildGitDiffGroups, type GitDiffChangeKind, type GitDiffFileEntry, type GitDiffRepositoryGroup } from "./git-diff-model";
import { GitStatus, type GitApi, type GitChange, type GitExtension, type GitRepository } from "./git-extension-api";

const GIT_EXTENSION_ID = "vscode.git";
const REFRESH_DEBOUNCE_MS = 150;
const DEFAULT_MAX_FILES_PER_REPOSITORY = 100;

type GitDiffMessageKind = "info" | "warning";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toChangeSnapshot(change: GitChange): {
  readonly uriPath: string;
  readonly originalUriPath: string;
  readonly renameUriPath?: string;
  readonly status: GitStatus;
} {
  return {
    uriPath: change.uri.fsPath,
    originalUriPath: change.originalUri.fsPath,
    renameUriPath: change.renameUri?.fsPath,
    status: change.status
  };
}

function createEmptyDiffUri(entry: GitDiffFileEntry, side: "left" | "right"): vscode.Uri {
  return vscode.Uri.from({
    scheme: "untitled",
    path: `/${entry.repositoryName}/${entry.relativePath}`,
    query: `side=${side}`
  });
}

function buildDiffTitle(entry: GitDiffFileEntry): string {
  return `${entry.repositoryName}: ${entry.relativePath} (${entry.bucketLabel})`;
}

function resolveMergeDiffUris(api: GitApi, entry: GitDiffFileEntry): { left: vscode.Uri; right: vscode.Uri } {
  const changeUri = vscode.Uri.file(entry.uriPath);

  switch (entry.status) {
    case GitStatus.ADDED_BY_US:
      return {
        left: createEmptyDiffUri(entry, "left"),
        right: api.toGitUri(changeUri, ":2")
      };
    case GitStatus.DELETED_BY_US:
      return {
        left: createEmptyDiffUri(entry, "left"),
        right: api.toGitUri(changeUri, ":3")
      };
    case GitStatus.DELETED_BY_THEM:
      return {
        left: api.toGitUri(changeUri, ":2"),
        right: createEmptyDiffUri(entry, "right")
      };
    case GitStatus.ADDED_BY_THEM:
      return {
        left: createEmptyDiffUri(entry, "left"),
        right: api.toGitUri(changeUri, ":3")
      };
    default:
      return {
        left: api.toGitUri(changeUri, ":2"),
        right: api.toGitUri(changeUri, ":3")
      };
  }
}

function resolveStagedDiffUris(api: GitApi, entry: GitDiffFileEntry): { left: vscode.Uri; right: vscode.Uri } {
  const changeUri = vscode.Uri.file(entry.uriPath);
  const originalUri = vscode.Uri.file(entry.originalUriPath);

  switch (entry.status) {
    case GitStatus.INDEX_ADDED:
      return {
        left: createEmptyDiffUri(entry, "left"),
        right: api.toGitUri(changeUri, "")
      };
    case GitStatus.INDEX_DELETED:
      return {
        left: api.toGitUri(changeUri, "HEAD"),
        right: createEmptyDiffUri(entry, "right")
      };
    case GitStatus.INDEX_RENAMED:
    case GitStatus.INDEX_COPIED:
      return {
        left: api.toGitUri(originalUri, "HEAD"),
        right: api.toGitUri(changeUri, "")
      };
    default:
      return {
        left: api.toGitUri(originalUri, "HEAD"),
        right: api.toGitUri(changeUri, "")
      };
  }
}

function resolveWorkingTreeDiffUris(api: GitApi, entry: GitDiffFileEntry): { left: vscode.Uri; right: vscode.Uri } {
  const changeUri = vscode.Uri.file(entry.uriPath);
  const originalUri = vscode.Uri.file(entry.originalUriPath);

  switch (entry.status) {
    case GitStatus.UNTRACKED:
    case GitStatus.INTENT_TO_ADD:
      return {
        left: createEmptyDiffUri(entry, "left"),
        right: changeUri
      };
    case GitStatus.DELETED:
      return {
        left: api.toGitUri(changeUri, "~"),
        right: createEmptyDiffUri(entry, "right")
      };
    case GitStatus.INTENT_TO_RENAME:
      return {
        left: api.toGitUri(originalUri, "~"),
        right: changeUri
      };
    case GitStatus.TYPE_CHANGED:
    case GitStatus.MODIFIED:
    default:
      return {
        left: api.toGitUri(changeUri, "~"),
        right: changeUri
      };
  }
}

function resolveDiffUris(api: GitApi, entry: GitDiffFileEntry): { left: vscode.Uri; right: vscode.Uri } {
  if (entry.bucket === "merge") {
    return resolveMergeDiffUris(api, entry);
  }

  if (entry.bucket === "staged") {
    return resolveStagedDiffUris(api, entry);
  }

  return resolveWorkingTreeDiffUris(api, entry);
}

function resolveChangeIcon(kind: GitDiffChangeKind): vscode.ThemeIcon {
  switch (kind) {
    case "added":
      return new vscode.ThemeIcon("diff-added", new vscode.ThemeColor("gitDecoration.addedResourceForeground"));
    case "deleted":
      return new vscode.ThemeIcon("diff-removed", new vscode.ThemeColor("gitDecoration.deletedResourceForeground"));
    case "renamed":
      return new vscode.ThemeIcon("diff-renamed", new vscode.ThemeColor("gitDecoration.renamedResourceForeground"));
    case "copied":
      return new vscode.ThemeIcon("files", new vscode.ThemeColor("gitDecoration.renamedResourceForeground"));
    case "typeChanged":
      return new vscode.ThemeIcon("symbol-file", new vscode.ThemeColor("gitDecoration.modifiedResourceForeground"));
    case "conflict":
      return new vscode.ThemeIcon("warning", new vscode.ThemeColor("gitDecoration.conflictingResourceForeground"));
    default:
      return new vscode.ThemeIcon("diff-modified", new vscode.ThemeColor("gitDecoration.modifiedResourceForeground"));
  }
}

class GitDiffRepositoryItem extends vscode.TreeItem {
  constructor(public readonly group: GitDiffRepositoryGroup) {
    super(group.name, vscode.TreeItemCollapsibleState.Expanded);

    this.id = `gitDiff:repo:${group.rootPath}`;
    this.contextValue = "gitDiff.repository";
    this.description = `${group.totalCount} change${group.totalCount === 1 ? "" : "s"}`;
    this.tooltip = `${group.name}\n${group.rootPath}`;
    this.iconPath = new vscode.ThemeIcon("repo");
  }
}

class GitDiffFileItem extends vscode.TreeItem {
  constructor(entry: GitDiffFileEntry, api: GitApi) {
    super(entry.relativePath, vscode.TreeItemCollapsibleState.None);

    const diffUris = resolveDiffUris(api, entry);
    const previousPathLine =
      entry.originalRelativePath && entry.originalRelativePath !== entry.relativePath
        ? `\nPrevious path: ${entry.originalRelativePath}`
        : "";

    this.id = `gitDiff:file:${entry.id}`;
    this.contextValue = "gitDiff.file";
    this.description = `${entry.changeLabel} · ${entry.bucketLabel}`;
    this.tooltip = `${entry.relativePath}\nRepository: ${entry.repositoryRootPath}\nType: ${entry.changeLabel}\nScope: ${entry.bucketLabel}${previousPathLine}`;
    this.iconPath = resolveChangeIcon(entry.kind);
    this.command = {
      command: "vscode.diff",
      title: "Open Git Diff",
      arguments: [diffUris.left, diffUris.right, buildDiffTitle(entry)]
    };
  }
}

class GitDiffMessageItem extends vscode.TreeItem {
  constructor(label: string, description: string | undefined, kind: GitDiffMessageKind) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.id = `gitDiff:message:${kind}:${label}`;
    this.contextValue = "gitDiff.message";
    this.description = description;
    this.iconPath =
      kind === "warning"
        ? new vscode.ThemeIcon("warning", new vscode.ThemeColor("editorWarning.foreground"))
        : new vscode.ThemeIcon("info", new vscode.ThemeColor("editorInfo.foreground"));
  }
}

class GitDiffOverflowItem extends vscode.TreeItem {
  constructor(group: GitDiffRepositoryGroup) {
    super(`${group.hiddenCount} more change${group.hiddenCount === 1 ? "" : "s"} not shown`, vscode.TreeItemCollapsibleState.None);

    this.id = `gitDiff:overflow:${group.rootPath}`;
    this.contextValue = "gitDiff.overflow";
    this.description = `Showing first ${group.visibleEntries.length} entries`;
    this.tooltip = `This view is showing the first ${group.visibleEntries.length} entries. Use Source Control for the full list.`;
    this.iconPath = new vscode.ThemeIcon("ellipsis");
  }
}

type GitDiffTreeNode =
  | GitDiffRepositoryItem
  | GitDiffFileItem
  | GitDiffMessageItem
  | GitDiffOverflowItem;

export class GitDiffTreeProvider implements vscode.TreeDataProvider<GitDiffTreeNode>, vscode.Disposable {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<GitDiffTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly disposables: vscode.Disposable[] = [];
  private readonly repositoryListeners = new Map<string, vscode.Disposable>();

  private gitExtensionDisposable: vscode.Disposable | undefined;
  private gitApiDisposables: vscode.Disposable[] = [];
  private gitExtension: GitExtension | undefined;
  private gitApi: GitApi | undefined;
  private loadPromise: Promise<void> | null = null;
  private refreshTimer: NodeJS.Timeout | undefined;

  private groups: GitDiffRepositoryGroup[] = [];
  private messageItem: GitDiffMessageItem | undefined;

  constructor(
    private readonly getWorkspacePaths: () => readonly string[],
    private readonly maxFilesPerRepository = DEFAULT_MAX_FILES_PER_REPOSITORY
  ) {
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.refresh();
      })
    );
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    this.gitExtensionDisposable?.dispose();
    this.gitExtensionDisposable = undefined;
    this.disposeGitApiListeners();
    this.disposeRepositoryListeners();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
    this._onDidChangeTreeData.dispose();
  }

  refresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      this.loadPromise = null;
      this._onDidChangeTreeData.fire(undefined);
    }, REFRESH_DEBOUNCE_MS);
  }

  getTreeItem(element: GitDiffTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: GitDiffTreeNode): Promise<GitDiffTreeNode[]> {
    await this.ensureLoaded();

    if (!element) {
      if (this.messageItem) {
        return [this.messageItem];
      }

      return this.groups.map((group) => new GitDiffRepositoryItem(group));
    }

    if (!(element instanceof GitDiffRepositoryItem) || !this.gitApi) {
      return [];
    }

    const items: GitDiffTreeNode[] = element.group.visibleEntries.map(
      (entry) => new GitDiffFileItem(entry, this.gitApi as GitApi)
    );

    if (element.group.hiddenCount > 0) {
      items.push(new GitDiffOverflowItem(element.group));
    }

    return items;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadTreeState().finally(() => {
        this.loadPromise = null;
      });
    }

    await this.loadPromise;
  }

  private async loadTreeState(): Promise<void> {
    this.groups = [];
    this.messageItem = undefined;

    const workspacePaths = [...this.getWorkspacePaths()];
    if (workspacePaths.length === 0) {
      this.messageItem = new GitDiffMessageItem(
        "Open a workspace folder to inspect Git changes.",
        "Git changes will appear here once a workspace is available.",
        "info"
      );
      return;
    }

    const gitApi = await this.getGitApi();
    if (!gitApi) {
      return;
    }

    this.syncRepositoryListeners(gitApi.repositories);

    if (gitApi.state !== "initialized" && gitApi.repositories.length === 0) {
      this.messageItem = new GitDiffMessageItem(
        "Scanning Git repositories...",
        "The built-in Git extension is still initializing.",
        "info"
      );
      return;
    }

    const repositories = gitApi.repositories.filter((repository) =>
      this.isWorkspaceRepository(repository.rootUri.fsPath, workspacePaths)
    );

    if (repositories.length === 0) {
      this.messageItem = new GitDiffMessageItem(
        "No Git repositories found.",
        "The current workspace folders do not contain an open Git repository.",
        "info"
      );
      return;
    }

    this.groups = buildGitDiffGroups(
      repositories.map((repository) => ({
        rootPath: repository.rootUri.fsPath,
        mergeChanges: repository.state.mergeChanges.map(toChangeSnapshot),
        indexChanges: repository.state.indexChanges.map(toChangeSnapshot),
        workingTreeChanges: repository.state.workingTreeChanges.map(toChangeSnapshot),
        untrackedChanges: repository.state.untrackedChanges.map(toChangeSnapshot)
      })),
      {
        workspacePaths,
        maxFilesPerRepository: this.maxFilesPerRepository
      }
    );

    if (this.groups.length === 0) {
      this.messageItem = new GitDiffMessageItem(
        "No changes detected.",
        "Working tree, staged, merge, and untracked changes will appear here.",
        "info"
      );
    }
  }

  private async getGitApi(): Promise<GitApi | undefined> {
    if (this.gitApi) {
      return this.gitApi;
    }

    const extension = vscode.extensions.getExtension<GitExtension>(GIT_EXTENSION_ID);
    if (!extension) {
      this.messageItem = new GitDiffMessageItem(
        "Git extension is unavailable.",
        "The built-in VS Code Git extension could not be found.",
        "warning"
      );
      return undefined;
    }

    try {
      if (!extension.isActive) {
        await extension.activate();
      }
    } catch (error) {
      this.messageItem = new GitDiffMessageItem(
        "Git extension could not be activated.",
        toErrorMessage(error),
        "warning"
      );
      return undefined;
    }

    const gitExtension = extension.exports as GitExtension | undefined;
    if (!gitExtension?.enabled) {
      this.messageItem = new GitDiffMessageItem(
        "Git extension is disabled.",
        "Enable the built-in Git extension to inspect repository diffs.",
        "warning"
      );
      return undefined;
    }

    this.attachGitExtensionListener(gitExtension);

    try {
      this.gitApi = gitExtension.getAPI(1);
    } catch (error) {
      this.messageItem = new GitDiffMessageItem(
        "Git API is unavailable.",
        toErrorMessage(error),
        "warning"
      );
      return undefined;
    }

    this.attachGitApiListeners(this.gitApi);
    return this.gitApi;
  }

  private attachGitExtensionListener(gitExtension: GitExtension): void {
    if (this.gitExtension === gitExtension && this.gitExtensionDisposable) {
      return;
    }

    this.gitExtension = gitExtension;
    this.gitExtensionDisposable?.dispose();
    this.gitExtensionDisposable = gitExtension.onDidChangeEnablement((enabled) => {
      if (!enabled) {
        this.gitApi = undefined;
        this.disposeGitApiListeners();
        this.disposeRepositoryListeners();
      }

      this.refresh();
    });
  }

  private attachGitApiListeners(api: GitApi): void {
    if (this.gitApiDisposables.length > 0) {
      return;
    }

    this.gitApiDisposables = [
      api.onDidChangeState(() => {
        this.refresh();
      }),
      api.onDidOpenRepository(() => {
        this.refresh();
      }),
      api.onDidCloseRepository(() => {
        this.refresh();
      })
    ];
  }

  private disposeGitApiListeners(): void {
    for (const disposable of this.gitApiDisposables) {
      disposable.dispose();
    }

    this.gitApiDisposables = [];
  }

  private disposeRepositoryListeners(): void {
    for (const disposable of this.repositoryListeners.values()) {
      disposable.dispose();
    }

    this.repositoryListeners.clear();
  }

  private syncRepositoryListeners(repositories: readonly GitRepository[]): void {
    const activeKeys = new Set<string>();

    for (const repository of repositories) {
      const key = repository.rootUri.toString();
      activeKeys.add(key);

      if (this.repositoryListeners.has(key)) {
        continue;
      }

      this.repositoryListeners.set(
        key,
        repository.state.onDidChange(() => {
          this.refresh();
        })
      );
    }

    for (const [key, disposable] of this.repositoryListeners.entries()) {
      if (activeKeys.has(key)) {
        continue;
      }

      disposable.dispose();
      this.repositoryListeners.delete(key);
    }
  }

  private isWorkspaceRepository(repositoryRootPath: string, workspacePaths: readonly string[]): boolean {
    const normalizedRepositoryRoot = path.resolve(repositoryRootPath);

    return workspacePaths.some((workspacePath) => {
      const normalizedWorkspace = path.resolve(workspacePath);
      return (
        normalizedRepositoryRoot === normalizedWorkspace ||
        normalizedRepositoryRoot.startsWith(`${normalizedWorkspace}${path.sep}`)
      );
    });
  }
}
