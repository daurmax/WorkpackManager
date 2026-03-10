import * as vscode from "vscode";
import * as path from "node:path";
import { getPromptThemeIcon, getWorkpackThemeIcon, type PromptDisplayStatus, type WorkpackStatus } from "./status-icons";

export enum TreeItemKind {
  Project,
  Group,
  Workpack,
  Section,
  PromptFile,
  OutputFile,
  StatusFile,
  MetaFile,
  StateFile
}

export type WorkpackSection = "request" | "plan" | "prompts" | "outputs" | "status";
export type TreeItemStatus = WorkpackStatus | PromptDisplayStatus;

function isWorkpackStatus(status: TreeItemStatus | undefined): status is WorkpackStatus {
  return (
    status === "unknown" ||
    status === "not_started" ||
    status === "in_progress" ||
    status === "blocked" ||
    status === "review" ||
    status === "complete" ||
    status === "abandoned"
  );
}

function isPromptStatus(status: TreeItemStatus | undefined): status is PromptDisplayStatus {
  return (
    status === "pending" ||
    status === "queued" ||
    status === "in_progress" ||
    status === "complete" ||
    status === "blocked" ||
    status === "skipped" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "human_input_required"
  );
}

function toPromptContextValue(status: PromptDisplayStatus | undefined): string {
  if (status === "queued") {
    return "prompt.queued";
  }

  if (status === "in_progress") {
    return "prompt.inProgress";
  }

  if (status === "complete") {
    return "prompt.complete";
  }

  if (status === "blocked") {
    return "prompt.blocked";
  }

  if (status === "skipped") {
    return "prompt.skipped";
  }

  if (status === "failed") {
    return "prompt.failed";
  }

  if (status === "cancelled") {
    return "prompt.cancelled";
  }

  if (status === "human_input_required") {
    return "prompt.humanInputRequired";
  }

  return "prompt.pending";
}

function resolveContextValue(
  kind: TreeItemKind,
  section?: WorkpackSection,
  status?: TreeItemStatus
): string {
  if (kind === TreeItemKind.Project) {
    return "project";
  }

  if (kind === TreeItemKind.Group) {
    return "group";
  }

  if (kind === TreeItemKind.Workpack) {
    return "workpack";
  }

  if (kind === TreeItemKind.Section) {
    return `section.${section ?? "generic"}`;
  }

  if (kind === TreeItemKind.PromptFile) {
    return toPromptContextValue(isPromptStatus(status) ? status : undefined);
  }

  if (kind === TreeItemKind.OutputFile) {
    return "output";
  }

  if (kind === TreeItemKind.StatusFile) {
    return "statusFile";
  }

  if (kind === TreeItemKind.StateFile) {
    return "stateFile";
  }

  return "metaFile";
}

function resolveSectionIcon(section?: WorkpackSection): vscode.ThemeIcon {
  if (section === "request") {
    return new vscode.ThemeIcon("file-text");
  }

  if (section === "plan") {
    return new vscode.ThemeIcon("checklist");
  }

  if (section === "prompts") {
    return new vscode.ThemeIcon("list-tree");
  }

  if (section === "outputs") {
    return new vscode.ThemeIcon("output");
  }

  if (section === "status") {
    return new vscode.ThemeIcon("pulse");
  }

  return new vscode.ThemeIcon("folder");
}

function resolveFileIcon(kind: TreeItemKind, section?: WorkpackSection): vscode.ThemeIcon {
  if (kind === TreeItemKind.OutputFile) {
    return new vscode.ThemeIcon("output");
  }

  if (kind === TreeItemKind.StatusFile) {
    return new vscode.ThemeIcon("pulse");
  }

  if (kind === TreeItemKind.StateFile) {
    return new vscode.ThemeIcon("symbol-key");
  }

  if (section === "request" || section === "plan" || section === "prompts") {
    return new vscode.ThemeIcon("markdown");
  }

  if (kind === TreeItemKind.MetaFile) {
    return new vscode.ThemeIcon("json");
  }

  return new vscode.ThemeIcon("file");
}

function resolveIcon(
  kind: TreeItemKind,
  section: WorkpackSection | undefined,
  status: TreeItemStatus | undefined
): vscode.ThemeIcon {
  if (kind === TreeItemKind.Project) {
    return new vscode.ThemeIcon("repo");
  }

  if (kind === TreeItemKind.Group) {
    return new vscode.ThemeIcon("folder");
  }

  if (kind === TreeItemKind.Workpack) {
    return getWorkpackThemeIcon(isWorkpackStatus(status) ? status : "unknown");
  }

  if (kind === TreeItemKind.PromptFile) {
    return getPromptThemeIcon(isPromptStatus(status) ? status : "pending");
  }

  if (kind === TreeItemKind.Section) {
    return resolveSectionIcon(section);
  }

  return resolveFileIcon(kind, section);
}

function normalizeFilePath(filePath: string | undefined): string {
  if (!filePath) {
    return "none";
  }

  return path.normalize(filePath).replaceAll("\\", "/");
}

function normalizeGroupPath(groupPath: readonly string[] | undefined): string {
  if (!groupPath || groupPath.length === 0) {
    return "none";
  }

  return groupPath.join("/");
}

function buildTreeItemId(
  kind: TreeItemKind,
  workpackId: string,
  label: string,
  filePath: string | undefined,
  section: WorkpackSection | undefined,
  groupPath: readonly string[] | undefined
): string {
  const kindPart = TreeItemKind[kind];
  const sectionPart = section ?? "none";
  const filePart = normalizeFilePath(filePath);
  const groupPart = normalizeGroupPath(groupPath);
  return `${workpackId}:${kindPart}:${sectionPart}:${label}:${filePart}:${groupPart}`;
}

export class WorkpackTreeItem extends vscode.TreeItem {
  constructor(
    public readonly kind: TreeItemKind,
    public readonly workpackId: string,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly filePath?: string,
    public readonly section?: WorkpackSection,
    public readonly status?: TreeItemStatus,
    public readonly groupPath?: readonly string[]
  ) {
    super(label, collapsibleState);

    this.id = buildTreeItemId(kind, workpackId, label, filePath, section, groupPath);
    this.contextValue = resolveContextValue(kind, section, status);
    this.iconPath = resolveIcon(kind, section, status);

    if (filePath) {
      const fileUri = vscode.Uri.file(filePath);
      this.resourceUri = fileUri;
      this.tooltip = `${label}\n${filePath}`;
      this.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [fileUri]
      };
    }
  }
}
