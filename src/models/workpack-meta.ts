/**
 * Workpack category values defined by the workpack metadata schema.
 */
export type WorkpackCategory =
  | "feature"
  | "refactor"
  | "bugfix"
  | "hotfix"
  | "debug"
  | "docs"
  | "perf"
  | "security";

/**
 * Delivery mode values supported by workpack metadata and outputs.
 */
export type DeliveryMode = "pr" | "direct_push";

/**
 * Estimated prompt effort buckets in ascending order.
 */
export type EffortEstimate = "XS" | "S" | "M" | "L" | "XL";

/**
 * Schema-aligned protocol version (`major.minor.patch`).
 */
export type WorkpackProtocolVersion = `${number}.${number}.${number}`;

/**
 * Machine-readable prompt entry used to represent the prompt DAG in metadata.
 */
export interface PromptEntry {
  /**
   * Prompt filename stem without extension (for example: `A1_data_models`).
   */
  stem: string;

  /**
   * Short role description used for assignment/orchestration.
   */
  agentRole: string;

  /**
   * Prompt stems that must complete before this prompt can start.
   */
  dependsOn: string[];

  /**
   * Repository names touched by this prompt.
   */
  repos: string[];

  /**
   * Estimated effort for this prompt.
   */
  estimatedEffort: EffortEstimate;
}

/**
 * Static, version-controlled metadata for a workpack instance.
 */
export interface WorkpackMeta {
  /**
   * Workpack folder identifier.
   */
  id: string;

  /**
   * Optional parent group identifier for grouped workpacks (v6.1+).
   */
  group?: string;

  /**
   * Human-readable workpack title.
   */
  title: string;

  /**
   * Brief objective summary.
   */
  summary: string;

  /**
   * Protocol version implemented by this workpack metadata.
   */
  protocolVersion: WorkpackProtocolVersion;

  /**
   * Semantic version of the workpack content.
   */
  workpackVersion: string;

  /**
   * High-level workpack classification.
   */
  category: WorkpackCategory;

  /**
   * Creation date in `YYYY-MM-DD` format.
   */
  createdAt: string;

  /**
   * Workpack IDs that must complete before this one starts.
   */
  requiresWorkpack: string[];

  /**
   * Free-form indexing tags.
   */
  tags: string[];

  /**
   * Responsible people or teams.
   */
  owners: string[];

  /**
   * Repositories touched by this workpack.
   */
  repos: string[];

  /**
   * Delivery mode used for implementing this workpack.
   */
  deliveryMode: DeliveryMode;

  /**
   * Target branch for merge or direct push.
   */
  targetBranch: string;

  /**
   * Prompt DAG projection for orchestration and indexing.
   */
  prompts: PromptEntry[];
}
