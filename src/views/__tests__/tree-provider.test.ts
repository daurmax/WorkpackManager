import { strict as assert } from "node:assert";
import * as os from "node:os";
import * as path from "node:path";
import { promises as fs } from "node:fs";
import { afterEach, beforeEach, describe, it } from "vitest";
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
    workpackFolder = path.join(
      workspaceRoot,
      "workpacks",
      "instances",
      "demo-group",
      "01_demo_tree-view"
    );

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
    const provider = new WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), workspaceRoot, {
      watchFileSystem: false
    });

    const rootItems = await provider.getChildren();

    assert.equal(rootItems.length, 1);
    assert.equal(rootItems[0].kind, TreeItemKind.Workpack);
    assert.equal(rootItems[0].label, "01_demo_tree-view");
  });

  it("returns sections as children of a workpack node", async () => {
    const provider = new WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), workspaceRoot, {
      watchFileSystem: false
    });

    const [workpackItem] = await provider.getChildren();
    const sectionItems = await provider.getChildren(workpackItem);
    const labels = sectionItems.map((item) => item.label);

    assert.deepEqual(labels, ["Request", "Plan", "Prompts", "Outputs", "Status"]);
    assert.equal(sectionItems.every((item) => item.kind === TreeItemKind.Section), true);
  });

  it("returns prompt files as children of the Prompts section", async () => {
    const provider = new WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), workspaceRoot, {
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

  it("sets context values for workpack, section, and prompt nodes", async () => {
    const provider = new WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), workspaceRoot, {
      watchFileSystem: false
    });

    const [workpackItem] = await provider.getChildren();
    const sectionItems = await provider.getChildren(workpackItem);
    const promptsSection = sectionItems.find((item) => item.section === "prompts");
    assert.ok(promptsSection);
    const promptItems = await provider.getChildren(promptsSection);

    assert.equal(workpackItem.contextValue, "workpack");
    assert.equal(promptsSection.contextValue, "section.prompts");
    assert.equal(promptItems[0].contextValue, "prompt");
  });

  it("refresh fires the tree change event", async () => {
    const provider = new WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), workspaceRoot, {
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
    const provider = new WorkpackTreeProvider(new MockParser([]), workspaceRoot, {
      watchFileSystem: false
    });

    const rootItems = await provider.getChildren();
    assert.deepEqual(rootItems, []);
  });
});
