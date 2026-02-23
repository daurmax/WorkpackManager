import type { WorkpackMeta, WorkpackProtocolVersion } from "./workpack-meta";
import type { WorkpackState } from "./workpack-state";

/**
 * Source used to register or discover a workpack in the extension.
 */
export type DiscoverySource = "auto" | "manual";

/**
 * Protocol version surfaced by discovery/parsing.
 *
 * Schema-aligned metadata uses semver. Legacy markdown fallback may report `5`.
 */
export type DiscoveredProtocolVersion = "5" | WorkpackProtocolVersion;

/**
 * In-memory representation of a discovered workpack folder.
 */
export interface WorkpackInstance {
  /**
   * Absolute filesystem path to the workpack folder.
   */
  folderPath: string;

  /**
   * Parsed workpack metadata.
   */
  meta: WorkpackMeta;

  /**
   * Parsed runtime state, or null when unavailable (for example, legacy mode).
   */
  state: WorkpackState | null;

  /**
   * Protocol version assigned during parsing/discovery.
   */
  protocolVersion: DiscoveredProtocolVersion;

  /**
   * Whether this instance came from workspace scan or manual registration.
   */
  discoverySource: DiscoverySource;
}
