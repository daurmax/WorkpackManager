import type { AgentRunSnapshot, AgentRunStatus } from "../../agents/execution-registry";
import type { PromptEntry } from "../workpack-meta";
import type { OverallStatus, PromptStatusValue } from "../workpack-state";

export interface PixelCoordinate {
  x: number;
  y: number;
  z?: number;
}

export interface PixelDimensions {
  width: number;
  height: number;
}

export type RoomStationKind = "request" | "plan" | "status" | "output_board";

export type DeskRuntimeStatus = PromptStatusValue | AgentRunStatus | "unassigned";

export type AvatarFacing = "up" | "down" | "left" | "right";

export enum AvatarAnimationState {
  Idle = "idle",
  Working = "working",
  WalkingToBoard = "walking_to_board",
  PinningOutput = "pinning_output",
  HandRaised = "hand_raised",
  Leaving = "leaving",
}

export interface RoomStation {
  id: string;
  kind: RoomStationKind;
  label: string;
  filePath?: string;
  position: PixelCoordinate;
  dimensions: PixelDimensions;
  badgeText?: string;
  isPrimary?: boolean;
}

export interface PromptDesk {
  id: string;
  promptStem: PromptEntry["stem"];
  label: string;
  promptFilePath?: string;
  position: PixelCoordinate;
  dimensions: PixelDimensions;
  promptRole: PromptEntry["agentRole"];
  dependsOn: PromptEntry["dependsOn"];
  repos: PromptEntry["repos"];
  status: DeskRuntimeStatus;
  assignedAgentId?: string;
  latestRunId?: string;
  outputPath?: string;
}

export interface AgentAvatar {
  id: string;
  runId: AgentRunSnapshot["runId"];
  providerId?: AgentRunSnapshot["providerId"];
  promptStem: AgentRunSnapshot["promptStem"];
  currentDeskId?: string;
  currentStationId?: string;
  position: PixelCoordinate;
  facing: AvatarFacing;
  animationState: AvatarAnimationState;
  run: AgentRunSnapshot;
}

export interface PixelRoom {
  id: string;
  workpackId: string;
  title: string;
  folderPath: string;
  overallStatus: OverallStatus | "unknown";
  tileSize: number;
  dimensions: PixelDimensions;
  stations: RoomStation[];
  desks: PromptDesk[];
  avatars: AgentAvatar[];
}

export interface SceneState {
  version: 1;
  generatedAt: string;
  workpackId: string;
  selectedDeskId?: string;
  hoveredDeskId?: string;
  reducedMotion: boolean;
  room: PixelRoom;
}
