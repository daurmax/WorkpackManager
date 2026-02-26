import { strict as assert } from "node:assert";
import * as os from "node:os";
import * as path from "node:path";
import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import { Module } from "node:module";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { WorkpackInstance } from "../../models";
type WorkpackTreeProviderCtor = typeof import("../workpack-tree-provider").WorkpackTreeProvider;
type TreeItemKindEnum = typeof import("../workpack-tree-item").TreeItemKind;

interface TreeViewRuntime {
  WorkpackTreeProvider: WorkpackTreeProviderCtor;
  TreeItemKind: TreeItemKindEnum;
}

class MockParser {
  constructor(private readonly instances: WorkpackInstance[]) {}

  async discover(_workspaceFolders: readonly string[]): Promise<WorkpackInstance[]> {
    return this.instances;
  }
}

function loadTreeViewRuntime(): TreeViewRuntime {
  const mockRoot = fsSync.mkdtempSync(path.join(os.tmpdir(), "workpack-tree-vscode-mock-"));
  const mockPackageDir = path.join(mockRoot, "node_modules", "vscode");
  fsSync.mkdirSync(mockPackageDir, { recursive: true });
  fsSync.writeFileSync(
    path.join(mockPackageDir, "index.js"),
    `"use strict";
class EventEmitter {
  constructor() { this.listeners = []; this.event = (listener) => { this.listeners.push(listener); return { dispose: () => { this.listeners = this.listeners.filter((entry) => entry !== listener); } }; }; }
  fire(event) { for (const listener of this.listeners) { listener(event); } }
  dispose() { this.listeners = []; }
}
class TreeItem {
  constructor(label, collapsibleState) { this.label = label; this.collapsibleState = collapsibleState; }
}
class ThemeIcon {
  constructor(id) { this.id = id; }
}
class RelativePattern {
  constructor(base, pattern) { this.base = base; this.pattern = pattern; }
}
function createWatcher() {
  return {
    onDidCreate: () => ({ dispose: () => undefined }),
    onDidChange: () => ({ dispose: () => undefined }),
    onDidDelete: () => ({ dispose: () => undefined }),
    dispose: () => undefined
  };
}
module.exports = {
  EventEmitter,
  TreeItem,
  ThemeIcon,
  RelativePattern,
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  Uri: { file: (filePath) => ({ fsPath: filePath }) },
  workspace: { createFileSystemWatcher: () => createWatcher() }
};`,
    "utf8"
  );

  const nodePathEntry = path.join(mockRoot, "node_modules");
  process.env.NODE_PATH = process.env.NODE_PATH
    ? `${nodePathEntry}${path.delimiter}${process.env.NODE_PATH}`
    : nodePathEntry;
  (Module as unknown as { _initPaths: () => void })._initPaths();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const treeItemModule = require("../workpack-tree-item") as typeof import("../workpack-tree-item");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const treeProviderModule = require("../workpack-tree-provider") as typeof import("../workpack-tree-provider");

  return {
    TreeItemKind: treeItemModule.TreeItemKind,
    WorkpackTreeProvider: treeProviderModule.WorkpackTreeProvider
  };
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
  let runtime: TreeViewRuntime;

  beforeEach(async () => {
    runtime = loadTreeViewRuntime();

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
    const provider = new runtime.WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), workspaceRoot, {
      watchFileSystem: false
    });

    const rootItems = await provider.getChildren();

    assert.equal(rootItems.length, 1);
    assert.equal(rootItems[0].kind, runtime.TreeItemKind.Workpack);
    assert.equal(rootItems[0].label, "01_demo_tree-view");
  });

  it("returns sections as children of a workpack node", async () => {
    const provider = new runtime.WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), workspaceRoot, {
      watchFileSystem: false
    });

    const [workpackItem] = await provider.getChildren();
    const sectionItems = await provider.getChildren(workpackItem);
    const labels = sectionItems.map((item) => item.label);

    assert.deepEqual(labels, ["Request", "Plan", "Prompts", "Outputs", "Status"]);
    assert.equal(sectionItems.every((item) => item.kind === runtime.TreeItemKind.Section), true);
  });

  it("returns prompt files as children of the Prompts section", async () => {
    const provider = new runtime.WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), workspaceRoot, {
      watchFileSystem: false
    });

    const [workpackItem] = await provider.getChildren();
    const sectionItems = await provider.getChildren(workpackItem);
    const promptsSection = sectionItems.find((item) => item.section === "prompts");

    assert.ok(promptsSection);
    const promptItems = await provider.getChildren(promptsSection);

    assert.equal(promptItems.length, 2);
    assert.equal(promptItems[0].kind, runtime.TreeItemKind.PromptFile);
    assert.equal(promptItems[1].kind, runtime.TreeItemKind.PromptFile);
    assert.equal(promptItems[0].label, "A0_bootstrap.md");
    assert.equal(promptItems[1].label, "A1_tree_view.md");
  });

  it("sets context values for workpack, section, and prompt nodes", async () => {
    const provider = new runtime.WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), workspaceRoot, {
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
    const provider = new runtime.WorkpackTreeProvider(new MockParser([createInstance(workpackFolder)]), workspaceRoot, {
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
    const provider = new runtime.WorkpackTreeProvider(new MockParser([]), workspaceRoot, {
      watchFileSystem: false
    });

    const rootItems = await provider.getChildren();
    assert.deepEqual(rootItems, []);
  });
});
