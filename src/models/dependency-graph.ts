/**
 * Node types supported by the dependency graph.
 */
export type DependencyNodeType = "workpack" | "prompt";

/**
 * Edge types for prompt-level and cross-workpack dependencies.
 */
export type DependencyEdgeType =
  | "prompt_depends_on_prompt"
  | "workpack_requires_workpack"
  | "prompt_requires_workpack";

/**
 * Graph node representing a workpack or a specific prompt within a workpack.
 */
export interface DependencyNode {
  /**
   * Stable unique identifier (for example: `workpack:<id>` or `prompt:<id>:<stem>`).
   */
  id: string;

  /**
   * Distinguishes workpack-level and prompt-level nodes.
   */
  nodeType: DependencyNodeType;

  /**
   * Owning workpack identifier.
   */
  workpackId: string;

  /**
   * Prompt stem when `nodeType` is `prompt`.
   */
  promptStem?: string;

  /**
   * Human-readable display label.
   */
  label: string;
}

/**
 * Directed edge between dependency graph nodes.
 */
export interface DependencyEdge {
  /**
   * Source node identifier.
   */
  from: string;

  /**
   * Target node identifier.
   */
  to: string;

  /**
   * Dependency relationship represented by this edge.
   */
  edgeType: DependencyEdgeType;
}

/**
 * Serialized dependency graph payload used by graph and resolver modules.
 */
export interface DependencyGraphData {
  /**
   * All graph nodes.
   */
  nodes: DependencyNode[];

  /**
   * Directed dependency edges between nodes.
   */
  edges: DependencyEdge[];
}

/**
 * Error shape returned when dependency cycles are detected.
 */
export type CycleError = {
  /**
   * Human-readable cycle detection message.
   */
  message: string;

  /**
   * Ordered node ID path that forms the detected cycle.
   */
  cyclePath: string[];
};
