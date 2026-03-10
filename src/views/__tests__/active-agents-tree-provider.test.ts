import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { ExecutionRegistry } from "../../agents/execution-registry";
import { ActiveAgentsTreeProvider } from "../active-agents-tree-provider";

describe("active agents tree provider", () => {
  it("lists only active runs", async () => {
    const registry = new ExecutionRegistry();
    const provider = new ActiveAgentsTreeProvider(registry);

    const running = registry.startRun({
      workpackId: "wp-demo",
      promptStem: "A0_bootstrap",
      providerId: "codex",
      status: "in_progress",
    });
    const completed = registry.startRun({
      workpackId: "wp-demo",
      promptStem: "A1_followup",
      providerId: "copilot",
      status: "queued",
    });
    registry.updateRun(completed.runId, { status: "complete" });

    const items = await provider.getChildren();

    assert.equal(items.length, 1);
    assert.equal(items[0].run.runId, running.runId);
    assert.equal(items[0].label, "A0_bootstrap");
    assert.equal(items[0].contextValue, "activeAgent.inProgress");
  });
});
