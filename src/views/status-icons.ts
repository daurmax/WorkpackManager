import * as vscode from "vscode";
import type { OverallStatus, PromptStatusValue } from "../models";

export interface StatusIcon {
  codicon: string;
  color: vscode.ThemeColor;
  label: string;
  sortOrder: number;
}

export type WorkpackStatus = OverallStatus | "unknown";

/** Workpack overall status -> visual representation. */
export const WORKPACK_STATUS_ICONS: Record<OverallStatus, StatusIcon> = {
  not_started: {
    codicon: "circle-outline",
    color: new vscode.ThemeColor("disabledForeground"),
    label: "Not Started",
    sortOrder: 0
  },
  in_progress: {
    codicon: "loading~spin",
    color: new vscode.ThemeColor("progressBar.background"),
    label: "In Progress",
    sortOrder: 1
  },
  blocked: {
    codicon: "error",
    color: new vscode.ThemeColor("errorForeground"),
    label: "Blocked",
    sortOrder: 2
  },
  review: {
    codicon: "eye",
    color: new vscode.ThemeColor("editorInfo.foreground"),
    label: "Review",
    sortOrder: 3
  },
  complete: {
    codicon: "check",
    color: new vscode.ThemeColor("testing.iconPassed"),
    label: "Complete",
    sortOrder: 4
  },
  abandoned: {
    codicon: "close",
    color: new vscode.ThemeColor("errorForeground"),
    label: "Abandoned",
    sortOrder: 5
  }
};

/** Prompt status -> visual representation. */
export const PROMPT_STATUS_ICONS: Record<PromptStatusValue, StatusIcon> = {
  pending: {
    codicon: "circle-outline",
    color: new vscode.ThemeColor("disabledForeground"),
    label: "Pending",
    sortOrder: 0
  },
  in_progress: {
    codicon: "loading~spin",
    color: new vscode.ThemeColor("progressBar.background"),
    label: "In Progress",
    sortOrder: 1
  },
  complete: {
    codicon: "pass-filled",
    color: new vscode.ThemeColor("testing.iconPassed"),
    label: "Complete",
    sortOrder: 2
  },
  blocked: {
    codicon: "error",
    color: new vscode.ThemeColor("errorForeground"),
    label: "Blocked",
    sortOrder: 3
  },
  skipped: {
    codicon: "debug-step-over",
    color: new vscode.ThemeColor("disabledForeground"),
    label: "Skipped",
    sortOrder: 4
  }
};

const UNKNOWN_WORKPACK_STATUS_ICON: StatusIcon = {
  codicon: "question",
  color: new vscode.ThemeColor("disabledForeground"),
  label: "Unknown",
  sortOrder: Number.MAX_SAFE_INTEGER
};

export function getWorkpackStatusIcon(status: WorkpackStatus): StatusIcon {
  if (status === "unknown") {
    return UNKNOWN_WORKPACK_STATUS_ICON;
  }

  return WORKPACK_STATUS_ICONS[status] ?? UNKNOWN_WORKPACK_STATUS_ICON;
}

export function getPromptStatusIcon(status: PromptStatusValue): StatusIcon {
  return PROMPT_STATUS_ICONS[status] ?? PROMPT_STATUS_ICONS.pending;
}

export function getWorkpackThemeIcon(status: WorkpackStatus): vscode.ThemeIcon {
  const icon = getWorkpackStatusIcon(status);
  return new vscode.ThemeIcon(icon.codicon, icon.color);
}

export function getPromptThemeIcon(status: PromptStatusValue): vscode.ThemeIcon {
  const icon = getPromptStatusIcon(status);
  return new vscode.ThemeIcon(icon.codicon, icon.color);
}

export function getWorkpackStatusSortOrder(status: WorkpackStatus): number {
  return getWorkpackStatusIcon(status).sortOrder;
}

export function getPromptStatusSortOrder(status: PromptStatusValue): number {
  return getPromptStatusIcon(status).sortOrder;
}
