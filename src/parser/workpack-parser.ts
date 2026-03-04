import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { ErrorObject, ValidateFunction } from "ajv";
import type {
  DeliveryMode,
  DiscoveredProtocolVersion,
  EffortEstimate,
  ExecutionEvent,
  OverallStatus,
  PromptEntry,
  PromptStatusValue,
  WorkpackCategory,
  WorkpackInstance,
  WorkpackMeta,
  WorkpackProtocolVersion,
  WorkpackState
} from "../models";
import { SchemaValidatorCache } from "../utils/schema-validator-cache";

const META_FILE = "workpack.meta.json";
const STATE_FILE = "workpack.state.json";
const REQUEST_FILE = "00_request.md";
const PLAN_FILE = "01_plan.md";
const META_SCHEMA_FILE = "WORKPACK_META_SCHEMA.json";
const STATE_SCHEMA_FILE = "WORKPACK_STATE_SCHEMA.json";
const DEFAULT_SCHEMA_PROTOCOL_VERSION: WorkpackProtocolVersion = "2.0.0";
const SEMVER_PROTOCOL_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;

const CATEGORY_VALUES = new Set([
  "feature",
  "refactor",
  "bugfix",
  "hotfix",
  "debug",
  "docs",
  "perf",
  "security"
]);
const DELIVERY_MODE_VALUES = new Set(["pr", "direct_push"]);
const OVERALL_STATUS_VALUES = new Set([
  "not_started",
  "in_progress",
  "blocked",
  "review",
  "complete",
  "abandoned"
]);
const PROMPT_STATUS_VALUES = new Set(["pending", "in_progress", "complete", "blocked", "skipped"]);
const EXECUTION_EVENT_VALUES = new Set([
  "created",
  "started",
  "prompt_started",
  "prompt_completed",
  "blocked",
  "unblocked",
  "review",
  "completed",
  "abandoned"
]);
const EFFORT_VALUES: EffortEstimate[] = ["XS", "S", "M", "L", "XL"];
const schemaValidatorCache = new SchemaValidatorCache({ onWarning: warn });

interface MarkdownFallbackMeta extends Partial<WorkpackMeta> {
  __legacyDetected?: boolean;
  __protocolVersion?: DiscoveredProtocolVersion;
}

function warn(message: string, error?: unknown): void {
  if (error instanceof Error) {
    console.warn(`[workpack-parser] ${message}: ${error.message}`);
    return;
  }

  console.warn(`[workpack-parser] ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      return null;
    }

    parsed.push(entry);
  }

  return parsed;
}

function isSemverProtocolVersion(value: string): value is WorkpackProtocolVersion {
  return SEMVER_PROTOCOL_PATTERN.test(value);
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return "unknown schema violation";
  }

  return errors
    .slice(0, 3)
    .map((error) => {
      const location = error.instancePath || "/";
      const message = error.message ?? "is invalid";
      return `${location} ${message}`;
    })
    .join("; ");
}

async function getSchemaValidator(
  folderPath: string,
  schemaFileName: string
): Promise<ValidateFunction<unknown> | null> {
  return schemaValidatorCache.getValidator(folderPath, schemaFileName);
}

async function validatePayloadAgainstSchema(
  payload: unknown,
  folderPath: string,
  sourceFilePath: string,
  schemaFileName: string
): Promise<boolean> {
  const validator = await getSchemaValidator(folderPath, schemaFileName);
  if (!validator) {
    return true;
  }

  const isValid = validator(payload);
  if (!isValid) {
    warn(
      `Schema validation failed for ${sourceFilePath} against ${schemaFileName}: ${formatSchemaErrors(
        validator.errors
      )}`
    );
  }

  return isValid;
}

function parseJson(content: string, filePath: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    warn(`Malformed JSON in ${filePath}`, error);
    return null;
  }
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return parseJson(content, filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    warn(`Unable to read ${filePath}`, error);
    return null;
  }
}

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    warn(`Unable to read ${filePath}`, error);
    return null;
  }
}

function parsePromptEntry(input: unknown, filePath: string): PromptEntry | null {
  if (!isRecord(input)) {
    warn(`Invalid prompt entry in ${filePath}: expected object`);
    return null;
  }

  const stem = asString(input.stem);
  const agentRole = asString(input.agent_role);
  const dependsOn = asStringArray(input.depends_on);
  const repos = asStringArray(input.repos);
  const estimatedEffort = asString(input.estimated_effort) as EffortEstimate | null;

  if (!stem || !agentRole || !dependsOn || !repos || !estimatedEffort) {
    warn(`Invalid prompt entry in ${filePath}: missing required fields`);
    return null;
  }

  if (!EFFORT_VALUES.includes(estimatedEffort)) {
    warn(`Invalid prompt entry in ${filePath}: invalid estimated_effort "${estimatedEffort}"`);
    return null;
  }

  return {
    stem,
    agentRole,
    dependsOn,
    repos,
    estimatedEffort
  };
}

function mapWorkpackMeta(input: unknown, filePath: string): WorkpackMeta | null {
  if (!isRecord(input)) {
    warn(`Invalid metadata in ${filePath}: expected object`);
    return null;
  }

  const id = asString(input.id);
  const group = asString(input.group);
  const title = asString(input.title);
  const summary = asString(input.summary);
  const protocolVersion = asString(input.protocol_version);
  const workpackVersion = asString(input.workpack_version);
  const category = asString(input.category);
  const createdAt = asString(input.created_at);
  const requiresWorkpack = asStringArray(input.requires_workpack);
  const tags = asStringArray(input.tags);
  const owners = asStringArray(input.owners);
  const repos = asStringArray(input.repos);
  const deliveryMode = asString(input.delivery_mode);
  const targetBranch = asString(input.target_branch);
  const promptsRaw = input.prompts;

  if (
    !id ||
    !title ||
    !summary ||
    !protocolVersion ||
    !workpackVersion ||
    !category ||
    !createdAt ||
    !requiresWorkpack ||
    !tags ||
    !owners ||
    !repos ||
    !deliveryMode ||
    !targetBranch ||
    !Array.isArray(promptsRaw)
  ) {
    warn(`Invalid metadata in ${filePath}: missing required fields`);
    return null;
  }

  if (!isSemverProtocolVersion(protocolVersion)) {
    warn(`Invalid protocol_version "${protocolVersion}" in ${filePath}: expected semantic version x.y.z`);
    return null;
  }

  if (!CATEGORY_VALUES.has(category)) {
    warn(`Invalid category "${category}" in ${filePath}`);
    return null;
  }

  if (!DELIVERY_MODE_VALUES.has(deliveryMode)) {
    warn(`Invalid delivery_mode "${deliveryMode}" in ${filePath}`);
    return null;
  }

  const prompts = promptsRaw
    .map((entry) => parsePromptEntry(entry, filePath))
    .filter((entry): entry is PromptEntry => entry !== null);

  if (prompts.length !== promptsRaw.length) {
    return null;
  }

  return {
    id,
    group: group ?? undefined,
    title,
    summary,
    protocolVersion,
    workpackVersion,
    category: category as WorkpackCategory,
    createdAt,
    requiresWorkpack,
    tags,
    owners,
    repos,
    deliveryMode: deliveryMode as DeliveryMode,
    targetBranch,
    prompts
  };
}

function mapPromptStatusEntry(input: unknown, filePath: string): WorkpackState["promptStatus"][string] | null {
  if (!isRecord(input)) {
    warn(`Invalid prompt_status entry in ${filePath}: expected object`);
    return null;
  }

  const status = asString(input.status);
  if (!status || !PROMPT_STATUS_VALUES.has(status)) {
    warn(`Invalid prompt status value in ${filePath}`);
    return null;
  }

  const assignedAgent = asString(input.assigned_agent);
  const startedAt = input.started_at;
  const completedAt = input.completed_at;
  const outputValidated = input.output_validated;
  const blockedReason = input.blocked_reason;

  const result: WorkpackState["promptStatus"][string] = {
    status: status as PromptStatusValue
  };

  if (assignedAgent !== null) {
    result.assignedAgent = assignedAgent;
  }

  if (typeof startedAt === "string" || startedAt === null) {
    result.startedAt = startedAt;
  }

  if (typeof completedAt === "string" || completedAt === null) {
    result.completedAt = completedAt;
  }

  if (typeof outputValidated === "boolean") {
    result.outputValidated = outputValidated;
  }

  if (typeof blockedReason === "string" || blockedReason === null) {
    result.blockedReason = blockedReason;
  }

  return result;
}

function mapExecutionLogEntry(input: unknown, filePath: string): WorkpackState["executionLog"][number] | null {
  if (!isRecord(input)) {
    warn(`Invalid execution_log entry in ${filePath}: expected object`);
    return null;
  }

  const timestamp = asString(input.timestamp);
  const event = asString(input.event);

  if (!timestamp || !event || !EXECUTION_EVENT_VALUES.has(event)) {
    warn(`Invalid execution_log entry in ${filePath}`);
    return null;
  }

  const promptStem = input.prompt_stem;
  const agent = input.agent;
  const notes = input.notes;

  return {
    timestamp,
    event: event as ExecutionEvent,
    promptStem: typeof promptStem === "string" || promptStem === null ? promptStem : undefined,
    agent: typeof agent === "string" || agent === null ? agent : undefined,
    notes: typeof notes === "string" || notes === null ? notes : undefined
  };
}

function mapWorkpackState(input: unknown, filePath: string): WorkpackState | null {
  if (!isRecord(input)) {
    warn(`Invalid state in ${filePath}: expected object`);
    return null;
  }

  const workpackId = asString(input.workpack_id);
  const overallStatus = asString(input.overall_status);
  const lastUpdated = asString(input.last_updated);
  const promptStatusRaw = input.prompt_status;
  const agentAssignmentsRaw = input.agent_assignments;
  const blockedBy = asStringArray(input.blocked_by);
  const executionLogRaw = input.execution_log;
  const notes = input.notes;

  if (
    !workpackId ||
    !overallStatus ||
    !OVERALL_STATUS_VALUES.has(overallStatus) ||
    !lastUpdated ||
    !isRecord(promptStatusRaw) ||
    !isRecord(agentAssignmentsRaw) ||
    !blockedBy ||
    !Array.isArray(executionLogRaw)
  ) {
    warn(`Invalid state in ${filePath}: missing required fields`);
    return null;
  }

  const promptStatus: WorkpackState["promptStatus"] = {};
  for (const [promptStem, value] of Object.entries(promptStatusRaw)) {
    const parsedEntry = mapPromptStatusEntry(value, filePath);
    if (!parsedEntry) {
      return null;
    }

    promptStatus[promptStem] = parsedEntry;
  }

  const agentAssignments: WorkpackState["agentAssignments"] = {};
  for (const [promptStem, assignedAgent] of Object.entries(agentAssignmentsRaw)) {
    if (typeof assignedAgent !== "string") {
      warn(`Invalid agent assignment in ${filePath} for prompt ${promptStem}`);
      return null;
    }

    agentAssignments[promptStem] = assignedAgent;
  }

  const executionLog = executionLogRaw
    .map((entry) => mapExecutionLogEntry(entry, filePath))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (executionLog.length !== executionLogRaw.length) {
    return null;
  }

  return {
    workpackId,
    overallStatus: overallStatus as OverallStatus,
    lastUpdated,
    promptStatus,
    agentAssignments,
    blockedBy,
    executionLog,
    notes: typeof notes === "string" || notes === null ? notes : undefined
  };
}

function parseListFromBracketNotation(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "[]") {
    return [];
  }

  const withoutBrackets = trimmed.startsWith("[") && trimmed.endsWith("]")
    ? trimmed.slice(1, -1)
    : trimmed;

  if (!withoutBrackets.trim()) {
    return [];
  }

  return withoutBrackets
    .split(",")
    .map((token) => token.trim().replace(/^`|`$/g, "").replace(/^"|"$/g, ""))
    .filter((token) => token.length > 0);
}

function parseEffort(value: string): EffortEstimate {
  const normalized = value.trim().replace(/`/g, "");
  return EFFORT_VALUES.includes(normalized as EffortEstimate)
    ? (normalized as EffortEstimate)
    : "M";
}

function parseRequestProtocolVersion(requestMarkdown: string): DiscoveredProtocolVersion | null {
  const match = requestMarkdown.match(/Workpack Protocol Version:\s*`?([0-9]+(?:\.[0-9]+\.[0-9]+)?)`?/i);
  if (!match) {
    return null;
  }

  const discoveredVersion = match[1].trim();
  if (discoveredVersion === "5") {
    return "5";
  }

  if (discoveredVersion === "6") {
    return DEFAULT_SCHEMA_PROTOCOL_VERSION;
  }

  if (isSemverProtocolVersion(discoveredVersion)) {
    return discoveredVersion;
  }

  return null;
}

function parseDeliveryModeFromRequest(requestMarkdown: string): DeliveryMode | null {
  const preferredMatch = requestMarkdown.match(/Preferred Delivery Mode:\s*`?([A-Za-z _-]+)`?/i);
  if (preferredMatch) {
    const value = preferredMatch[1].toLowerCase();
    if (value.includes("direct")) {
      return "direct_push";
    }

    return "pr";
  }

  const lines = requestMarkdown.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim().toLowerCase();
    if (!line.startsWith("- [x]")) {
      continue;
    }

    if (line.includes("direct")) {
      return "direct_push";
    }

    if (line.includes("pr")) {
      return "pr";
    }
  }

  return null;
}

function parseTargetBranchFromRequest(requestMarkdown: string): string | null {
  const match =
    requestMarkdown.match(/Target Base Branch:\s*`?([^\r\n`]+)`?/i) ??
    requestMarkdown.match(/Target Branch:\s*`?([^\r\n`]+)`?/i);

  return match ? match[1].trim() : null;
}

function parseShortSlugFromRequest(requestMarkdown: string): string | null {
  const match = requestMarkdown.match(/Short Slug:\s*`?([a-z0-9][a-z0-9-]*)`?/i);
  return match ? match[1].trim() : null;
}

function parseSummaryFromRequest(requestMarkdown: string): string | null {
  const sectionMatch = requestMarkdown.match(/##\s*Original Request([\s\S]*?)(\n##\s+|\s*$)/i);
  if (!sectionMatch) {
    return null;
  }

  const lines = sectionMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("Request Type:"))
    .filter((line) => !line.startsWith("Short Slug:"));

  const summary = lines.find((line) => !line.startsWith("#") && line.length >= 10);
  return summary ?? null;
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseWbsMetadata(planMarkdown: string): Map<string, { agentRole: string; estimatedEffort: EffortEstimate }> {
  const lines = planMarkdown.split(/\r?\n/);
  const metadataByPrompt = new Map<string, { agentRole: string; estimatedEffort: EffortEstimate }>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes("|") || !line.toLowerCase().includes("agent prompt")) {
      continue;
    }

    index += 2;
    for (; index < lines.length; index += 1) {
      const row = lines[index];
      if (!row.trim().startsWith("|")) {
        break;
      }

      const cells = row
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      if (cells.length < 5) {
        continue;
      }

      const agentPrompt = cells[2];
      const task = cells[1];
      const estimatedEffort = parseEffort(cells[4]);

      if (!agentPrompt || !task) {
        continue;
      }

      metadataByPrompt.set(agentPrompt, { agentRole: task, estimatedEffort });
    }

    break;
  }

  return metadataByPrompt;
}

function parseDagPromptsFromPlan(planMarkdown: string): PromptEntry[] {
  const lines = planMarkdown.split(/\r?\n/);
  const prompts: PromptEntry[] = [];
  const metadataByPrompt = parseWbsMetadata(planMarkdown);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) {
      continue;
    }

    const normalizedHeader = line.toLowerCase();
    if (!normalizedHeader.includes("| prompt |") || !normalizedHeader.includes("depends_on")) {
      continue;
    }

    index += 2;
    for (; index < lines.length; index += 1) {
      const row = lines[index];
      if (!row.trim().startsWith("|")) {
        break;
      }

      const cells = row
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      if (cells.length < 3) {
        continue;
      }

      const stem = cells[0];
      if (!stem || stem === "Prompt") {
        continue;
      }

      const dependsOn = parseListFromBracketNotation(cells[1]);
      const repos = parseListFromBracketNotation(cells[2]);
      const metadata = metadataByPrompt.get(stem);

      prompts.push({
        stem,
        agentRole: metadata?.agentRole ?? `Legacy prompt ${stem}`,
        dependsOn,
        repos,
        estimatedEffort: metadata?.estimatedEffort ?? "M"
      });
    }

    break;
  }

  if (prompts.length > 0) {
    return prompts;
  }

  for (const [stem, metadata] of metadataByPrompt.entries()) {
    prompts.push({
      stem,
      agentRole: metadata.agentRole,
      dependsOn: [],
      repos: [],
      estimatedEffort: metadata.estimatedEffort
    });
  }

  return prompts;
}

function parseRequiresWorkpackFromPlan(planMarkdown: string): string[] {
  const inlineMatch = planMarkdown.match(/requires_workpack:\s*\[([^\]]*)\]/i);
  if (inlineMatch) {
    return parseListFromBracketNotation(`[${inlineMatch[1]}]`);
  }

  return [];
}

function inferCreatedAtFromFolderName(folderName: string): string {
  const dateMatch = folderName.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})_/);
  if (dateMatch) {
    return dateMatch[1];
  }

  return "1970-01-01";
}

function buildLegacyMeta(folderPath: string, fallback: MarkdownFallbackMeta): WorkpackMeta {
  const folderName = path.basename(folderPath);

  return {
    id: folderName,
    group: fallback.group,
    title: fallback.title ?? humanizeSlug(folderName),
    summary: fallback.summary ?? "Legacy workpack discovered from markdown fallback parsing.",
    protocolVersion: fallback.protocolVersion ?? DEFAULT_SCHEMA_PROTOCOL_VERSION,
    workpackVersion: fallback.workpackVersion ?? "0.0.0",
    category: fallback.category ?? "feature",
    createdAt: fallback.createdAt ?? inferCreatedAtFromFolderName(folderName),
    requiresWorkpack: fallback.requiresWorkpack ?? [],
    tags: fallback.tags ?? ["legacy"],
    owners: fallback.owners ?? [],
    repos: fallback.repos ?? [],
    deliveryMode: fallback.deliveryMode ?? "pr",
    targetBranch: fallback.targetBranch ?? "main",
    prompts: fallback.prompts ?? []
  };
}

export async function parseWorkpackMeta(folderPath: string): Promise<WorkpackMeta | null> {
  const metaPath = path.join(folderPath, META_FILE);
  const rawMeta = await readJsonFile(metaPath);
  if (rawMeta === null) {
    return null;
  }

  const isSchemaValid = await validatePayloadAgainstSchema(rawMeta, folderPath, metaPath, META_SCHEMA_FILE);
  if (!isSchemaValid) {
    return null;
  }

  return mapWorkpackMeta(rawMeta, metaPath);
}

export async function parseWorkpackState(folderPath: string): Promise<WorkpackState | null> {
  const statePath = path.join(folderPath, STATE_FILE);
  const rawState = await readJsonFile(statePath);
  if (rawState === null) {
    return null;
  }

  const isSchemaValid = await validatePayloadAgainstSchema(rawState, folderPath, statePath, STATE_SCHEMA_FILE);
  if (!isSchemaValid) {
    return null;
  }

  return mapWorkpackState(rawState, statePath);
}

export async function parseWorkpackMarkdownFallback(folderPath: string): Promise<Partial<WorkpackMeta>> {
  const requestPath = path.join(folderPath, REQUEST_FILE);
  const planPath = path.join(folderPath, PLAN_FILE);
  const [requestMarkdown, planMarkdown] = await Promise.all([readTextFile(requestPath), readTextFile(planPath)]);

  const result: MarkdownFallbackMeta = {};
  if (!requestMarkdown && !planMarkdown) {
    return result;
  }

  result.__legacyDetected = true;

  if (requestMarkdown) {
    const protocolVersion = parseRequestProtocolVersion(requestMarkdown);
    if (protocolVersion) {
      result.__protocolVersion = protocolVersion;
      if (protocolVersion !== "5") {
        result.protocolVersion = protocolVersion;
      }
    }

    const deliveryMode = parseDeliveryModeFromRequest(requestMarkdown);
    if (deliveryMode) {
      result.deliveryMode = deliveryMode;
    }

    const targetBranch = parseTargetBranchFromRequest(requestMarkdown);
    if (targetBranch) {
      result.targetBranch = targetBranch;
    }

    const shortSlug = parseShortSlugFromRequest(requestMarkdown);
    if (shortSlug) {
      result.title = humanizeSlug(shortSlug);
    }

    const summary = parseSummaryFromRequest(requestMarkdown);
    if (summary) {
      result.summary = summary;
    }
  }

  if (planMarkdown) {
    const prompts = parseDagPromptsFromPlan(planMarkdown);
    if (prompts.length > 0) {
      result.prompts = prompts;
    }

    const requiresWorkpack = parseRequiresWorkpackFromPlan(planMarkdown);
    if (requiresWorkpack.length > 0) {
      result.requiresWorkpack = requiresWorkpack;
    }

    if (!result.repos && prompts.length > 0) {
      result.repos = Array.from(new Set(prompts.flatMap((prompt) => prompt.repos)));
    }
  }

  return result;
}

export async function parseWorkpackInstance(folderPath: string): Promise<WorkpackInstance> {
  const resolvedFolderPath = path.resolve(folderPath);
  const meta = await parseWorkpackMeta(resolvedFolderPath);
  const state = await parseWorkpackState(resolvedFolderPath);

  if (meta) {
    return {
      folderPath: resolvedFolderPath,
      meta,
      state,
      protocolVersion: meta.protocolVersion,
      discoverySource: "auto"
    };
  }

  const fallback = (await parseWorkpackMarkdownFallback(resolvedFolderPath)) as MarkdownFallbackMeta;
  if (!fallback.__legacyDetected) {
    throw new Error(`Unable to parse workpack at ${resolvedFolderPath}: no metadata or markdown fallback files found`);
  }

  const legacyMeta = buildLegacyMeta(resolvedFolderPath, fallback);
  const discoveredProtocolVersion = fallback.__protocolVersion ?? "5";

  return {
    folderPath: resolvedFolderPath,
    meta: legacyMeta,
    state,
    protocolVersion: discoveredProtocolVersion,
    discoverySource: "auto"
  };
}
