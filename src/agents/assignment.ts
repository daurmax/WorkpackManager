import { promises as fs } from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  EffortEstimate,
  ExecutionEvent,
  ExecutionLogEntry,
  OverallStatus,
  PromptEntry,
  PromptStatus,
  PromptStatusValue,
  WorkpackState,
} from "../models";
import type { ProviderRegistry } from "./registry";
import type { AgentProvider, ProviderId } from "./types";

type JsonRecord = Record<string, unknown>;

const OVERALL_STATUS_VALUES = new Set<OverallStatus>([
  "not_started",
  "in_progress",
  "blocked",
  "review",
  "complete",
  "abandoned",
]);

const PROMPT_STATUS_VALUES = new Set<PromptStatusValue>([
  "pending",
  "in_progress",
  "complete",
  "blocked",
  "skipped",
]);

const EXECUTION_EVENT_VALUES = new Set<ExecutionEvent>([
  "created",
  "started",
  "prompt_started",
  "prompt_completed",
  "blocked",
  "unblocked",
  "review",
  "completed",
  "abandoned",
]);

const COMMAND_ROLE_PATTERN = /\b(command|shell|terminal|cli|script)\b/i;
const DEFAULT_PROMPT_TIMEOUT_MS = 300_000;

export type PromptMeta = PromptEntry;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function inferWorkpackIdFromStatePath(stateFilePath: string): string {
  const parentFolder = path.basename(path.dirname(path.resolve(stateFilePath)));
  return parentFolder || "unknown-workpack";
}

function parsePromptStatus(input: unknown): PromptStatus {
  if (!isRecord(input)) {
    return { status: "pending" };
  }

  const statusCandidate = input.status;
  const status = PROMPT_STATUS_VALUES.has(statusCandidate as PromptStatusValue)
    ? (statusCandidate as PromptStatusValue)
    : "pending";

  const parsed: PromptStatus = { status };

  if (typeof input.assigned_agent === "string") {
    parsed.assignedAgent = input.assigned_agent;
  }

  if (typeof input.started_at === "string" || input.started_at === null) {
    parsed.startedAt = input.started_at;
  }

  if (typeof input.completed_at === "string" || input.completed_at === null) {
    parsed.completedAt = input.completed_at;
  }

  if (typeof input.output_validated === "boolean") {
    parsed.outputValidated = input.output_validated;
  }

  if (typeof input.blocked_reason === "string" || input.blocked_reason === null) {
    parsed.blockedReason = input.blocked_reason;
  }

  return parsed;
}

function parseExecutionLogEntry(input: unknown): ExecutionLogEntry | null {
  if (!isRecord(input)) {
    return null;
  }

  if (typeof input.timestamp !== "string") {
    return null;
  }

  if (!EXECUTION_EVENT_VALUES.has(input.event as ExecutionEvent)) {
    return null;
  }

  const parsed: ExecutionLogEntry = {
    timestamp: input.timestamp,
    event: input.event as ExecutionEvent,
  };

  if (typeof input.prompt_stem === "string" || input.prompt_stem === null) {
    parsed.promptStem = input.prompt_stem;
  }

  if (typeof input.agent === "string" || input.agent === null) {
    parsed.agent = input.agent;
  }

  if (typeof input.notes === "string" || input.notes === null) {
    parsed.notes = input.notes;
  }

  return parsed;
}

function createDefaultState(stateFilePath: string, workpackId?: string): WorkpackState {
  return {
    workpackId: workpackId ?? inferWorkpackIdFromStatePath(stateFilePath),
    overallStatus: "not_started",
    lastUpdated: new Date().toISOString(),
    promptStatus: {},
    agentAssignments: {},
    blockedBy: [],
    executionLog: [],
  };
}

function parseStatePayload(
  payload: unknown,
  stateFilePath: string,
  fallbackWorkpackId?: string
): WorkpackState {
  const defaults = createDefaultState(stateFilePath, fallbackWorkpackId);
  if (!isRecord(payload)) {
    return defaults;
  }

  const workpackId =
    typeof payload.workpack_id === "string" ? payload.workpack_id : defaults.workpackId;
  const overallStatus = OVERALL_STATUS_VALUES.has(payload.overall_status as OverallStatus)
    ? (payload.overall_status as OverallStatus)
    : defaults.overallStatus;
  const lastUpdated = typeof payload.last_updated === "string"
    ? payload.last_updated
    : defaults.lastUpdated;

  const promptStatus: WorkpackState["promptStatus"] = {};
  if (isRecord(payload.prompt_status)) {
    for (const [stem, promptState] of Object.entries(payload.prompt_status)) {
      promptStatus[stem] = parsePromptStatus(promptState);
    }
  }

  const agentAssignments: WorkpackState["agentAssignments"] = {};
  if (isRecord(payload.agent_assignments)) {
    for (const [stem, providerId] of Object.entries(payload.agent_assignments)) {
      if (typeof providerId === "string") {
        agentAssignments[stem] = providerId;
      }
    }
  }

  const executionLog: WorkpackState["executionLog"] = [];
  if (Array.isArray(payload.execution_log)) {
    for (const entry of payload.execution_log) {
      const parsedEntry = parseExecutionLogEntry(entry);
      if (parsedEntry) {
        executionLog.push(parsedEntry);
      }
    }
  }

  return {
    workpackId,
    overallStatus,
    lastUpdated,
    promptStatus,
    agentAssignments,
    blockedBy: asStringArray(payload.blocked_by),
    executionLog,
    notes: typeof payload.notes === "string" || payload.notes === null ? payload.notes : undefined,
  };
}

function serializePromptStatus(promptStatus: PromptStatus): JsonRecord {
  const serialized: JsonRecord = {
    status: promptStatus.status,
  };

  if (promptStatus.assignedAgent !== undefined) {
    serialized.assigned_agent = promptStatus.assignedAgent;
  }

  if (promptStatus.startedAt !== undefined) {
    serialized.started_at = promptStatus.startedAt;
  }

  if (promptStatus.completedAt !== undefined) {
    serialized.completed_at = promptStatus.completedAt;
  }

  if (promptStatus.outputValidated !== undefined) {
    serialized.output_validated = promptStatus.outputValidated;
  }

  if (promptStatus.blockedReason !== undefined) {
    serialized.blocked_reason = promptStatus.blockedReason;
  }

  return serialized;
}

function serializeExecutionLogEntry(entry: ExecutionLogEntry): JsonRecord {
  const serialized: JsonRecord = {
    timestamp: entry.timestamp,
    event: entry.event,
  };

  if (entry.promptStem !== undefined) {
    serialized.prompt_stem = entry.promptStem;
  }

  if (entry.agent !== undefined) {
    serialized.agent = entry.agent;
  }

  if (entry.notes !== undefined) {
    serialized.notes = entry.notes;
  }

  return serialized;
}

function serializeStatePayload(state: WorkpackState): JsonRecord {
  const promptStatus: JsonRecord = {};
  for (const [stem, promptState] of Object.entries(state.promptStatus)) {
    promptStatus[stem] = serializePromptStatus(promptState);
  }

  const payload: JsonRecord = {
    workpack_id: state.workpackId,
    overall_status: state.overallStatus,
    last_updated: state.lastUpdated,
    prompt_status: promptStatus,
    agent_assignments: { ...state.agentAssignments },
    blocked_by: [...state.blockedBy],
    execution_log: state.executionLog.map((entry) => serializeExecutionLogEntry(entry)),
  };

  if (state.notes !== undefined) {
    payload.notes = state.notes;
  }

  return payload;
}

export async function loadWorkpackState(
  stateFilePath: string,
  fallbackWorkpackId?: string
): Promise<WorkpackState> {
  try {
    const content = await fs.readFile(stateFilePath, "utf8");
    const payload = JSON.parse(content) as unknown;
    return parseStatePayload(payload, stateFilePath, fallbackWorkpackId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createDefaultState(stateFilePath, fallbackWorkpackId);
    }

    if (error instanceof SyntaxError) {
      return createDefaultState(stateFilePath, fallbackWorkpackId);
    }

    throw error;
  }
}

export async function saveWorkpackStateAtomic(
  stateFilePath: string,
  state: WorkpackState
): Promise<void> {
  const dirPath = path.dirname(stateFilePath);
  const tempPath = path.join(
    dirPath,
    `${path.basename(stateFilePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`
  );
  const serialized = `${JSON.stringify(serializeStatePayload(state), null, 2)}\n`;

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(tempPath, serialized, "utf8");

  try {
    await fs.rename(tempPath, stateFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      await fs.rm(stateFilePath, { force: true });
      await fs.rename(tempPath, stateFilePath);
      return;
    }

    throw error;
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}

function tokenizeRole(agentRole: string): Set<string> {
  const tokens = agentRole
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);

  return new Set(tokens);
}

function expectsLongRunning(effort: EffortEstimate): boolean {
  return effort === "L" || effort === "XL";
}

function scoreProvider(prompt: PromptMeta, provider: AgentProvider): number {
  const capability = provider.capabilities();
  const roleTokens = tokenizeRole(prompt.agentRole);
  const tagSet = new Set(capability.tags.map((tag) => tag.toLowerCase()));

  let score = 0;

  if (COMMAND_ROLE_PATTERN.test(prompt.agentRole) && capability.commandExecution) {
    score += 4;
  }

  if (expectsLongRunning(prompt.estimatedEffort) && capability.longRunning) {
    score += 3;
  }

  if (prompt.repos.length > 1 && capability.multiFileEdit) {
    score += 2;
  }

  for (const token of roleTokens) {
    if (tagSet.has(token)) {
      score += 1;
    }
  }

  if (prompt.estimatedEffort === "XL" && capability.maxPromptTokens >= 32_000) {
    score += 2;
  } else if (prompt.estimatedEffort === "L" && capability.maxPromptTokens >= 16_000) {
    score += 1;
  }

  if (!expectsLongRunning(prompt.estimatedEffort) && !capability.longRunning) {
    score += 1;
  }

  return score;
}

function pickBestProvider(prompt: PromptMeta, providers: AgentProvider[]): AgentProvider | null {
  if (providers.length === 0) {
    return null;
  }

  const ranked = providers
    .map((provider) => ({
      provider,
      score: scoreProvider(prompt, provider),
      maxPromptTokens: provider.capabilities().maxPromptTokens,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.maxPromptTokens !== left.maxPromptTokens) {
        return right.maxPromptTokens - left.maxPromptTokens;
      }

      return left.provider.id.localeCompare(right.provider.id);
    });

  return ranked[0]?.provider ?? null;
}

export class AssignmentModel {
  private assignments: Record<string, ProviderId> = {};

  constructor(
    private readonly stateFilePath: string,
    private readonly registry: ProviderRegistry
  ) {}

  private ensureProviderExists(providerId: ProviderId): void {
    if (!this.registry.get(providerId)) {
      throw new Error(`Unknown provider '${providerId}'.`);
    }
  }

  private async getEligibleProviders(): Promise<AgentProvider[]> {
    const allProviders = this.registry.listAll();
    const availability = await Promise.all(
      allProviders.map(async (provider) => {
        try {
          return {
            provider,
            available: await provider.isAvailable(),
          };
        } catch {
          return {
            provider,
            available: false,
          };
        }
      })
    );

    const availableProviders = availability
      .filter((entry) => entry.available)
      .map((entry) => entry.provider);

    return availableProviders.length > 0 ? availableProviders : allProviders;
  }

  async assign(promptStem: string, providerId: ProviderId): Promise<void> {
    this.ensureProviderExists(providerId);
    this.assignments[promptStem] = providerId;
  }

  async unassign(promptStem: string): Promise<void> {
    delete this.assignments[promptStem];
  }

  getAssignment(promptStem: string): ProviderId | undefined {
    return this.assignments[promptStem];
  }

  getAllAssignments(): Record<string, ProviderId> {
    return { ...this.assignments };
  }

  async autoAssign(prompts: PromptMeta[]): Promise<Record<string, ProviderId>> {
    const providers = await this.getEligibleProviders();
    if (providers.length === 0) {
      throw new Error("No providers registered for auto-assignment.");
    }

    const newlyAssigned: Record<string, ProviderId> = {};

    for (const prompt of prompts) {
      if (this.assignments[prompt.stem]) {
        continue;
      }

      const provider = pickBestProvider(prompt, providers);
      if (!provider) {
        continue;
      }

      this.assignments[prompt.stem] = provider.id;
      newlyAssigned[prompt.stem] = provider.id;
    }

    return newlyAssigned;
  }

  async save(): Promise<void> {
    const state = await loadWorkpackState(this.stateFilePath);
    state.agentAssignments = { ...this.assignments };

    for (const promptState of Object.values(state.promptStatus)) {
      delete promptState.assignedAgent;
    }

    for (const [promptStem, providerId] of Object.entries(this.assignments)) {
      if (!state.promptStatus[promptStem]) {
        state.promptStatus[promptStem] = { status: "pending" };
      }

      state.promptStatus[promptStem].assignedAgent = providerId;
    }

    state.lastUpdated = new Date().toISOString();
    await saveWorkpackStateAtomic(this.stateFilePath, state);
  }

  async load(): Promise<void> {
    const state = await loadWorkpackState(this.stateFilePath);
    const mergedAssignments: Record<string, ProviderId> = {
      ...state.agentAssignments,
    };

    for (const [promptStem, promptState] of Object.entries(state.promptStatus)) {
      if (promptState.assignedAgent) {
        mergedAssignments[promptStem] = promptState.assignedAgent;
      }
    }

    for (const [key, providerId] of Object.entries(mergedAssignments)) {
      if (!this.registry.get(providerId)) {
        delete mergedAssignments[key];
      }
    }

    this.assignments = mergedAssignments;
  }
}

export const assignmentDefaults = {
  promptTimeoutMs: DEFAULT_PROMPT_TIMEOUT_MS,
};
