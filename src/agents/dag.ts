import type { PromptEntry, WorkpackMeta, WorkpackState } from "../models";

const COMPLETE_STATUS = "complete";

export class DagCycleError extends Error {
  constructor(public readonly cyclePath: string[]) {
    super(`Cycle detected in prompt DAG: ${cyclePath.join(" -> ")}`);
  }
}

function buildPromptMap(meta: WorkpackMeta): Map<string, PromptEntry> {
  return new Map(meta.prompts.map((prompt) => [prompt.stem, prompt]));
}

function buildAdjacency(meta: WorkpackMeta): Map<string, string[]> {
  const promptByStem = buildPromptMap(meta);
  const adjacency = new Map<string, string[]>();

  for (const prompt of meta.prompts) {
    adjacency.set(prompt.stem, []);
  }

  for (const prompt of meta.prompts) {
    for (const dependencyStem of prompt.dependsOn) {
      if (!promptByStem.has(dependencyStem)) {
        continue;
      }

      adjacency.get(dependencyStem)?.push(prompt.stem);
    }
  }

  for (const dependents of adjacency.values()) {
    dependents.sort();
  }

  return adjacency;
}

export function detectPromptCycle(meta: WorkpackMeta): string[] | null {
  const adjacency = buildAdjacency(meta);
  const orderedStems = [...adjacency.keys()].sort();
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  const visit = (stem: string): string[] | null => {
    visited.add(stem);
    inStack.add(stem);
    stack.push(stem);

    for (const dependentStem of adjacency.get(stem) ?? []) {
      if (!visited.has(dependentStem)) {
        const cycle = visit(dependentStem);
        if (cycle) {
          return cycle;
        }

        continue;
      }

      if (!inStack.has(dependentStem)) {
        continue;
      }

      const cycleStart = stack.indexOf(dependentStem);
      if (cycleStart < 0) {
        continue;
      }

      return [...stack.slice(cycleStart), dependentStem];
    }

    stack.pop();
    inStack.delete(stem);
    return null;
  };

  for (const stem of orderedStems) {
    if (visited.has(stem)) {
      continue;
    }

    const cycle = visit(stem);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

export function topologicalSortPrompts(meta: WorkpackMeta): PromptEntry[] {
  const promptByStem = buildPromptMap(meta);
  const adjacency = buildAdjacency(meta);
  const inDegree = new Map<string, number>();

  for (const prompt of meta.prompts) {
    inDegree.set(prompt.stem, 0);
  }

  for (const prompt of meta.prompts) {
    for (const dependencyStem of prompt.dependsOn) {
      if (!promptByStem.has(dependencyStem)) {
        continue;
      }

      inDegree.set(prompt.stem, (inDegree.get(prompt.stem) ?? 0) + 1);
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([stem]) => stem)
    .sort();
  const orderedStems: string[] = [];

  while (queue.length > 0) {
    const stem = queue.shift();
    if (!stem) {
      continue;
    }

    orderedStems.push(stem);

    for (const dependentStem of adjacency.get(stem) ?? []) {
      const nextInDegree = (inDegree.get(dependentStem) ?? 0) - 1;
      inDegree.set(dependentStem, nextInDegree);

      if (nextInDegree === 0) {
        queue.push(dependentStem);
        queue.sort();
      }
    }
  }

  if (orderedStems.length !== meta.prompts.length) {
    const cycle = detectPromptCycle(meta);
    throw new DagCycleError(cycle ?? []);
  }

  return orderedStems
    .map((stem) => promptByStem.get(stem))
    .filter((prompt): prompt is PromptEntry => prompt !== undefined);
}

export function getReadyPrompts(meta: WorkpackMeta, state: WorkpackState): PromptEntry[] {
  const promptByStem = buildPromptMap(meta);
  const completedPrompts = new Set(
    Object.entries(state.promptStatus)
      .filter(([, promptState]) => promptState.status === COMPLETE_STATUS)
      .map(([stem]) => stem)
  );

  return topologicalSortPrompts(meta).filter((prompt) => {
    const currentStatus = state.promptStatus[prompt.stem]?.status ?? "pending";
    const alreadyHandled =
      currentStatus === "complete" ||
      currentStatus === "in_progress" ||
      currentStatus === "skipped" ||
      currentStatus === "blocked";
    if (alreadyHandled) {
      return false;
    }

    return prompt.dependsOn.every(
      (dependencyStem) => promptByStem.has(dependencyStem) && completedPrompts.has(dependencyStem)
    );
  });
}

export function getReadyPromptStems(meta: WorkpackMeta, state: WorkpackState): string[] {
  return getReadyPrompts(meta, state).map((prompt) => prompt.stem);
}
