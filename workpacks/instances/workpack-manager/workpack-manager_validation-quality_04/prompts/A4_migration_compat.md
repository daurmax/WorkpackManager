---
prompt_id: A4_migration_compat
workpack: workpack-manager_validation-quality_04
agent_role: Migration tool developer
depends_on:
  - A0_bootstrap
repos:
  - WorkpackManager
estimated_effort: M
---

# A4 – Protocol v5 → v6 Migration Tool

## Objective

Implement a migration tool that converts Protocol v5 workpacks (no `workpack.meta.json` or `workpack.state.json`) to Protocol v6 format by generating these files from existing markdown content.

## Background

Protocol v5 workpacks store all metadata in markdown files:
- `00_request.md` contains YAML front-matter or header fields with the workpack type, slug, etc.
- `01_plan.md` contains the WBS, DAG, and cross-workpack references.
- `99_status.md` contains the current status.
- Prompt files have YAML front-matter with `prompt_id`, `depends_on`, `repos`, `estimated_effort`.

Protocol v6 adds:
- `workpack.meta.json` — extracted static metadata.
- `workpack.state.json` — extracted runtime state.

Migration must be non-destructive: original files are preserved, new files are added.

## Deliverables

### 1. Migration Engine (`src/validation/migration.ts`)

```typescript
export interface MigrationOptions {
  /** Dry run: report what would change without writing. */
  dryRun: boolean;
  /** Overwrite existing v6 files if they exist. Default: false. */
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
  /**
   * Migrate a single v5 workpack to v6.
   */
  async migrate(workpackPath: string, options: MigrationOptions): Promise<MigrationResult>;

  /**
   * Migrate all v5 workpacks in an instances directory.
   */
  async migrateAll(instancesPath: string, options: MigrationOptions): Promise<MigrationResult[]>;
}
```

### 2. Metadata Extraction

Extract from existing files:

| Target Field | Source |
|-------------|--------|
| `id` | Folder name |
| `title` | `00_request.md` title or first heading |
| `summary` | `00_request.md` first paragraph |
| `protocol_version` | Parse from `00_request.md` header, default to "5" |
| `workpack_version` | Default to "1.0.0" |
| `category` | From `workpack.meta.json` category field (no longer derivable from folder name) |
| `created_at` | From folder name date prefix |
| `requires_workpack` | From `01_plan.md` cross-workpack references section |
| `tags` | Inferred from category + slug words |
| `prompts[]` | Scanned from `prompts/` directory, YAML front-matter parsed |

### 3. State Extraction

| Target Field | Source |
|-------------|--------|
| `workpack_id` | Same as meta.id |
| `overall_status` | Parsed from `99_status.md` |
| `last_updated` | File modification time or current time |
| `prompt_status` | Parsed from `99_status.md` table |
| `agent_assignments` | Empty (not tracked in v5) |
| `blocked_by` | From `requires_workpack` where status ≠ complete |

### 4. Validation

After generation:
- Validate `workpack.meta.json` against `WORKPACK_META_SCHEMA.json`.
- Validate `workpack.state.json` against `WORKPACK_STATE_SCHEMA.json`.
- Report validation errors as migration warnings.

### 5. Unit Tests (`src/validation/__tests__/migration.test.ts`)

Create a v5 workpack fixture:
- Standard v5 workpack with markdown frontmatter.
- Run migration.
- Verify `workpack.meta.json` is valid and contains expected data.
- Verify `workpack.state.json` is valid and contains expected data.
- Verify original files are untouched.
- Verify dry run produces no files.
- Verify `overwrite: false` skips existing v6 files.
- Verify edge case: v5 workpack with missing prompts directory.

### 6. CLI Integration (Optional)

If tooling from WP00 is available:
- Add migration to `workpack_lint.py` repertoire.
- Or create a standalone `workpack_migrate.py`.

## Constraints

- Non-destructive: original files MUST NOT be modified.
- Generated JSON must validate against v6 schemas.
- Graceful handling of v5 workpacks with incomplete or non-standard formatting.
- Must work with workpacks from `FurlanPronunciationService/workpacks/instances/` as real-world test cases.

## Output

Write `outputs/A4_migration_compat.json`.

## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Migration tests pass.
- [ ] Generated JSON validates against schemas.
- [ ] Original files are untouched after migration.
- [ ] Works on a real v5 workpack fixture.
