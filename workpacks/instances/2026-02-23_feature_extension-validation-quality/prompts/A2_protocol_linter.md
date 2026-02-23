---
prompt_id: A2_protocol_linter
workpack: 2026-02-23_feature_extension-validation-quality
agent_role: Protocol linter architect
depends_on:
  - A0_bootstrap
repos:
  - WorkpackManager
estimated_effort: L
---

# A2 – Workpack Protocol Linter with VS Code Diagnostics

## Objective

Implement a structural linter that validates workpack instances against the Protocol v6 specification. Lint results are surfaced as VS Code diagnostics in the Problems panel.

## Deliverables

### 1. Lint Rules (`src/validation/lint-rules.ts`)

Each rule is a function that takes a parsed workpack and returns an array of lint diagnostics.

| Rule ID | Description | Severity |
|---------|-------------|----------|
| WP001 | Folder name matches `YYYY-MM-DD_<category>_<slug>` pattern | Error |
| WP002 | Required files exist: `00_request.md`, `01_plan.md`, `99_status.md` | Error |
| WP003 | `workpack.meta.json` exists and validates against schema | Error |
| WP004 | `workpack.state.json` exists and validates against schema | Error |
| WP005 | `outputs/` directory exists | Warning |
| WP006 | All prompts listed in `meta.json` have corresponding files in `prompts/` | Error |
| WP007 | No orphan prompt files (files in `prompts/` not listed in `meta.json`) | Warning |
| WP008 | Prompt DAG is acyclic | Error |
| WP009 | `depends_on` references in prompts resolve to existing prompt stems | Error |
| WP010 | `requires_workpack` references resolve to existing workpack IDs | Warning |
| WP011 | `workpack.state.json` `workpack_id` matches `workpack.meta.json` `id` | Error |
| WP012 | Protocol version is supported (currently "5" or "6") | Warning |
| WP013 | YAML front-matter in prompt files contains valid `prompt_id` | Warning |

```typescript
export interface LintDiagnostic {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface LintRule {
  id: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check(workpackPath: string, meta?: WorkpackMeta, state?: WorkpackState): Promise<LintDiagnostic[]>;
}
```

### 2. Linter Engine (`src/validation/linter.ts`)

```typescript
export class WorkpackLinter {
  private rules: LintRule[] = [];

  constructor() {
    this.rules = getAllRules();
  }

  /** Lint a single workpack instance. */
  async lintWorkpack(workpackPath: string): Promise<LintDiagnostic[]>;

  /** Lint all workpack instances in a directory. */
  async lintAll(instancesPath: string): Promise<Map<string, LintDiagnostic[]>>;

  /** Get only errors (excludes warnings/info). */
  getErrors(diagnostics: LintDiagnostic[]): LintDiagnostic[];
}
```

### 3. VS Code Diagnostics Integration (`src/validation/diagnostics.ts`)

```typescript
export class WorkpackDiagnosticProvider {
  private collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('workpack');
  }

  /** Convert LintDiagnostics to VS Code Diagnostics and publish. */
  async publishDiagnostics(workpackPath: string): Promise<void>;

  /** Clear diagnostics for a workpack. */
  clearDiagnostics(workpackPath: string): void;

  /** Clear all diagnostics. */
  clearAll(): void;

  dispose(): void;
}
```

### 4. JSON Schema Validation

Use `ajv` (Another JSON Validator) to validate:
- `workpack.meta.json` against `WORKPACK_META_SCHEMA.json`.
- `workpack.state.json` against `WORKPACK_STATE_SCHEMA.json`.
- Output JSONs against `WORKPACK_OUTPUT_SCHEMA.json`.

### 5. Unit Tests (`src/validation/__tests__/linter.test.ts`)

For each rule:
- Valid workpack passes.
- Invalid workpack triggers the expected diagnostic.
- Severity is correct.

Additional tests:
- `lintAll` processes multiple workpacks.
- Schema validation catches missing required fields.
- DAG cycle detection triggers WP008.
- Orphan prompt file triggers WP007.

## Constraints

- Linter is read-only: never modifies files.
- Must handle malformed JSON gracefully (report parse errors, don't crash).
- Rules must be individually disableable (for future configuration).

## Output

Write `outputs/A2_protocol_linter.json`.

## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] All lint rule tests pass.
- [ ] Diagnostics appear in VS Code Problems panel (manual test).
- [ ] Linter handles malformed files without crashing.
