import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, test } from "node:test";
import type { WorkpackInstance, WorkpackMeta, WorkpackState } from "../../models";
import { scanOutputs } from "../../state/output-scanner";
import { reconcile } from "../../state/reconciliation-engine";
import { parseStatusMarkdown } from "../../state/status-markdown-parser";

const tempDirs: string[] = [];

const baseMeta: WorkpackMeta = {
  id: "reconciliation-fixture",
  title: "Reconciliation Fixture",
  summary: "Fixture used to verify reconciliation behavior.",
  protocolVersion: "2.0.0",
  workpackVersion: "1.0.0",
  category: "feature",
  createdAt: "2026-02-23",
  requiresWorkpack: [],
  tags: [],
  owners: [],
  repos: ["WorkpackManager"],
  deliveryMode: "pr",
  targetBranch: "main",
  prompts: [],
};

function buildState(overrides?: Partial<WorkpackState>): WorkpackState {
  return {
    workpackId: "reconciliation-fixture",
    overallStatus: "in_progress",
    lastUpdated: "2026-02-23T00:00:00Z",
    promptStatus: {
      A1_test_prompt: { status: "pending" },
    },
    agentAssignments: {},
    blockedBy: [],
    executionLog: [],
    ...overrides,
  };
}

function createFixture(options?: {
  state?: WorkpackState;
  statusMarkdown?: string;
  outputs?: Record<string, string>;
}): WorkpackInstance {
  const folderPath = mkdtempSync(path.join(os.tmpdir(), "reconciliation-"));
  tempDirs.push(folderPath);

  mkdirSync(path.join(folderPath, "outputs"), { recursive: true });

  const statusMarkdown = options?.statusMarkdown ?? "# Status\n";
  writeFileSync(path.join(folderPath, "99_status.md"), statusMarkdown, "utf8");

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
    discoverySource: "manual",
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const target = tempDirs.pop();
    if (target) {
      rmSync(target, { recursive: true, force: true });
    }
  }
});

describe("reconciliation", () => {
  test("parses all supported completion markers from status markdown", () => {
    const markdown = [
      "| A1_alpha | ✅ Complete |",
      "| A2_alpha | 🟢 Done |",
      "| A3_alpha | ✅ Applied |",
      "| A4_alpha | ✅ Completed |",
      "| B1_fix | ✅ Fixed |",
      "| B2_fix | ✅ Resolved |",
      "| V1_verify | ✅ Passed |",
      "| R1_retro | 🟢 Complete |",
    ].join("\n");

    const parsed = parseStatusMarkdown(markdown);
    const expected = [
      "A1_alpha",
      "A2_alpha",
      "A3_alpha",
      "A4_alpha",
      "B1_fix",
      "B2_fix",
      "V1_verify",
      "R1_retro",
    ];

    for (const promptStem of expected) {
      assert.equal(parsed.completedPromptStems.has(promptStem), true);
    }
  });

  test("maps output files to prompt stems and validates JSON", () => {
    const instance = createFixture({
      outputs: {
        "A1_test_prompt.json": JSON.stringify({ prompt: "A1_test_prompt" }),
        "A2_other_prompt.json": "{invalid-json",
      },
    });

    const scan = scanOutputs(path.join(instance.folderPath, "outputs"));
    assert.equal(scan.outputByPrompt.has("A1_test_prompt"), true);
    assert.equal(scan.outputByPrompt.has("A2_other_prompt"), true);
    assert.equal(scan.outputByPrompt.get("A1_test_prompt")?.isValidJson, true);
    assert.equal(scan.outputByPrompt.get("A2_other_prompt")?.isValidJson, false);
  });

  test("reports error when state says complete but output JSON is missing", () => {
    const state = buildState({
      promptStatus: {
        A1_test_prompt: { status: "complete" },
      },
    });
    const instance = createFixture({ state });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "inconsistent");
    assert.equal(
      report.drifts.some(
        (drift) =>
          drift.promptStem === "A1_test_prompt" &&
          drift.field === "outputs/<PROMPT>.json" &&
          drift.severity === "error",
      ),
      true,
    );
  });

  test("reports warning when state is pending but output JSON exists", () => {
    const instance = createFixture({
      outputs: {
        "A1_test_prompt.json": JSON.stringify({ prompt: "A1_test_prompt" }),
      },
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      report.drifts.some(
        (drift) =>
          drift.promptStem === "A1_test_prompt" &&
          drift.field === "outputs/<PROMPT>.json" &&
          drift.severity === "warning",
      ),
      true,
    );
  });

  test("reports warning when status markdown says complete but state is pending", () => {
    const instance = createFixture({
      statusMarkdown: "| A1_test_prompt | ✅ Complete |",
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      report.drifts.some(
        (drift) =>
          drift.promptStem === "A1_test_prompt" &&
          drift.field === "99_status.md" &&
          drift.severity === "warning",
      ),
      true,
    );
  });

  test("reports warning when overallStatus conflicts with prompt statuses", () => {
    const state = buildState({
      overallStatus: "complete",
      promptStatus: {
        A1_test_prompt: { status: "pending" },
      },
    });
    const instance = createFixture({ state });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      report.drifts.some(
        (drift) =>
          drift.promptStem === "*" &&
          drift.field === "workpack.state.json.overallStatus" &&
          drift.severity === "warning",
      ),
      true,
    );
  });
});
