import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { AnySchema, ErrorObject, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { WorkpackMeta, WorkpackState } from "../models";

const META_FILE = "workpack.meta.json";
const STATE_FILE = "workpack.state.json";
const OUTPUTS_DIR = "outputs";
const PROMPTS_DIR = "prompts";
const REQUEST_FILE = "00_request.md";
const PLAN_FILE = "01_plan.md";
const STATUS_FILE = "99_status.md";
const META_SCHEMA_FILE = "WORKPACK_META_SCHEMA.json";
const STATE_SCHEMA_FILE = "WORKPACK_STATE_SCHEMA.json";
const OUTPUT_SCHEMA_FILE = "WORKPACK_OUTPUT_SCHEMA.json";
const PROMPT_STEM_PATTERN = /^[A-Z][A-Za-z0-9]*(?:_[a-z0-9][a-z0-9_]*)+$/;
const FOLDER_STANDALONE_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const FOLDER_GROUPED_PATTERN = /^\d{2}_[a-z0-9](?:[a-z0-9-]*[a-z0-9])?_[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const schemaValidatorCache = new Map<string, ValidateFunction<unknown>>();

export interface LintDiagnostic {
  ruleId: string;
  severity: "error" | "warning" | "info";
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface LintRule {
  id: string;
  description: string;
  severity: "error" | "warning" | "info";
  check(workpackPath: string, meta?: WorkpackMeta, state?: WorkpackState): Promise<LintDiagnostic[]>;
}

interface ParsedFrontMatter {
  data: Record<string, unknown>;
  startLine: number;
}

interface JsonReadResult {
  exists: boolean;
  value: unknown | null;
  parseError?: string;
}

type PromptFrontMatterIndex = Map<string, { filePath: string; frontMatter: ParsedFrontMatter | null }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return "unknown schema violation";
  }

  return errors
    .slice(0, 3)
    .map((error) => {
      const location = error.instancePath || "/";
      return `${location} ${error.message ?? "is invalid"}`;
    })
    .join("; ");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function readJson(filePath: string): Promise<JsonReadResult> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    try {
      return { exists: true, value: JSON.parse(content) as unknown };
    } catch (error) {
      return {
        exists: true,
        value: null,
        parseError: error instanceof Error ? error.message : String(error)
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { exists: false, value: null };
    }

    return {
      exists: true,
      value: null,
      parseError: error instanceof Error ? error.message : String(error)
    };
  }
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function parseInlineArray(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [];
  }

  const body = trimmed.slice(1, -1).trim();
  if (!body) {
    return [];
  }

  return body
    .split(",")
    .map((entry) => entry.trim().replace(/^['\"]|['\"]$/g, ""))
    .filter((entry) => entry.length > 0);
}

function parseFrontMatter(markdown: string): ParsedFrontMatter | null {
  const lines = markdown.split(/\r?\n/);
  if (lines.length < 3 || lines[0].trim() !== "---") {
    return null;
  }

  let endIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      endIndex = index;
      break;
    }
  }

  if (endIndex === -1) {
    return null;
  }

  const data: Record<string, unknown> = {};
  for (let index = 1; index < endIndex; index += 1) {
    const rawLine = lines[index];
    if (!rawLine || rawLine.trim().startsWith("#")) {
      continue;
    }

    const trimmed = rawLine.trim();
    const listMatch = trimmed.match(/^\-\s+(.+)$/);
    if (listMatch) {
      const lastKey = Object.keys(data).at(-1);
      if (lastKey && Array.isArray(data[lastKey])) {
        (data[lastKey] as string[]).push(listMatch[1].trim());
      }
      continue;
    }

    const colonIndex = rawLine.indexOf(":");
    if (colonIndex <= 0) {
      continue;
    }

    const key = rawLine.slice(0, colonIndex).trim();
    const value = rawLine.slice(colonIndex + 1).trim();
    if (!key) {
      continue;
    }

    if (value.length === 0) {
      data[key] = [];
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = parseInlineArray(value);
      continue;
    }

    data[key] = value.replace(/^['\"]|['\"]$/g, "");
  }

  return {
    data,
    startLine: 1
  };
}

async function findWorkpacksRoot(folderPath: string): Promise<string | null> {
  let current = path.resolve(folderPath);

  while (true) {
    const candidate = path.join(current, "workpacks");
    if (await isDirectory(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

async function getSchemaValidator(workpackPath: string, schemaName: string): Promise<ValidateFunction<unknown> | null> {
  const workpacksRoot = await findWorkpacksRoot(workpackPath);
  if (!workpacksRoot) {
    return null;
  }

  const schemaPath = path.join(workpacksRoot, schemaName);
  const cached = schemaValidatorCache.get(schemaPath);
  if (cached) {
    return cached;
  }

  const schemaRaw = await readJson(schemaPath);
  if (!schemaRaw.exists || !schemaRaw.value) {
    return null;
  }

  try {
    const validator = ajv.compile(schemaRaw.value as AnySchema);
    schemaValidatorCache.set(schemaPath, validator);
    return validator;
  } catch {
    if (isRecord(schemaRaw.value) && typeof schemaRaw.value.$id === "string") {
      const existing = ajv.getSchema(schemaRaw.value.$id);
      if (existing) {
        schemaValidatorCache.set(schemaPath, existing);
        return existing;
      }
    }

    return null;
  }
}

async function listPromptMarkdownFiles(workpackPath: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const promptDir = path.join(workpackPath, PROMPTS_DIR);
  if (!(await isDirectory(promptDir))) {
    return result;
  }

  const entries = await fs.readdir(promptDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
      continue;
    }

    const stem = entry.name.slice(0, -3);
    result.set(stem, path.join(promptDir, entry.name));
  }

  return result;
}

async function readPromptFrontMatterIndex(workpackPath: string): Promise<PromptFrontMatterIndex> {
  const prompts = await listPromptMarkdownFiles(workpackPath);
  const index: PromptFrontMatterIndex = new Map();

  for (const [stem, filePath] of prompts) {
    const content = await readText(filePath);
    index.set(stem, {
      filePath,
      frontMatter: content ? parseFrontMatter(content) : null
    });
  }

  return index;
}

async function collectKnownWorkpackIds(workpackPath: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const workpacksRoot = await findWorkpacksRoot(workpackPath);
  if (!workpacksRoot) {
    return ids;
  }

  const instancesRoot = path.join(workpacksRoot, "instances");
  if (!(await isDirectory(instancesRoot))) {
    return ids;
  }

  const stack = [instancesRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const childPath = path.join(current, entry.name);
      const childMetaPath = path.join(childPath, META_FILE);
      if (await pathExists(childMetaPath)) {
        ids.add(entry.name);
        continue;
      }

      stack.push(childPath);
    }
  }

  return ids;
}

function getMetaPromptStems(metaJson: unknown): string[] {
  if (!isRecord(metaJson) || !Array.isArray(metaJson.prompts)) {
    return [];
  }

  const stems: string[] = [];
  for (const prompt of metaJson.prompts) {
    if (!isRecord(prompt) || typeof prompt.stem !== "string") {
      continue;
    }

    stems.push(prompt.stem);
  }

  return stems;
}

function getPromptDependsOnFromMeta(metaJson: unknown): Map<string, string[]> {
  const dependsOnByStem = new Map<string, string[]>();
  if (!isRecord(metaJson) || !Array.isArray(metaJson.prompts)) {
    return dependsOnByStem;
  }

  for (const prompt of metaJson.prompts) {
    if (!isRecord(prompt) || typeof prompt.stem !== "string") {
      continue;
    }

    dependsOnByStem.set(prompt.stem, asStringArray(prompt.depends_on));
  }

  return dependsOnByStem;
}

function detectCycle(dependsOnByStem: Map<string, string[]>): string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (stem: string): string[] | null => {
    if (visiting.has(stem)) {
      const start = stack.indexOf(stem);
      if (start >= 0) {
        return [...stack.slice(start), stem];
      }

      return [stem, stem];
    }

    if (visited.has(stem)) {
      return null;
    }

    visiting.add(stem);
    stack.push(stem);

    for (const dependency of dependsOnByStem.get(stem) ?? []) {
      if (!dependsOnByStem.has(dependency)) {
        continue;
      }

      const cycle = visit(dependency);
      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    visiting.delete(stem);
    visited.add(stem);
    return null;
  };

  for (const stem of dependsOnByStem.keys()) {
    const cycle = visit(stem);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

function diagnostic(
  ruleId: string,
  severity: "error" | "warning" | "info",
  message: string,
  file?: string,
  line?: number,
  column?: number
): LintDiagnostic {
  return {
    ruleId,
    severity,
    message,
    file,
    line,
    column
  };
}

function createRule(
  id: string,
  description: string,
  severity: "error" | "warning" | "info",
  check: LintRule["check"]
): LintRule {
  return { id, description, severity, check };
}

export function getAllRules(): LintRule[] {
  const rules: LintRule[] = [
    createRule("WP001", "Folder name matches naming convention", "error", async (workpackPath) => {
      const folderName = path.basename(path.resolve(workpackPath));
      if (FOLDER_STANDALONE_PATTERN.test(folderName) || FOLDER_GROUPED_PATTERN.test(folderName)) {
        return [];
      }

      return [
        diagnostic(
          "WP001",
          "error",
          "Folder name must be '<slug>' or '<NN>_<group>_<slug>' using lowercase, digits, and hyphens.",
          workpackPath
        )
      ];
    }),

    createRule("WP002", "Required files exist", "error", async (workpackPath) => {
      const required = [REQUEST_FILE, PLAN_FILE, STATUS_FILE];
      const findings: LintDiagnostic[] = [];

      for (const fileName of required) {
        const filePath = path.join(workpackPath, fileName);
        if (!(await pathExists(filePath))) {
          findings.push(diagnostic("WP002", "error", `Missing required file '${fileName}'.`, filePath));
        }
      }

      return findings;
    }),

    createRule("WP003", "workpack.meta.json exists and validates schema", "error", async (workpackPath) => {
      const metaPath = path.join(workpackPath, META_FILE);
      const meta = await readJson(metaPath);
      if (!meta.exists) {
        return [diagnostic("WP003", "error", `Missing '${META_FILE}'.`, metaPath)];
      }

      if (meta.parseError) {
        return [
          diagnostic(
            "WP003",
            "error",
            `Malformed JSON in '${META_FILE}': ${meta.parseError}`,
            metaPath,
            1,
            1
          )
        ];
      }

      const validator = await getSchemaValidator(workpackPath, META_SCHEMA_FILE);
      if (!validator || !meta.value) {
        return [];
      }

      const valid = validator(meta.value);
      if (valid) {
        return [];
      }

      return [
        diagnostic(
          "WP003",
          "error",
          `Schema validation failed for '${META_FILE}': ${formatSchemaErrors(validator.errors)}`,
          metaPath,
          1,
          1
        )
      ];
    }),

    createRule("WP004", "workpack.state.json exists and validates schema", "error", async (workpackPath) => {
      const statePath = path.join(workpackPath, STATE_FILE);
      const state = await readJson(statePath);
      if (!state.exists) {
        return [diagnostic("WP004", "error", `Missing '${STATE_FILE}'.`, statePath)];
      }

      if (state.parseError) {
        return [
          diagnostic(
            "WP004",
            "error",
            `Malformed JSON in '${STATE_FILE}': ${state.parseError}`,
            statePath,
            1,
            1
          )
        ];
      }

      const validator = await getSchemaValidator(workpackPath, STATE_SCHEMA_FILE);
      if (!validator || !state.value) {
        return [];
      }

      const valid = validator(state.value);
      if (valid) {
        return [];
      }

      return [
        diagnostic(
          "WP004",
          "error",
          `Schema validation failed for '${STATE_FILE}': ${formatSchemaErrors(validator.errors)}`,
          statePath,
          1,
          1
        )
      ];
    }),

    createRule("WP005", "outputs directory exists", "warning", async (workpackPath) => {
      const outputsPath = path.join(workpackPath, OUTPUTS_DIR);
      if (!(await isDirectory(outputsPath))) {
        return [diagnostic("WP005", "warning", `Missing '${OUTPUTS_DIR}/' directory.`, outputsPath)];
      }

      const validator = await getSchemaValidator(workpackPath, OUTPUT_SCHEMA_FILE);
      if (!validator) {
        return [];
      }

      const findings: LintDiagnostic[] = [];
      const entries = await fs.readdir(outputsPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) {
          continue;
        }

        const outputFilePath = path.join(outputsPath, entry.name);
        const output = await readJson(outputFilePath);
        if (output.parseError) {
          findings.push(
            diagnostic(
              "WP005",
              "warning",
              `Malformed output JSON '${entry.name}': ${output.parseError}`,
              outputFilePath,
              1,
              1
            )
          );
          continue;
        }

        if (!output.value) {
          continue;
        }

        const valid = validator(output.value);
        if (!valid) {
          findings.push(
            diagnostic(
              "WP005",
              "warning",
              `Output schema validation failed for '${entry.name}': ${formatSchemaErrors(validator.errors)}`,
              outputFilePath,
              1,
              1
            )
          );
        }
      }

      return findings;
    }),

    createRule("WP006", "All prompts listed in meta have files", "error", async (workpackPath) => {
      const meta = await readJson(path.join(workpackPath, META_FILE));
      if (!meta.value) {
        return [];
      }

      const metaStems = new Set(getMetaPromptStems(meta.value));
      const promptFiles = await listPromptMarkdownFiles(workpackPath);
      const findings: LintDiagnostic[] = [];

      for (const stem of metaStems) {
        if (!promptFiles.has(stem)) {
          findings.push(
            diagnostic(
              "WP006",
              "error",
              `Prompt '${stem}' is listed in metadata but missing from '${PROMPTS_DIR}/'.`,
              path.join(workpackPath, PROMPTS_DIR)
            )
          );
        }
      }

      return findings;
    }),

    createRule("WP007", "No orphan prompt files", "warning", async (workpackPath) => {
      const meta = await readJson(path.join(workpackPath, META_FILE));
      if (!meta.value) {
        return [];
      }

      const metaStems = new Set(getMetaPromptStems(meta.value));
      const promptFiles = await listPromptMarkdownFiles(workpackPath);
      const findings: LintDiagnostic[] = [];

      for (const [stem, filePath] of promptFiles) {
        if (!metaStems.has(stem)) {
          findings.push(
            diagnostic(
              "WP007",
              "warning",
              `Prompt file '${stem}.md' is not declared in '${META_FILE}'.`,
              filePath
            )
          );
        }
      }

      return findings;
    }),

    createRule("WP008", "Prompt DAG is acyclic", "error", async (workpackPath) => {
      const meta = await readJson(path.join(workpackPath, META_FILE));
      if (!meta.value) {
        return [];
      }

      const dependsOnByStem = getPromptDependsOnFromMeta(meta.value);
      const cycle = detectCycle(dependsOnByStem);
      if (!cycle) {
        return [];
      }

      return [
        diagnostic(
          "WP008",
          "error",
          `Prompt dependency cycle detected: ${cycle.join(" -> ")}`,
          path.join(workpackPath, META_FILE)
        )
      ];
    }),

    createRule(
      "WP009",
      "depends_on references resolve to existing prompt stems",
      "error",
      async (workpackPath) => {
        const promptFrontMatterIndex = await readPromptFrontMatterIndex(workpackPath);
        const existingStems = new Set(promptFrontMatterIndex.keys());
        const findings: LintDiagnostic[] = [];

        for (const [stem, promptInfo] of promptFrontMatterIndex) {
          const dependsOn = asStringArray(promptInfo.frontMatter?.data.depends_on);
          for (const dependency of dependsOn) {
            if (!existingStems.has(dependency)) {
              findings.push(
                diagnostic(
                  "WP009",
                  "error",
                  `Prompt '${stem}' depends_on '${dependency}', but no matching prompt file exists.`,
                  promptInfo.filePath,
                  promptInfo.frontMatter?.startLine,
                  1
                )
              );
            }
          }
        }

        return findings;
      }
    ),

    createRule(
      "WP010",
      "requires_workpack references resolve to existing workpack IDs",
      "warning",
      async (workpackPath) => {
        const meta = await readJson(path.join(workpackPath, META_FILE));
        if (!isRecord(meta.value)) {
          return [];
        }

        const requires = asStringArray(meta.value.requires_workpack);
        if (requires.length === 0) {
          return [];
        }

        const knownWorkpackIds = await collectKnownWorkpackIds(workpackPath);
        const findings: LintDiagnostic[] = [];

        for (const requiredWorkpack of requires) {
          if (!knownWorkpackIds.has(requiredWorkpack)) {
            findings.push(
              diagnostic(
                "WP010",
                "warning",
                `requires_workpack references unknown workpack '${requiredWorkpack}'.`,
                path.join(workpackPath, META_FILE)
              )
            );
          }
        }

        return findings;
      }
    ),

    createRule("WP011", "workpack_id in state matches metadata id", "error", async (workpackPath) => {
      const meta = await readJson(path.join(workpackPath, META_FILE));
      const state = await readJson(path.join(workpackPath, STATE_FILE));
      if (!isRecord(meta.value) || !isRecord(state.value)) {
        return [];
      }

      const metaId = typeof meta.value.id === "string" ? meta.value.id : null;
      const stateWorkpackId = typeof state.value.workpack_id === "string" ? state.value.workpack_id : null;
      if (!metaId || !stateWorkpackId || metaId === stateWorkpackId) {
        return [];
      }

      return [
        diagnostic(
          "WP011",
          "error",
          `State workpack_id '${stateWorkpackId}' does not match metadata id '${metaId}'.`,
          path.join(workpackPath, STATE_FILE)
        )
      ];
    }),

    createRule("WP012", "Protocol version is supported", "warning", async (workpackPath) => {
      const meta = await readJson(path.join(workpackPath, META_FILE));
      if (!isRecord(meta.value) || typeof meta.value.protocol_version !== "string") {
        return [];
      }

      const rawVersion = meta.value.protocol_version;
      const major = rawVersion.includes(".") ? rawVersion.split(".")[0] : rawVersion;
      if (major === "5" || major === "6") {
        return [];
      }

      return [
        diagnostic(
          "WP012",
          "warning",
          `Unsupported protocol_version '${rawVersion}'. Supported major versions are '5' or '6'.`,
          path.join(workpackPath, META_FILE)
        )
      ];
    }),

    createRule(
      "WP013",
      "Prompt front matter contains valid prompt_id",
      "warning",
      async (workpackPath) => {
        const promptFrontMatterIndex = await readPromptFrontMatterIndex(workpackPath);
        const findings: LintDiagnostic[] = [];

        for (const [stem, promptInfo] of promptFrontMatterIndex) {
          if (!promptInfo.frontMatter) {
            findings.push(
              diagnostic(
                "WP013",
                "warning",
                `Prompt '${stem}.md' is missing YAML front matter.`,
                promptInfo.filePath,
                1,
                1
              )
            );
            continue;
          }

          const promptId =
            typeof promptInfo.frontMatter.data.prompt_id === "string"
              ? promptInfo.frontMatter.data.prompt_id
              : null;

          if (!promptId || !PROMPT_STEM_PATTERN.test(promptId)) {
            findings.push(
              diagnostic(
                "WP013",
                "warning",
                `Prompt '${stem}.md' has invalid or missing prompt_id in front matter.`,
                promptInfo.filePath,
                promptInfo.frontMatter.startLine,
                1
              )
            );
            continue;
          }

          if (promptId !== stem) {
            findings.push(
              diagnostic(
                "WP013",
                "warning",
                `prompt_id '${promptId}' should match file stem '${stem}'.`,
                promptInfo.filePath,
                promptInfo.frontMatter.startLine,
                1
              )
            );
          }
        }

        return findings;
      }
    )
  ];

  return rules;
}
