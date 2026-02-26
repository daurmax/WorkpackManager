import { strict as assert } from "node:assert";
import * as path from "node:path";
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

describe("parser discoverer", () => {
  beforeEach(() => {
    clearManualWorkpackFolders();
  });

  afterEach(() => {
    clearManualWorkpackFolders();
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

  it("validates workpack folder names", () => {
    assert.equal(isWorkpackFolder("standalone-legacy"), true);
    assert.equal(isWorkpackFolder("02_sample-group_legacy-fallback"), true);
    assert.equal(isWorkpackFolder("invalid folder"), false);
    assert.equal(isWorkpackFolder("_invalid"), false);
  });
});
