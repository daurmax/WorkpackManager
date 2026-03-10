import { randomUUID } from "node:crypto";
import * as vscode from "vscode";

export type AgentRunStatus =
  | "queued"
  | "in_progress"
  | "complete"
  | "failed"
  | "cancelled"
  | "human_input_required";

export interface AgentRunSnapshot {
  runId: string;
  workpackId: string;
  promptStem: string;
  folderPath?: string;
  promptFilePath?: string;
  providerId?: string;
  status: AgentRunStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  summary?: string;
  error?: string;
  inputRequest?: string;
}

export type HumanInputHandler = (input: string) => Promise<void> | void;

interface AgentRunRecord extends AgentRunSnapshot {
  abortController?: AbortController;
  humanInputHandler?: HumanInputHandler;
}

export interface StartAgentRunOptions {
  workpackId: string;
  promptStem: string;
  folderPath?: string;
  promptFilePath?: string;
  providerId?: string;
  status?: AgentRunStatus;
  abortController?: AbortController;
  summary?: string;
  error?: string;
  inputRequest?: string;
  humanInputHandler?: HumanInputHandler;
}

export interface UpdateAgentRunOptions {
  providerId?: string;
  status?: AgentRunStatus;
  abortController?: AbortController;
  summary?: string;
  error?: string;
  inputRequest?: string;
  humanInputHandler?: HumanInputHandler;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildPromptKey(workpackId: string, promptStem: string): string {
  return `${workpackId}::${promptStem}`;
}

export class ExecutionRegistry implements vscode.Disposable {
  private readonly runsById = new Map<string, AgentRunRecord>();
  private readonly latestRunIdByPrompt = new Map<string, string>();
  private readonly _onDidChangeRuns = new vscode.EventEmitter<void>();

  readonly onDidChangeRuns = this._onDidChangeRuns.event;

  dispose(): void {
    this.runsById.clear();
    this.latestRunIdByPrompt.clear();
    this._onDidChangeRuns.dispose();
  }

  startRun(options: StartAgentRunOptions): AgentRunSnapshot {
    const timestamp = nowIso();
    const runId = randomUUID();
    const record: AgentRunRecord = {
      runId,
      workpackId: options.workpackId,
      promptStem: options.promptStem,
      folderPath: options.folderPath,
      promptFilePath: options.promptFilePath,
      providerId: options.providerId,
      status: options.status ?? "in_progress",
      startedAt: timestamp,
      updatedAt: timestamp,
      summary: options.summary,
      error: options.error,
      inputRequest: options.inputRequest,
      abortController: options.abortController,
      humanInputHandler: options.humanInputHandler,
    };

    this.runsById.set(runId, record);
    this.latestRunIdByPrompt.set(buildPromptKey(record.workpackId, record.promptStem), runId);
    this._onDidChangeRuns.fire();

    return this.toSnapshot(record);
  }

  updateRun(runId: string, options: UpdateAgentRunOptions): AgentRunSnapshot | undefined {
    const record = this.runsById.get(runId);
    if (!record) {
      return undefined;
    }

    record.updatedAt = nowIso();

    if (options.providerId !== undefined) {
      record.providerId = options.providerId;
    }

    if (options.abortController !== undefined) {
      record.abortController = options.abortController;
    }

    if (options.humanInputHandler !== undefined) {
      record.humanInputHandler = options.humanInputHandler;
    }

    if (options.summary !== undefined) {
      record.summary = options.summary;
    }

    if (options.error !== undefined) {
      record.error = options.error;
    }

    if (options.inputRequest !== undefined) {
      record.inputRequest = options.inputRequest;
    }

    if (options.status !== undefined) {
      record.status = options.status;
      if (
        options.status === "complete" ||
        options.status === "failed" ||
        options.status === "cancelled"
      ) {
        record.completedAt = record.updatedAt;
      }
    }

    this._onDidChangeRuns.fire();
    return this.toSnapshot(record);
  }

  stopRun(runId: string): boolean {
    const record = this.runsById.get(runId);
    if (!record?.abortController) {
      return false;
    }

    record.abortController.abort(new Error(`Stopped prompt ${record.promptStem}.`));
    record.status = "cancelled";
    record.error = "Execution cancelled.";
    record.completedAt = nowIso();
    record.updatedAt = record.completedAt;
    this._onDidChangeRuns.fire();

    return true;
  }

  requestHumanInput(runId: string, inputRequest: string, humanInputHandler?: HumanInputHandler): AgentRunSnapshot | undefined {
    return this.updateRun(runId, {
      status: "human_input_required",
      inputRequest,
      humanInputHandler,
      error: undefined,
    });
  }

  async submitHumanInput(runId: string, input: string): Promise<boolean> {
    const record = this.runsById.get(runId);
    if (!record || !record.humanInputHandler) {
      return false;
    }

    record.updatedAt = nowIso();
    record.summary = "Human input submitted.";
    record.error = undefined;

    try {
      await record.humanInputHandler(input);
      record.status = "queued";
      record.inputRequest = undefined;
      this._onDidChangeRuns.fire();
      return true;
    } catch (error) {
      record.status = "failed";
      record.error = error instanceof Error ? error.message : String(error);
      record.completedAt = nowIso();
      record.updatedAt = record.completedAt;
      this._onDidChangeRuns.fire();
      return false;
    }
  }

  getRun(runId: string): AgentRunSnapshot | undefined {
    const record = this.runsById.get(runId);
    return record ? this.toSnapshot(record) : undefined;
  }

  getLatestRunForPrompt(workpackId: string, promptStem: string): AgentRunSnapshot | undefined {
    const runId = this.latestRunIdByPrompt.get(buildPromptKey(workpackId, promptStem));
    if (!runId) {
      return undefined;
    }

    return this.getRun(runId);
  }

  listRuns(): AgentRunSnapshot[] {
    return Array.from(this.runsById.values()).map((record) => this.toSnapshot(record));
  }

  listActiveRuns(): AgentRunSnapshot[] {
    return this.listRuns()
      .filter((run) => run.status === "queued" || run.status === "in_progress" || run.status === "human_input_required")
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  }

  private toSnapshot(record: AgentRunRecord): AgentRunSnapshot {
    return {
      runId: record.runId,
      workpackId: record.workpackId,
      promptStem: record.promptStem,
      folderPath: record.folderPath,
      promptFilePath: record.promptFilePath,
      providerId: record.providerId,
      status: record.status,
      startedAt: record.startedAt,
      updatedAt: record.updatedAt,
      completedAt: record.completedAt,
      summary: record.summary,
      error: record.error,
      inputRequest: record.inputRequest,
    };
  }
}