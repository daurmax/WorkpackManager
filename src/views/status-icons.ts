import * as vscode from "vscode";
import type { OverallStatus, PromptStatusValue } from "../models";

export type WorkpackStatus = OverallStatus | "unknown";

const WORKPACK_STATUS_ICONS: Record<WorkpackStatus, string> = {
  unknown: "question",
  not_started: "circle-outline",
  in_progress: "sync~spin",
  blocked: "error",
  review: "eye",
  complete: "check",
  abandoned: "circle-slash"
};

const PROMPT_STATUS_ICONS: Record<PromptStatusValue, string> = {
  pending: "circle-outline",
  in_progress: "sync~spin",
  complete: "check",
  blocked: "error",
  skipped: "debug-step-over"
};

export function getWorkpackThemeIcon(status: WorkpackStatus): vscode.ThemeIcon {
  return new vscode.ThemeIcon(WORKPACK_STATUS_ICONS[status] ?? WORKPACK_STATUS_ICONS.unknown);
}

export function getPromptThemeIcon(status: PromptStatusValue): vscode.ThemeIcon {
  return new vscode.ThemeIcon(PROMPT_STATUS_ICONS[status] ?? PROMPT_STATUS_ICONS.pending);
}
