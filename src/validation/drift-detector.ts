import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { WorkpackMeta } from "../models";

const WORKPACK_META_FILE = "workpack.meta.json";
const WORKPACK_STATE_FILE = "workpack.state.json";
const STATUS_FILE = "99_status.md";
const PROMPTS_DIR = "prompts";
const OUTPUTS_DIR = "outputs";

const PROMPT_STEM_PATTERN = /^(?:[ABVR]\d+_[A-Za-z0-9_]+)$/;
const PROMPT_FILE_PATTERN = /^(?:[ABVR]\d+_[A-Za-z0-9_]+)\.md$/i;
const OUTPUT_FILE_PATTERN = /^(?:[ABVR]\d+_[A-Za-z0-9_]+)\.json$/i;

const STATUS_VALUE_PATTERNS: Array<{ pattern: RegExp; normalized: string }> = [
  { pattern: /\bnot\s*started\b/i, normalized: "not_started" },
  { pattern: /\bpending\b/i, normalized: "pending" },
  { pattern: /\bin\s*progress\b|\bongoing\b/i, normalized: "in_progress" },
  { pattern: /\bblocked\b/i, normalized: "blocked" },
  { pattern: /\breview\b|\bin\s*review\b/i, normalized: "review" },
  { pattern: /\bcomplete\b|\bcompleted\b|\bdone\b/i, normalized: "complete" },
  { pattern: /\babandoned\b|\bcancelled\b|\bcanceled\b/i, normalized: "abandoned" },
  { pattern: /\bskipped\b|\bskip\b/i, normalized: "skipped" }
];

type Severity = "error" | "warning" | "info";

interface RawPromptMetaEntry {
  stem?: unknown;
}

interface RawWorkpackMeta {
  id?: unknown;
  prompts?: unknown;
}

interface RawPromptState {
  status?: unknown;
  completed_at?: unknown;
}

interface RawWorkpackState {
  workpack_id?: unknown;
  overall_status?: unknown;
  prompt_status?: unknown;
  blocked_by?: unknown;
  last_updated?: unknown;
}

interface StatusMarkdownResult {
  overallStatus: string;
  promptStatuses: Record<string, string>;
}

interface WorkpackFolderCandidate {
  folderPath: string;
  meta: WorkpackMeta | null;
}

export enum DriftType {
  MISSING_OUTPUT = "missing_output",
  ORPHANED_OUTPUT = "orphaned_output",
  STATUS_MISMATCH = "status_mismatch",
  MISSING_PROMPT_FILE = "missing_prompt_file",
  UNLISTED_PROMPT = "unlisted_prompt",
  ID_MISMATCH = "id_mismatch",
  STALE_BLOCKER = "stale_blocker"
}

export interface DriftItem {
  type: DriftType;
  severity: Severity;
  message: string;
  file?: string;
  promptStem?: string;
  suggestion?: string;
}

export interface DriftReport {
  workpackId: string;
  drifts: DriftItem[];
  checkedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeStatus(rawValue: string): string {
  const value = rawValue.trim().toLowerCase();
  for (const entry of STATUS_VALUE_PATTERNS) {
    if (entry.pattern.test(value)) {
      return entry.normalized;
    }
  }

  return value.replace(/\s+/g, "_");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function listPromptStemsFromDirectory(promptsDirPath: string): Promise<Set<string>> {
  const stems = new Set<string>();
  try {
    const entries = await fs.readdir(promptsDirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !PROMPT_FILE_PATTERN.test(entry.name)) {
        continue;
      }

      stems.add(path.parse(entry.name).name);
    }
  } catch {
    return stems;
  }

  return stems;
}

async function listOutputStemsFromDirectory(outputsDirPath: string): Promise<Set<string>> {
  const stems = new Set<string>();
  try {
    const entries = await fs.readdir(outputsDirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !OUTPUT_FILE_PATTERN.test(entry.name)) {
        continue;
      }

      stems.add(path.parse(entry.name).name);
    }
  } catch {
    return stems;
  }

  return stems;
}

function parseMetaPromptStems(rawMeta: RawWorkpackMeta | null): Set<string> {
  const stems = new Set<string>();
  if (!rawMeta || !Array.isArray(rawMeta.prompts)) {
    return stems;
  }

  for (const entry of rawMeta.prompts) {
    if (!isRecord(entry)) {
      continue;
    }

    const stem = asString((entry as RawPromptMetaEntry).stem);
    if (stem && PROMPT_STEM_PATTERN.test(stem)) {
      stems.add(stem);
    }
  }

  return stems;
}

function parseStatePromptStatuses(rawState: RawWorkpackState | null): Record<string, string> {
  const statuses: Record<string, string> = {};
  if (!rawState || !isRecord(rawState.prompt_status)) {
    return statuses;
  }

  for (const [promptStem, value] of Object.entries(rawState.prompt_status)) {
    if (!PROMPT_STEM_PATTERN.test(promptStem) || !isRecord(value)) {
      continue;
    }

    const statusValue = asString((value as RawPromptState).status);
    if (!statusValue) {
      continue;
    }

    statuses[promptStem] = normalizeStatus(statusValue);
  }

  return statuses;
}

function addDrift(
  target: DriftItem[],
  type: DriftType,
  severity: Severity,
  message: string,
  options: { file?: string; promptStem?: string; suggestion?: string } = {}
): void {
  target.push({
    type,
    severity,
    message,
    file: options.file,
    promptStem: options.promptStem,
    suggestion: options.suggestion
  });
}

function parseTablePromptStatuses(lines: string[]): Record<string, string> {
  const promptStatuses: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("|") || !line.endsWith("|")) {
      continue;
    }

    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell, index, all) => !(index === 0 || index === all.length - 1));

    if (cells.length < 2 || /^-+$/.test(cells[0].replace(/\s+/g, ""))) {
      continue;
    }

    const promptStem = cells[0];
    if (!PROMPT_STEM_PATTERN.test(promptStem)) {
      continue;
    }

    promptStatuses[promptStem] = normalizeStatus(cells[1]);
  }

  return promptStatuses;
}

function parseFallbackPromptStatuses(lines: string[]): Record<string, string> {
  const promptStatuses: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const promptMatch = line.match(/\b([ABVR]\d+_[A-Za-z0-9_]+)\b/);
    if (!promptMatch) {
      continue;
    }

    const status = normalizeStatus(line);
    if (!status || status === line.toLowerCase().replace(/\s+/g, "_")) {
      continue;
    }

    promptStatuses[promptMatch[1]] = status;
  }

  return promptStatuses;
}

export function parseStatusMarkdown(content: string): StatusMarkdownResult {
  const lines = content.split(/\r?\n/);

  let overallStatus = "unknown";
  const overallHeaderIndex = lines.findIndex((line) => /\boverall\s+status\b/i.test(line));

  if (overallHeaderIndex >= 0) {
    for (let index = overallHeaderIndex + 1; index < lines.length; index += 1) {
      const candidate = lines[index].trim();
      if (!candidate) {
        continue;
      }

      if (candidate.startsWith("#")) {
        break;
      }

      const normalized = normalizeStatus(candidate);
      if (normalized !== candidate.toLowerCase().replace(/\s+/g, "_")) {
        overallStatus = normalized;
      }
      break;
    }
  }

  if (overallStatus === "unknown") {
    for (const line of lines) {
      const normalized = normalizeStatus(line);
      if (normalized !== line.trim().toLowerCase().replace(/\s+/g, "_")) {
        overallStatus = normalized;
        break;
      }
    }
  }

  const promptStatuses = {
    ...parseFallbackPromptStatuses(lines),
    ...parseTablePromptStatuses(lines)
  };

  return {
    overallStatus,
    promptStatuses
  };
}

async function readWorkpackCandidate(folderPath: string): Promise<WorkpackFolderCandidate | null> {
  const metaPath = path.join(folderPath, WORKPACK_META_FILE);
  if (!(await pathExists(metaPath))) {
    return null;
  }

  const rawMeta = await readJsonFile<RawWorkpackMeta>(metaPath);
  const id = rawMeta ? asString(rawMeta.id) : null;

  return {
    folderPath,
    meta: id
      ? ({
          id,
          title: "",
          summary: "",
          protocolVersion: "2.0.0",
          workpackVersion: "1.0.0",
          category: "feature",
          createdAt: "",
          requiresWorkpack: [],
          tags: [],
          owners: [],
          repos: [],
          deliveryMode: "pr",
          targetBranch: "main",
          prompts: []
        } as WorkpackMeta)
      : null
  };
}

async function discoverWorkpackFolders(rootPath: string): Promise<string[]> {
  const discovered = new Set<string>();

  async function walk(currentPath: string, depth: number): Promise<void> {
    if (depth > 3) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    const hasMeta = entries.some((entry) => entry.isFile() && entry.name === WORKPACK_META_FILE);
    if (hasMeta) {
      discovered.add(currentPath);
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      await walk(path.join(currentPath, entry.name), depth + 1);
    }
  }

  await walk(instancesPathNormalize(rootPath), 0);
  return Array.from(discovered).sort((left, right) => left.localeCompare(right));
}

function instancesPathNormalize(instancesPath: string): string {
  return path.resolve(instancesPath);
}

async function detectStaleBlockers(
  drifts: DriftItem[],
  blockedBy: string[],
  currentWorkpackPath: string,
  allWorkpacks?: WorkpackMeta[]
): Promise<void> {
  const siblingRoot = path.dirname(currentWorkpackPath);
  const knownIds = new Set((allWorkpacks ?? []).map((entry) => entry.id));

  for (const blockedWorkpackId of blockedBy) {
    if (!blockedWorkpackId) {
      continue;
    }

    if (knownIds.size > 0 && !knownIds.has(blockedWorkpackId)) {
      continue;
    }

    const blockedStatePath = path.join(siblingRoot, blockedWorkpackId, WORKPACK_STATE_FILE);
    const blockedState = await readJsonFile<RawWorkpackState>(blockedStatePath);
    if (!blockedState) {
      continue;
    }

    const blockedOverallStatus = asString(blockedState.overall_status);
    if (blockedOverallStatus && normalizeStatus(blockedOverallStatus) === "complete") {
      addDrift(
        drifts,
        DriftType.STALE_BLOCKER,
        "warning",
        `Blocked workpack '${blockedWorkpackId}' is already complete but still listed in blocked_by.`,
        {
          file: WORKPACK_STATE_FILE,
          suggestion: `Remove '${blockedWorkpackId}' from blocked_by.`
        }
      );
    }
  }
}

export class DriftDetector {
  async detect(workpackPath: string, allWorkpacks?: WorkpackMeta[]): Promise<DriftReport> {
    const resolvedPath = path.resolve(workpackPath);
    const metaPath = path.join(resolvedPath, WORKPACK_META_FILE);
    const statePath = path.join(resolvedPath, WORKPACK_STATE_FILE);
    const statusPath = path.join(resolvedPath, STATUS_FILE);

    const [rawMeta, rawState, statusMarkdown, promptStemsOnDisk, outputStemsOnDisk] = await Promise.all([
      readJsonFile<RawWorkpackMeta>(metaPath),
      readJsonFile<RawWorkpackState>(statePath),
      readTextFile(statusPath),
      listPromptStemsFromDirectory(path.join(resolvedPath, PROMPTS_DIR)),
      listOutputStemsFromDirectory(path.join(resolvedPath, OUTPUTS_DIR))
    ]);

    const drifts: DriftItem[] = [];
    const workpackId =
      asString(rawState?.workpack_id) ?? asString(rawMeta?.id) ?? path.basename(resolvedPath) ?? "unknown";

    if (!rawMeta) {
      addDrift(drifts, DriftType.ID_MISMATCH, "warning", "Missing or invalid workpack.meta.json.", {
        file: WORKPACK_META_FILE,
        suggestion: "Create or fix workpack.meta.json."
      });
    }

    if (!rawState) {
      addDrift(drifts, DriftType.STATUS_MISMATCH, "warning", "Missing or invalid workpack.state.json.", {
        file: WORKPACK_STATE_FILE,
        suggestion: "Create or fix workpack.state.json."
      });
    }

    const stateWorkpackId = asString(rawState?.workpack_id);
    const metaWorkpackId = asString(rawMeta?.id);
    if (stateWorkpackId && metaWorkpackId && stateWorkpackId !== metaWorkpackId) {
      addDrift(
        drifts,
        DriftType.ID_MISMATCH,
        "error",
        `State workpack_id '${stateWorkpackId}' does not match meta id '${metaWorkpackId}'.`,
        {
          file: WORKPACK_STATE_FILE,
          suggestion: `Set workpack_id to '${metaWorkpackId}'.`
        }
      );
    }

    const metaPromptStems = parseMetaPromptStems(rawMeta);
    const statePromptStatuses = parseStatePromptStatuses(rawState);

    for (const promptStem of metaPromptStems) {
      if (!promptStemsOnDisk.has(promptStem)) {
        addDrift(
          drifts,
          DriftType.MISSING_PROMPT_FILE,
          "error",
          `Prompt '${promptStem}' is listed in meta but prompt file is missing.`,
          {
            file: path.join(PROMPTS_DIR, `${promptStem}.md`),
            promptStem,
            suggestion: `Create '${promptStem}.md' or remove it from workpack.meta.json.`
          }
        );
      }
    }

    for (const promptStem of promptStemsOnDisk) {
      if (!metaPromptStems.has(promptStem)) {
        addDrift(
          drifts,
          DriftType.UNLISTED_PROMPT,
          "warning",
          `Prompt file '${promptStem}.md' exists but is not listed in workpack.meta.json.`,
          {
            file: path.join(PROMPTS_DIR, `${promptStem}.md`),
            promptStem,
            suggestion: `Add '${promptStem}' to workpack.meta.json prompts list.`
          }
        );
      }
    }

    for (const [promptStem, status] of Object.entries(statePromptStatuses)) {
      const hasOutput = outputStemsOnDisk.has(promptStem);

      if (status === "complete" && !hasOutput) {
        addDrift(
          drifts,
          DriftType.MISSING_OUTPUT,
          "error",
          `Prompt '${promptStem}' is complete in state but output JSON is missing.`,
          {
            file: path.join(OUTPUTS_DIR, `${promptStem}.json`),
            promptStem,
            suggestion: `Generate '${promptStem}.json' or set prompt status to pending.`
          }
        );
      }

      if (status === "pending" && hasOutput) {
        addDrift(
          drifts,
          DriftType.ORPHANED_OUTPUT,
          "warning",
          `Output JSON exists for '${promptStem}' but state status is pending.`,
          {
            file: path.join(OUTPUTS_DIR, `${promptStem}.json`),
            promptStem,
            suggestion: `Set '${promptStem}' status to complete if output is valid.`
          }
        );
      }
    }

    if (statusMarkdown && rawState) {
      const parsedStatus = parseStatusMarkdown(statusMarkdown);
      const stateOverallStatus = asString(rawState.overall_status);

      if (stateOverallStatus) {
        const normalizedStateOverall = normalizeStatus(stateOverallStatus);
        if (parsedStatus.overallStatus !== "unknown" && normalizedStateOverall !== parsedStatus.overallStatus) {
          addDrift(
            drifts,
            DriftType.STATUS_MISMATCH,
            "warning",
            `Overall status mismatch: state='${normalizedStateOverall}' vs status file='${parsedStatus.overallStatus}'.`,
            {
              file: STATUS_FILE,
              suggestion: "Align 99_status.md overall status with workpack.state.json."
            }
          );
        }
      }

      for (const [promptStem, markdownStatus] of Object.entries(parsedStatus.promptStatuses)) {
        const statePromptStatus = statePromptStatuses[promptStem];
        if (!statePromptStatus) {
          continue;
        }

        if (statePromptStatus !== markdownStatus) {
          addDrift(
            drifts,
            DriftType.STATUS_MISMATCH,
            "warning",
            `Prompt '${promptStem}' status mismatch: state='${statePromptStatus}' vs status file='${markdownStatus}'.`,
            {
              file: STATUS_FILE,
              promptStem,
              suggestion: "Update table row in 99_status.md or align workpack.state.json prompt status."
            }
          );
        }
      }
    }

    const blockedBy = Array.isArray(rawState?.blocked_by)
      ? rawState?.blocked_by.filter((entry): entry is string => typeof entry === "string")
      : [];
    await detectStaleBlockers(drifts, blockedBy, resolvedPath, allWorkpacks);

    return {
      workpackId,
      drifts,
      checkedAt: new Date().toISOString()
    };
  }

  async detectAll(instancesPath: string): Promise<DriftReport[]> {
    const workpackFolders = await discoverWorkpackFolders(instancesPath);

    const candidates = await Promise.all(workpackFolders.map((folderPath) => readWorkpackCandidate(folderPath)));
    const allWorkpacks = candidates
      .filter((candidate): candidate is WorkpackFolderCandidate => candidate !== null)
      .map((candidate) => candidate.meta)
      .filter((meta): meta is WorkpackMeta => meta !== null);

    const reports = await Promise.all(
      workpackFolders.map(async (folderPath) => this.detect(folderPath, allWorkpacks))
    );

    return reports.sort((left, right) => left.workpackId.localeCompare(right.workpackId));
  }

  async autoFix(workpackPath: string, report: DriftReport): Promise<DriftItem[]> {
    const statePath = path.join(path.resolve(workpackPath), WORKPACK_STATE_FILE);
    const rawState = await readJsonFile<RawWorkpackState>(statePath);
    if (!rawState || !isRecord(rawState.prompt_status)) {
      return [];
    }

    let changed = false;
    const fixes: DriftItem[] = [];
    const now = new Date().toISOString();

    for (const drift of report.drifts) {
      if (drift.type !== DriftType.ORPHANED_OUTPUT || !drift.promptStem) {
        continue;
      }

      const promptState = rawState.prompt_status[drift.promptStem];
      if (!isRecord(promptState)) {
        continue;
      }

      const status = asString(promptState.status);
      if (status !== "pending") {
        continue;
      }

      promptState.status = "complete";
      if (typeof promptState.completed_at !== "string" || promptState.completed_at.length === 0) {
        promptState.completed_at = now;
      }

      changed = true;
      fixes.push({
        type: DriftType.ORPHANED_OUTPUT,
        severity: "info",
        message: `Updated prompt '${drift.promptStem}' status from pending to complete.`,
        promptStem: drift.promptStem,
        file: WORKPACK_STATE_FILE,
        suggestion: "Review and commit the updated workpack.state.json."
      });
    }

    if (!changed) {
      return fixes;
    }

    if (typeof rawState.last_updated === "string") {
      rawState.last_updated = now;
    }

    await fs.writeFile(statePath, `${JSON.stringify(rawState, null, 2)}\n`, "utf8");
    return fixes;
  }
}
