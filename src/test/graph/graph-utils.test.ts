import assert from "node:assert/strict";
import test from "node:test";
import type { DependencyGraphData } from "../../models";
import {
  buildAdjacencyList,
  buildIncomingAdjacencyList,
  computeTransitiveClosure,
  normalizeCyclePath,
} from "../../graph/graph-utils";

const sampleGraph: DependencyGraphData = {
  nodes: [
    { id: "A", nodeType: "workpack", workpackId: "A", label: "A" },
    { id: "B", nodeType: "workpack", workpackId: "B", label: "B" },
    { id: "C", nodeType: "workpack", workpackId: "C", label: "C" },
    { id: "D", nodeType: "workpack", workpackId: "D", label: "D" },
  ],
  edges: [
    { from: "A", to: "B", edgeType: "workpack_requires_workpack" },
    { from: "B", to: "C", edgeType: "workpack_requires_workpack" },
    { from: "A", to: "D", edgeType: "workpack_requires_workpack" },
  ],
};

test("dependency: graph utils build adjacency and incoming maps", () => {
  const adjacency = buildAdjacencyList(sampleGraph);
  const incoming = buildIncomingAdjacencyList(sampleGraph);

  assert.deepEqual(adjacency.get("A"), ["B", "D"]);
  assert.deepEqual(adjacency.get("C"), []);
  assert.deepEqual(incoming.get("C"), ["B"]);
  assert.deepEqual(incoming.get("A"), []);
});

test("dependency: graph utils compute transitive closure", () => {
  const adjacency = buildAdjacencyList(sampleGraph);
  const closure = computeTransitiveClosure(adjacency);

  assert.deepEqual([...(closure.get("A") ?? [])].sort(), ["B", "C", "D"]);
  assert.deepEqual([...(closure.get("B") ?? [])], ["C"]);
  assert.deepEqual([...(closure.get("C") ?? [])], []);
});

test("dependency: graph utils normalize cycle path rotation", () => {
  const normalized = normalizeCyclePath(["B", "C", "A", "B"]);

  assert.deepEqual(normalized, ["A", "B", "C", "A"]);
});
