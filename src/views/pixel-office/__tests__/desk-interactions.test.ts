import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "vitest";
import type { AgentRunSnapshot } from "../../../agents/execution-registry";
import { buildDeskPreview, getDeskActionItems, isDeskActionAllowed } from "../desk-interactions";

const tempFolders: string[] = [];

afterEach(async () => {
  while (tempFolders.length > 0) {
    const folderPath = tempFolders.pop();
    if (!folderPath) {
      continue;
    }

    await rm(folderPath, { recursive: true, force: true });
  }
});

describe("desk interaction helpers", () => {
  it("matches room actions to the prompt runtime status rules", () => {
    assert.deepEqual(
      getDeskActionItems({
        status: "pending",
        promptRole: "Draft the change",
      }).map((action) => action.action),
      [],
    );

    assert.deepEqual(
      getDeskActionItems({
        status: "pending",
        promptRole: "Draft the change",
        assignedAgentId: "codex",
      }).map((action) => action.action),
      ["execute"],
    );

    assert.deepEqual(
      getDeskActionItems({
        status: "human_input_required",
        promptRole: "Draft the change",
        assignedAgentId: "codex",
      }).map((action) => action.action),
      ["provide_input", "stop"],
    );

    assert.deepEqual(
      getDeskActionItems({
        status: "failed",
        promptRole: "Draft the change",
        assignedAgentId: "codex",
      }).map((action) => action.action),
      ["retry"],
    );

    assert.deepEqual(
      getDeskActionItems({
        status: "complete",
        promptRole: "Draft the change",
        outputPath: "C:/temp/output.json",
      }).map((action) => action.action),
      ["open_output"],
    );
  });

  it("validates individual room actions against the same rule set", () => {
    const state = {
      status: "human_input_required" as const,
      promptRole: "Need a human answer",
      assignedAgentId: "codex",
    };

    assert.equal(isDeskActionAllowed(state, "provide_input"), true);
    assert.equal(isDeskActionAllowed(state, "stop"), true);
    assert.equal(isDeskActionAllowed(state, "execute"), false);
  });

  it("builds preview text from runtime data before falling back to output excerpts and prompt role", async () => {
    const runtimeRun: AgentRunSnapshot = {
      runId: "run-1",
      workpackId: "wp-preview",
      promptStem: "A3_preview",
      providerId: "codex",
      status: "human_input_required",
      startedAt: "2026-03-12T12:00:00Z",
      updatedAt: "2026-03-12T12:05:00Z",
      inputRequest: "Need approval to continue.",
    };

    const runtimePreview = buildDeskPreview({
      status: "human_input_required",
      promptRole: "Gather approval and continue the run",
      assignedAgentId: "codex",
      providerDisplayName: "Codex",
      latestRun: runtimeRun,
    });

    assert.equal(runtimePreview.providerLabel, "Codex");
    assert.equal(runtimePreview.statusLabel, "Human Input Required");
    assert.equal(runtimePreview.excerpt, "Need approval to continue.");
    assert.equal(runtimePreview.excerptSource, "input_request");
    assert.equal(runtimePreview.links[0]?.action, "open_prompt");

    const tempFolder = await mkdtemp(path.join(os.tmpdir(), "desk-preview-"));
    tempFolders.push(tempFolder);
    const outputPath = path.join(tempFolder, "A3_preview.json");
    await writeFile(
      outputPath,
      JSON.stringify({ prompt: "A3_preview", summary: "Pixel room interaction state persisted." }, null, 2),
      "utf8",
    );

    const outputPreview = buildDeskPreview({
      status: "complete",
      promptRole: "Gather approval and continue the run",
      outputPath,
    });

    assert.equal(outputPreview.excerpt, "Pixel room interaction state persisted.");
    assert.equal(outputPreview.excerptSource, "output");
    assert.equal(outputPreview.links.some((link) => link.action === "open_output"), true);

    const fallbackPreview = buildDeskPreview({
      status: "pending",
      promptRole: "Gather approval and continue the run",
    });

    assert.equal(fallbackPreview.excerpt, "Gather approval and continue the run");
    assert.equal(fallbackPreview.excerptSource, "prompt_role");
  });
});
