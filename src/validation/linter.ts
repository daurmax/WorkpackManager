import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { WorkpackMeta, WorkpackState } from "../models";
import { getAllRules, type LintDiagnostic, type LintRule } from "./lint-rules";

interface WorkpackLinterOptions {
  disabledRuleIds?: string[];
  rules?: LintRule[];
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

async function discoverWorkpackDirectories(instancesPath: string): Promise<string[]> {
  const discovered = new Set<string>();
  const stack = [path.resolve(instancesPath)];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (!(await isDirectory(current))) {
      continue;
    }

    const looksLikeWorkpack =
      (await pathExists(path.join(current, "workpack.meta.json"))) ||
      (await pathExists(path.join(current, "workpack.state.json"))) ||
      (await pathExists(path.join(current, "00_request.md")));

    if (looksLikeWorkpack) {
      discovered.add(current);
      continue;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== "out") {
        stack.push(path.join(current, entry.name));
      }
    }
  }

  return [...discovered].sort((left, right) => left.localeCompare(right));
}

export class WorkpackLinter {
  private readonly rules: LintRule[];

  constructor(options?: WorkpackLinterOptions) {
    const disabledRuleIds = new Set((options?.disabledRuleIds ?? []).map((ruleId) => ruleId.trim()));
    const configuredRules = options?.rules ?? getAllRules();
    this.rules = configuredRules.filter((rule) => !disabledRuleIds.has(rule.id));
  }

  async lintWorkpack(workpackPath: string): Promise<LintDiagnostic[]> {
    const absolutePath = path.resolve(workpackPath);
    const diagnostics: LintDiagnostic[] = [];

    let parsedMeta: WorkpackMeta | undefined;
    let parsedState: WorkpackState | undefined;
    void parsedMeta;
    void parsedState;

    for (const rule of this.rules) {
      const findings = await rule.check(absolutePath, parsedMeta, parsedState);
      diagnostics.push(...findings);
    }

    return diagnostics.sort((left, right) => {
      const bySeverity = left.severity.localeCompare(right.severity);
      if (bySeverity !== 0) {
        return bySeverity;
      }

      const byRule = left.ruleId.localeCompare(right.ruleId);
      if (byRule !== 0) {
        return byRule;
      }

      return (left.file ?? "").localeCompare(right.file ?? "");
    });
  }

  async lintAll(instancesPath: string): Promise<Map<string, LintDiagnostic[]>> {
    const result = new Map<string, LintDiagnostic[]>();
    const workpackPaths = await discoverWorkpackDirectories(instancesPath);

    for (const workpackPath of workpackPaths) {
      result.set(workpackPath, await this.lintWorkpack(workpackPath));
    }

    return result;
  }

  getErrors(diagnostics: LintDiagnostic[]): LintDiagnostic[] {
    return diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  }
}
