/**
 * Workpack-level lifecycle status values.
 */
export type OverallStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "review"
  | "complete"
  | "abandoned";

/**
 * Prompt-level runtime status values.
 */
export type PromptStatusValue = "pending" | "in_progress" | "complete" | "blocked" | "skipped";

/**
 * Execution log event values.
 */
export type ExecutionEvent =
  | "created"
  | "started"
  | "prompt_started"
  | "prompt_completed"
  | "blocked"
  | "unblocked"
  | "review"
  | "completed"
  | "abandoned";

/**
 * Per-prompt runtime state from `workpack.state.json.prompt_status`.
 */
export interface PromptStatus {
  /**
   * Current prompt runtime status.
   */
  status: PromptStatusValue;

  /**
   * Agent assigned specifically to this prompt at runtime.
   */
  assignedAgent?: string;

  /**
   * Prompt start timestamp (`date-time`) or null.
   */
  startedAt?: string | null;

  /**
   * Prompt completion timestamp (`date-time`) or null.
   */
  completedAt?: string | null;

  /**
   * Whether output artifacts were validated for this prompt.
   */
  outputValidated?: boolean;

  /**
   * Reason for blocked status.
   */
  blockedReason?: string | null;
}

/**
 * Append-only audit log entry from `workpack.state.json.execution_log`.
 */
export interface ExecutionLogEntry {
  /**
   * Timestamp of the recorded event (`date-time`).
   */
  timestamp: string;

  /**
   * Lifecycle event identifier.
   */
  event: ExecutionEvent;

  /**
   * Prompt stem related to the event, when applicable.
   */
  promptStem?: string | null;

  /**
   * Agent identifier associated with the event, when available.
   */
  agent?: string | null;

  /**
   * Optional human-readable event notes.
   */
  notes?: string | null;
}

/**
 * Mutable runtime state for a workpack instance.
 */
export interface WorkpackState {
  /**
   * Workpack identifier; must match `workpack.meta.json.id`.
   */
  workpackId: string;

  /**
   * Overall lifecycle status for the workpack.
   */
  overallStatus: OverallStatus;

  /**
   * Last state mutation timestamp (`date-time`).
   */
  lastUpdated: string;

  /**
   * Per-prompt runtime state keyed by prompt stem.
   */
  promptStatus: Record<string, PromptStatus>;

  /**
   * Default agent assignments keyed by prompt stem.
   */
  agentAssignments: Record<string, string>;

  /**
   * Blocking workpack IDs unresolved for this workpack.
   */
  blockedBy: string[];

  /**
   * Append-only audit log of runtime lifecycle events.
   */
  executionLog: ExecutionLogEntry[];

  /**
   * Optional free-form runtime notes.
   */
  notes?: string | null;
}
