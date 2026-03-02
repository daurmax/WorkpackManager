import * as path from "node:path";
import * as vscode from "vscode";
import { WorkpackLinter } from "./linter";
import type { LintDiagnostic } from "./lint-rules";

function mapSeverity(severity: LintDiagnostic["severity"]): vscode.DiagnosticSeverity {
  switch (severity) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

function toVscodeDiagnostic(issue: LintDiagnostic): vscode.Diagnostic {
  const line = Math.max(0, (issue.line ?? 1) - 1);
  const column = Math.max(0, (issue.column ?? 1) - 1);
  const range = new vscode.Range(line, column, line, Math.max(column + 1, column));
  const diagnostic = new vscode.Diagnostic(range, `[${issue.ruleId}] ${issue.message}`, mapSeverity(issue.severity));
  diagnostic.source = "workpack";
  diagnostic.code = issue.ruleId;
  return diagnostic;
}

export class WorkpackDiagnosticProvider {
  private readonly collection: vscode.DiagnosticCollection;

  private readonly linter: WorkpackLinter;

  private readonly publishedByWorkpack = new Map<string, string[]>();

  constructor(linter?: WorkpackLinter) {
    this.collection = vscode.languages.createDiagnosticCollection("workpack");
    this.linter = linter ?? new WorkpackLinter();
  }

  async publishDiagnostics(workpackPath: string): Promise<void> {
    const resolvedWorkpackPath = path.resolve(workpackPath);
    const lintDiagnostics = await this.linter.lintWorkpack(resolvedWorkpackPath);
    const groupedByFile = new Map<string, vscode.Diagnostic[]>();

    for (const issue of lintDiagnostics) {
      const filePath = path.resolve(issue.file ?? path.join(resolvedWorkpackPath, "99_status.md"));
      const diagnostics = groupedByFile.get(filePath) ?? [];
      diagnostics.push(toVscodeDiagnostic(issue));
      groupedByFile.set(filePath, diagnostics);
    }

    this.clearDiagnostics(resolvedWorkpackPath);

    const publishedUris: string[] = [];
    for (const [filePath, diagnostics] of groupedByFile) {
      const fileUri = vscode.Uri.file(filePath);
      this.collection.set(fileUri, diagnostics);
      publishedUris.push(fileUri.toString());
    }

    this.publishedByWorkpack.set(resolvedWorkpackPath, publishedUris);
  }

  clearDiagnostics(workpackPath: string): void {
    const resolvedWorkpackPath = path.resolve(workpackPath);
    const uris = this.publishedByWorkpack.get(resolvedWorkpackPath) ?? [];

    for (const uri of uris) {
      this.collection.delete(vscode.Uri.parse(uri));
    }

    this.publishedByWorkpack.delete(resolvedWorkpackPath);
  }

  clearAll(): void {
    this.collection.clear();
    this.publishedByWorkpack.clear();
  }

  dispose(): void {
    this.clearAll();
    this.collection.dispose();
  }
}
