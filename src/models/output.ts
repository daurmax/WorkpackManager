/**
 * Delivery mode values accepted by output payloads.
 */
export type OutputDeliveryMode = "pr" | "direct_push";

/**
 * Command verification result values.
 */
export type VerificationResult = "pass" | "fail" | "not_run";

/**
 * Severity classification for bugfix/verification prompts.
 */
export type OutputSeverity = "blocker" | "major" | "minor" | null;

/**
 * Per-file change action values.
 */
export type ChangeAction = "created" | "modified" | "deleted" | "renamed";

/**
 * Branch metadata for prompt delivery.
 */
export interface OutputBranch {
  /**
   * Baseline branch before work begins.
   */
  base: string;

  /**
   * Branch where prompt changes were implemented.
   */
  work: string;

  /**
   * Branch targeted for merge.
   */
  mergeTarget: string;
}

/**
 * Optional links and identifiers for external delivery artifacts.
 *
 * Additional keys are allowed by schema for future extension.
 */
export interface OutputArtifacts {
  /**
   * Pull request URL when applicable; may be an empty string.
   */
  prUrl?: string;

  /**
   * Commit SHAs produced for this prompt.
   */
  commitShas?: string[];

  /**
   * Future artifact properties.
   */
  [key: string]: unknown;
}

/**
 * Aggregate changed-file summary.
 */
export interface OutputChanges {
  /**
   * Modified files.
   */
  filesModified: string[];

  /**
   * Newly created files.
   */
  filesCreated: string[];

  /**
   * Contract/schema/API artifacts changed by this prompt.
   */
  contractsChanged: string[];

  /**
   * Whether this prompt introduced a breaking change.
   */
  breakingChange: boolean;
}

/**
 * Single verification command outcome.
 */
export interface VerificationCommand {
  /**
   * Executed command string.
   */
  cmd: string;

  /**
   * Command execution result.
   */
  result: VerificationResult;

  /**
   * Optional command-specific notes.
   */
  notes?: string;
}

/**
 * Verification summary for this prompt execution.
 */
export interface OutputVerification {
  /**
   * Commands run (or intentionally skipped) during verification.
   */
  commands: VerificationCommand[];

  /**
   * Indicates if regression tests were added.
   */
  regressionAdded?: boolean;

  /**
   * Optional notes describing regression coverage.
   */
  regressionNotes?: string;
}

/**
 * Human handoff content for downstream prompts/reviewers.
 */
export interface OutputHandoff {
  /**
   * Concise summary of completed work.
   */
  summary: string;

  /**
   * Recommended immediate next steps.
   */
  nextSteps: string[];

  /**
   * Known issues left unresolved by this prompt.
   */
  knownIssues: string[];
}

/**
 * Execution and token usage metrics.
 */
export interface OutputExecution {
  /**
   * Model identifier used to produce the output.
   */
  model: string;

  /**
   * Input tokens consumed.
   */
  tokensIn: number;

  /**
   * Output tokens generated.
   */
  tokensOut: number;

  /**
   * End-to-end execution duration in milliseconds.
   */
  durationMs: number;
}

/**
 * Structured per-file change details.
 */
export interface OutputChangeDetail {
  /**
   * Repository containing the changed file.
   */
  repo: string;

  /**
   * Relative file path.
   */
  file: string;

  /**
   * File-level change action.
   */
  action: ChangeAction;

  /**
   * Number of added lines when available.
   */
  linesAdded?: number;

  /**
   * Number of removed lines when available.
   */
  linesRemoved?: number;
}

/**
 * Structured handoff payload generated after prompt execution.
 */
export interface AgentOutput {
  /**
   * Output schema version (pattern `1.x`).
   */
  schemaVersion: string;

  /**
   * Workpack ID.
   */
  workpack: string;

  /**
   * Prompt stem.
   */
  prompt: string;

  /**
   * Affected component or domain.
   */
  component: string;

  /**
   * Delivery mode used for this execution.
   */
  deliveryMode: OutputDeliveryMode;

  /**
   * Branch metadata.
   */
  branch: OutputBranch;

  /**
   * Optional external artifact links/IDs.
   */
  artifacts?: OutputArtifacts;

  /**
   * Aggregate change summary.
   */
  changes: OutputChanges;

  /**
   * Verification evidence.
   */
  verification: OutputVerification;

  /**
   * Human handoff details.
   */
  handoff: OutputHandoff;

  /**
   * Repositories touched by this prompt.
   */
  repos: string[];

  /**
   * Execution and usage metrics.
   */
  execution: OutputExecution;

  /**
   * Optional severity label.
   */
  severity?: OutputSeverity;

  /**
   * Optional current iteration number (1-based).
   */
  iteration?: number;

  /**
   * Resolved B-series bug IDs.
   */
  bSeriesResolved?: string[];

  /**
   * Remaining B-series bug IDs.
   */
  bSeriesRemaining?: string[];

  /**
   * Indicates budget warning for unresolved B-series issues.
   */
  bSeriesBudgetWarning?: boolean;

  /**
   * Structured per-file change details.
   */
  changeDetails: OutputChangeDetail[];

  /**
   * Optional additional notes.
   */
  notes?: string | null;
}
