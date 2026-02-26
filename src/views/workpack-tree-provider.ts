import * as vscode from "vscode";
import * as path from "node:path";
import { promises as fs } from "node:fs";
import type { OverallStatus, PromptStatusValue, WorkpackInstance } from "../models";
import { discoverWorkpacks } from "../parser/workpack-discoverer";
import { getPromptStatusIcon, getWorkpackStatusSortOrder } from "./status-icons";
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

  private instances: WorkpackInstance[] = [];
  private activeFilter: TreeFilter = {};
  private activeSort: TreeSortMode = "name";
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(
    private readonly parser: WorkpackParser,
    private readonly workspacePath: string,
    options: WorkpackTreeProviderOptions = {}
  ) {
    this.watcherFactory = options.watcherFactory ?? ((pattern) => vscode.workspace.createFileSystemWatcher(pattern));

    if ((options.watchFileSystem ?? true) && workspacePath.trim().length > 0) {
      const watcher = this.watcherFactory(new vscode.RelativePattern(workspacePath, "workpacks/instances/**"));
      watcher.onDidCreate(() => this.refresh(), this, this.disposables);
      watcher.onDidChange(() => this.refresh(), this, this.disposables);
      watcher.onDidDelete(() => this.refresh(), this, this.disposables);
      this.disposables.push(watcher);
    }
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.disposables.length = 0;
    this._onDidChangeTreeData.dispose();
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
      return this.getWorkpackItems();
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
    if (!this.workspacePath) {
      this.instances = [];
      this.instancesById.clear();
      this.isLoaded = true;
      return;
    }

    try {
      const discovered = await this.parser.discover([this.workspacePath]);
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

  private getWorkpackItems(): WorkpackTreeItem[] {
    return this.instances
      .filter((instance) => matchesFilter(instance, this.activeFilter))
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
        const status = getPromptStatus(instance, prompt.stem);

        const item = new WorkpackTreeItem(
          TreeItemKind.PromptFile,
          instance.meta.id,
          promptFileName,
          vscode.TreeItemCollapsibleState.None,
          existingPath,
          "prompts",
          status
        );

        item.description = getPromptStatusIcon(status).label;
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
}
