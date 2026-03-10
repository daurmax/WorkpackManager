import { strict as assert } from "node:assert";
import * as os from "node:os";
import * as path from "node:path";
import { promises as fs } from "node:fs";
import { afterEach, beforeEach, describe, it } from "vitest";
import { ExecutionRegistry } from "../../agents/execution-registry";
import type { WorkpackInstance } from "../../models";
import { TreeItemKind } from "../workpack-tree-item";
import { WorkpackTreeProvider } from "../workpack-tree-provider";

class MockParser {
  constructor(private readonly instances: WorkpackInstance[]) {}

  discover(workspaceFolders: readonly string[]): Promise<WorkpackInstance[]> {
    void workspaceFolders;
    return Promise.resolve(this.instances);
  }
}

async function writeFile(targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, "", "utf8");
}

function createInstance(folderPath: string): WorkpackInstance {
  return {
    folderPath,
    protocolVersion: "2.0.0",
    discoverySource: "auto",
    sourceProject: "WorkpackManager",
    meta: {
      id: "01_demo_tree-view",
      title: "Demo Tree View",
      summary: "Demo workpack",
      protocolVersion: "2.0.0",
      workpackVersion: "1.0.0",
      category: "feature",
      createdAt: "2026-02-26",
      requiresWorkpack: [],
      tags: ["demo"],
      owners: ["team"],
      repos: ["WorkpackManager"],
      deliveryMode: "pr",
      targetBranch: "main",
      prompts: [
        {
          stem: "A0_bootstrap",
          agentRole: "bootstrap",
          dependsOn: [],
          repos: ["WorkpackManager"],
          estimatedEffort: "S"
        },
        {
          stem: "A1_tree_view",
          agentRole: "tree provider",
          dependsOn: ["A0_bootstrap"],
          repos: ["WorkpackManager"],
          estimatedEffort: "M"
        }
      ]
    },
    state: {
      workpackId: "01_demo_tree-view",
      overallStatus: "in_progress",
      lastUpdated: "2026-02-26T10:00:00.000Z",
      promptStatus: {
        A0_bootstrap: { status: "complete" },
        A1_tree_view: { status: "in_progress" }
      },
      agentAssignments: {},
      blockedBy: [],
      executionLog: [],
      notes: null
    }
  };
}

describe("workpack tree provider", () => {
  let workspaceRoot: string;
  let workpackFolder: string;

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "workpack-tree-provider-"));
    workpackFolder = path.join(workspaceRoot, "workpacks", "instances", "01_demo_tree-view");

    await writeFile(path.join(workpackFolder, "00_request.md"));
    await writeFile(path.join(workpackFolder, "01_plan.md"));
    await writeFile(path.join(workpackFolder, "99_status.md"));
    await writeFile(path.join(workpackFolder, "workpack.meta.json"));
    await writeFile(path.join(workpackFolder, "workpack.state.json"));
    await writeFile(path.join(workpackFolder, "prompts", "A0_bootstrap.md"));
    await writeFile(path.join(workpackFolder, "prompts", "A1_tree_view.md"));
    await writeFile(path.join(workpackFolder, "outputs", "A0_bootstrap.json"));
  });

  afterEach(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  it("returns workpack instances as root nodes", async () => {
    const provider = new WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), [workspaceRoot], {
      watchFileSystem: false
    });

    const rootItems = await provider.getChildren();

    assert.equal(rootItems.length, 1);
    assert.equal(rootItems[0].kind, TreeItemKind.Workpack);
    assert.equal(rootItems[0].label, "01_demo_tree-view");
  });

  it("preserves grouped folders inside a single project", async () => {
    const standalone = createInstance(path.join(workspaceRoot, "workpacks", "instances", "2026-02-23_feature_alignment"));
    standalone.meta = { ...standalone.meta, id: "2026-02-23_feature_alignment" };

    const groupedA = createInstance(
      path.join(workspaceRoot, "workpacks", "instances", "furlan-speech-migration", "01_furlan-speech-migration_pre-audit")
    );
    groupedA.meta = {
      ...groupedA.meta,
      id: "01_furlan-speech-migration_pre-audit",
      group: "furlan-speech-migration"
    };

    const groupedB = createInstance(
      path.join(workspaceRoot, "workpacks", "instances", "furlan-speech-migration", "02_furlan-speech-migration_manifest")
    );
    groupedB.meta = {
      ...groupedB.meta,
      id: "02_furlan-speech-migration_manifest",
      group: "furlan-speech-migration"
    };

    const provider = new WorkpackTreeProvider(new MockParser([standalone, groupedA, groupedB]), [workspaceRoot], {
      watchFileSystem: false
    });

    const rootItems = await provider.getChildren();

    assert.equal(rootItems.length, 2);
    assert.equal(rootItems[0].kind, TreeItemKind.Workpack);
    assert.equal(rootItems[0].label, "2026-02-23_feature_alignment");
    assert.equal(rootItems[1].kind, TreeItemKind.Group);
    assert.equal(rootItems[1].label, "furlan-speech-migration");

    const groupChildren = await provider.getChildren(rootItems[1]);
    assert.deepEqual(
      groupChildren.map((item) => item.label),
      ["01_furlan-speech-migration_pre-audit", "02_furlan-speech-migration_manifest"]
    );
  });

  it("returns sections as children of a workpack node", async () => {
    const provider = new WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), [workspaceRoot], {
      watchFileSystem: false
    });

    const [workpackItem] = await provider.getChildren();
    const sectionItems = await provider.getChildren(workpackItem);
    const labels = sectionItems.map((item) => item.label);

    assert.deepEqual(labels, ["Request", "Plan", "Prompts", "Outputs", "Status"]);
    assert.equal(sectionItems.every((item) => item.kind === TreeItemKind.Section), true);
  });

  it("returns prompt files as children of the Prompts section", async () => {
    const provider = new WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), [workspaceRoot], {
      watchFileSystem: false
    });

    const [workpackItem] = await provider.getChildren();
    const sectionItems = await provider.getChildren(workpackItem);
    const promptsSection = sectionItems.find((item) => item.section === "prompts");

    assert.ok(promptsSection);
    const promptItems = await provider.getChildren(promptsSection);

    assert.equal(promptItems.length, 2);
    assert.equal(promptItems[0].kind, TreeItemKind.PromptFile);
    assert.equal(promptItems[1].kind, TreeItemKind.PromptFile);
    assert.equal(promptItems[0].label, "A0_bootstrap.md");
    assert.equal(promptItems[1].label, "A1_tree_view.md");
  });

  it("overlays runtime prompt status from the execution registry", async () => {
    const provider = new WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), [workspaceRoot], {
      watchFileSystem: false
    });
    const executionRegistry = new ExecutionRegistry();
    provider.setExecutionRegistry(executionRegistry);
    executionRegistry.startRun({
      workpackId: "01_demo_tree-view",
      promptStem: "A0_bootstrap",
      providerId: "codex",
      status: "failed"
    });

    const [workpackItem] = await provider.getChildren();
    const sectionItems = await provider.getChildren(workpackItem);
    const promptsSection = sectionItems.find((item) => item.section === "prompts");

    assert.ok(promptsSection);
    const promptItems = await provider.getChildren(promptsSection);
    assert.equal(promptItems[0].description, "Failed · codex");
  });

  it("sets context values for workpack, section, and prompt nodes", async () => {
    const provider = new WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), [workspaceRoot], {
      watchFileSystem: false
    });

    const [workpackItem] = await provider.getChildren();
    const sectionItems = await provider.getChildren(workpackItem);
    const promptsSection = sectionItems.find((item) => item.section === "prompts");
    assert.ok(promptsSection);
    const promptItems = await provider.getChildren(promptsSection);

    assert.equal(workpackItem.contextValue, "workpack");
    assert.equal(promptsSection.contextValue, "section.prompts");
    assert.equal(promptItems[0].contextValue, "prompt.complete");
  });

  it("refresh fires the tree change event", async () => {
    const provider = new WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), [workspaceRoot], {
      watchFileSystem: false
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("refresh event was not fired")), 2000);
      const disposable = provider.onDidChangeTreeData(() => {
        clearTimeout(timeout);
        disposable.dispose();
        resolve();
      });

      provider.refresh();
    });
  });

  it("returns an empty tree when no workpacks are discovered", async () => {
    const provider = new WorkpackTreeProvider(new MockParser([]), [workspaceRoot], {
      watchFileSystem: false
    });

    const rootItems = await provider.getChildren();
    assert.deepEqual(rootItems, []);
  });

  it("groups by project when workpacks come from multiple projects", async () => {
    const instanceA = { ...createInstance(workpackFolder), sourceProject: "ProjectA" };
    instanceA.meta = { ...instanceA.meta, id: "wp_A" };
    const instanceB = { ...createInstance(workpackFolder), sourceProject: "ProjectB" };
    instanceB.meta = { ...instanceB.meta, id: "wp_B" };

    const provider = new WorkpackTreeProvider(new MockParser([instanceA, instanceB]), [workspaceRoot], {
      watchFileSystem: false
    });

    const rootItems = await provider.getChildren();

    assert.equal(rootItems.length, 2);
    assert.equal(rootItems[0].kind, TreeItemKind.Project);
    assert.equal(rootItems[0].label, "ProjectA");
    assert.equal(rootItems[1].kind, TreeItemKind.Project);
    assert.equal(rootItems[1].label, "ProjectB");

    const projectAChildren = await provider.getChildren(rootItems[0]);
    assert.equal(projectAChildren.length, 1);
    assert.equal(projectAChildren[0].kind, TreeItemKind.Workpack);
    assert.equal(projectAChildren[0].label, "wp_A");
  });
});
