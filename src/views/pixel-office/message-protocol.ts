import type {
  AgentAvatar,
  AvatarAnimationState,
  DeskRuntimeStatus,
  PromptActionKind,
  SceneState,
} from "../../models/pixel-office";

export type SceneUpdateReason = "initial" | "workpack_refresh" | "runtime_refresh" | "selection_change";

export interface SceneUpdate {
  type: "SceneUpdate";
  scene: SceneState;
  reason: SceneUpdateReason;
}

export interface AvatarTransition {
  type: "AvatarTransition";
  avatar: AgentAvatar;
  from?: AvatarAnimationState;
  occurredAt: string;
  removeAfterMs?: number;
}

export interface DeskStatusChange {
  type: "DeskStatusChange";
  deskId: string;
  promptStem: string;
  status: DeskRuntimeStatus;
  assignedAgentId?: string;
  runId?: string;
  occurredAt: string;
}

export type PixelOfficeHostMessage = SceneUpdate | AvatarTransition | DeskStatusChange;

export interface DeskClicked {
  type: "DeskClicked";
  deskId: string;
  promptStem: string;
  button: "primary" | "secondary";
}

export interface DeskHovered {
  type: "DeskHovered";
  deskId: string;
  promptStem: string;
  hovered: boolean;
}

export interface AgentAssignRequested {
  type: "AgentAssignRequested";
  deskId: string;
  promptStem: string;
  providerId: string;
}

export interface PromptActionRequested {
  type: "PromptActionRequested";
  deskId: string;
  promptStem: string;
  action: PromptActionKind;
}

export type PixelOfficeWebviewMessage =
  | DeskClicked
  | DeskHovered
  | AgentAssignRequested
  | PromptActionRequested;
