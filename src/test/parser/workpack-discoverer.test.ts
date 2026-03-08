import { strict as assert } from "node:assert";
import * as os from "node:os";
import * as path from "node:path";
import { promises as fs } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  clearManualWorkpackFolders,
  discoverWorkpacks,
  isWorkpackFolder,
  registerManualWorkpackFolder,
  unregisterManualWorkpackFolder
} from "../../parser/workpack-discoverer";

const FIXTURES_ROOT = path.resolve(process.cwd(), "src", "test", "parser", "fixtures");

function fixturePath(...segments: string[]): string {
  return path.join(FIXTURES_ROOT, ...segments);
}

const tempDirs: string[] = [];

describe("parser discoverer", () => {
  beforeEach(() => {
    clearManualWorkpackFolders();
  });

  afterEach(async () => {
    clearManualWorkpackFolders();

    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  });

  it("discovers workpacks across multiple workspace roots", async () => {
    const workspaceA = fixturePath("workspace-a");
    const workspaceB = fixturePath("workspace-b");

    const instances = await discoverWorkpacks([workspaceA, workspaceB]);
    const ids = instances.map((instance) => instance.meta.id);

    assert.ok(ids.includes("01_sample-group_parser-v6"));
    assert.ok(ids.includes("02_sample-group_legacy-fallback"));
    assert.ok(ids.includes("standalone-legacy"));
    assert.ok(!ids.includes("bad-workpack"));
  });

  it("marks workspace-discovered workpacks as auto source", async () => {
    const instances = await discoverWorkpacks([fixturePath("workspace-a")]);

    assert.ok(instances.length > 0);
    for (const instance of instances) {
      assert.equal(instance.discoverySource, "auto");
    }
  });

  it("adds manually registered workpack folders", async () => {
    const manualFolder = fixturePath("manual-workpack");
    registerManualWorkpackFolder(manualFolder);

    const instances = await discoverWorkpacks([fixturePath("workspace-a")]);
    const manualInstance = instances.find((instance) => instance.meta.id === "manual-workpack");

    assert.ok(manualInstance);
    assert.equal(manualInstance.discoverySource, "manual");
  });

  it("can remove manually registered folders", async () => {
    const manualFolder = fixturePath("manual-workpack");
    registerManualWorkpackFolder(manualFolder);
    unregisterManualWorkpackFolder(manualFolder);

    const instances = await discoverWorkpacks([fixturePath("workspace-a")]);
    const manualInstance = instances.find((instance) => instance.meta.id === "manual-workpack");

    assert.equal(manualInstance, undefined);
  });

  it("discovers grouped workpacks nested under instances with group metadata", async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "workpack-discoverer-nested-"));
    tempDirs.push(workspaceRoot);

    const groupFolder = path.join(workspaceRoot, "workpacks", "instances", "furlan-speech-migration");
    await fs.mkdir(groupFolder, { recursive: true });
    await fs.writeFile(
      path.join(groupFolder, "group.meta.json"),
      JSON.stringify(
        {
          id: "furlan-speech-migration",
          title: "Furlan Speech Migration",
          summary: "Grouped migration workpacks",
          protocol_version: "3.0.0",
          created_at: "2026-03-08",
          workpacks: [
            { id: "01_furlan-speech-migration_pre-audit", execution_order: 1 },
            { id: "02_furlan-speech-migration_manifest", execution_order: 2 }
          ],
          execution_dag: {
            phases: [
              { order: 1, workpacks: ["01_furlan-speech-migration_pre-audit"], mode: "serial" },
              { order: 2, workpacks: ["02_furlan-speech-migration_manifest"], mode: "serial" }
            ],
            edges: [["01_furlan-speech-migration_pre-audit", "02_furlan-speech-migration_manifest"]]
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await fs.writeFile(path.join(groupFolder, "GROUP.md"), "# Group\n", "utf8");

    await fs.cp(
      fixturePath("manual-workpack"),
      path.join(groupFolder, "01_furlan-speech-migration_pre-audit"),
      { recursive: true }
    );
    await fs.cp(
      fixturePath("manual-workpack"),
      path.join(groupFolder, "02_furlan-speech-migration_manifest"),
      { recursive: true }
    );

    const instances = await discoverWorkpacks([workspaceRoot]);
    const nestedInstances = instances.filter((instance) =>
      instance.folderPath.includes(path.join("workpacks", "instances", "furlan-speech-migration"))
    );

    assert.equal(nestedInstances.length, 2);
  });

  it("validates workpack folder names", () => {
    assert.equal(isWorkpackFolder("standalone-legacy"), true);
    assert.equal(isWorkpackFolder("02_sample-group_legacy-fallback"), true);
    assert.equal(isWorkpackFolder("invalid folder"), false);
    assert.equal(isWorkpackFolder("_invalid"), false);
  });
});
