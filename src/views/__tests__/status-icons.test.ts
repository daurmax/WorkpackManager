import { strict as assert } from "node:assert";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";
import { Module } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "node:test";
import type { OverallStatus, PromptStatusValue, WorkpackCategory, WorkpackInstance } from "../../models";

type StatusIconsRuntime = typeof import("../status-icons");
type WorkpackTreeProviderCtor = typeof import("../workpack-tree-provider").WorkpackTreeProvider;

interface Runtime {
  statusIcons: StatusIconsRuntime;
  WorkpackTreeProvider: WorkpackTreeProviderCtor;
}

class MockParser {
  constructor(private readonly instances: WorkpackInstance[]) {}

  async discover(_workspaceFolders: readonly string[]): Promise<WorkpackInstance[]> {
    return this.instances;
  }
}

const tempRoots: string[] = [];
const tempWorkspaces: string[] = [];

function loadRuntime(): Runtime {
  const mockRoot = fsSync.mkdtempSync(path.join(os.tmpdir(), "workpack-status-icons-vscode-mock-"));
  tempRoots.push(mockRoot);

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
class ThemeColor {
  constructor(id) { this.id = id; }
}
class ThemeIcon {
  constructor(id, color) { this.id = id; this.color = color; }
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
  ThemeColor,
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

  delete require.cache[require.resolve("../status-icons")];
  delete require.cache[require.resolve("../workpack-tree-provider")];

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const statusIcons = require("../status-icons") as StatusIconsRuntime;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const treeProviderModule = require("../workpack-tree-provider") as typeof import("../workpack-tree-provider");

  return {
    statusIcons,
    WorkpackTreeProvider: treeProviderModule.WorkpackTreeProvider
  };
}

function createWorkspaceRoot(): string {
  const workspaceRoot = fsSync.mkdtempSync(path.join(os.tmpdir(), "workpack-status-icons-workspace-"));
  tempWorkspaces.push(workspaceRoot);
  return workspaceRoot;
}

interface InstanceOptions {
  id: string;
  status: OverallStatus;
  category?: WorkpackCategory;
  tags?: string[];
  createdAt?: string;
  promptStatuses?: Record<string, PromptStatusValue>;
}

function createInstance(options: InstanceOptions): WorkpackInstance {
  const promptStatuses = options.promptStatuses ?? {
    A0_bootstrap: "complete",
    A1_tree_view: "pending"
  };
  const promptStems = Object.keys(promptStatuses);

  return {
    folderPath: path.join("C:", "workpacks", options.id),
    protocolVersion: "2.0.0",
    discoverySource: "auto",
    meta: {
      id: options.id,
      title: options.id,
      summary: `${options.id} summary`,
      protocolVersion: "2.0.0",
      workpackVersion: "1.0.0",
      category: options.category ?? "feature",
      createdAt: options.createdAt ?? "2026-02-26",
      requiresWorkpack: [],
      tags: options.tags ?? [],
      owners: ["team"],
      repos: ["WorkpackManager"],
      deliveryMode: "pr",
      targetBranch: "main",
      prompts: promptStems.map((stem) => ({
        stem,
        agentRole: stem,
        dependsOn: [],
        repos: ["WorkpackManager"],
        estimatedEffort: "S" as const
      }))
    },
    state: {
      workpackId: options.id,
      overallStatus: options.status,
      lastUpdated: "2026-02-26T10:00:00.000Z",
      promptStatus: Object.fromEntries(promptStems.map((stem) => [stem, { status: promptStatuses[stem] }])),
      agentAssignments: {},
      blockedBy: [],
      executionLog: [],
      notes: null
    }
  };
}

afterEach(async () => {
  while (tempWorkspaces.length > 0) {
    const workspaceRoot = tempWorkspaces.pop();
    if (workspaceRoot) {
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  }

  while (tempRoots.length > 0) {
    const tempRoot = tempRoots.pop();
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }
});

describe("status icons and tree filtering", () => {
  it("maps all status values to icon metadata", () => {
    const runtime = loadRuntime();

    const overallStatuses: OverallStatus[] = [
      "not_started",
      "in_progress",
      "blocked",
      "review",
      "complete",
      "abandoned"
    ];
    const promptStatuses: PromptStatusValue[] = ["pending", "in_progress", "complete", "blocked", "skipped"];

    for (const status of overallStatuses) {
      const icon = runtime.statusIcons.WORKPACK_STATUS_ICONS[status];
      assert.ok(icon);
      assert.equal(icon.codicon.length > 0, true);
      assert.equal(icon.label.length > 0, true);
    }

    for (const status of promptStatuses) {
      const icon = runtime.statusIcons.PROMPT_STATUS_ICONS[status];
      assert.ok(icon);
      assert.equal(icon.codicon.length > 0, true);
      assert.equal(icon.label.length > 0, true);
    }
  });

  it("exposes monotonic sort order for workpack and prompt statuses", () => {
    const runtime = loadRuntime();

    const workpackOrder = Object.values(runtime.statusIcons.WORKPACK_STATUS_ICONS).map((icon) => icon.sortOrder);
    const promptOrder = Object.values(runtime.statusIcons.PROMPT_STATUS_ICONS).map((icon) => icon.sortOrder);

    assert.deepEqual(workpackOrder, [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(promptOrder, [0, 1, 2, 3, 4]);
  });

  it("filters workpacks by status, category, and tags while keeping filter across refresh", async () => {
    const runtime = loadRuntime();
    const workspaceRoot = createWorkspaceRoot();

    const provider = new runtime.WorkpackTreeProvider(
      new MockParser([
        createInstance({ id: "01_ui_blocked", status: "blocked", category: "feature", tags: ["ui", "extension"] }),
        createInstance({ id: "02_cli_complete", status: "complete", category: "bugfix", tags: ["cli"] }),
        createInstance({ id: "03_api_progress", status: "in_progress", category: "feature", tags: ["api"] })
      ]),
      workspaceRoot,
      { watchFileSystem: false }
    );

    provider.setFilter({
      status: ["blocked"],
      category: ["feature"],
      tags: ["ui"]
    });

    const filtered = await provider.getChildren();
    assert.deepEqual(filtered.map((item) => String(item.label)), ["01_ui_blocked"]);

    provider.refresh();
    const filteredAfterRefresh = await provider.getChildren();
    assert.deepEqual(filteredAfterRefresh.map((item) => String(item.label)), ["01_ui_blocked"]);

    provider.clearFilter();
    const unfiltered = await provider.getChildren();
    assert.equal(unfiltered.length, 3);
  });

  it("supports sorting by name, status, and date", async () => {
    const runtime = loadRuntime();
    const workspaceRoot = createWorkspaceRoot();

    const provider = new runtime.WorkpackTreeProvider(
      new MockParser([
        createInstance({ id: "b_complete", status: "complete", createdAt: "2026-02-10" }),
        createInstance({ id: "a_not_started", status: "not_started", createdAt: "2026-01-15" }),
        createInstance({ id: "c_blocked", status: "blocked", createdAt: "2026-03-01" })
      ]),
      workspaceRoot,
      { watchFileSystem: false }
    );

    const byName = await provider.getChildren();
    assert.deepEqual(byName.map((item) => String(item.label)), ["a_not_started", "b_complete", "c_blocked"]);

    provider.setSort("status");
    const byStatus = await provider.getChildren();
    assert.deepEqual(byStatus.map((item) => String(item.label)), ["a_not_started", "c_blocked", "b_complete"]);

    provider.setSort("date");
    const byDate = await provider.getChildren();
    assert.deepEqual(byDate.map((item) => String(item.label)), ["c_blocked", "b_complete", "a_not_started"]);
  });

  it("formats root progress description as completed over total prompts", async () => {
    const runtime = loadRuntime();
    const workspaceRoot = createWorkspaceRoot();

    const provider = new runtime.WorkpackTreeProvider(
      new MockParser([
        createInstance({
          id: "01_progress_demo",
          status: "in_progress",
          promptStatuses: {
            A0_bootstrap: "complete",
            A1_tree_view: "skipped",
            A2_status_visualization: "pending"
          }
        })
      ]),
      workspaceRoot,
      { watchFileSystem: false }
    );

    const [rootItem] = await provider.getChildren();
    assert.equal(rootItem.description, "2 / 3 prompts");
  });
});
