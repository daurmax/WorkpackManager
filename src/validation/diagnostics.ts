export type Diagnostic = {
  file: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  line?: number;
};

export function collectDiagnostics(issues: { message: string; file?: string; line?: number }[]): Diagnostic[] {
  return issues.map((i) => ({
    file: i.file ?? 'unknown',
    message: i.message,
    severity: 'warning',
    line: i.line,
  }));
}
