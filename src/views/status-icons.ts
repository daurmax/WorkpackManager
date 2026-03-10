import * as vscode from "vscode";
import type { OverallStatus, PromptStatusValue } from "../models";

export type RuntimePromptStatus =
  | "queued"
  | "in_progress"
  | "complete"
  | "failed"
  | "cancelled"
  | "human_input_required";

export type PromptDisplayStatus = PromptStatusValue | RuntimePromptStatus;

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

export const RUNTIME_PROMPT_STATUS_ICONS: Record<Exclude<RuntimePromptStatus, PromptStatusValue>, StatusIcon> = {
  queued: {
    codicon: "clock",
    color: new vscode.ThemeColor("editorInfo.foreground"),
    label: "Queued",
    sortOrder: 1,
  },
  failed: {
    codicon: "error",
    color: new vscode.ThemeColor("errorForeground"),
    label: "Failed",
    sortOrder: 5,
  },
  cancelled: {
    codicon: "debug-stop",
    color: new vscode.ThemeColor("disabledForeground"),
    label: "Cancelled",
    sortOrder: 6,
  },
  human_input_required: {
    codicon: "question",
    color: new vscode.ThemeColor("editorWarning.foreground"),
    label: "Needs Input",
    sortOrder: 4,
  },
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

export function getPromptStatusIcon(status: PromptDisplayStatus): StatusIcon {
  if (status in PROMPT_STATUS_ICONS) {
    return PROMPT_STATUS_ICONS[status as PromptStatusValue] ?? PROMPT_STATUS_ICONS.pending;
  }

  return (
    RUNTIME_PROMPT_STATUS_ICONS[status as Exclude<RuntimePromptStatus, PromptStatusValue>] ??
    PROMPT_STATUS_ICONS.pending
  );
}

export function getWorkpackThemeIcon(status: WorkpackStatus): vscode.ThemeIcon {
  const icon = getWorkpackStatusIcon(status);
  return new vscode.ThemeIcon(icon.codicon, icon.color);
}

export function getPromptThemeIcon(status: PromptDisplayStatus): vscode.ThemeIcon {
  const icon = getPromptStatusIcon(status);
  return new vscode.ThemeIcon(icon.codicon, icon.color);
}

export function getWorkpackStatusSortOrder(status: WorkpackStatus): number {
  return getWorkpackStatusIcon(status).sortOrder;
}

export function getPromptStatusSortOrder(status: PromptDisplayStatus): number {
  return getPromptStatusIcon(status).sortOrder;
}
