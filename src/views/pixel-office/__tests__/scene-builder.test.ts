import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "vitest";
import type { AgentRunSnapshot } from "../../../agents/execution-registry";
import type { WorkpackInstance } from "../../../models";
import { createPixelRoomLayout } from "../room-layout";
import { buildPixelOfficeSceneState } from "../scene-builder";

const tempFolders: string[] = [];

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

async function createWorkpackFixture(promptCount: number): Promise<WorkpackInstance> {
  const folderPath = await mkdtemp(path.join(os.tmpdir(), "pixel-room-scene-"));
  tempFolders.push(folderPath);

  await mkdir(path.join(folderPath, "prompts"), { recursive: true });
  await mkdir(path.join(folderPath, "outputs"), { recursive: true });
  await writeFile(path.join(folderPath, "outputs", "A1_prompt_1.json"), JSON.stringify({ prompt: "A1_prompt_1" }, null, 2));

  const prompts = Array.from({ length: promptCount }, (_, index) => {
    const stem = `A${index + 1}_prompt_${index + 1}`;
    return {
      stem,
      agentRole: `Role ${index + 1}`,
      dependsOn: index === 0 ? [] : [`A${index}_prompt_${index}`],
      repos: ["WorkpackManager"],
      estimatedEffort: "S" as const,
    };
  });

  for (const prompt of prompts) {
    await writeFile(path.join(folderPath, "prompts", `${prompt.stem}.md`), `# ${prompt.stem}\n`);
  }

  return {
    folderPath,
    protocolVersion: "3.0.0",
    discoverySource: "auto",
    sourceProject: "WorkpackManager",
    meta: {
      id: "pixel-room-scene",
      title: "Pixel Room Scene",
      summary: "Fixture for pixel room scene building",
      protocolVersion: "3.0.0",
      workpackVersion: "1.0.0",
      category: "feature",
      createdAt: "2026-03-12",
      requiresWorkpack: [],
      tags: ["pixel"],
      owners: [],
      repos: ["WorkpackManager"],
      deliveryMode: "pr",
      targetBranch: "master",
      prompts,
    },
    state: {
      workpackId: "pixel-room-scene",
      overallStatus: "in_progress",
      lastUpdated: "2026-03-12T10:43:56Z",
      promptStatus: Object.fromEntries(
        prompts.map((prompt, index) => [
          prompt.stem,
          {
            status: index === 0 ? "complete" : index === 1 ? "in_progress" : "pending",
            assignedAgent: index === 1 ? "codex" : undefined,
          },
        ]),
      ),
      agentAssignments: {
        [prompts[1]?.stem ?? ""]: "codex",
      },
      blockedBy: [],
      executionLog: [],
    },
  };
}

afterEach(async () => {
  while (tempFolders.length > 0) {
    const folderPath = tempFolders.pop();
    if (!folderPath) {
      continue;
    }

    await rm(folderPath, { recursive: true, force: true });
  }
});

describe("pixel office scene builder", () => {
  it("creates non-overlapping desk frames within the room bounds", () => {
    const layout = createPixelRoomLayout(12);

    assert.equal(layout.desks.length, 12);
    assert.ok(layout.dimensions.width >= 760);
    assert.ok(layout.dimensions.height >= 560);

    for (const desk of layout.desks) {
      assert.ok(desk.position.x >= 0);
      assert.ok(desk.position.y >= 0);
      assert.ok(desk.position.x + desk.dimensions.width <= layout.dimensions.width);
      assert.ok(desk.position.y + desk.dimensions.height <= layout.dimensions.height);
    }

    for (let index = 0; index < layout.desks.length; index += 1) {
      const current = layout.desks[index];
      const currentRect = {
        x: current.position.x,
        y: current.position.y,
        width: current.dimensions.width,
        height: current.dimensions.height,
      };

      for (let compareIndex = index + 1; compareIndex < layout.desks.length; compareIndex += 1) {
        const compare = layout.desks[compareIndex];
        const compareRect = {
          x: compare.position.x,
          y: compare.position.y,
          width: compare.dimensions.width,
          height: compare.dimensions.height,
        };
        assert.equal(rectanglesOverlap(currentRect, compareRect), false);
      }
    }
  });

  it("maps workpack prompts, stations, outputs, and runtime runs into a scene", async () => {
    const workpack = await createWorkpackFixture(4);
    const runtimeRuns: AgentRunSnapshot[] = [
      {
        runId: "run-1",
        workpackId: workpack.meta.id,
        promptStem: "A2_prompt_2",
        providerId: "codex",
        status: "in_progress",
        startedAt: "2026-03-12T10:44:00Z",
        updatedAt: "2026-03-12T10:44:30Z",
      },
    ];

    const scene = buildPixelOfficeSceneState(workpack, {
      generatedAt: "2026-03-12T10:45:00Z",
      runtimeRuns,
    });

    assert.equal(scene.version, 1);
    assert.equal(scene.generatedAt, "2026-03-12T10:45:00Z");
    assert.equal(scene.room.stations.map((station) => station.label).join(","), "00_request.md,01_plan.md,99_status.md,outputs");
    assert.equal(scene.room.desks.length, 4);
    assert.equal(scene.room.avatars.length, 0);

    const runtimeDesk = scene.room.desks.find((desk) => desk.promptStem === "A2_prompt_2");
    assert.ok(runtimeDesk);
    assert.equal(runtimeDesk?.status, "in_progress");
    assert.equal(runtimeDesk?.assignedAgentId, "codex");
    assert.equal(runtimeDesk?.latestRunId, "run-1");

    const outputDesk = scene.room.desks.find((desk) => desk.promptStem === "A1_prompt_1");
    assert.ok(outputDesk?.outputPath?.endsWith(path.join("outputs", "A1_prompt_1.json")));

    const outputBoard = scene.room.stations.find((station) => station.kind === "output_board");
    assert.equal(outputBoard?.badgeText, "1 artifact");
  });
});
