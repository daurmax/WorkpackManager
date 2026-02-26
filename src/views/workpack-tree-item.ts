import * as vscode from "vscode";
import * as path from "node:path";
import type { PromptStatusValue } from "../models";
import { getPromptThemeIcon, getWorkpackThemeIcon, type WorkpackStatus } from "./status-icons";

export enum TreeItemKind {
  Workpack,
  Section,
  PromptFile,
  OutputFile,
  StatusFile,
  MetaFile,
  StateFile
}

export type WorkpackSection = "request" | "plan" | "prompts" | "outputs" | "status";
export type TreeItemStatus = WorkpackStatus | PromptStatusValue;

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

function isPromptStatus(status: TreeItemStatus | undefined): status is PromptStatusValue {
  return (
    status === "pending" ||
    status === "in_progress" ||
    status === "complete" ||
    status === "blocked" ||
    status === "skipped"
  );
}

function resolveContextValue(kind: TreeItemKind, section?: WorkpackSection): string {
  if (kind === TreeItemKind.Workpack) {
    return "workpack";
  }

  if (kind === TreeItemKind.Section) {
    return `section.${section ?? "generic"}`;
  }

  if (kind === TreeItemKind.PromptFile) {
    return "prompt";
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

function buildTreeItemId(
  kind: TreeItemKind,
  workpackId: string,
  label: string,
  filePath: string | undefined,
  section: WorkpackSection | undefined
): string {
  const kindPart = TreeItemKind[kind];
  const sectionPart = section ?? "none";
  const filePart = normalizeFilePath(filePath);
  return `${workpackId}:${kindPart}:${sectionPart}:${label}:${filePart}`;
}

export class WorkpackTreeItem extends vscode.TreeItem {
  constructor(
    public readonly kind: TreeItemKind,
    public readonly workpackId: string,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly filePath?: string,
    public readonly section?: WorkpackSection,
    public readonly status?: TreeItemStatus
  ) {
    super(label, collapsibleState);

    this.id = buildTreeItemId(kind, workpackId, label, filePath, section);
    this.contextValue = resolveContextValue(kind, section);
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
