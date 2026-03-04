import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, test, vi } from "vitest";
import type { WorkpackInstance, WorkpackMeta, WorkpackState } from "../../models";
import { scanOutputs } from "../output-scanner";
import { reconcile, type DriftEntry } from "../reconciliation-engine";

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

function createTempDir(prefix: string): string {
  const folderPath = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(folderPath);
  return folderPath;
}

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
  state?: WorkpackState | null;
  statusMarkdown?: string;
  outputs?: Record<string, string>;
}): WorkpackInstance {
  const folderPath = createTempDir("state-reconciliation-");

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
    state: options && "state" in options ? options.state ?? null : buildState(),
    protocolVersion: "2.0.0",
    discoverySource: "manual"
  };
}

function hasDrift(report: ReturnType<typeof reconcile>, expected: Partial<DriftEntry>): boolean {
  return report.drifts.some((drift) =>
    (Object.keys(expected) as (keyof DriftEntry)[]).every((key) => {
      const expectedValue = expected[key];
      return expectedValue === undefined || drift[key] === expectedValue;
    })
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const folderPath = tempDirs.pop();
    if (folderPath) {
      rmSync(folderPath, { recursive: true, force: true });
    }
  }
});

describe("output scanner", () => {
  test("returns empty artifacts when the outputs folder is missing", () => {
    const workspaceDir = createTempDir("state-output-scan-");
    const missingOutputsFolder = path.join(workspaceDir, "outputs");

    const scan = scanOutputs(missingOutputsFolder);
    assert.equal(scan.artifacts.length, 0);
    assert.equal(scan.outputByPrompt.size, 0);
  });

  test("validates payload shape and ignores non-json entries", () => {
    const instance = createFixture({
      outputs: {
        "A1_valid.json": JSON.stringify({ prompt: "A1_valid" }),
        "A2_not_object.json": JSON.stringify([]),
        "A3_missing_prompt.json": JSON.stringify({}),
        "A4_mismatch.json": JSON.stringify({ prompt: "A4_other" })
      }
    });

    const outputsFolder = path.join(instance.folderPath, "outputs");
    mkdirSync(path.join(outputsFolder, "nested-dir"), { recursive: true });
    writeFileSync(path.join(outputsFolder, "README.md"), "not json", "utf8");

    const scan = scanOutputs(outputsFolder);
    assert.equal(scan.artifacts.length, 4);
    assert.equal(scan.outputByPrompt.get("A1_valid")?.isValidJson, true);
    assert.equal(scan.outputByPrompt.get("A2_not_object")?.isValidJson, false);
    assert.equal(
      scan.outputByPrompt.get("A2_not_object")?.validationError,
      "Output JSON payload must be an object."
    );
    assert.equal(scan.outputByPrompt.get("A3_missing_prompt")?.isValidJson, false);
    assert.equal(
      scan.outputByPrompt.get("A3_missing_prompt")?.validationError,
      "Output JSON is missing required string field 'prompt'."
    );
    assert.equal(scan.outputByPrompt.get("A4_mismatch")?.isValidJson, false);
    assert.equal(
      scan.outputByPrompt.get("A4_mismatch")?.validationError,
      "Output JSON prompt field 'A4_other' does not match filename stem 'A4_mismatch'."
    );
  });

  test("captures parse failures and records the parser error message", () => {
    const instance = createFixture({
      outputs: {
        "A1_invalid_json.json": "{invalid-json"
      }
    });

    const scan = scanOutputs(path.join(instance.folderPath, "outputs"));
    assert.equal(scan.outputByPrompt.get("A1_invalid_json")?.isValidJson, false);
    assert.equal(typeof scan.outputByPrompt.get("A1_invalid_json")?.validationError, "string");
    assert.notEqual(scan.outputByPrompt.get("A1_invalid_json")?.validationError, "Unknown JSON parse error.");
  });

  test("falls back to an unknown parse message when non-Error values are thrown", () => {
    const instance = createFixture({
      outputs: {
        "A1_non_error_throw.json": JSON.stringify({ prompt: "A1_non_error_throw" })
      }
    });

    const parseSpy = vi.spyOn(JSON, "parse").mockImplementation((): unknown => {
      throw "non-error-throwable";
    });

    try {
      const scan = scanOutputs(path.join(instance.folderPath, "outputs"));
      assert.equal(scan.outputByPrompt.get("A1_non_error_throw")?.isValidJson, false);
      assert.equal(scan.outputByPrompt.get("A1_non_error_throw")?.validationError, "Unknown JSON parse error.");
    } finally {
      parseSpy.mockRestore();
    }
  });
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

  test("reports warning when an output JSON artifact is invalid", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "not_started"
      }),
      outputs: {
        "A1_test_strategy.json": JSON.stringify({})
      }
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      hasDrift(report, {
        promptStem: "A1_test_strategy",
        field: "outputs/*.json",
        severity: "warning"
      }),
      true
    );
  });

  test("reports warning when status markdown cannot be read", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "not_started"
      })
    });

    unlinkSync(path.join(instance.folderPath, "99_status.md"));

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      hasDrift(report, {
        promptStem: "*",
        field: "99_status.md",
        severity: "warning"
      }),
      true
    );
  });

  test("reports error when workpack.state.json is missing", () => {
    const instance = createFixture({
      state: null
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "inconsistent");
    assert.equal(
      hasDrift(report, {
        promptStem: "*",
        field: "workpack.state.json",
        severity: "error"
      }),
      true
    );
  });

  test("returns healthy when overallStatus is not_started and all prompts are pending", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "not_started"
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "healthy");
  });

  test("flags not_started drift when prompts are no longer all pending", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "not_started",
        promptStatus: {
          A1_test_strategy: { status: "in_progress" }
        }
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      hasDrift(report, {
        field: "workpack.state.json.overallStatus",
        actualValue: "overallStatus is not_started but prompts are no longer all pending"
      }),
      true
    );
  });

  test("flags in_progress drift when all prompts are pending", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "in_progress",
        promptStatus: {
          A1_test_strategy: { status: "pending" }
        }
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      hasDrift(report, {
        field: "workpack.state.json.overallStatus",
        actualValue: "overallStatus is in_progress but all prompts are pending"
      }),
      true
    );
  });

  test("flags in_progress drift when all prompts are complete or skipped", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "in_progress",
        promptStatus: {
          A1_test_strategy: { status: "skipped" }
        }
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      hasDrift(report, {
        field: "workpack.state.json.overallStatus",
        actualValue: "overallStatus is in_progress but all prompts are complete/skipped"
      }),
      true
    );
  });

  test("flags blocked drift when no blocked prompts and no blockedBy references exist", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "blocked",
        promptStatus: {
          A1_test_strategy: { status: "pending" }
        },
        blockedBy: []
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      hasDrift(report, {
        field: "workpack.state.json.overallStatus",
        actualValue: "overallStatus is blocked but no prompt is blocked and blockedBy is empty"
      }),
      true
    );
  });

  test("returns healthy for blocked status when a prompt is blocked", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "blocked",
        promptStatus: {
          A1_test_strategy: { status: "blocked" }
        }
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "healthy");
  });

  test("flags review drift when prompts remain in progress", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "review",
        promptStatus: {
          A1_test_strategy: { status: "in_progress" }
        }
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      hasDrift(report, {
        field: "workpack.state.json.overallStatus",
        actualValue: "overallStatus is review but prompts remain in_progress/blocked"
      }),
      true
    );
  });

  test("flags review drift when no prompt has started", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "review",
        promptStatus: {
          A1_test_strategy: { status: "pending" }
        }
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      hasDrift(report, {
        field: "workpack.state.json.overallStatus",
        actualValue: "overallStatus is review but no prompt has started"
      }),
      true
    );
  });

  test("returns healthy for review when at least one prompt is complete and none are blocked", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "review",
        promptStatus: {
          A1_test_strategy: { status: "complete" }
        }
      }),
      outputs: {
        "A1_test_strategy.json": JSON.stringify({ prompt: "A1_test_strategy" })
      }
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "healthy");
  });

  test("flags complete drift when prompts are not all complete or skipped", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "complete",
        promptStatus: {
          A1_test_strategy: { status: "pending" }
        }
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      hasDrift(report, {
        field: "workpack.state.json.overallStatus",
        actualValue: "overallStatus is complete but not all prompts are complete/skipped"
      }),
      true
    );
  });

  test("flags complete drift when blockedBy is not empty", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "complete",
        promptStatus: {
          A1_test_strategy: { status: "skipped" }
        },
        blockedBy: ["upstream-workpack"]
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "drifted");
    assert.equal(
      hasDrift(report, {
        field: "workpack.state.json.overallStatus",
        actualValue: "overallStatus is complete but blockedBy is not empty"
      }),
      true
    );
  });

  test("returns healthy when complete has all prompts complete or skipped and no blockers", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "complete",
        promptStatus: {
          A1_test_strategy: { status: "complete" },
          A2_optional: { status: "skipped" }
        },
        blockedBy: []
      }),
      outputs: {
        "A1_test_strategy.json": JSON.stringify({ prompt: "A1_test_strategy" })
      }
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "healthy");
  });

  test("treats prompt stems missing from state as neutral during reconciliation", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "not_started",
        promptStatus: {}
      }),
      statusMarkdown: "| B1_bugfix | ✅ Complete |",
      outputs: {
        "B1_bugfix.json": JSON.stringify({ prompt: "B1_bugfix" })
      }
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "healthy");
  });

  test("returns healthy for overall statuses outside reconciliation rules", () => {
    const instance = createFixture({
      state: buildState({
        overallStatus: "abandoned",
        promptStatus: {
          A1_test_strategy: { status: "pending" }
        }
      })
    });

    const report = reconcile(instance);
    assert.equal(report.overallHealth, "healthy");
  });
});
