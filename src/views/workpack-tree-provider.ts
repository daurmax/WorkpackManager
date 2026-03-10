import * as vscode from "vscode";
import * as path from "node:path";
import { promises as fs } from "node:fs";
import type { AgentRunSnapshot, ExecutionRegistry } from "../agents/execution-registry";
import type { OverallStatus, PromptStatusValue, WorkpackInstance } from "../models";
import { discoverWorkpacks } from "../parser/workpack-discoverer";
import { getPromptStatusIcon, getWorkpackStatusSortOrder, type PromptDisplayStatus } from "./status-icons";
import { TreeItemKind, type WorkpackSection, WorkpackTreeItem } from "./workpack-tree-item";

const REQUEST_FILE = "00_request.md";
const PLAN_FILE = "01_plan.md";
const STATUS_FILE = "99_status.md";
const META_FILE = "workpack.meta.json";
const STATE_FILE = "workpack.state.json";
const PROMPTS_DIRECTORY = "prompts";
const OUTPUTS_DIRECTORY = "outputs";
const SECTION_ORDER: WorkpackSection[] = ["request", "plan", "prompts", "outputs", "status"];
const SECTION_LABELS: Record<WorkpackSection, string> = {
  request: "Request",
  plan: "Plan",
  prompts: "Prompts",
  outputs: "Outputs",
  status: "Status"
};

function warn(message: string, error?: unknown): void {
  if (error instanceof Error) {
    console.warn(`[workpack-tree-provider] ${message}: ${error.message}`);
    return;
  }

  console.warn(`[workpack-tree-provider] ${message}`);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readChildFiles(folderPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((entryName) => !entryName.startsWith("."))
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      warn(`Unable to read folder ${folderPath}`, error);
    }

    return [];
  }
}

function getCompletedPromptCount(instance: WorkpackInstance): number {
  if (!instance.state) {
    return 0;
  }

  return instance.meta.prompts.filter((prompt) => {
    const status = instance.state?.promptStatus[prompt.stem]?.status;
    return status === "complete" || status === "skipped";
  }).length;
}

function getPromptStatus(instance: WorkpackInstance, promptStem: string): PromptStatusValue {
  return instance.state?.promptStatus[promptStem]?.status ?? "pending";
}

function getWorkpackStatus(instance: WorkpackInstance): OverallStatus | "unknown" {
  return instance.state?.overallStatus ?? "unknown";
}

function normalizeFilterValues(values: string[] | undefined): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0)
    )
  );

  return normalized.length > 0 ? normalized : undefined;
}

function cloneFilter(filter: TreeFilter): TreeFilter {
  return {
    status: filter.status ? [...filter.status] : undefined,
    category: filter.category ? [...filter.category] : undefined,
    tags: filter.tags ? [...filter.tags] : undefined,
    searchText: filter.searchText
  };
}

function normalizeFilter(filter: TreeFilter): TreeFilter {
  const searchText = filter.searchText?.trim().toLowerCase();
  return {
    status: normalizeFilterValues(filter.status),
    category: normalizeFilterValues(filter.category),
    tags: normalizeFilterValues(filter.tags),
    searchText: searchText && searchText.length > 0 ? searchText : undefined
  };
}

function matchesFilter(instance: WorkpackInstance, filter: TreeFilter): boolean {
  if (filter.status && filter.status.length > 0) {
    const status = getWorkpackStatus(instance).toLowerCase();
    if (!filter.status.includes(status)) {
      return false;
    }
  }

  if (filter.category && filter.category.length > 0) {
    const category = instance.meta.category.toLowerCase();
    if (!filter.category.includes(category)) {
      return false;
    }
  }

  if (filter.tags && filter.tags.length > 0) {
    const tags = new Set(instance.meta.tags.map((tag) => tag.toLowerCase()));
    const hasTagMatch = filter.tags.some((tag) => tags.has(tag));
    if (!hasTagMatch) {
      return false;
    }
  }

  if (filter.searchText) {
    const searchBlob = [
      instance.meta.id,
      instance.meta.title,
      instance.meta.summary,
      instance.meta.category,
      instance.meta.tags.join(" "),
      instance.meta.owners.join(" "),
      instance.meta.repos.join(" ")
    ]
      .join(" ")
      .toLowerCase();

    if (!searchBlob.includes(filter.searchText)) {
      return false;
    }
  }

  return true;
}

function compareByName(left: WorkpackInstance, right: WorkpackInstance): number {
  return left.meta.id.localeCompare(right.meta.id);
}

function compareByStatus(left: WorkpackInstance, right: WorkpackInstance): number {
  const leftOrder = getWorkpackStatusSortOrder(getWorkpackStatus(left));
  const rightOrder = getWorkpackStatusSortOrder(getWorkpackStatus(right));
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return compareByName(left, right);
}

function compareByDate(left: WorkpackInstance, right: WorkpackInstance): number {
  const createdAtCompare = right.meta.createdAt.localeCompare(left.meta.createdAt);
  if (createdAtCompare !== 0) {
    return createdAtCompare;
  }

  return compareByName(left, right);
}

function compareInstances(left: WorkpackInstance, right: WorkpackInstance, sortBy: TreeSortMode): number {
  if (sortBy === "status") {
    return compareByStatus(left, right);
  }

  if (sortBy === "date") {
    return compareByDate(left, right);
  }

  return compareByName(left, right);
}

function normalizeFolderPath(folderPath: string): string {
  return path.normalize(folderPath).replaceAll("\\", "/");
}

function getInstanceGroupPath(instance: WorkpackInstance): string[] {
  const normalizedFolderPath = normalizeFolderPath(instance.folderPath);
  const marker = "/workpacks/instances/";
  const markerIndex = normalizedFolderPath.toLowerCase().indexOf(marker);

  if (markerIndex === -1) {
    return instance.meta.group ? [instance.meta.group] : [];
  }

  const relativePath = normalizedFolderPath.slice(markerIndex + marker.length);
  const segments = relativePath.split("/").filter((segment) => segment.length > 0);
  if (segments.length <= 1) {
    return instance.meta.group ? [instance.meta.group] : [];
  }

  return segments.slice(0, -1);
}

function startsWithSegments(segments: readonly string[], prefix: readonly string[]): boolean {
  if (prefix.length > segments.length) {
    return false;
  }

  return prefix.every((segment, index) => segments[index] === segment);
}

export interface WorkpackParser {
  discover(workspaceFolders: readonly string[]): Promise<WorkpackInstance[]>;
}

export class DiscovererWorkpackParser implements WorkpackParser {
  async discover(workspaceFolders: readonly string[]): Promise<WorkpackInstance[]> {
    return discoverWorkpacks([...workspaceFolders]);
  }
}

interface WorkpackTreeProviderOptions {
  watcherFactory?: (pattern: vscode.GlobPattern) => vscode.FileSystemWatcher;
  watchFileSystem?: boolean;
}

export interface TreeFilter {
  status?: string[];
  category?: string[];
  tags?: string[];
  searchText?: string;
}

export type TreeSortMode = "status" | "name" | "date";

export class WorkpackTreeProvider implements vscode.TreeDataProvider<WorkpackTreeItem>, vscode.Disposable {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<WorkpackTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly instancesById = new Map<string, WorkpackInstance>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly watcherFactory: (pattern: vscode.GlobPattern) => vscode.FileSystemWatcher;
  private executionRegistry?: ExecutionRegistry;
  private executionRegistryDisposable?: vscode.Disposable;

  private instances: WorkpackInstance[] = [];
  private activeFilter: TreeFilter = {};
  private activeSort: TreeSortMode = "name";
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(
    private readonly parser: WorkpackParser,
    private readonly workspacePaths: readonly string[],
    options: WorkpackTreeProviderOptions = {}
  ) {
    this.watcherFactory = options.watcherFactory ?? ((pattern) => vscode.workspace.createFileSystemWatcher(pattern));

    if (options.watchFileSystem ?? true) {
      for (const wsPath of workspacePaths) {
        if (wsPath.trim().length === 0) {
          continue;
        }
        // Watch direct workpacks/instances/ and one level deeper (*/workpacks/instances/)
        const directWatcher = this.watcherFactory(new vscode.RelativePattern(wsPath, "workpacks/instances/**"));
        directWatcher.onDidCreate(() => this.refresh(), this, this.disposables);
        directWatcher.onDidChange(() => this.refresh(), this, this.disposables);
        directWatcher.onDidDelete(() => this.refresh(), this, this.disposables);
        this.disposables.push(directWatcher);

        const childWatcher = this.watcherFactory(new vscode.RelativePattern(wsPath, "*/workpacks/instances/**"));
        childWatcher.onDidCreate(() => this.refresh(), this, this.disposables);
        childWatcher.onDidChange(() => this.refresh(), this, this.disposables);
        childWatcher.onDidDelete(() => this.refresh(), this, this.disposables);
        this.disposables.push(childWatcher);
      }
    }
  }

  dispose(): void {
    this.executionRegistryDisposable?.dispose();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.disposables.length = 0;
    this._onDidChangeTreeData.dispose();
  }

  setExecutionRegistry(executionRegistry: ExecutionRegistry): void {
    this.executionRegistryDisposable?.dispose();
    this.executionRegistry = executionRegistry;
    this.executionRegistryDisposable = executionRegistry.onDidChangeRuns(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this.isLoaded = false;
    this._onDidChangeTreeData.fire(undefined);
  }

  setFilter(filter: TreeFilter): void {
    this.activeFilter = normalizeFilter(filter);
    this.refresh();
  }

  clearFilter(): void {
    this.activeFilter = {};
    this.refresh();
  }

  getFilter(): TreeFilter {
    return cloneFilter(this.activeFilter);
  }

  setSort(sortBy: TreeSortMode): void {
    this.activeSort = sortBy;
    this.refresh();
  }

  getSort(): TreeSortMode {
    return this.activeSort;
  }

  getTreeItem(element: WorkpackTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkpackTreeItem): Promise<WorkpackTreeItem[]> {
    await this.ensureLoaded();

    if (!element) {
      return this.getRootItems();
    }

    if (element.kind === TreeItemKind.Project) {
      return this.getScopedItems(element.workpackId, []);
    }

    if (element.kind === TreeItemKind.Group) {
      return this.getScopedItems(element.workpackId, element.groupPath ?? []);
    }

    if (element.kind === TreeItemKind.Workpack) {
      return this.getSectionItems(element.workpackId);
    }

    if (element.kind === TreeItemKind.Section) {
      return this.getSectionChildren(element.workpackId, element.section);
    }

    return [];
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    if (!this.loadPromise) {
      this.loadPromise = this.loadInstances().finally(() => {
        this.loadPromise = null;
      });
    }

    await this.loadPromise;
  }

  private async loadInstances(): Promise<void> {
    if (this.workspacePaths.length === 0) {
      this.instances = [];
      this.instancesById.clear();
      this.isLoaded = true;
      return;
    }

    try {
      const discovered = await this.parser.discover(this.workspacePaths);
      this.instances = [...discovered];
    } catch (error) {
      warn("Unable to discover workpacks", error);
      this.instances = [];
    }

    this.instancesById.clear();
    for (const instance of this.instances) {
      this.instancesById.set(instance.meta.id, instance);
    }

    this.isLoaded = true;
  }

  /**
   * Returns the root-level tree items.
   * When workpacks are discovered from multiple projects, returns Project nodes.
   * Otherwise returns the project contents directly.
   */
  private getRootItems(): WorkpackTreeItem[] {
    const filtered = this.instances.filter((instance) => matchesFilter(instance, this.activeFilter));
    const projects = new Set(filtered.map((i) => i.sourceProject));

    if (projects.size <= 1) {
      const singleProject = filtered[0]?.sourceProject ?? "";
      return this.buildScopedItems(filtered, singleProject, []);
    }

    return Array.from(projects)
      .sort((a, b) => a.localeCompare(b))
      .map((projectName) => {
        const projectInstances = filtered.filter((i) => i.sourceProject === projectName);
        const item = new WorkpackTreeItem(
          TreeItemKind.Project,
          projectName,
          projectName,
          vscode.TreeItemCollapsibleState.Expanded
        );

        item.description = `${projectInstances.length} workpack${projectInstances.length === 1 ? "" : "s"}`;
        return item;
      });
  }

  private getScopedItems(projectName: string, groupPath: readonly string[]): WorkpackTreeItem[] {
    const filtered = this.instances
      .filter((instance) => projectName.length === 0 || instance.sourceProject === projectName)
      .filter((instance) => matchesFilter(instance, this.activeFilter));

    return this.buildScopedItems(filtered, projectName, groupPath);
  }

  private buildScopedItems(
    filtered: WorkpackInstance[],
    projectName: string,
    groupPath: readonly string[]
  ): WorkpackTreeItem[] {
    const directInstances: WorkpackInstance[] = [];
    const childGroups = new Map<string, WorkpackInstance[]>();

    for (const instance of filtered) {
      const instanceGroupPath = getInstanceGroupPath(instance);
      if (!startsWithSegments(instanceGroupPath, groupPath)) {
        continue;
      }

      if (instanceGroupPath.length === groupPath.length) {
        directInstances.push(instance);
        continue;
      }

      const nextSegment = instanceGroupPath[groupPath.length];
      const siblings = childGroups.get(nextSegment) ?? [];
      siblings.push(instance);
      childGroups.set(nextSegment, siblings);
    }

    const groupItems = Array.from(childGroups.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([groupName, instances]) => {
        const item = new WorkpackTreeItem(
          TreeItemKind.Group,
          projectName,
          groupName,
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          undefined,
          undefined,
          [...groupPath, groupName]
        );

        item.description = `${instances.length} workpack${instances.length === 1 ? "" : "s"}`;
        return item;
      });

    const workpackItems = this.buildWorkpackItems(directInstances);

    if (this.activeSort === "name") {
      return [...groupItems, ...workpackItems].sort((left, right) =>
        String(left.label).localeCompare(String(right.label))
      );
    }

    return [...groupItems, ...workpackItems];
  }

  private buildWorkpackItems(filtered: WorkpackInstance[]): WorkpackTreeItem[] {
    return filtered
      .sort((left, right) => compareInstances(left, right, this.activeSort))
      .map((instance) => {
        const promptCount = instance.meta.prompts.length;
        const completedPrompts = getCompletedPromptCount(instance);
        const status = getWorkpackStatus(instance);

        const item = new WorkpackTreeItem(
          TreeItemKind.Workpack,
          instance.meta.id,
          instance.meta.id,
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          undefined,
          status
        );

        item.description = `${completedPrompts} / ${promptCount} prompts`;
        item.tooltip = `${instance.meta.title}\n${instance.folderPath}`;
        return item;
      });
  }

  private getSectionItems(workpackId: string): WorkpackTreeItem[] {
    return SECTION_ORDER.map((section) => {
      return new WorkpackTreeItem(
        TreeItemKind.Section,
        workpackId,
        SECTION_LABELS[section],
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        section
      );
    });
  }

  private async getSectionChildren(
    workpackId: string,
    section: WorkpackSection | undefined
  ): Promise<WorkpackTreeItem[]> {
    if (!section) {
      return [];
    }

    const instance = this.instancesById.get(workpackId);
    if (!instance) {
      return [];
    }

    if (section === "request") {
      return this.createSingleFileSectionItem(instance, REQUEST_FILE, TreeItemKind.MetaFile, section);
    }

    if (section === "plan") {
      return this.createSingleFileSectionItem(instance, PLAN_FILE, TreeItemKind.MetaFile, section);
    }

    if (section === "prompts") {
      return this.getPromptItems(instance);
    }

    if (section === "outputs") {
      return this.getOutputItems(instance);
    }

    return this.getStatusItems(instance);
  }

  private async createSingleFileSectionItem(
    instance: WorkpackInstance,
    fileName: string,
    kind: TreeItemKind,
    section: WorkpackSection
  ): Promise<WorkpackTreeItem[]> {
    const targetPath = path.join(instance.folderPath, fileName);
    if (!(await fileExists(targetPath))) {
      return [];
    }

    return [
      new WorkpackTreeItem(
        kind,
        instance.meta.id,
        fileName,
        vscode.TreeItemCollapsibleState.None,
        targetPath,
        section
      )
    ];
  }

  private async getPromptItems(instance: WorkpackInstance): Promise<WorkpackTreeItem[]> {
    const items = await Promise.all(
      instance.meta.prompts.map(async (prompt) => {
        const promptFileName = `${prompt.stem}.md`;
        const promptFilePath = path.join(instance.folderPath, PROMPTS_DIRECTORY, promptFileName);
        const existingPath = (await fileExists(promptFilePath)) ? promptFilePath : undefined;
        const runtimeRun = this.executionRegistry?.getLatestRunForPrompt(instance.meta.id, prompt.stem);
        const status = this.getPromptDisplayStatus(instance, prompt.stem, runtimeRun);

        const item = new WorkpackTreeItem(
          TreeItemKind.PromptFile,
          instance.meta.id,
          promptFileName,
          vscode.TreeItemCollapsibleState.None,
          existingPath,
          "prompts",
          status
        );

        const statusLabel = getPromptStatusIcon(status).label;
        item.description = runtimeRun?.providerId ? `${statusLabel} · ${runtimeRun.providerId}` : statusLabel;
        item.tooltip = this.buildPromptTooltip(promptFileName, existingPath, runtimeRun, statusLabel);
        return item;
      })
    );

    return items.sort((left, right) => String(left.label).localeCompare(String(right.label)));
  }

  private async getOutputItems(instance: WorkpackInstance): Promise<WorkpackTreeItem[]> {
    const outputsFolder = path.join(instance.folderPath, OUTPUTS_DIRECTORY);
    const outputFiles = await readChildFiles(outputsFolder);

    return outputFiles.map((fileName) => {
      const outputPath = path.join(outputsFolder, fileName);
      return new WorkpackTreeItem(
        TreeItemKind.OutputFile,
        instance.meta.id,
        fileName,
        vscode.TreeItemCollapsibleState.None,
        outputPath,
        "outputs"
      );
    });
  }

  private async getStatusItems(instance: WorkpackInstance): Promise<WorkpackTreeItem[]> {
    const statusItems: WorkpackTreeItem[] = [];
    const statusEntries: Array<{ fileName: string; kind: TreeItemKind }> = [
      { fileName: STATUS_FILE, kind: TreeItemKind.StatusFile },
      { fileName: META_FILE, kind: TreeItemKind.MetaFile },
      { fileName: STATE_FILE, kind: TreeItemKind.StateFile }
    ];

    for (const entry of statusEntries) {
      const filePath = path.join(instance.folderPath, entry.fileName);
      if (!(await fileExists(filePath))) {
        continue;
      }

      statusItems.push(
        new WorkpackTreeItem(
          entry.kind,
          instance.meta.id,
          entry.fileName,
          vscode.TreeItemCollapsibleState.None,
          filePath,
          "status"
        )
      );
    }

    return statusItems;
  }

  private getPromptDisplayStatus(
    instance: WorkpackInstance,
    promptStem: string,
    runtimeRun?: AgentRunSnapshot
  ): PromptDisplayStatus {
    if (runtimeRun) {
      return runtimeRun.status;
    }

    return getPromptStatus(instance, promptStem);
  }

  private buildPromptTooltip(
    promptFileName: string,
    existingPath: string | undefined,
    runtimeRun: AgentRunSnapshot | undefined,
    statusLabel: string
  ): string {
    const lines = [promptFileName, existingPath, `Status: ${statusLabel}`];

    if (runtimeRun?.providerId) {
      lines.push(`Agent: ${runtimeRun.providerId}`);
    }

    if (runtimeRun?.error) {
      lines.push(`Error: ${runtimeRun.error}`);
    }

    if (runtimeRun?.inputRequest) {
      lines.push(`Input: ${runtimeRun.inputRequest}`);
    }

    return lines.filter((line): line is string => typeof line === "string" && line.length > 0).join("\n");
  }
}
