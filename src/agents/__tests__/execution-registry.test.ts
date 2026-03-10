import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { ExecutionRegistry } from "../execution-registry";

describe("execution registry", () => {
  it("tracks latest runs and active runs", () => {
    const registry = new ExecutionRegistry();
    const abortController = new AbortController();

    const firstRun = registry.startRun({
      workpackId: "wp-demo",
      promptStem: "A0_bootstrap",
      providerId: "codex",
      status: "in_progress",
      abortController,
    });

    assert.equal(registry.listActiveRuns().length, 1);
    assert.equal(registry.getLatestRunForPrompt("wp-demo", "A0_bootstrap")?.runId, firstRun.runId);

    registry.updateRun(firstRun.runId, {
      status: "complete",
      summary: "done",
    });

    assert.equal(registry.listActiveRuns().length, 0);
    assert.equal(registry.getRun(firstRun.runId)?.status, "complete");
    assert.equal(registry.getRun(firstRun.runId)?.summary, "done");
  });

  it("stops active runs through their abort controller", () => {
    const registry = new ExecutionRegistry();
    const abortController = new AbortController();
    const run = registry.startRun({
      workpackId: "wp-demo",
      promptStem: "A1_execute",
      providerId: "copilot",
      status: "in_progress",
      abortController,
    });

    const stopped = registry.stopRun(run.runId);

    assert.equal(stopped, true);
    assert.equal(abortController.signal.aborted, true);
    assert.equal(registry.getRun(run.runId)?.status, "cancelled");
  });

  it("submits human input through the registered handler", async () => {
    const registry = new ExecutionRegistry();
    let receivedInput: string | undefined;
    const run = registry.startRun({
      workpackId: "wp-demo",
      promptStem: "A2_review",
      status: "human_input_required",
      inputRequest: "Approve?",
      humanInputHandler: async (input) => {
        receivedInput = input;
      }
    });

    const submitted = await registry.submitHumanInput(run.runId, "yes");

    assert.equal(submitted, true);
    assert.equal(receivedInput, "yes");
    assert.equal(registry.getRun(run.runId)?.status, "queued");
  });
});
