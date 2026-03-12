import type { AgentRunSnapshot, AgentRunStatus } from "../../agents/execution-registry";
import {
  AvatarAnimationState,
  type AgentAvatar,
  type AvatarFacing,
  type PromptDesk,
  type RoomStation,
} from "../../models/pixel-office";

const AVATAR_WIDTH = 24;
const AVATAR_HEIGHT = 32;
const BOARD_SLOT_COLUMNS = 3;
const BOARD_SLOT_HORIZONTAL_GAP = 8;
const BOARD_SLOT_VERTICAL_STEP = 10;
const BOARD_SLOT_LEFT_PADDING = 14;
const BOARD_SLOT_BOTTOM_PADDING = 14;
const LEAVING_REMOVAL_MS = 220;

export const AVATAR_COMPLETION_TRAVEL_MS = 550;
export const AVATAR_COMPLETION_LINGER_MS = 1_800;
export const AVATAR_FAILURE_LINGER_MS = 4_500;
export const AVATAR_CANCELLED_LINGER_MS = 1_200;

export interface AvatarTransitionPlan {
  avatar: AgentAvatar;
  from?: AvatarAnimationState;
  removeAfterMs?: number;
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getCompletionElapsedMs(run: AgentRunSnapshot, generatedAt: string): number | undefined {
  const completedAt = parseTimestamp(run.completedAt);
  const generatedAtMs = parseTimestamp(generatedAt);

  if (completedAt === undefined || generatedAtMs === undefined) {
    return undefined;
  }

  return Math.max(0, generatedAtMs - completedAt);
}

function getAvatarId(runId: string): string {
  return `avatar:${runId}`;
}

function getDeskAvatarPosition(desk: PromptDesk): AgentAvatar["position"] {
  const x = desk.position.x + Math.round((desk.dimensions.width - AVATAR_WIDTH) / 2);
  const y = desk.position.y + desk.dimensions.height - AVATAR_HEIGHT - 6;

  return {
    x,
    y,
    z: y + AVATAR_HEIGHT,
  };
}

function getBoardAvatarPosition(outputBoard: RoomStation, promptIndex: number): AgentAvatar["position"] {
  const column = promptIndex % BOARD_SLOT_COLUMNS;
  const row = Math.floor(promptIndex / BOARD_SLOT_COLUMNS);
  const x = outputBoard.position.x + BOARD_SLOT_LEFT_PADDING + (column * (AVATAR_WIDTH + BOARD_SLOT_HORIZONTAL_GAP));
  const y = outputBoard.position.y + outputBoard.dimensions.height - AVATAR_HEIGHT - BOARD_SLOT_BOTTOM_PADDING - (row * BOARD_SLOT_VERTICAL_STEP);

  return {
    x,
    y,
    z: y + AVATAR_HEIGHT,
  };
}

function getDeskFacing(): AvatarFacing {
  return "up";
}

function getBoardFacing(desk: PromptDesk, outputBoard: RoomStation): AvatarFacing {
  return outputBoard.position.x >= desk.position.x ? "right" : "left";
}

function getLeavingFacing(): AvatarFacing {
  return "left";
}

function isAvatarVisible(run: AgentRunSnapshot, generatedAt: string): boolean {
  if (run.status === "queued" || run.status === "in_progress" || run.status === "human_input_required") {
    return true;
  }

  const elapsed = getCompletionElapsedMs(run, generatedAt);
  if (elapsed === undefined) {
    return run.status !== "cancelled";
  }

  if (run.status === "complete") {
    return elapsed <= AVATAR_COMPLETION_TRAVEL_MS + AVATAR_COMPLETION_LINGER_MS;
  }

  if (run.status === "failed") {
    return elapsed <= AVATAR_FAILURE_LINGER_MS;
  }

  return elapsed <= AVATAR_CANCELLED_LINGER_MS;
}

function getAvatarAnimationState(run: AgentRunSnapshot, generatedAt: string): AvatarAnimationState {
  if (run.status === "queued") {
    return AvatarAnimationState.Idle;
  }

  if (run.status === "in_progress") {
    return AvatarAnimationState.Working;
  }

  if (run.status === "human_input_required") {
    return AvatarAnimationState.HandRaised;
  }

  if (run.status === "complete") {
    const elapsed = getCompletionElapsedMs(run, generatedAt) ?? (AVATAR_COMPLETION_TRAVEL_MS + 1);
    return elapsed < AVATAR_COMPLETION_TRAVEL_MS
      ? AvatarAnimationState.WalkingToBoard
      : AvatarAnimationState.PinningOutput;
  }

  if (run.status === "cancelled") {
    return AvatarAnimationState.Leaving;
  }

  return AvatarAnimationState.Idle;
}

function arePositionsEqual(left: AgentAvatar["position"], right: AgentAvatar["position"]): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function needsTransition(previous: AgentAvatar, next: AgentAvatar): boolean {
  return (
    previous.animationState !== next.animationState ||
    previous.facing !== next.facing ||
    previous.currentDeskId !== next.currentDeskId ||
    previous.currentStationId !== next.currentStationId ||
    previous.providerId !== next.providerId ||
    previous.run.status !== next.run.status ||
    !arePositionsEqual(previous.position, next.position)
  );
}

export function mapRunStatusToAvatarState(status: AgentRunStatus): AvatarAnimationState {
  if (status === "queued") {
    return AvatarAnimationState.Idle;
  }

  if (status === "in_progress") {
    return AvatarAnimationState.Working;
  }

  if (status === "human_input_required") {
    return AvatarAnimationState.HandRaised;
  }

  if (status === "complete") {
    return AvatarAnimationState.WalkingToBoard;
  }

  if (status === "cancelled") {
    return AvatarAnimationState.Leaving;
  }

  return AvatarAnimationState.Idle;
}

export function buildAgentAvatars(
  desks: readonly PromptDesk[],
  outputBoard: RoomStation | undefined,
  latestRunsByPrompt: ReadonlyMap<string, AgentRunSnapshot>,
  generatedAt: string,
): AgentAvatar[] {
  return desks.flatMap((desk, promptIndex) => {
    const run = latestRunsByPrompt.get(desk.promptStem);
    if (!run || !isAvatarVisible(run, generatedAt)) {
      return [];
    }

    const animationState = getAvatarAnimationState(run, generatedAt);
    const isBoardState = outputBoard && (run.status === "complete");
    const position = isBoardState ? getBoardAvatarPosition(outputBoard, promptIndex) : getDeskAvatarPosition(desk);
    const facing = run.status === "cancelled"
      ? getLeavingFacing()
      : isBoardState && outputBoard
        ? getBoardFacing(desk, outputBoard)
        : getDeskFacing();

    return [
      {
        id: getAvatarId(run.runId),
        runId: run.runId,
        providerId: run.providerId,
        promptStem: run.promptStem,
        currentDeskId: isBoardState ? undefined : desk.id,
        currentStationId: isBoardState && outputBoard ? outputBoard.id : undefined,
        position,
        facing,
        animationState,
        run,
      },
    ];
  });
}

export function deriveAvatarTransitions(
  previousAvatars: readonly AgentAvatar[],
  nextAvatars: readonly AgentAvatar[],
): AvatarTransitionPlan[] {
  const transitions: AvatarTransitionPlan[] = [];
  const previousById = new Map(previousAvatars.map((avatar) => [avatar.id, avatar]));
  const nextById = new Map(nextAvatars.map((avatar) => [avatar.id, avatar]));

  for (const nextAvatar of nextAvatars) {
    const previousAvatar = previousById.get(nextAvatar.id);
    if (!previousAvatar) {
      transitions.push({
        avatar: nextAvatar,
      });
      continue;
    }

    if (!needsTransition(previousAvatar, nextAvatar)) {
      continue;
    }

    transitions.push({
      avatar: nextAvatar,
      from: previousAvatar.animationState,
    });
  }

  for (const previousAvatar of previousAvatars) {
    if (nextById.has(previousAvatar.id)) {
      continue;
    }

    transitions.push({
      avatar: {
        ...previousAvatar,
        animationState: AvatarAnimationState.Leaving,
        facing: getLeavingFacing(),
      },
      from: previousAvatar.animationState,
      removeAfterMs: LEAVING_REMOVAL_MS,
    });
  }

  return transitions;
}
