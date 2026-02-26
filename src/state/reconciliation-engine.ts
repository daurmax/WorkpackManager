import path from "node:path";
import type { WorkpackInstance, WorkpackState } from "../models";
import { scanOutputs } from "./output-scanner";
import { parseStatusMarkdownFile } from "./status-markdown-parser";

/**
 * Severity level for detected drift entries.
 */
export type DriftSeverity = "info" | "warning" | "error";

/**
 * One reconciliation mismatch between declared and observed workpack state.
 */
export interface DriftEntry {
  promptStem: string;
  field: string;
  stateValue: string;
  actualValue: string;
  severity: DriftSeverity;
}

/**
 * Aggregate reconciliation output.
 */
export interface ReconciliationReport {
  drifts: DriftEntry[];
  overallHealth: "healthy" | "drifted" | "inconsistent";
}

function evaluateOverallStatusConsistency(state: WorkpackState): string | null {
  const promptStatuses = Object.values(state.promptStatus).map((prompt) => prompt.status);
  if (promptStatuses.length === 0) {
    return null;
  }

  const allPending = promptStatuses.every((status) => status === "pending");
  const allComplete = promptStatuses.every((status) => status === "complete" || status === "skipped");
  const anyInProgress = promptStatuses.some((status) => status === "in_progress");
  const anyBlocked = promptStatuses.some((status) => status === "blocked");
  const hasBlockers = state.blockedBy.length > 0;

  if (state.overallStatus === "not_started") {
    return allPending ? null : "overallStatus is not_started but prompts are no longer all pending";
  }

  if (state.overallStatus === "in_progress") {
    if (allPending) {
      return "overallStatus is in_progress but all prompts are pending";
    }
    if (allComplete) {
      return "overallStatus is in_progress but all prompts are complete/skipped";
    }
    return null;
  }

  if (state.overallStatus === "blocked") {
    return anyBlocked || hasBlockers
      ? null
      : "overallStatus is blocked but no prompt is blocked and blockedBy is empty";
  }

  if (state.overallStatus === "review") {
    if (anyInProgress || anyBlocked) {
      return "overallStatus is review but prompts remain in_progress/blocked";
    }
    if (allPending) {
      return "overallStatus is review but no prompt has started";
    }
    return null;
  }

  if (state.overallStatus === "complete") {
    if (!allComplete) {
      return "overallStatus is complete but not all prompts are complete/skipped";
    }
    if (hasBlockers) {
      return "overallStatus is complete but blockedBy is not empty";
    }
    return null;
  }

  return null;
}

/**
 * Compare `workpack.state.json`, `outputs/`, and `99_status.md` and report drift.
 */
export function reconcile(instance: WorkpackInstance): ReconciliationReport {
  const drifts: DriftEntry[] = [];

  const statusFilePath = path.join(instance.folderPath, "99_status.md");
  const outputsFolderPath = path.join(instance.folderPath, "outputs");

  let completedInStatus = new Set<string>();
  try {
    completedInStatus = parseStatusMarkdownFile(statusFilePath).completedPromptStems;
  } catch (error) {
    drifts.push({
      promptStem: "*",
      field: "99_status.md",
      stateValue: "readable",
      actualValue: error instanceof Error ? error.message : "Unable to parse status markdown",
      severity: "warning",
    });
  }

  const outputScan = scanOutputs(outputsFolderPath);
  for (const artifact of outputScan.artifacts) {
    if (!artifact.isValidJson) {
      drifts.push({
        promptStem: artifact.promptStem,
        field: "outputs/*.json",
        stateValue: "valid",
        actualValue: artifact.validationError ?? "Invalid output JSON",
        severity: "warning",
      });
    }
  }

  if (!instance.state) {
    drifts.push({
      promptStem: "*",
      field: "workpack.state.json",
      stateValue: "present",
      actualValue: "missing",
      severity: "error",
    });
    return {
      drifts,
      overallHealth: "inconsistent",
    };
  }

  const allPromptStems = new Set<string>([
    ...Object.keys(instance.state.promptStatus),
    ...outputScan.outputByPrompt.keys(),
    ...completedInStatus,
  ]);

  for (const promptStem of Array.from(allPromptStems).sort()) {
    const stateStatus = instance.state.promptStatus[promptStem]?.status ?? "missing";
    const hasOutputJson = outputScan.outputByPrompt.has(promptStem);
    const statusMarkdownComplete = completedInStatus.has(promptStem);

    if (stateStatus === "complete" && !hasOutputJson) {
      drifts.push({
        promptStem,
        field: "outputs/<PROMPT>.json",
        stateValue: "complete",
        actualValue: "missing",
        severity: "error",
      });
    }

    if (stateStatus === "pending" && hasOutputJson) {
      drifts.push({
        promptStem,
        field: "outputs/<PROMPT>.json",
        stateValue: "pending",
        actualValue: "present",
        severity: "warning",
      });
    }

    if (statusMarkdownComplete && stateStatus === "pending") {
      drifts.push({
        promptStem,
        field: "99_status.md",
        stateValue: "pending",
        actualValue: "complete",
        severity: "warning",
      });
    }
  }

  const overallStatusDrift = evaluateOverallStatusConsistency(instance.state);
  if (overallStatusDrift) {
    drifts.push({
      promptStem: "*",
      field: "workpack.state.json.overallStatus",
      stateValue: instance.state.overallStatus,
      actualValue: overallStatusDrift,
      severity: "warning",
    });
  }

  const hasError = drifts.some((drift) => drift.severity === "error");
  if (hasError) {
    return { drifts, overallHealth: "inconsistent" };
  }

  if (drifts.length > 0) {
    return { drifts, overallHealth: "drifted" };
  }

  return { drifts, overallHealth: "healthy" };
}

