---
prompt_id: A3_drift_detection
workpack: 04_workpack-manager_validation-quality
agent_role: Drift detection engineer
depends_on:
  - A0_bootstrap
repos:
  - WorkpackManager
estimated_effort: M
---

# A3 – State-vs-Artifact Drift Detection

## Objective

Implement a drift detector that identifies inconsistencies between `workpack.state.json` (declared state), the actual file system artifacts (`prompts/`, `outputs/`), and the `99_status.md` human-readable status file.

## Background

Drift occurs when:
- `workpack.state.json` says a prompt is "complete" but no output file exists.
- An output file exists but the state file says "pending".
- `99_status.md` shows a different status than `workpack.state.json`.
- `workpack.meta.json` lists a prompt that has no corresponding prompt file.
- A prompt file exists but is not listed in `workpack.meta.json`.

## Deliverables

### 1. DriftDetector (`src/validation/drift-detector.ts`)

```typescript
export enum DriftType {
  /** State says complete, but output is missing. */
  MISSING_OUTPUT = 'missing_output',
  /** Output exists, but state says pending. */
  ORPHANED_OUTPUT = 'orphaned_output',
  /** State file status doesn't match 99_status.md. */
  STATUS_MISMATCH = 'status_mismatch',
  /** Meta lists prompt but file is missing. */
  MISSING_PROMPT_FILE = 'missing_prompt_file',
  /** Prompt file exists but not in meta. */
  UNLISTED_PROMPT = 'unlisted_prompt',
  /** State workpack_id doesn't match meta id. */
  ID_MISMATCH = 'id_mismatch',
  /** Blocked_by workpack is actually complete. */
  STALE_BLOCKER = 'stale_blocker',
}

export interface DriftReport {
  workpackId: string;
  drifts: DriftItem[];
  checkedAt: string;
}

export interface DriftItem {
  type: DriftType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  promptStem?: string;
  suggestion?: string;
}

export class DriftDetector {
  /**
   * Detect all drifts in a workpack instance.
   * @param workpackPath - Path to the workpack instance directory.
   * @param allWorkpacks - All known workpacks (for cross-reference checks).
   */
  async detect(workpackPath: string, allWorkpacks?: WorkpackMeta[]): Promise<DriftReport>;

  /**
   * Detect drifts across all workpack instances.
   */
  async detectAll(instancesPath: string): Promise<DriftReport[]>;

  /**
   * Auto-fix safe drifts (e.g., update state for existing outputs).
   * Returns list of fixes applied.
   */
  async autoFix(workpackPath: string, report: DriftReport): Promise<DriftItem[]>;
}
```

### 2. Status File Parser

Parse `99_status.md` to extract:
- Overall status (from the emoji + text pattern).
- Per-prompt status (from the table rows).

```typescript
export function parseStatusMarkdown(content: string): {
  overallStatus: string;
  promptStatuses: Record<string, string>;
};
```

### 3. Unit Tests (`src/validation/__tests__/drift-detector.test.ts`)

Create test fixtures:
- Fixture A: Consistent workpack (no drift).
- Fixture B: "complete" prompt with no output → `MISSING_OUTPUT`.
- Fixture C: Output file exists but state says "pending" → `ORPHANED_OUTPUT`.
- Fixture D: 99_status.md says "In Progress" but state says "complete" → `STATUS_MISMATCH`.
- Fixture E: Prompt file not in meta → `UNLISTED_PROMPT`.
- Fixture F: Meta lists prompt but file missing → `MISSING_PROMPT_FILE`.
- Fixture G: Stale blocker → `STALE_BLOCKER`.

### 4. Auto-Fix Tests

- `autoFix` updates state for orphaned outputs.
- `autoFix` does NOT auto-fix destructive changes (MISSING_OUTPUT).
- Changes are written to `workpack.state.json` correctly.

## Constraints

- Auto-fix must only handle safe, non-destructive fixes.
- Drift detection must not modify files (only `autoFix` modifies).
- Must handle partial/incomplete workpacks gracefully (missing meta.json = report but don't crash).
- Status markdown parsing must be tolerant of formatting variations.

## Output

Write `outputs/A3_drift_detection.json`.

## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] All drift detection tests pass.
- [ ] Auto-fix only applies safe changes.
- [ ] Handles malformed workpacks without crashing.
