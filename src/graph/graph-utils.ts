import type { DependencyGraphData } from "../models/dependency-graph";

/**
 * Returns a stable, deduplicated, sorted list of node IDs found in graph nodes and edges.
 */
export function getNodeIds(graph: DependencyGraphData): string[] {
  const nodeIds = new Set<string>();

  for (const node of graph.nodes) {
    nodeIds.add(node.id);
  }

  for (const edge of graph.edges) {
    nodeIds.add(edge.from);
    nodeIds.add(edge.to);
  }

  return [...nodeIds].sort();
}

/**
 * Builds an adjacency list for outgoing edges keyed by node ID.
 */
export function buildAdjacencyList(graph: DependencyGraphData): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  for (const nodeId of getNodeIds(graph)) {
    adjacency.set(nodeId, []);
  }

  for (const edge of graph.edges) {
    const neighbors = adjacency.get(edge.from);

    if (!neighbors) {
      adjacency.set(edge.from, [edge.to]);
      continue;
    }

    if (!neighbors.includes(edge.to)) {
      neighbors.push(edge.to);
    }
  }

  for (const neighbors of adjacency.values()) {
    neighbors.sort();
  }

  return adjacency;
}

/**
 * Builds an adjacency list for incoming edges keyed by node ID.
 */
export function buildIncomingAdjacencyList(graph: DependencyGraphData): Map<string, string[]> {
  const incoming = new Map<string, string[]>();

  for (const nodeId of getNodeIds(graph)) {
    incoming.set(nodeId, []);
  }

  for (const edge of graph.edges) {
    const parents = incoming.get(edge.to);

    if (!parents) {
      incoming.set(edge.to, [edge.from]);
      continue;
    }

    if (!parents.includes(edge.from)) {
      parents.push(edge.from);
    }
  }

  for (const parents of incoming.values()) {
    parents.sort();
  }

  return incoming;
}

/**
 * Computes in-degree counts for each node ID.
 */
export function buildInDegreeMap(graph: DependencyGraphData): Map<string, number> {
  const inDegree = new Map<string, number>();

  for (const nodeId of getNodeIds(graph)) {
    inDegree.set(nodeId, 0);
  }

  for (const edge of graph.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);

    if (!inDegree.has(edge.from)) {
      inDegree.set(edge.from, 0);
    }
  }

  return inDegree;
}

/**
 * Computes transitive closure from an adjacency list.
 */
export function computeTransitiveClosure(
  adjacency: ReadonlyMap<string, readonly string[]>,
): Map<string, Set<string>> {
  const closure = new Map<string, Set<string>>();

  for (const nodeId of adjacency.keys()) {
    const visited = new Set<string>();
    const stack = [...(adjacency.get(nodeId) ?? [])];

    while (stack.length > 0) {
      const candidate = stack.pop();

      if (!candidate || visited.has(candidate)) {
        continue;
      }

      visited.add(candidate);

      for (const next of adjacency.get(candidate) ?? []) {
        if (!visited.has(next)) {
          stack.push(next);
        }
      }
    }

    closure.set(nodeId, visited);
  }

  return closure;
}

/**
 * Normalizes cycle paths to provide stable deduplication keys.
 */
export function normalizeCyclePath(cyclePath: string[]): string[] {
  if (cyclePath.length === 0) {
    return cyclePath;
  }

  const hasClosingNode = cyclePath.length > 1 && cyclePath[0] === cyclePath[cyclePath.length - 1];
  const cycleCore = hasClosingNode ? cyclePath.slice(0, -1) : [...cyclePath];

  if (cycleCore.length === 0) {
    return cyclePath;
  }

  let bestRotation = [...cycleCore];
  let bestKey = bestRotation.join("->");

  for (let index = 1; index < cycleCore.length; index += 1) {
    const rotated = [...cycleCore.slice(index), ...cycleCore.slice(0, index)];
    const key = rotated.join("->");

    if (key < bestKey) {
      bestRotation = rotated;
      bestKey = key;
    }
  }

  return [...bestRotation, bestRotation[0]];
}
