import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { AgentRunSnapshot } from "../../../agents/execution-registry";
import {
  AvatarAnimationState,
  type PromptDesk,
  type RoomStation,
} from "../../../models/pixel-office";
import {
  AVATAR_COMPLETION_TRAVEL_MS,
  buildAgentAvatars,
  deriveAvatarTransitions,
  mapRunStatusToAvatarState,
} from "../avatar-runtime";

function createDesk(promptStem: string, x: number): PromptDesk {
  return {
    id: `desk:${promptStem}`,
    promptStem,
    label: promptStem,
    position: { x, y: 176, z: 248 },
    dimensions: { width: 88, height: 72 },
    promptRole: `Role for ${promptStem}`,
    dependsOn: [],
    repos: ["WorkpackManager"],
    status: "pending",
    actions: [],
    preview: {
      providerLabel: "Codex",
      statusLabel: "Pending",
      excerpt: "Preview",
      excerptSource: "prompt_role",
      links: [],
    },
  };
}

function createRun(status: AgentRunSnapshot["status"], overrides: Partial<AgentRunSnapshot> = {}): AgentRunSnapshot {
  return {
    runId: overrides.runId ?? `${status}-run`,
    workpackId: "pixel-room",
    promptStem: overrides.promptStem ?? "A2_agent_animation_runtime",
    providerId: overrides.providerId ?? "codex",
    status,
    startedAt: overrides.startedAt ?? "2026-03-12T11:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-03-12T11:00:10Z",
    completedAt: overrides.completedAt,
    summary: overrides.summary,
    error: overrides.error,
    inputRequest: overrides.inputRequest,
  };
}

describe("avatar runtime", () => {
  it("maps run statuses to animation states", () => {
    assert.equal(mapRunStatusToAvatarState("queued"), AvatarAnimationState.Idle);
    assert.equal(mapRunStatusToAvatarState("in_progress"), AvatarAnimationState.Working);
    assert.equal(mapRunStatusToAvatarState("human_input_required"), AvatarAnimationState.HandRaised);
    assert.equal(mapRunStatusToAvatarState("complete"), AvatarAnimationState.WalkingToBoard);
    assert.equal(mapRunStatusToAvatarState("failed"), AvatarAnimationState.Idle);
    assert.equal(mapRunStatusToAvatarState("cancelled"), AvatarAnimationState.Leaving);
  });

  it("builds desk and board avatars with linger rules", () => {
    const desks = [createDesk("A1_pixel_room_shell", 64), createDesk("A2_agent_animation_runtime", 184)];
    const outputBoard: RoomStation = {
      id: "station:output-board",
      kind: "output_board",
      label: "outputs",
      position: { x: 600, y: 360, z: 472 },
      dimensions: { width: 128, height: 112 },
    };
    const generatedAt = "2026-03-12T11:10:00.000Z";
    const latestRunsByPrompt = new Map<string, AgentRunSnapshot>([
      ["A1_pixel_room_shell", createRun("in_progress", { promptStem: "A1_pixel_room_shell", runId: "run-active" })],
      [
        "A2_agent_animation_runtime",
        createRun("complete", {
          promptStem: "A2_agent_animation_runtime",
          runId: "run-complete",
          completedAt: new Date(Date.parse(generatedAt) - (AVATAR_COMPLETION_TRAVEL_MS - 50)).toISOString(),
        }),
      ],
      [
        "A3_desk_interactions_chat_preview",
        createRun("cancelled", {
          promptStem: "A3_desk_interactions_chat_preview",
          runId: "run-cancelled",
          completedAt: "2026-03-12T10:00:00.000Z",
        }),
      ],
    ]);

    const avatars = buildAgentAvatars(desks, outputBoard, latestRunsByPrompt, generatedAt);

    assert.equal(avatars.length, 2);

    const activeAvatar = avatars.find((avatar) => avatar.promptStem === "A1_pixel_room_shell");
    assert.ok(activeAvatar);
    assert.equal(activeAvatar?.animationState, AvatarAnimationState.Working);
    assert.equal(activeAvatar?.currentDeskId, "desk:A1_pixel_room_shell");
    assert.equal(activeAvatar?.currentStationId, undefined);

    const completedAvatar = avatars.find((avatar) => avatar.promptStem === "A2_agent_animation_runtime");
    assert.ok(completedAvatar);
    assert.equal(completedAvatar?.animationState, AvatarAnimationState.WalkingToBoard);
    assert.equal(completedAvatar?.currentDeskId, undefined);
    assert.equal(completedAvatar?.currentStationId, "station:output-board");
    assert.ok((completedAvatar?.position.x ?? 0) >= outputBoard.position.x);
  });

  it("creates leaving transitions for removed avatars", () => {
    const previous = [
      {
        id: "avatar:run-1",
        runId: "run-1",
        promptStem: "A2_agent_animation_runtime",
        position: { x: 40, y: 50, z: 82 },
        facing: "up" as const,
        animationState: AvatarAnimationState.Working,
        run: createRun("in_progress", { runId: "run-1" }),
      },
    ];

    const transitions = deriveAvatarTransitions(previous, []);

    assert.equal(transitions.length, 1);
    assert.equal(transitions[0]?.from, AvatarAnimationState.Working);
    assert.equal(transitions[0]?.avatar.animationState, AvatarAnimationState.Leaving);
    assert.equal(typeof transitions[0]?.removeAfterMs, "number");
  });
});
