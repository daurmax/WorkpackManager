import type {
  CycleError,
  DependencyEdge,
  DependencyGraphData,
  DependencyNode,
} from "../models/dependency-graph";
import type { WorkpackInstance } from "../models/workpack-instance";
import type { WorkpackMeta } from "../models/workpack-meta";
import type { PromptStatusValue, WorkpackState } from "../models/workpack-state";
import { buildAdjacencyList, buildInDegreeMap, normalizeCyclePath } from "./graph-utils";

const WORKPACK_NODE_PREFIX = "workpack:";
const PROMPT_NODE_PREFIX = "prompt:";
const COMPLETE_PROMPT_STATUS: PromptStatusValue = "complete";

function getWorkpackNodeId(workpackId: string): string {
  return `${WORKPACK_NODE_PREFIX}${workpackId}`;
}

function getPromptNodeId(workpackId: string, promptStem: string): string {
  return `${PROMPT_NODE_PREFIX}${workpackId}:${promptStem}`;
}

function addEdge(edges: DependencyEdge[], edgeSet: Set<string>, edge: DependencyEdge): void {
  const edgeKey = `${edge.from}|${edge.to}|${edge.edgeType}`;

  if (edgeSet.has(edgeKey)) {
    return;
  }

  edgeSet.add(edgeKey);
  edges.push(edge);
}

/**
 * Builds prompt-level DAG for a single workpack from metadata prompt dependencies.
 */
export function buildPromptGraph(meta: WorkpackMeta): DependencyGraphData {
  const nodeById = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];
  const edgeSet = new Set<string>();

  const ensurePromptNode = (promptStem: string, isDeclaredPrompt: boolean): string => {
    const nodeId = getPromptNodeId(meta.id, promptStem);

    if (!nodeById.has(nodeId)) {
      nodeById.set(nodeId, {
        id: nodeId,
        nodeType: "prompt",
        workpackId: meta.id,
        promptStem,
        label: isDeclaredPrompt
          ? `${meta.id}/${promptStem}`
          : `${meta.id}/${promptStem} (referenced dependency)`,
      });
    }

    return nodeId;
  };

  for (const prompt of meta.prompts) {
    ensurePromptNode(prompt.stem, true);
  }

  for (const prompt of meta.prompts) {
    const promptNodeId = getPromptNodeId(meta.id, prompt.stem);

    for (const dependencyStem of prompt.dependsOn) {
      const dependencyNodeId = ensurePromptNode(dependencyStem, false);

      addEdge(edges, edgeSet, {
        from: dependencyNodeId,
        to: promptNodeId,
        edgeType: "prompt_depends_on_prompt",
      });
    }
  }

  return {
    nodes: [...nodeById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges,
  };
}

/**
 * Builds cross-workpack DAG from `requiresWorkpack` metadata relationships.
 */
export function buildWorkpackGraph(instances: WorkpackInstance[]): DependencyGraphData {
  const nodeById = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];
  const edgeSet = new Set<string>();
  const instanceById = new Map(instances.map((instance) => [instance.meta.id, instance]));

  const ensureWorkpackNode = (workpackId: string): string => {
    const nodeId = getWorkpackNodeId(workpackId);

    if (!nodeById.has(nodeId)) {
      const instance = instanceById.get(workpackId);

      nodeById.set(nodeId, {
        id: nodeId,
        nodeType: "workpack",
        workpackId,
        label: instance ? instance.meta.title : `${workpackId} (external dependency)`,
      });
    }

    return nodeId;
  };

  for (const instance of instances) {
    ensureWorkpackNode(instance.meta.id);
  }

  for (const instance of instances) {
    const workpackNodeId = ensureWorkpackNode(instance.meta.id);

    for (const dependencyId of instance.meta.requiresWorkpack) {
      const dependencyNodeId = ensureWorkpackNode(dependencyId);

      addEdge(edges, edgeSet, {
        from: dependencyNodeId,
        to: workpackNodeId,
        edgeType: "workpack_requires_workpack",
      });
    }
  }

  return {
    nodes: [...nodeById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges,
  };
}

/**
 * Kahn topological sort. Returns sorted node IDs or cycle details when impossible.
 */
export function topologicalSort(graph: DependencyGraphData): string[] | CycleError {
  const adjacency = buildAdjacencyList(graph);
  const inDegree = buildInDegreeMap(graph);
  const readyQueue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([nodeId]) => nodeId)
    .sort();
  const ordered: string[] = [];

  while (readyQueue.length > 0) {
    const nodeId = readyQueue.shift();

    if (!nodeId) {
      continue;
    }

    ordered.push(nodeId);

    for (const dependent of adjacency.get(nodeId) ?? []) {
      const nextDegree = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, nextDegree);

      if (nextDegree === 0) {
        readyQueue.push(dependent);
        readyQueue.sort();
      }
    }
  }

  if (ordered.length === inDegree.size) {
    return ordered;
  }

  const detectedCycles = detectCycles(graph);

  if (detectedCycles.length > 0) {
    return detectedCycles[0];
  }

  const unresolvedNodes = [...inDegree.entries()]
    .filter(([nodeId]) => !ordered.includes(nodeId))
    .map(([nodeId]) => nodeId)
    .sort();

  return {
    message: "Cycle detected in dependency graph.",
    cyclePath: unresolvedNodes,
  };
}

/**
 * DFS cycle detection that reports cycle node paths.
 */
export function detectCycles(graph: DependencyGraphData): CycleError[] {
  const adjacency = buildAdjacencyList(graph);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const stackIndex = new Map<string, number>();
  const cycleByKey = new Map<string, string[]>();

  const visit = (nodeId: string): void => {
    visited.add(nodeId);
    visiting.add(nodeId);
    stackIndex.set(nodeId, stack.length);
    stack.push(nodeId);

    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      if (!visited.has(nextNodeId)) {
        visit(nextNodeId);
        continue;
      }

      if (!visiting.has(nextNodeId)) {
        continue;
      }

      const cycleStartIndex = stackIndex.get(nextNodeId);

      if (cycleStartIndex === undefined) {
        continue;
      }

      const rawCyclePath = [...stack.slice(cycleStartIndex), nextNodeId];
      const normalizedPath = normalizeCyclePath(rawCyclePath);
      cycleByKey.set(normalizedPath.join("->"), normalizedPath);
    }

    stack.pop();
    stackIndex.delete(nodeId);
    visiting.delete(nodeId);
  };

  for (const nodeId of [...adjacency.keys()].sort()) {
    if (!visited.has(nodeId)) {
      visit(nodeId);
    }
  }

  return [...cycleByKey.values()]
    .sort((left, right) => left.join("->").localeCompare(right.join("->")))
    .map((cyclePath) => ({
      message: `Cycle detected: ${cyclePath.join(" -> ")}`,
      cyclePath,
    }));
}

/**
 * Returns prompt stems that are not already finished/running and whose dependencies are complete.
 */
export function getReadyPrompts(meta: WorkpackMeta, state: WorkpackState): string[] {
  const promptByStem = new Map(meta.prompts.map((prompt) => [prompt.stem, prompt]));
  const completePrompts = new Set(
    Object.entries(state.promptStatus)
      .filter(([, promptStatus]) => promptStatus.status === COMPLETE_PROMPT_STATUS)
      .map(([promptStem]) => promptStem),
  );
  const readyCandidates = new Set<string>();

  for (const prompt of meta.prompts) {
    const currentStatus = state.promptStatus[prompt.stem]?.status;
    const isAlreadyHandled =
      currentStatus === "complete" || currentStatus === "in_progress" || currentStatus === "skipped";

    if (isAlreadyHandled) {
      continue;
    }

    const dependenciesComplete = prompt.dependsOn.every(
      (dependencyStem) => promptByStem.has(dependencyStem) && completePrompts.has(dependencyStem),
    );

    if (dependenciesComplete) {
      readyCandidates.add(prompt.stem);
    }
  }

  const graph = buildPromptGraph(meta);
  const orderedNodeIds = topologicalSort(graph);

  if (!Array.isArray(orderedNodeIds)) {
    return meta.prompts
      .map((prompt) => prompt.stem)
      .filter((promptStem) => readyCandidates.has(promptStem));
  }

  const stemByNodeId = new Map(
    graph.nodes
      .filter((node) => node.nodeType === "prompt" && node.promptStem)
      .map((node) => [node.id, node.promptStem as string]),
  );

  return orderedNodeIds
    .map((nodeId) => stemByNodeId.get(nodeId))
    .filter((promptStem): promptStem is string => {
      if (promptStem === undefined) {
        return false;
      }

      return readyCandidates.has(promptStem);
    });
}

/**
 * Returns workpack IDs blocked by incomplete or missing required workpacks.
 */
export function getBlockedWorkpacks(instances: WorkpackInstance[]): Map<string, string[]> {
  const blockedWorkpacks = new Map<string, string[]>();
  const instanceById = new Map(instances.map((instance) => [instance.meta.id, instance]));

  for (const instance of instances) {
    if (instance.state?.overallStatus === "complete") {
      continue;
    }

    const blockers = new Set<string>();

    for (const requiredWorkpackId of instance.meta.requiresWorkpack) {
      const dependency = instanceById.get(requiredWorkpackId);

      if (!dependency || dependency.state?.overallStatus !== "complete") {
        blockers.add(requiredWorkpackId);
      }
    }

    if (blockers.size > 0) {
      blockedWorkpacks.set(instance.meta.id, [...blockers].sort());
    }
  }

  return blockedWorkpacks;
}
