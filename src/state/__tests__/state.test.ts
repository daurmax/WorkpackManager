import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, test } from "vitest";
import type { WorkpackInstance, WorkpackMeta, WorkpackState } from "../../models";
import { reconcile } from "../reconciliation-engine";

const tempDirs: string[] = [];

const baseMeta: WorkpackMeta = {
  id: "state-fixture",
  title: "State Fixture",
  summary: "Fixture used to validate reconciliation behavior.",
  protocolVersion: "2.0.0",
  workpackVersion: "1.0.0",
  category: "feature",
  createdAt: "2026-02-26",
  requiresWorkpack: [],
  tags: [],
  owners: [],
  repos: ["WorkpackManager"],
  deliveryMode: "pr",
  targetBranch: "main",
  prompts: []
};

function buildState(overrides?: Partial<WorkpackState>): WorkpackState {
  return {
    workpackId: "state-fixture",
    overallStatus: "in_progress",
    lastUpdated: "2026-02-26T10:00:00Z",
    promptStatus: {
      A1_test_strategy: { status: "pending" }
    },
    agentAssignments: {},
    blockedBy: [],
    executionLog: [],
    ...overrides
  };
}

function createFixture(options?: {
  state?: WorkpackState;
  statusMarkdown?: string;
  outputs?: Record<string, string>;
}): WorkpackInstance {
  const folderPath = mkdtempSync(path.join(os.tmpdir(), "state-reconciliation-"));
  tempDirs.push(folderPath);

  mkdirSync(path.join(folderPath, "outputs"), { recursive: true });

  writeFileSync(path.join(folderPath, "99_status.md"), options?.statusMarkdown ?? "# Status\n", "utf8");

  if (options?.outputs) {
    for (const [fileName, content] of Object.entries(options.outputs)) {
      writeFileSync(path.join(folderPath, "outputs", fileName), content, "utf8");
    }
  }

  return {
    folderPath,
    meta: baseMeta,
    state: options?.state ?? buildState(),
    protocolVersion: "2.0.0",
    discoverySource: "manual"
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const folderPath = tempDirs.pop();
    if (folderPath) {
      rmSync(folderPath, { recursive: true, force: true });
    }
  }
});

describe("state reconciliation", () => {
  test("reports error when prompt is complete but output JSON is missing", () => {
    const instance = createFixture({
      state: buildState({
        promptStatus: {
          A1_test_strategy: { status: "complete" }
        }
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "inconsistent");
    assert.equal(
      report.drifts.some(
        (entry) =>
          entry.promptStem === "A1_test_strategy" &&
          entry.field === "outputs/<PROMPT>.json" &&
          entry.severity === "error"
      ),
      true
    );
  });

  test("reports warning when output exists while prompt is still pending", () => {
    const instance = createFixture({
      outputs: {
        "A1_test_strategy.json": JSON.stringify({ prompt: "A1_test_strategy" })
      }
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      report.drifts.some(
        (entry) =>
          entry.promptStem === "A1_test_strategy" &&
          entry.field === "outputs/<PROMPT>.json" &&
          entry.severity === "warning"
      ),
      true
    );
  });

  test("reports warning when status markdown marks complete but state is pending", () => {
    const instance = createFixture({
      statusMarkdown: "| A1_test_strategy | ✅ Complete |"
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      report.drifts.some(
        (entry) =>
          entry.promptStem === "A1_test_strategy" &&
          entry.field === "99_status.md" &&
          entry.severity === "warning"
      ),
      true
    );
  });
});
