import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PromptEntry, WorkpackMeta } from "../../models";
import { detectPromptCycle, topologicalSortPrompts } from "../dag";

function createPrompt(stem: string, dependsOn: string[] = []): PromptEntry {
  return {
    stem,
    agentRole: `Agent for ${stem}`,
    dependsOn,
    repos: ["WorkpackManager"],
    estimatedEffort: "S",
  };
}

function createMeta(id: string, prompts: PromptEntry[]): WorkpackMeta {
  return {
    id,
    title: `Title ${id}`,
    summary: `Summary ${id}`,
    protocolVersion: "2.0.0",
    workpackVersion: "1.0.0",
    category: "feature",
    createdAt: "2026-02-26",
    requiresWorkpack: [],
    tags: [],
    owners: [],
    repos: ["WorkpackManager"],
    deliveryMode: "pr",
    targetBranch: "main",
    prompts,
  };
}

describe("prompt dag utilities", () => {
  it("topological sorts a simple DAG", () => {
    const meta = createMeta("wp-simple-dag", [
      createPrompt("A"),
      createPrompt("B", ["A"]),
      createPrompt("C", ["A"]),
      createPrompt("D", ["B", "C"]),
    ]);

    const ordered = topologicalSortPrompts(meta).map((prompt) => prompt.stem);

    assert.deepEqual(ordered, ["A", "B", "C", "D"]);
  });

  it("detects a cycle in a graph", () => {
    const meta = createMeta("wp-cycle", [
      createPrompt("A", ["C"]),
      createPrompt("B", ["A"]),
      createPrompt("C", ["B"]),
    ]);

    const cycle = detectPromptCycle(meta);

    assert.deepEqual(cycle, ["A", "B", "C", "A"]);
  });

  it("returns empty topological sort for empty graph", () => {
    const meta = createMeta("wp-empty", []);

    const ordered = topologicalSortPrompts(meta).map((prompt) => prompt.stem);

    assert.deepEqual(ordered, []);
  });

  it("handles single-node graph", () => {
    const meta = createMeta("wp-single", [createPrompt("A")]);

    const ordered = topologicalSortPrompts(meta).map((prompt) => prompt.stem);

    assert.deepEqual(ordered, ["A"]);
  });
});
