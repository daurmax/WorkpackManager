import assert from "node:assert/strict";
import test from "node:test";
import type {
  OverallStatus,
  PromptEntry,
  WorkpackInstance,
  WorkpackMeta,
  WorkpackState,
} from "../../models";
import {
  buildPromptGraph,
  buildWorkpackGraph,
  detectCycles,
  getBlockedWorkpacks,
  getReadyPrompts,
  topologicalSort,
} from "../../graph/dependency-resolver";

function createPrompt(stem: string, dependsOn: string[] = []): PromptEntry {
  return {
    stem,
    agentRole: `Agent for ${stem}`,
    dependsOn,
    repos: ["WorkpackManager"],
    estimatedEffort: "S",
  };
}

function createMeta(id: string, prompts: PromptEntry[], requiresWorkpack: string[] = []): WorkpackMeta {
  return {
    id,
    title: `Title for ${id}`,
    summary: `Summary for ${id} workpack metadata.`,
    protocolVersion: "2.0.0",
    workpackVersion: "1.0.0",
    category: "feature",
    createdAt: "2026-02-23",
    requiresWorkpack,
    tags: [],
    owners: [],
    repos: ["WorkpackManager"],
    deliveryMode: "pr",
    targetBranch: "main",
    prompts,
  };
}

function createState(
  workpackId: string,
  overallStatus: OverallStatus,
  promptStatus: WorkpackState["promptStatus"] = {},
): WorkpackState {
  return {
    workpackId,
    overallStatus,
    lastUpdated: "2026-02-23T00:00:00Z",
    promptStatus,
    agentAssignments: {},
    blockedBy: [],
    executionLog: [],
  };
}

function createInstance(meta: WorkpackMeta, state: WorkpackState | null): WorkpackInstance {
  return {
    folderPath: `C:\\\\tmp\\\\${meta.id}`,
    meta,
    state,
    protocolVersion: "2.0.0",
    discoverySource: "auto",
  };
}

function promptNodeId(workpackId: string, stem: string): string {
  return `prompt:${workpackId}:${stem}`;
}

function workpackNodeId(workpackId: string): string {
  return `workpack:${workpackId}`;
}

test("dependency: topological sort resolves linear prompt DAG", () => {
  const meta = createMeta("wp_linear", [
    createPrompt("A0_bootstrap"),
    createPrompt("A1_models", ["A0_bootstrap"]),
    createPrompt("A2_parser", ["A1_models"]),
  ]);
  const graph = buildPromptGraph(meta);
  const order = topologicalSort(graph);

  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 2);
  assert.ok(Array.isArray(order));

  if (!Array.isArray(order)) {
    assert.fail("Expected topological sort to return an ordering for linear DAG.");
  }

  assert.deepEqual(order, [
    promptNodeId(meta.id, "A0_bootstrap"),
    promptNodeId(meta.id, "A1_models"),
    promptNodeId(meta.id, "A2_parser"),
  ]);
});

test("dependency: topological sort handles parallel branches and orphan prompt nodes", () => {
  const meta = createMeta("wp_parallel", [
    createPrompt("A0_foundation"),
    createPrompt("A1_setup"),
    createPrompt("A2_merge", ["A0_foundation", "A1_setup"]),
    createPrompt("A3_orphan"),
  ]);
  const graph = buildPromptGraph(meta);
  const order = topologicalSort(graph);

  assert.ok(Array.isArray(order));

  if (!Array.isArray(order)) {
    assert.fail("Expected topological sort to return an ordering for acyclic graph.");
  }

  const mergeIndex = order.indexOf(promptNodeId(meta.id, "A2_merge"));
  const foundationIndex = order.indexOf(promptNodeId(meta.id, "A0_foundation"));
  const setupIndex = order.indexOf(promptNodeId(meta.id, "A1_setup"));
  const orphanIndex = order.indexOf(promptNodeId(meta.id, "A3_orphan"));

  assert.notEqual(orphanIndex, -1);
  assert.ok(foundationIndex < mergeIndex);
  assert.ok(setupIndex < mergeIndex);
});

test("dependency: cycle detection reports prompt cycle path", () => {
  const meta = createMeta("wp_cycle", [
    createPrompt("A0_alpha", ["A2_gamma"]),
    createPrompt("A1_beta", ["A0_alpha"]),
    createPrompt("A2_gamma", ["A1_beta"]),
  ]);
  const graph = buildPromptGraph(meta);
  const cycles = detectCycles(graph);
  const topoResult = topologicalSort(graph);

  assert.equal(cycles.length, 1);
  assert.deepEqual(cycles[0].cyclePath, [
    promptNodeId(meta.id, "A0_alpha"),
    promptNodeId(meta.id, "A1_beta"),
    promptNodeId(meta.id, "A2_gamma"),
    promptNodeId(meta.id, "A0_alpha"),
  ]);
  assert.ok(!Array.isArray(topoResult));

  if (Array.isArray(topoResult)) {
    assert.fail("Expected topological sort to return cycle details for cyclic graph.");
  }

  assert.ok(topoResult.message.includes("Cycle detected"));
});

test("dependency: getReadyPrompts returns only prompts with complete dependencies", () => {
  const meta = createMeta("wp_ready", [
    createPrompt("A0_bootstrap"),
    createPrompt("A1_models", ["A0_bootstrap"]),
    createPrompt("A2_parser", ["A1_models"]),
    createPrompt("A3_external_dep", ["A9_missing"]),
    createPrompt("A4_running"),
  ]);
  const state = createState(meta.id, "in_progress", {
    A0_bootstrap: { status: "complete" },
    A1_models: { status: "pending" },
    A2_parser: { status: "pending" },
    A3_external_dep: { status: "pending" },
    A4_running: { status: "in_progress" },
  });

  const ready = getReadyPrompts(meta, state);

  assert.deepEqual(ready, ["A1_models"]);
});

test("dependency: workpack graph and blocked workpack computation", () => {
  const coreMeta = createMeta("wp_core", []);
  const apiMeta = createMeta("wp_api", [], ["wp_core"]);
  const agentsMeta = createMeta("wp_agents", []);
  const uiMeta = createMeta("wp_ui", [], ["wp_core", "wp_agents"]);
  const docsMeta = createMeta("wp_docs", [], ["wp_missing"]);
  const instances = [
    createInstance(coreMeta, createState("wp_core", "complete")),
    createInstance(apiMeta, createState("wp_api", "in_progress")),
    createInstance(agentsMeta, null),
    createInstance(uiMeta, createState("wp_ui", "in_progress")),
    createInstance(docsMeta, createState("wp_docs", "in_progress")),
  ];

  const graph = buildWorkpackGraph(instances);
  const order = topologicalSort(graph);
  const blocked = getBlockedWorkpacks(instances);

  assert.ok(Array.isArray(order));

  if (!Array.isArray(order)) {
    assert.fail("Expected topological sort to return an ordering for acyclic workpack graph.");
  }

  assert.ok(order.indexOf(workpackNodeId("wp_core")) < order.indexOf(workpackNodeId("wp_api")));
  assert.ok(order.includes(workpackNodeId("wp_missing")));
  assert.equal(blocked.size, 2);
  assert.deepEqual(blocked.get("wp_ui"), ["wp_agents"]);
  assert.deepEqual(blocked.get("wp_docs"), ["wp_missing"]);
});
