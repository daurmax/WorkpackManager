import { readFileSync } from "node:fs";

const PROMPT_STEM_PATTERN = /\b([ABVR]\d+_[A-Za-z0-9_]+)\b/g;
const COMPLETION_MARKER_PATTERN = /(✅|🟢)\s*(complete|completed|done|applied|fixed|resolved|passed)\b/i;

/**
 * Parsed completion data extracted from `99_status.md`.
 */
export interface StatusMarkdownParseResult {
  /**
   * Prompt stems marked with a completion marker in markdown.
   */
  completedPromptStems: Set<string>;

  /**
   * First completion marker text found for each completed prompt stem.
   */
  completionMarkersByPrompt: Record<string, string>;
}

/**
 * Parse markdown text and identify prompt stems marked as complete.
 */
export function parseStatusMarkdown(markdown: string): StatusMarkdownParseResult {
  const completedPromptStems = new Set<string>();
  const completionMarkersByPrompt: Record<string, string> = {};

  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const markerMatch = line.match(COMPLETION_MARKER_PATTERN);
    if (!markerMatch) {
      continue;
    }

    const stemMatches = line.matchAll(PROMPT_STEM_PATTERN);
    for (const stemMatch of stemMatches) {
      const promptStem = stemMatch[1];
      completedPromptStems.add(promptStem);
      if (!completionMarkersByPrompt[promptStem]) {
        completionMarkersByPrompt[promptStem] = markerMatch[0];
      }
    }
  }

  return {
    completedPromptStems,
    completionMarkersByPrompt,
  };
}

/**
 * Read and parse a `99_status.md` file from disk.
 */
export function parseStatusMarkdownFile(statusFilePath: string): StatusMarkdownParseResult {
  const markdown = readFileSync(statusFilePath, "utf8");
  return parseStatusMarkdown(markdown);
}

