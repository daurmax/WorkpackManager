import { strict as assert } from "node:assert";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";
import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { ProtocolMigrator } from "../../validation/migration";

interface FixtureOptions {
  includePromptsDir?: boolean;
}

const META_SCHEMA_PATH = path.resolve(process.cwd(), "workpacks", "WORKPACK_META_SCHEMA.json");
const STATE_SCHEMA_PATH = path.resolve(process.cwd(), "workpacks", "WORKPACK_STATE_SCHEMA.json");

async function createV5Fixture(options: FixtureOptions = {}): Promise<{ root: string; workpackPath: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wp-migration-"));
  const instancesPath = path.join(root, "workpacks", "instances", "sample-group");
  const workpackPath = path.join(instancesPath, "2026-02-20_sample-group_legacy-migration");
  await fs.mkdir(workpackPath, { recursive: true });

  await fs.writeFile(
    path.join(workpackPath, "00_request.md"),
    [
      "---",
      "title: Legacy Migration Workpack",
      "protocol_version: 5",
      "repos:",
      "  - WorkpackManager",
      "---",
      "",
      "# Legacy Migration Workpack",
      "",
      "This migration validates conversion from protocol v5 markdown files to v6 JSON metadata/state.",
      "",
      "## Notes",
      "Some additional details."
    ].join("\n"),
    "utf8"
  );

  await fs.writeFile(
    path.join(workpackPath, "01_plan.md"),
    [
      "# Plan",
      "",
      "requires_workpack: [01_sample-group_bootstrap]",
      "",
      "## Cross-Workpack References",
      "",
      "| Workpack | Status | Notes |",
      "|----------|--------|-------|",
      "| 01_sample-group_bootstrap | complete | done |",
      "| 02_sample-group_infra | blocked | pending env |"
    ].join("\n"),
    "utf8"
  );

  await fs.writeFile(
    path.join(workpackPath, "99_status.md"),
    [
      "# Status",
      "",
      "## Overall Status",
      "",
      "🟡 In Progress",
      "",
      "## Implementation Progress (A-series)",
      "",
      "| Prompt | Status | Output JSON | Notes |",
      "|--------|--------|-------------|-------|",
      "| A0_bootstrap | ✅ Complete | ✅ | done |",
      "| A1_migrate_tool | ⏳ Pending | ❌ | |"
    ].join("\n"),
    "utf8"
  );

  if (options.includePromptsDir ?? true) {
    const promptsPath = path.join(workpackPath, "prompts");
    await fs.mkdir(promptsPath, { recursive: true });

    await fs.writeFile(
      path.join(promptsPath, "A0_bootstrap.md"),
      [
        "---",
        "prompt_id: A0_bootstrap",
        "agent_role: Setup branch",
        "depends_on: []",
        "repos:",
        "  - WorkpackManager",
        "estimated_effort: XS",
        "---",
        "",
        "# A0"
      ].join("\n"),
      "utf8"
    );

    await fs.writeFile(
      path.join(promptsPath, "A1_migrate_tool.md"),
      [
        "---",
        "prompt_id: A1_migrate_tool",
        "agent_role: Build migration",
        "depends_on:",
        "  - A0_bootstrap",
        "repos: [WorkpackManager]",
        "estimated_effort: M",
        "---",
        "",
        "# A1"
      ].join("\n"),
      "utf8"
    );
  }

  return { root, workpackPath };
}

async function removeDir(folderPath: string): Promise<void> {
  await fs.rm(folderPath, { recursive: true, force: true });
}

async function loadValidator(schemaPath: string): Promise<(value: unknown) => boolean> {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const raw = await fs.readFile(schemaPath, "utf8");
  const schema = JSON.parse(raw) as AnySchema;
  return ajv.compile(schema);
}

void describe("validation/migration", () => {
  void it("migrates a v5 workpack and writes schema-valid v6 files without changing original markdown", async () => {
    const { root, workpackPath } = await createV5Fixture();
    try {
      const migrator = new ProtocolMigrator();
      const requestBefore = await fs.readFile(path.join(workpackPath, "00_request.md"), "utf8");
      const planBefore = await fs.readFile(path.join(workpackPath, "01_plan.md"), "utf8");
      const statusBefore = await fs.readFile(path.join(workpackPath, "99_status.md"), "utf8");

      const result = await migrator.migrate(workpackPath, { dryRun: false, overwrite: false });

      assert.equal(result.success, true);
      assert.equal(result.errors.length, 0);
      assert.equal(result.filesCreated.includes("2026-02-20_sample-group_legacy-migration/workpack.meta.json"), true);
      assert.equal(result.filesCreated.includes("2026-02-20_sample-group_legacy-migration/workpack.state.json"), true);

      const metaRaw = await fs.readFile(path.join(workpackPath, "workpack.meta.json"), "utf8");
      const stateRaw = await fs.readFile(path.join(workpackPath, "workpack.state.json"), "utf8");
      const meta = JSON.parse(metaRaw) as Record<string, unknown>;
      const state = JSON.parse(stateRaw) as Record<string, unknown>;

      const metaValidator = await loadValidator(META_SCHEMA_PATH);
      const stateValidator = await loadValidator(STATE_SCHEMA_PATH);

      assert.equal(metaValidator(meta), true);
      assert.equal(stateValidator(state), true);
      assert.equal(meta.id, "2026-02-20_sample-group_legacy-migration");
      assert.equal(meta.protocol_version, "2.0.0");
      assert.equal(meta.category, "feature");
      assert.equal(state.workpack_id, "2026-02-20_sample-group_legacy-migration");
      assert.equal(state.overall_status, "in_progress");

      const requestAfter = await fs.readFile(path.join(workpackPath, "00_request.md"), "utf8");
      const planAfter = await fs.readFile(path.join(workpackPath, "01_plan.md"), "utf8");
      const statusAfter = await fs.readFile(path.join(workpackPath, "99_status.md"), "utf8");

      assert.equal(requestAfter, requestBefore);
      assert.equal(planAfter, planBefore);
      assert.equal(statusAfter, statusBefore);
    } finally {
      await removeDir(root);
    }
  });

  void it("supports dry-run mode without creating files", async () => {
    const { root, workpackPath } = await createV5Fixture();
    try {
      const migrator = new ProtocolMigrator();
      const result = await migrator.migrate(workpackPath, { dryRun: true, overwrite: false });

      assert.equal(result.success, true);
      assert.equal(result.filesCreated.length, 2);

      await assert.rejects(async () => {
        await fs.access(path.join(workpackPath, "workpack.meta.json"));
      });
      await assert.rejects(async () => {
        await fs.access(path.join(workpackPath, "workpack.state.json"));
      });
    } finally {
      await removeDir(root);
    }
  });

  void it("skips existing v6 files when overwrite is false", async () => {
    const { root, workpackPath } = await createV5Fixture();
    try {
      await fs.writeFile(path.join(workpackPath, "workpack.meta.json"), "{}\n", "utf8");
      await fs.writeFile(path.join(workpackPath, "workpack.state.json"), "{}\n", "utf8");

      const migrator = new ProtocolMigrator();
      const result = await migrator.migrate(workpackPath, { dryRun: false, overwrite: false });

      assert.equal(result.success, true);
      assert.equal(result.filesCreated.length, 0);
      assert.equal(result.filesSkipped.includes("2026-02-20_sample-group_legacy-migration/workpack.meta.json"), true);
      assert.equal(result.filesSkipped.includes("2026-02-20_sample-group_legacy-migration/workpack.state.json"), true);
    } finally {
      await removeDir(root);
    }
  });

  void it("handles legacy workpacks with missing prompts directory", async () => {
    const { root, workpackPath } = await createV5Fixture({ includePromptsDir: false });
    try {
      const migrator = new ProtocolMigrator();
      const result = await migrator.migrate(workpackPath, { dryRun: false, overwrite: false });

      assert.equal(result.success, true);
      assert.equal(result.warnings.some((warning) => warning.includes("Prompts directory is missing")), true);

      const metaRaw = await fs.readFile(path.join(workpackPath, "workpack.meta.json"), "utf8");
      const meta = JSON.parse(metaRaw) as { prompts: unknown[] };
      assert.deepEqual(meta.prompts, []);
    } finally {
      await removeDir(root);
    }
  });

  void it("migrates all legacy workpacks in instances directory", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "wp-migration-all-"));
    const instancesPath = path.join(root, "workpacks", "instances", "sample-group");
    await fs.mkdir(instancesPath, { recursive: true });

    const first = path.join(instancesPath, "2026-02-21_group_first");
    const second = path.join(instancesPath, "2026-02-22_group_second");

    await fs.mkdir(first, { recursive: true });
    await fs.mkdir(second, { recursive: true });

    await fs.writeFile(path.join(first, "00_request.md"), "# First\n\nSummary paragraph for first workpack.", "utf8");
    await fs.writeFile(path.join(first, "99_status.md"), "# Status\n\n## Overall Status\n\nNot Started", "utf8");

    await fs.writeFile(path.join(second, "00_request.md"), "# Second\n\nSummary paragraph for second workpack.", "utf8");
    await fs.writeFile(path.join(second, "99_status.md"), "# Status\n\n## Overall Status\n\nNot Started", "utf8");

    try {
      const migrator = new ProtocolMigrator();
      const results = await migrator.migrateAll(path.join(root, "workpacks", "instances"), {
        dryRun: false,
        overwrite: false
      });

      assert.equal(results.length, 2);
      assert.equal(results.every((entry) => entry.success), true);

      const firstMeta = await fs.readFile(path.join(first, "workpack.meta.json"), "utf8");
      const secondMeta = await fs.readFile(path.join(second, "workpack.meta.json"), "utf8");
      assert.equal(firstMeta.length > 0, true);
      assert.equal(secondMeta.length > 0, true);
    } finally {
      await removeDir(root);
    }
  });
});
