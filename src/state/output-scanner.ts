import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Structured metadata for one output artifact file.
 */
export interface OutputArtifact {
  /**
   * Prompt stem derived from output file basename.
   */
  promptStem: string;

  /**
   * Absolute path to the output JSON file.
   */
  filePath: string;

  /**
   * Whether the file content is valid JSON and matches the basic output shape.
   */
  isValidJson: boolean;

  /**
   * Validation detail when `isValidJson` is false.
   */
  validationError?: string;
}

/**
 * Output scan result keyed by prompt stem.
 */
export interface OutputScanResult {
  /**
   * One artifact per prompt stem.
   */
  outputByPrompt: Map<string, OutputArtifact>;

  /**
   * Flat list of scanned output artifacts.
   */
  artifacts: OutputArtifact[];
}

function validateOutputPayload(payload: unknown, promptStem: string): string | undefined {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return "Output JSON payload must be an object.";
  }

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.prompt !== "string" || candidate.prompt.length === 0) {
    return "Output JSON is missing required string field 'prompt'.";
  }

  if (candidate.prompt !== promptStem) {
    return `Output JSON prompt field '${candidate.prompt}' does not match filename stem '${promptStem}'.`;
  }

  return undefined;
}

/**
 * Scan an `outputs/` folder and map `.json` files by prompt stem.
 */
export function scanOutputs(outputsFolderPath: string): OutputScanResult {
  const outputByPrompt = new Map<string, OutputArtifact>();
  const artifacts: OutputArtifact[] = [];

  if (!existsSync(outputsFolderPath)) {
    return { outputByPrompt, artifacts };
  }

  const entries = readdirSync(outputsFolderPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".json") {
      continue;
    }

    const promptStem = path.parse(entry.name).name;
    const filePath = path.join(outputsFolderPath, entry.name);
    const artifact: OutputArtifact = {
      promptStem,
      filePath,
      isValidJson: true,
    };

    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const validationError = validateOutputPayload(parsed, promptStem);
      if (validationError) {
        artifact.isValidJson = false;
        artifact.validationError = validationError;
      }
    } catch (error) {
      artifact.isValidJson = false;
      artifact.validationError = error instanceof Error ? error.message : "Unknown JSON parse error.";
    }

    outputByPrompt.set(promptStem, artifact);
    artifacts.push(artifact);
  }

  return { outputByPrompt, artifacts };
}

