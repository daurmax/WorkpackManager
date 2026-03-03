import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { PromptEntry, WorkpackMeta, WorkpackState } from "../models";
import {
  AssignmentModel,
  loadWorkpackState,
  saveWorkpackStateAtomic,
} from "./assignment";
import {
  DagCycleError,
  detectPromptCycle,
  getReadyPrompts as computeReadyPrompts,
  topologicalSortPrompts,
} from "./dag";
import type { ProviderRegistry } from "./registry";
import type { AgentProvider, PromptDispatchContext, PromptResult } from "./types";

const DEFAULT_MAX_PARALLEL = 1;
const DEFAULT_CONTINUE_ON_ERROR = false;
const DEFAULT_TIMEOUT_MS = 300_000;

interface DispatchOutcome {
  promptStem: string;
  result: PromptResult;
  stopExecution: boolean;
}

export interface OrchestratorOptions {
  /** Maximum parallel dispatches (default: 1 for safety). */
  maxParallel: number;
  /** Continue dispatching if a prompt fails? */
  continueOnError: boolean;
  /** Timeout per prompt dispatch in ms (default: 300000 = 5min). */
  timeoutMs: number;
  /** Optional external cancellation signal for this execution run. */
  signal?: AbortSignal;
}

export interface ExecutionSummary {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  results: Record<string, PromptResult>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export class ExecutionOrchestrator {
  private readonly resolvedOptions: OrchestratorOptions;

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly assignment: AssignmentModel,
    options: OrchestratorOptions
  ) {
    this.resolvedOptions = {
      maxParallel: Math.max(1, options.maxParallel || DEFAULT_MAX_PARALLEL),
      continueOnError: options.continueOnError ?? DEFAULT_CONTINUE_ON_ERROR,
      timeoutMs: options.timeoutMs > 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS,
      signal: options.signal,
    };
  }

  async execute(meta: WorkpackMeta, stateFilePath: string): Promise<ExecutionSummary> {
    this.validateDAG(meta);

    await this.assignment.load();
    await this.assignment.autoAssign(meta.prompts);
    await this.assignment.save();

    const state = await loadWorkpackState(stateFilePath, meta.id);
    this.initializeState(meta, state);

    const assignments = this.assignment.getAllAssignments();
    for (const prompt of meta.prompts) {
      const assignedProvider = assignments[prompt.stem];
      if (assignedProvider) {
        state.agentAssignments[prompt.stem] = assignedProvider;
        state.promptStatus[prompt.stem].assignedAgent = assignedProvider;
      }
    }

    state.overallStatus = "in_progress";
    state.lastUpdated = nowIso();
    await saveWorkpackStateAtomic(stateFilePath, state);

    const results: Record<string, PromptResult> = {};
    let stopExecution = false;

    while (!stopExecution) {
      if (this.resolvedOptions.signal?.aborted) {
        stopExecution = true;
        break;
      }

      const readyPrompts = this.getReadyPrompts(meta, state).filter(
        (prompt) => results[prompt.stem] === undefined
      );

      if (readyPrompts.length === 0) {
        break;
      }

      const batch = readyPrompts.slice(0, this.resolvedOptions.maxParallel);
      const outcomes = await Promise.all(
        batch.map((prompt) => this.dispatchPrompt(meta, stateFilePath, state, prompt, results))
      );

      for (const outcome of outcomes) {
        results[outcome.promptStem] = outcome.result;
        if (outcome.stopExecution) {
          stopExecution = true;
        }
      }
    }

    this.markSkippedPrompts(meta, state, results, stopExecution);
    this.refreshOverallStatus(meta, state);
    state.lastUpdated = nowIso();
    await saveWorkpackStateAtomic(stateFilePath, state);

    const promptStatuses = meta.prompts.map((prompt) => state.promptStatus[prompt.stem]?.status);
    const completed = promptStatuses.filter((status) => status === "complete").length;
    const failed = promptStatuses.filter((status) => status === "blocked").length;
    const skipped = promptStatuses.filter((status) => status === "skipped").length;

    return {
      total: meta.prompts.length,
      completed,
      failed,
      skipped,
      results,
    };
  }

  async executeOne(
    meta: WorkpackMeta,
    stateFilePath: string,
    promptStem: string
  ): Promise<ExecutionSummary> {
    const promptByStem = new Map(meta.prompts.map((prompt) => [prompt.stem, prompt]));
    if (!promptByStem.has(promptStem)) {
      throw new Error(`Prompt '${promptStem}' is not declared in workpack '${meta.id}'.`);
    }

    const requiredPrompts = new Set<string>();
    const stack = [promptStem];

    while (stack.length > 0) {
      const currentStem = stack.pop();
      if (!currentStem || requiredPrompts.has(currentStem)) {
        continue;
      }

      const currentPrompt = promptByStem.get(currentStem);
      if (!currentPrompt) {
        throw new Error(`Prompt '${currentStem}' is not declared in workpack '${meta.id}'.`);
      }

      requiredPrompts.add(currentStem);

      for (const dependencyStem of currentPrompt.dependsOn) {
        if (!promptByStem.has(dependencyStem)) {
          throw new Error(
            `Prompt '${currentStem}' depends on missing prompt '${dependencyStem}'.`
          );
        }

        stack.push(dependencyStem);
      }
    }

    const scopedMeta: WorkpackMeta = {
      ...meta,
      prompts: topologicalSortPrompts(meta).filter((prompt) => requiredPrompts.has(prompt.stem)),
    };

    return this.execute(scopedMeta, stateFilePath);
  }

  getReadyPrompts(meta: WorkpackMeta, state: WorkpackState): PromptEntry[] {
    return computeReadyPrompts(meta, state);
  }

  validateDAG(meta: WorkpackMeta): void {
    const cycle = detectPromptCycle(meta);
    if (!cycle) {
      return;
    }

    throw new DagCycleError(cycle);
  }

  private initializeState(meta: WorkpackMeta, state: WorkpackState): void {
    for (const prompt of meta.prompts) {
      if (!state.promptStatus[prompt.stem]) {
        state.promptStatus[prompt.stem] = { status: "pending" };
      }
    }
  }

  private async loadPromptContent(stateFilePath: string, promptStem: string): Promise<string> {
    const workpackFolder = path.dirname(path.resolve(stateFilePath));
    const candidates = [
      path.join(workpackFolder, "prompts", `${promptStem}.md`),
      path.join(workpackFolder, `${promptStem}.md`),
    ];

    for (const candidatePath of candidates) {
      try {
        return await fs.readFile(candidatePath, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }

        throw error;
      }
    }

    throw new Error(`Prompt file not found for stem '${promptStem}'.`);
  }

  private buildDependencyOutputs(
    prompt: PromptEntry,
    results: Record<string, PromptResult>
  ): Record<string, unknown> | undefined {
    const dependencyOutputs: Record<string, unknown> = {};

    for (const dependencyStem of prompt.dependsOn) {
      const dependencyResult = results[dependencyStem];
      if (dependencyResult?.output) {
        dependencyOutputs[dependencyStem] = dependencyResult.output;
      }
    }

    return Object.keys(dependencyOutputs).length > 0 ? dependencyOutputs : undefined;
  }

  private async markPromptBlocked(
    stateFilePath: string,
    state: WorkpackState,
    promptStem: string,
    providerId: string | undefined,
    errorMessage: string
  ): Promise<void> {
    const timestamp = nowIso();
    const currentPromptState = state.promptStatus[promptStem] ?? { status: "pending" };

    state.promptStatus[promptStem] = {
      ...currentPromptState,
      status: "blocked",
      assignedAgent: providerId ?? currentPromptState.assignedAgent,
      completedAt: timestamp,
      outputValidated: false,
      blockedReason: errorMessage,
    };

    state.executionLog.push({
      timestamp,
      event: "blocked",
      promptStem,
      agent: providerId ?? null,
      notes: errorMessage,
    });
    state.lastUpdated = timestamp;

    await saveWorkpackStateAtomic(stateFilePath, state);
  }

  private async dispatchPrompt(
    meta: WorkpackMeta,
    stateFilePath: string,
    state: WorkpackState,
    prompt: PromptEntry,
    results: Record<string, PromptResult>
  ): Promise<DispatchOutcome> {
    const providerId =
      this.assignment.getAssignment(prompt.stem) ?? state.agentAssignments[prompt.stem];

    if (!providerId) {
      const error = `No provider assignment found for prompt '${prompt.stem}'.`;
      await this.markPromptBlocked(stateFilePath, state, prompt.stem, undefined, error);

      return {
        promptStem: prompt.stem,
        result: {
          success: false,
          summary: `Prompt ${prompt.stem} failed.`,
          error,
        },
        stopExecution: !this.resolvedOptions.continueOnError,
      };
    }

    const provider = this.registry.get(providerId);
    if (!provider) {
      const error = `Assigned provider '${providerId}' is not registered.`;
      await this.markPromptBlocked(stateFilePath, state, prompt.stem, providerId, error);

      return {
        promptStem: prompt.stem,
        result: {
          success: false,
          summary: `Prompt ${prompt.stem} failed.`,
          error,
        },
        stopExecution: !this.resolvedOptions.continueOnError,
      };
    }

    const isAvailable = await provider.isAvailable().catch(() => false);
    if (!isAvailable) {
      const error = `Provider '${providerId}' is unavailable.`;
      await this.markPromptBlocked(stateFilePath, state, prompt.stem, providerId, error);

      return {
        promptStem: prompt.stem,
        result: {
          success: false,
          summary: `Prompt ${prompt.stem} failed.`,
          error,
        },
        stopExecution: !this.resolvedOptions.continueOnError,
      };
    }

    state.agentAssignments[prompt.stem] = providerId;
    const startedAt = nowIso();
    const currentPromptState = state.promptStatus[prompt.stem] ?? { status: "pending" };
    state.promptStatus[prompt.stem] = {
      ...currentPromptState,
      status: "in_progress",
      assignedAgent: providerId,
      startedAt,
      completedAt: null,
      blockedReason: null,
    };
    state.executionLog.push({
      timestamp: startedAt,
      event: "prompt_started",
      promptStem: prompt.stem,
      agent: providerId,
      notes: null,
    });
    state.lastUpdated = startedAt;
    await saveWorkpackStateAtomic(stateFilePath, state);

    let promptContent: string;
    try {
      promptContent = await this.loadPromptContent(stateFilePath, prompt.stem);
    } catch (error) {
      const message = toErrorMessage(error);
      await this.markPromptBlocked(stateFilePath, state, prompt.stem, providerId, message);

      return {
        promptStem: prompt.stem,
        result: {
          success: false,
          summary: `Prompt ${prompt.stem} failed.`,
          error: message,
        },
        stopExecution: !this.resolvedOptions.continueOnError,
      };
    }

    const startMs = Date.now();
    const context: PromptDispatchContext = {
      workpackId: meta.id,
      promptStem: prompt.stem,
      repos: prompt.repos,
      dependencyOutputs: this.buildDependencyOutputs(prompt, results),
    };
    const dispatchResult = await this.dispatchWithTimeout(provider, promptContent, context, prompt.stem);
    const normalizedResult: PromptResult = {
      ...dispatchResult,
      durationMs: dispatchResult.durationMs ?? Date.now() - startMs,
    };

    const completedAt = nowIso();
    if (normalizedResult.success) {
      state.promptStatus[prompt.stem] = {
        ...state.promptStatus[prompt.stem],
        status: "complete",
        assignedAgent: providerId,
        completedAt,
        outputValidated: true,
        blockedReason: null,
      };
      state.executionLog.push({
        timestamp: completedAt,
        event: "prompt_completed",
        promptStem: prompt.stem,
        agent: providerId,
        notes: normalizedResult.summary,
      });
    } else {
      state.promptStatus[prompt.stem] = {
        ...state.promptStatus[prompt.stem],
        status: "blocked",
        assignedAgent: providerId,
        completedAt,
        outputValidated: false,
        blockedReason: normalizedResult.error ?? normalizedResult.summary,
      };
      state.executionLog.push({
        timestamp: completedAt,
        event: "blocked",
        promptStem: prompt.stem,
        agent: providerId,
        notes: normalizedResult.error ?? normalizedResult.summary,
      });
    }

    state.lastUpdated = completedAt;
    await saveWorkpackStateAtomic(stateFilePath, state);

    return {
      promptStem: prompt.stem,
      result: normalizedResult,
      stopExecution: !normalizedResult.success && !this.resolvedOptions.continueOnError,
    };
  }

  private async dispatchWithTimeout(
    provider: AgentProvider,
    promptContent: string,
    context: PromptDispatchContext,
    promptStem: string
  ): Promise<PromptResult> {
    type DispatchRaceResult =
      | { kind: "result"; result: PromptResult }
      | { kind: "error"; error: unknown }
      | { kind: "timeout" }
      | { kind: "cancelled" };

    const dispatchAbortController = new AbortController();
    let timeoutHandle: NodeJS.Timeout | undefined;
    let abortListener: (() => void) | undefined;

    const timeoutPromise: Promise<DispatchRaceResult> = new Promise((resolve) => {
      timeoutHandle = setTimeout(() => {
        dispatchAbortController.abort(new Error(`Prompt ${promptStem} timed out.`));
        resolve({ kind: "timeout" });
      }, this.resolvedOptions.timeoutMs);
    });

    const cancellationPromise: Promise<DispatchRaceResult> | undefined = this.resolvedOptions.signal
      ? new Promise((resolve) => {
          if (this.resolvedOptions.signal?.aborted) {
            dispatchAbortController.abort(this.resolvedOptions.signal.reason);
            resolve({ kind: "cancelled" });
            return;
          }

          abortListener = () => {
            dispatchAbortController.abort(this.resolvedOptions.signal?.reason);
            resolve({ kind: "cancelled" });
          };

          this.resolvedOptions.signal?.addEventListener("abort", abortListener, { once: true });
        })
      : undefined;

    const dispatchPromise: Promise<DispatchRaceResult> = provider
      .dispatch(promptContent, {
        ...context,
        abortSignal: dispatchAbortController.signal,
      })
      .then((result) => ({ kind: "result", result } as const))
      .catch((error: unknown) => ({ kind: "error", error } as const));

    const raceCandidates: Promise<DispatchRaceResult>[] = [dispatchPromise, timeoutPromise];
    if (cancellationPromise) {
      raceCandidates.push(cancellationPromise);
    }

    const raced = await Promise.race(raceCandidates);

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    if (abortListener) {
      this.resolvedOptions.signal?.removeEventListener("abort", abortListener);
    }

    if (raced.kind === "result") {
      return raced.result;
    }

    if (raced.kind === "error") {
      return {
        success: false,
        summary: `Prompt ${promptStem} failed during dispatch.`,
        error: toErrorMessage(raced.error),
      };
    }

    if (raced.kind === "timeout") {
      return {
        success: false,
        summary: `Prompt ${promptStem} timed out.`,
        error: `Timed out after ${this.resolvedOptions.timeoutMs} ms.`,
      };
    }

    return {
      success: false,
      summary: `Prompt ${promptStem} cancelled.`,
      error: "Execution cancelled.",
    };
  }

  private markSkippedPrompts(
    meta: WorkpackMeta,
    state: WorkpackState,
    results: Record<string, PromptResult>,
    executionStopped: boolean
  ): void {
    const sortedPrompts = topologicalSortPrompts(meta);

    for (const prompt of sortedPrompts) {
      const promptState = state.promptStatus[prompt.stem];
      if (promptState?.status !== "pending") {
        continue;
      }

      const unsatisfiedDependencies = prompt.dependsOn.filter(
        (dependencyStem) => state.promptStatus[dependencyStem]?.status !== "complete"
      );

      const reason =
        unsatisfiedDependencies.length > 0
          ? `Unsatisfied dependencies: ${unsatisfiedDependencies.join(", ")}.`
          : executionStopped
            ? "Execution halted before dispatch."
            : "Prompt was not dispatched.";
      const completedAt = nowIso();

      state.promptStatus[prompt.stem] = {
        ...promptState,
        status: "skipped",
        completedAt,
        blockedReason: reason,
      };
      state.executionLog.push({
        timestamp: completedAt,
        event: "prompt_completed",
        promptStem: prompt.stem,
        agent: state.agentAssignments[prompt.stem] ?? null,
        notes: `Skipped. ${reason}`,
      });

      results[prompt.stem] = {
        success: false,
        summary: `Prompt ${prompt.stem} skipped.`,
        error: reason,
      };
    }
  }

  private refreshOverallStatus(meta: WorkpackMeta, state: WorkpackState): void {
    const statuses = meta.prompts.map((prompt) => state.promptStatus[prompt.stem]?.status);

    if (statuses.some((status) => status === "blocked")) {
      state.overallStatus = "blocked";
      return;
    }

    if (statuses.every((status) => status === "complete" || status === "skipped")) {
      state.overallStatus = "complete";
      return;
    }

    state.overallStatus = "in_progress";
  }
}
