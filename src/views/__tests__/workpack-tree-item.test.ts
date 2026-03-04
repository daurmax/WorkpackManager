import { strict as assert } from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import { describe, it } from "vitest";
import { TreeItemKind, WorkpackTreeItem } from "../workpack-tree-item";

describe("workpack-tree-item", () => {
  it("maps each tree item kind to expected context values and icons", () => {
    const workpack = new WorkpackTreeItem(
      TreeItemKind.Workpack,
      "wp_01",
      "wp_01",
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      undefined,
      "complete"
    );
    assert.equal(workpack.contextValue, "workpack");
    assert.equal(workpack.iconPath?.id, "check");

    const sectionIcons: Array<{ section: "request" | "plan" | "prompts" | "outputs" | "status"; iconId: string }> = [
      { section: "request", iconId: "file-text" },
      { section: "plan", iconId: "checklist" },
      { section: "prompts", iconId: "list-tree" },
      { section: "outputs", iconId: "output" },
      { section: "status", iconId: "pulse" }
    ];

    for (const sectionIcon of sectionIcons) {
      const section = new WorkpackTreeItem(
        TreeItemKind.Section,
        "wp_01",
        sectionIcon.section,
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        sectionIcon.section
      );
      assert.equal(section.contextValue, `section.${sectionIcon.section}`);
      assert.equal(section.iconPath?.id, sectionIcon.iconId);
    }

    const sectionWithoutName = new WorkpackTreeItem(
      TreeItemKind.Section,
      "wp_01",
      "generic",
      vscode.TreeItemCollapsibleState.Collapsed
    );
    assert.equal(sectionWithoutName.contextValue, "section.generic");
    assert.equal(sectionWithoutName.iconPath?.id, "folder");

    const prompt = new WorkpackTreeItem(
      TreeItemKind.PromptFile,
      "wp_01",
      "A0_bootstrap.md",
      vscode.TreeItemCollapsibleState.None,
      undefined,
      "prompts",
      "blocked"
    );
    assert.equal(prompt.contextValue, "prompt");
    assert.equal(prompt.iconPath?.id, "error");

    const output = new WorkpackTreeItem(
      TreeItemKind.OutputFile,
      "wp_01",
      "A0_bootstrap.json",
      vscode.TreeItemCollapsibleState.None,
      undefined,
      "outputs"
    );
    assert.equal(output.contextValue, "output");
    assert.equal(output.iconPath?.id, "output");

    const status = new WorkpackTreeItem(
      TreeItemKind.StatusFile,
      "wp_01",
      "99_status.md",
      vscode.TreeItemCollapsibleState.None,
      undefined,
      "status"
    );
    assert.equal(status.contextValue, "statusFile");
    assert.equal(status.iconPath?.id, "pulse");

    const state = new WorkpackTreeItem(
      TreeItemKind.StateFile,
      "wp_01",
      "workpack.state.json",
      vscode.TreeItemCollapsibleState.None,
      undefined,
      "status"
    );
    assert.equal(state.contextValue, "stateFile");
    assert.equal(state.iconPath?.id, "symbol-key");

    const meta = new WorkpackTreeItem(
      TreeItemKind.MetaFile,
      "wp_01",
      "workpack.meta.json",
      vscode.TreeItemCollapsibleState.None
    );
    assert.equal(meta.contextValue, "metaFile");
    assert.equal(meta.iconPath?.id, "json");
  });

  it("falls back to unknown or pending icons for mismatched statuses", () => {
    const workpackWithPromptStatus = new WorkpackTreeItem(
      TreeItemKind.Workpack,
      "wp_02",
      "wp_02",
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      undefined,
      "pending"
    );
    assert.equal(workpackWithPromptStatus.iconPath?.id, "question");

    const promptWithWorkpackStatus = new WorkpackTreeItem(
      TreeItemKind.PromptFile,
      "wp_02",
      "A1_plan.md",
      vscode.TreeItemCollapsibleState.None,
      undefined,
      "prompts",
      "review"
    );
    assert.equal(promptWithWorkpackStatus.iconPath?.id, "circle-outline");
  });

  it("handles markdown, json, and generic file icon resolution paths", () => {
    const markdown = new WorkpackTreeItem(
      TreeItemKind.MetaFile,
      "wp_03",
      "01_plan.md",
      vscode.TreeItemCollapsibleState.None,
      undefined,
      "plan"
    );
    assert.equal(markdown.iconPath?.id, "markdown");

    const genericFile = new WorkpackTreeItem(
      999 as TreeItemKind,
      "wp_03",
      "artifact.bin",
      vscode.TreeItemCollapsibleState.None,
      undefined,
      "outputs"
    );
    assert.equal(genericFile.iconPath?.id, "file");
    assert.equal(genericFile.contextValue, "metaFile");
  });

  it("normalizes file paths in ids and wires open-file metadata", () => {
    const filePath = path.join("C:", "repo", "workpacks", "instances", "demo", "00_request.md");
    const requestFile = new WorkpackTreeItem(
      TreeItemKind.MetaFile,
      "wp_04",
      "00_request.md",
      vscode.TreeItemCollapsibleState.None,
      filePath,
      "request"
    );

    assert.equal(requestFile.id, "wp_04:MetaFile:request:00_request.md:C:/repo/workpacks/instances/demo/00_request.md");
    assert.equal(requestFile.resourceUri?.fsPath, filePath);
    assert.equal(requestFile.tooltip, `00_request.md\n${filePath}`);
    assert.equal(requestFile.command?.command, "vscode.open");
    assert.equal(requestFile.command?.title, "Open File");
    assert.deepEqual(requestFile.command?.arguments, [requestFile.resourceUri]);

    const missingFilePath = new WorkpackTreeItem(
      TreeItemKind.Workpack,
      "wp_04",
      "wp_04",
      vscode.TreeItemCollapsibleState.Collapsed
    );
    assert.equal(missingFilePath.id, "wp_04:Workpack:none:wp_04:none");
    assert.equal(missingFilePath.resourceUri, undefined);
    assert.equal(missingFilePath.command, undefined);
  });
});
