export type LintIssue = {
  message: string;
  file?: string;
  line?: number;
  ruleId?: string;
};

export function lintWorkspace(): LintIssue[] {
  // Placeholder implementation — individual rules live in `lint-rules.ts`.
  // Real implementation should load project files and run each rule.
  return [];
}

export function lintFile(path: string): LintIssue[] {
  // Minimal stub for tests and integration.
  return [];
}
