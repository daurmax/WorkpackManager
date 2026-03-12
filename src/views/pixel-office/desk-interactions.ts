import { readFileSync } from "node:fs";
import type { AgentRunSnapshot } from "../../agents/execution-registry";
import type {
  DeskActionItem,
  DeskPreview,
  DeskRuntimeStatus,
  PromptActionKind,
} from "../../models/pixel-office";

const PREVIEW_CHARACTER_LIMIT = 200;
const OUTPUT_PREVIEW_KEYS = ["summary", "message", "notes", "result", "output", "description"] as const;

export interface DeskInteractionState {
  status: DeskRuntimeStatus;
  promptRole: string;
  assignedAgentId?: string;
  providerDisplayName?: string;
  blockedReason?: string | null;
  latestRun?: AgentRunSnapshot;
  outputPath?: string;
}

function humanizeValue(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function truncatePreview(value: string, maxLength = PREVIEW_CHARACTER_LIMIT): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }

  return `${collapsed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function pickPreviewString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const preview = pickPreviewString(entry);
      if (preview) {
        return preview;
      }
    }

    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of OUTPUT_PREVIEW_KEYS) {
      const preview = pickPreviewString(record[key]);
      if (preview) {
        return preview;
      }
    }

    return JSON.stringify(record);
  }

  return undefined;
}

function readOutputPreview(outputPath: string | undefined): string | undefined {
  if (!outputPath) {
    return undefined;
  }

  try {
    const raw = readFileSync(outputPath, "utf8").trim();
    if (raw.length === 0) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      return pickPreviewString(parsed) ?? raw;
    } catch {
      return raw;
    }
  } catch {
    return undefined;
  }
}

export function humanizeDeskStatus(status: DeskRuntimeStatus): string {
  return humanizeValue(status);
}

export function getDeskActionItems(state: DeskInteractionState): DeskActionItem[] {
  const actions: DeskActionItem[] = [];

  if (state.status === "pending" && state.assignedAgentId) {
    actions.push({ action: "execute", label: "Execute" });
  }

  if (state.status === "human_input_required") {
    actions.push({ action: "provide_input", label: "Provide Input" });
    actions.push({ action: "stop", label: "Stop" });
    return actions;
  }

  if (state.status === "queued" || state.status === "in_progress") {
    actions.push({ action: "stop", label: "Stop" });
  }

  if (state.status === "blocked" || state.status === "failed" || state.status === "cancelled") {
    actions.push({ action: "retry", label: "Retry" });
  }

  if (state.status === "complete" && state.outputPath) {
    actions.push({ action: "open_output", label: "View Output" });
  }

  return actions;
}

export function isDeskActionAllowed(state: DeskInteractionState, action: PromptActionKind): boolean {
  return getDeskActionItems(state).some((item) => item.action === action);
}

export function buildDeskPreview(state: DeskInteractionState): DeskPreview {
  let excerptSource: DeskPreview["excerptSource"] = "prompt_role";
  let excerpt = state.promptRole;

  if (state.latestRun?.inputRequest) {
    excerptSource = "input_request";
    excerpt = state.latestRun.inputRequest;
  } else if (state.latestRun?.error) {
    excerptSource = "error";
    excerpt = state.latestRun.error;
  } else if (state.latestRun?.summary) {
    excerptSource = "summary";
    excerpt = state.latestRun.summary;
  } else if (state.blockedReason) {
    excerptSource = "blocked_reason";
    excerpt = state.blockedReason;
  } else {
    const outputPreview = readOutputPreview(state.outputPath);
    if (outputPreview) {
      excerptSource = "output";
      excerpt = outputPreview;
    }
  }

  const links: DeskPreview["links"] = [{ label: "View Full Chat", action: "open_prompt" }];
  if (state.outputPath) {
    links.push({ label: "View Output", action: "open_output" });
  }

  return {
    providerLabel: state.providerDisplayName ?? state.assignedAgentId ?? "Unassigned",
    statusLabel: humanizeDeskStatus(state.status),
    excerpt: truncatePreview(excerpt),
    excerptSource,
    links,
  };
}
