import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { AnySchema, ErrorObject, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

const META_FILE = "workpack.meta.json";
const STATE_FILE = "workpack.state.json";
const REQUEST_FILE = "00_request.md";
const PLAN_FILE = "01_plan.md";
const STATUS_FILE = "99_status.md";
const PROMPTS_DIR = "prompts";
const META_SCHEMA_FILE = "WORKPACK_META_SCHEMA.json";
const STATE_SCHEMA_FILE = "WORKPACK_STATE_SCHEMA.json";
const WORKPACKS_DIR = "workpacks";
const DEFAULT_PROTOCOL_VERSION = "2.0.0";
const DEFAULT_WORKPACK_VERSION = "1.0.0";
const DEFAULT_CATEGORY = "feature";
const DEFAULT_OVERALL_STATUS = "not_started";
const EFFORT_VALUES = new Set(["XS", "S", "M", "L", "XL"]);
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
const PROMPT_STATUS_VALUES = ["pending", "in_progress", "complete", "blocked", "skipped"] as const;

type PromptRuntimeStatus = (typeof PROMPT_STATUS_VALUES)[number];

interface PromptMetaEntry {
  stem: string;
  agent_role: string;
  depends_on: string[];
  repos: string[];
  estimated_effort: string;
}

interface ParsedRequest {
  title: string;
  summary: string;
  protocolVersionRaw: string;
  repos: string[];
}

interface ParsedPlan {
  requiresWorkpack: string[];
  requiresWorkpackStatus: Record<string, string>;
}

interface MigrationData {
  meta: Record<string, unknown>;
  state: Record<string, unknown>;
}

export interface MigrationOptions {
  dryRun: boolean;
  overwrite: boolean;
}

export interface MigrationResult {
  workpackId: string;
  success: boolean;
  filesCreated: string[];
  filesSkipped: string[];
  errors: string[];
  warnings: string[];
}

export class ProtocolMigrator {
  private readonly ajv: Ajv2020;
  private readonly validators = new Map<string, ValidateFunction<unknown>>();

  public constructor() {
    this.ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  public async migrate(workpackPath: string, options: MigrationOptions): Promise<MigrationResult> {
    const resolvedPath = path.resolve(workpackPath);
    const workpackId = path.basename(resolvedPath);
    const result: MigrationResult = {
      workpackId,
      success: false,
      filesCreated: [],
      filesSkipped: [],
      errors: [],
      warnings: []
    };

    const [requestMarkdown, planMarkdown, statusMarkdown] = await Promise.all([
      this.readOptionalText(path.join(resolvedPath, REQUEST_FILE)),
      this.readOptionalText(path.join(resolvedPath, PLAN_FILE)),
      this.readOptionalText(path.join(resolvedPath, STATUS_FILE))
    ]);

    if (!requestMarkdown && !planMarkdown && !statusMarkdown) {
      result.errors.push("Not a legacy workpack: missing 00_request.md, 01_plan.md, and 99_status.md.");
      return result;
    }

    const migrationData = await this.extractMigrationData(
      resolvedPath,
      requestMarkdown,
      planMarkdown,
      statusMarkdown,
      result.warnings
    );

    const schemaWarnings = await this.validateGeneratedFiles(resolvedPath, migrationData.meta, migrationData.state);
    result.warnings.push(...schemaWarnings);

    await this.persistGeneratedFile(
      resolvedPath,
      META_FILE,
      migrationData.meta,
      options,
      result
    );
    await this.persistGeneratedFile(
      resolvedPath,
      STATE_FILE,
      migrationData.state,
      options,
      result
    );

    result.success = result.errors.length === 0;
    return result;
  }

  public async migrateAll(instancesPath: string, options: MigrationOptions): Promise<MigrationResult[]> {
    const candidates = await this.findLegacyWorkpackFolders(path.resolve(instancesPath));
    const results: MigrationResult[] = [];

    for (const candidate of candidates) {
      results.push(await this.migrate(candidate, options));
    }

    return results;
  }

  private async extractMigrationData(
    workpackPath: string,
    requestMarkdown: string | null,
    planMarkdown: string | null,
    statusMarkdown: string | null,
    warnings: string[]
  ): Promise<MigrationData> {
    const workpackId = path.basename(workpackPath);
    const parsedRequest = this.parseRequest(requestMarkdown, workpackId);
    const parsedPlan = this.parsePlan(planMarkdown);
    const prompts = await this.scanPromptMetadata(path.join(workpackPath, PROMPTS_DIR), warnings);
    const category = await this.resolveCategory(workpackPath, warnings);

    const createdAt = this.inferCreatedAt(workpackId);
    if (!createdAt) {
      warnings.push("Unable to infer created_at from folder name; using current date.");
    }

    const normalizedProtocolVersion = this.normalizeProtocolVersion(parsedRequest.protocolVersionRaw);
    if (normalizedProtocolVersion !== parsedRequest.protocolVersionRaw) {
      warnings.push(
        `Legacy protocol version \"${parsedRequest.protocolVersionRaw}\" normalized to \"${normalizedProtocolVersion}\" to satisfy v6 schema.`
      );
    }

    const tags = this.inferTags(workpackId, category);
    const promptStatus = this.extractPromptStatus(statusMarkdown, prompts);
    const overallStatus = this.extractOverallStatus(statusMarkdown);
    const lastUpdated = await this.resolveLastUpdated(path.join(workpackPath, STATUS_FILE));
    const blockedBy = parsedPlan.requiresWorkpack.filter((dependencyId) => {
      const status = parsedPlan.requiresWorkpackStatus[dependencyId]?.toLowerCase() ?? "";
      return !status.includes("complete") && !status.includes("done") && !status.includes("resolved");
    });

    const promptRepos = Array.from(new Set(prompts.flatMap((prompt) => prompt.repos)));
    const repos = Array.from(new Set([...parsedRequest.repos, ...promptRepos]));

    const meta: Record<string, unknown> = {
      id: workpackId,
      title: parsedRequest.title,
      summary: parsedRequest.summary,
      protocol_version: normalizedProtocolVersion,
      workpack_version: DEFAULT_WORKPACK_VERSION,
      category,
      created_at: createdAt ?? new Date().toISOString().slice(0, 10),
      requires_workpack: parsedPlan.requiresWorkpack,
      tags,
      owners: [],
      repos,
      delivery_mode: "pr",
      target_branch: "main",
      prompts
    };

    const state: Record<string, unknown> = {
      workpack_id: workpackId,
      overall_status: overallStatus,
      last_updated: lastUpdated,
      prompt_status: promptStatus,
      agent_assignments: {},
      blocked_by: blockedBy,
      execution_log: []
    };

    return { meta, state };
  }

  private async validateGeneratedFiles(
    workpackPath: string,
    meta: Record<string, unknown>,
    state: Record<string, unknown>
  ): Promise<string[]> {
    const warnings: string[] = [];
    const [metaValidator, stateValidator] = await Promise.all([
      this.getSchemaValidator(workpackPath, META_SCHEMA_FILE),
      this.getSchemaValidator(workpackPath, STATE_SCHEMA_FILE)
    ]);

    if (metaValidator && !metaValidator(meta)) {
      warnings.push(`Meta schema validation warning: ${this.formatSchemaErrors(metaValidator.errors)}`);
    }

    if (stateValidator && !stateValidator(state)) {
      warnings.push(`State schema validation warning: ${this.formatSchemaErrors(stateValidator.errors)}`);
    }

    return warnings;
  }

  private async persistGeneratedFile(
    workpackPath: string,
    fileName: string,
    payload: Record<string, unknown>,
    options: MigrationOptions,
    result: MigrationResult
  ): Promise<void> {
    const targetPath = path.join(workpackPath, fileName);
    const relativeCreated = path.posix.join(result.workpackId, fileName);

    const exists = await this.pathExists(targetPath);
    if (exists && !options.overwrite) {
      result.filesSkipped.push(relativeCreated);
      return;
    }

    if (options.dryRun) {
      result.filesCreated.push(relativeCreated);
      return;
    }

    try {
      await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      result.filesCreated.push(relativeCreated);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to write ${fileName}: ${errorMessage}`);
    }
  }

  private parseRequest(requestMarkdown: string | null, workpackId: string): ParsedRequest {
    const defaultTitle = this.humanizeWorkpackId(workpackId);
    const defaultSummary = `Migrated legacy workpack ${workpackId}.`;
    if (!requestMarkdown) {
      return {
        title: defaultTitle,
        summary: defaultSummary,
        protocolVersionRaw: "5",
        repos: []
      };
    }

    const frontMatter = this.parseFrontMatter(requestMarkdown);
    const headingMatch = requestMarkdown.match(/^#\s+(.+)$/m);
    const title =
      this.readStringField(frontMatter, ["title", "workpack_title"]) ??
      (headingMatch ? headingMatch[1].trim() : null) ??
      defaultTitle;

    const summary = this.extractFirstParagraphAfterHeading(requestMarkdown) ?? defaultSummary;
    const protocolVersionRaw =
      this.readStringField(frontMatter, ["protocol_version"]) ??
      requestMarkdown.match(/Workpack Protocol Version:\s*`?([^`\n\r]+)`?/i)?.[1]?.trim() ??
      "5";

    const repos = this.extractStringListField(frontMatter, ["repos"]);

    return {
      title,
      summary,
      protocolVersionRaw,
      repos
    };
  }

  private parsePlan(planMarkdown: string | null): ParsedPlan {
    if (!planMarkdown) {
      return { requiresWorkpack: [], requiresWorkpackStatus: {} };
    }

    const requiresSet = new Set<string>();
    const requiresWorkpackStatus: Record<string, string> = {};

    const inlineMatch = planMarkdown.match(/requires_workpack:\s*\[([^\]]*)\]/i);
    if (inlineMatch) {
      for (const rawToken of inlineMatch[1].split(",")) {
        const dependencyId = rawToken.trim().replace(/^['"`]|['"`]$/g, "");
        if (this.looksLikeWorkpackId(dependencyId)) {
          requiresSet.add(dependencyId);
        }
      }
    }

    const lines = planMarkdown.split(/\r?\n/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith("|")) {
        continue;
      }

      const cells = trimmedLine
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      if (cells.length < 2) {
        continue;
      }

      const dependencyId = cells[0];
      if (!this.looksLikeWorkpackId(dependencyId) || dependencyId.toLowerCase() === "workpack") {
        continue;
      }

      requiresSet.add(dependencyId);
      if (!requiresWorkpackStatus[dependencyId] && cells[1]) {
        requiresWorkpackStatus[dependencyId] = cells[1];
      }
    }

    return {
      requiresWorkpack: Array.from(requiresSet),
      requiresWorkpackStatus
    };
  }

  private async scanPromptMetadata(promptsPath: string, warnings: string[]): Promise<PromptMetaEntry[]> {
    const exists = await this.pathExists(promptsPath);
    if (!exists) {
      warnings.push("Prompts directory is missing; prompts[] migrated as empty.");
      return [];
    }

    const entries = await fs.readdir(promptsPath, { withFileTypes: true });
    const promptFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    const prompts: PromptMetaEntry[] = [];

    for (const fileName of promptFiles) {
      const filePath = path.join(promptsPath, fileName);
      const markdown = await this.readOptionalText(filePath);
      if (!markdown) {
        continue;
      }

      const frontMatter = this.parseFrontMatter(markdown);
      const stem =
        this.readStringField(frontMatter, ["prompt_id"]) ??
        path.basename(fileName, path.extname(fileName));

      if (!this.looksLikePromptStem(stem)) {
        warnings.push(`Skipped prompt metadata from ${fileName}: invalid prompt stem \"${stem}\".`);
        continue;
      }

      const dependsOn = this.extractStringListField(frontMatter, ["depends_on"])
        .filter((entry) => this.looksLikePromptStem(entry));
      const repos = this.extractStringListField(frontMatter, ["repos"]);
      const estimatedEffortRaw = this.readStringField(frontMatter, ["estimated_effort"]) ?? "M";
      const estimatedEffort = EFFORT_VALUES.has(estimatedEffortRaw) ? estimatedEffortRaw : "M";

      prompts.push({
        stem,
        agent_role: this.readStringField(frontMatter, ["agent_role"]) ?? `Legacy prompt ${stem}`,
        depends_on: Array.from(new Set(dependsOn)),
        repos: Array.from(new Set(repos)),
        estimated_effort: estimatedEffort
      });
    }

    return prompts;
  }

  private async resolveCategory(workpackPath: string, warnings: string[]): Promise<string> {
    const metaPath = path.join(workpackPath, META_FILE);
    const rawMeta = await this.readOptionalText(metaPath);
    if (!rawMeta) {
      warnings.push(`Category not found in existing ${META_FILE}; defaulted to \"${DEFAULT_CATEGORY}\".`);
      return DEFAULT_CATEGORY;
    }

    try {
      const parsed = JSON.parse(rawMeta) as Record<string, unknown>;
      const category = typeof parsed.category === "string" ? parsed.category : null;
      if (category && CATEGORY_VALUES.has(category)) {
        return category;
      }
    } catch {
      // Intentionally ignore parse failures here and use fallback.
    }

    warnings.push(`Invalid category in existing ${META_FILE}; defaulted to \"${DEFAULT_CATEGORY}\".`);
    return DEFAULT_CATEGORY;
  }

  private inferTags(workpackId: string, category: string): string[] {
    const slugTokens = workpackId
      .toLowerCase()
      .split(/[_-]+/)
      .filter((token) => token.length > 1)
      .filter((token) => !/^\d+$/.test(token))
      .filter((token) => token !== "workpack");

    return Array.from(new Set([category, ...slugTokens]));
  }

  private extractPromptStatus(statusMarkdown: string | null, prompts: PromptMetaEntry[]): Record<string, unknown> {
    const promptStatus: Record<string, unknown> = {};
    for (const prompt of prompts) {
      promptStatus[prompt.stem] = { status: "pending" };
    }

    if (!statusMarkdown) {
      return promptStatus;
    }

    const lines = statusMarkdown.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) {
        continue;
      }

      const cells = trimmed
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      if (cells.length < 2) {
        continue;
      }

      const stem = cells[0];
      if (!this.looksLikePromptStem(stem) || stem.toLowerCase() === "prompt") {
        continue;
      }

      const mappedStatus = this.mapPromptStatus(cells[1]);
      const runtimeEntry: Record<string, unknown> = { status: mappedStatus };
      if (mappedStatus === "in_progress") {
        runtimeEntry.started_at = null;
      }

      if (mappedStatus === "complete") {
        runtimeEntry.completed_at = null;
      }

      if (mappedStatus === "blocked") {
        runtimeEntry.blocked_reason = cells[3] ?? "Legacy status markdown indicates blocked state.";
      }

      promptStatus[stem] = runtimeEntry;
    }

    return promptStatus;
  }

  private extractOverallStatus(statusMarkdown: string | null): string {
    if (!statusMarkdown) {
      return DEFAULT_OVERALL_STATUS;
    }

    const sectionMatch = statusMarkdown.match(/##\s*Overall Status([\s\S]*?)(\n##\s+|$)/i);
    const statusText = (sectionMatch?.[1] ?? statusMarkdown).toLowerCase();

    if (statusText.includes("abandoned")) {
      return "abandoned";
    }

    if (statusText.includes("review")) {
      return "review";
    }

    if (statusText.includes("blocked")) {
      return "blocked";
    }

    if (statusText.includes("in progress") || statusText.includes("in_progress")) {
      return "in_progress";
    }

    if (statusText.includes("complete") || statusText.includes("done")) {
      return "complete";
    }

    return "not_started";
  }

  private mapPromptStatus(statusValue: string): PromptRuntimeStatus {
    const normalized = statusValue.toLowerCase();

    if (normalized.includes("skip")) {
      return "skipped";
    }

    if (normalized.includes("blocked")) {
      return "blocked";
    }

    if (normalized.includes("progress")) {
      return "in_progress";
    }

    if (normalized.includes("complete") || normalized.includes("done") || normalized.includes("✅")) {
      return "complete";
    }

    return "pending";
  }

  private normalizeProtocolVersion(rawVersion: string): string {
    const trimmed = rawVersion.trim();
    if (/^[0-9]+\.[0-9]+\.[0-9]+$/.test(trimmed)) {
      return trimmed;
    }

    if (trimmed === "5" || trimmed === "6") {
      return DEFAULT_PROTOCOL_VERSION;
    }

    return DEFAULT_PROTOCOL_VERSION;
  }

  private inferCreatedAt(workpackId: string): string | null {
    const match = workpackId.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})_/);
    return match ? match[1] : null;
  }

  private humanizeWorkpackId(workpackId: string): string {
    return workpackId
      .replace(/^\d+_/, "")
      .split(/[_-]+/)
      .filter((token) => token.length > 0)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  }

  private extractFirstParagraphAfterHeading(markdown: string): string | null {
    const lines = markdown.split(/\r?\n/);
    const contentLines: string[] = [];

    let started = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!started) {
        if (trimmed.startsWith("#")) {
          started = true;
        }

        continue;
      }

      if (!trimmed) {
        if (contentLines.length > 0) {
          break;
        }

        continue;
      }

      if (trimmed.startsWith("##")) {
        break;
      }

      contentLines.push(trimmed);
    }

    return contentLines.length > 0 ? contentLines.join(" ") : null;
  }

  private parseFrontMatter(markdown: string): Record<string, string | string[]> {
    const frontMatter: Record<string, string | string[]> = {};
    const frontMatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontMatterMatch) {
      return frontMatter;
    }

    const lines = frontMatterMatch[1].split(/\r?\n/);
    let activeListKey: string | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const listMatch = line.match(/^-\s*(.+)$/);
      if (listMatch && activeListKey) {
        const current = frontMatter[activeListKey];
        const normalizedValue = this.stripYamlToken(listMatch[1]);
        if (Array.isArray(current)) {
          current.push(normalizedValue);
        } else {
          frontMatter[activeListKey] = [normalizedValue];
        }

        continue;
      }

      const keyValueMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (!keyValueMatch) {
        activeListKey = null;
        continue;
      }

      const key = keyValueMatch[1];
      const value = keyValueMatch[2].trim();

      if (!value) {
        frontMatter[key] = [];
        activeListKey = key;
        continue;
      }

      if (value.startsWith("[") && value.endsWith("]")) {
        frontMatter[key] = value
          .slice(1, -1)
          .split(",")
          .map((token) => this.stripYamlToken(token))
          .filter((token) => token.length > 0);
        activeListKey = null;
        continue;
      }

      frontMatter[key] = this.stripYamlToken(value);
      activeListKey = null;
    }

    return frontMatter;
  }

  private stripYamlToken(value: string): string {
    return value.trim().replace(/^['"`]/, "").replace(/['"`]$/, "");
  }

  private readStringField(record: Record<string, string | string[]>, keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }

    return null;
  }

  private extractStringListField(record: Record<string, string | string[]>, keys: string[]): string[] {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
      }

      if (typeof value === "string" && value.trim().length > 0) {
        return [value.trim()];
      }
    }

    return [];
  }

  private looksLikePromptStem(value: string): boolean {
    return /^[A-Z][A-Za-z0-9]*(?:_[a-z0-9][a-z0-9_]*)+$/.test(value.trim());
  }

  private looksLikeWorkpackId(value: string): boolean {
    return /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/.test(value.trim());
  }

  private async resolveLastUpdated(statusPath: string): Promise<string> {
    try {
      const stats = await fs.stat(statusPath);
      return stats.mtime.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  private async getSchemaValidator(
    workpackPath: string,
    schemaFileName: string
  ): Promise<ValidateFunction<unknown> | null> {
    const schemaPath = await this.resolveSchemaPath(workpackPath, schemaFileName);
    if (!schemaPath) {
      return null;
    }

    const cached = this.validators.get(schemaPath);
    if (cached) {
      return cached;
    }

    try {
      const schemaRaw = await fs.readFile(schemaPath, "utf8");
      const schema = JSON.parse(schemaRaw) as AnySchema;
      const validator = this.ajv.compile(schema);
      this.validators.set(schemaPath, validator);
      return validator;
    } catch {
      return null;
    }
  }

  private formatSchemaErrors(errors: ErrorObject[] | null | undefined): string {
    if (!errors || errors.length === 0) {
      return "unknown validation error";
    }

    return errors
      .slice(0, 5)
      .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
      .join("; ");
  }

  private async resolveSchemaPath(folderPath: string, schemaFileName: string): Promise<string | null> {
    let currentPath = path.resolve(folderPath);

    while (true) {
      const candidatePath = path.join(currentPath, WORKPACKS_DIR, schemaFileName);
      if (await this.pathExists(candidatePath)) {
        return candidatePath;
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        return null;
      }

      currentPath = parentPath;
    }
  }

  private async findLegacyWorkpackFolders(instancesPath: string): Promise<string[]> {
    const discovered = new Set<string>();

    const walk = async (folderPath: string): Promise<void> => {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      const fileNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));

      const hasLegacyMarkers =
        fileNames.has(REQUEST_FILE) || fileNames.has(PLAN_FILE) || fileNames.has(STATUS_FILE);
      if (hasLegacyMarkers) {
        discovered.add(folderPath);
      }

      await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => walk(path.join(folderPath, entry.name)))
      );
    };

    await walk(instancesPath);
    return Array.from(discovered).sort((left, right) => left.localeCompare(right));
  }

  private async readOptionalText(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch {
      return null;
    }
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export async function migrateV5ToV6(
  workpackPath: string,
  options: MigrationOptions = { dryRun: true, overwrite: false }
): Promise<MigrationResult> {
  const migrator = new ProtocolMigrator();
  return migrator.migrate(workpackPath, options);
}
