import { strict as assert } from "node:assert";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "vitest";
import { DriftDetector, DriftType } from "../drift-detector";

interface FixtureOptions {
  metaId?: string;
  stateId?: string;
  overallStatus?: string;
  statePromptStatus?: Record<string, string>;
  metaPrompts?: string[];
  promptFiles?: string[];
  outputFiles?: string[];
  statusOverall?: string;
  statusPromptStatus?: Record<string, string>;
  blockedBy?: string[];
}

const tempFolders: string[] = [];

async function createFixture(name: string, options: FixtureOptions = {}): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `workpack-drift-${name}-`));
  tempFolders.push(root);

  const workpackPath = path.join(root, "04_validation");
  await fs.mkdir(path.join(workpackPath, "prompts"), { recursive: true });
  await fs.mkdir(path.join(workpackPath, "outputs"), { recursive: true });

  const metaPrompts = options.metaPrompts ?? ["A0_bootstrap"];
  const promptFiles = options.promptFiles ?? ["A0_bootstrap"];
  const outputFiles = options.outputFiles ?? ["A0_bootstrap"];

  const meta = {
    id: options.metaId ?? "04_validation",
    prompts: metaPrompts.map((stem) => ({ stem }))
  };

  const statePromptStatus = options.statePromptStatus ?? { A0_bootstrap: "complete" };
  const state = {
    workpack_id: options.stateId ?? "04_validation",
    overall_status: options.overallStatus ?? "complete",
    last_updated: "2026-02-26T10:00:00.000Z",
    prompt_status: Object.fromEntries(
      Object.entries(statePromptStatus).map(([stem, status]) => [stem, { status }])
    ),
    blocked_by: options.blockedBy ?? [],
    agent_assignments: {},
    execution_log: []
  };

  const statusOverall = options.statusOverall ?? "✅ Complete";
  const statusPromptStatus = options.statusPromptStatus ?? { A0_bootstrap: "✅ Complete" };

  const statusMarkdown = [
    "# Status",
    "",
    "## Overall Status",
    "",
    statusOverall,
    "",
    "## Implementation Progress",
    "",
    "| Prompt | Status |",
    "|--------|--------|",
    ...Object.entries(statusPromptStatus).map(([stem, status]) => `| ${stem} | ${status} |`)
  ].join("\n");

  await fs.writeFile(path.join(workpackPath, "workpack.meta.json"), JSON.stringify(meta, null, 2), "utf8");
  await fs.writeFile(path.join(workpackPath, "workpack.state.json"), JSON.stringify(state, null, 2), "utf8");
  await fs.writeFile(path.join(workpackPath, "99_status.md"), `${statusMarkdown}\n`, "utf8");

  for (const stem of promptFiles) {
    await fs.writeFile(path.join(workpackPath, "prompts", `${stem}.md`), `# ${stem}\n`, "utf8");
  }

  for (const stem of outputFiles) {
    await fs.writeFile(path.join(workpackPath, "outputs", `${stem}.json`), JSON.stringify({ prompt: stem }), "utf8");
  }

  return workpackPath;
}

afterEach(async () => {
  while (tempFolders.length > 0) {
    const folder = tempFolders.pop();
    if (folder) {
      await fs.rm(folder, { recursive: true, force: true });
    }
  }
});

describe("DriftDetector", () => {
  it("Fixture A: reports no drift for a consistent workpack", async () => {
    const fixture = await createFixture("consistent");
    const report = await new DriftDetector().detect(fixture);

    assert.equal(report.drifts.length, 0);
  });

  it("Fixture B: detects missing output when state is complete", async () => {
    const fixture = await createFixture("missing-output", {
      outputFiles: []
    });

    const report = await new DriftDetector().detect(fixture);
    assert.ok(report.drifts.some((drift) => drift.type === DriftType.MISSING_OUTPUT && drift.promptStem === "A0_bootstrap"));
  });

  it("Fixture C: detects orphaned output when state is pending", async () => {
    const fixture = await createFixture("orphaned-output", {
      statePromptStatus: { A0_bootstrap: "pending" },
      outputFiles: ["A0_bootstrap"]
    });

    const report = await new DriftDetector().detect(fixture);
    assert.ok(
      report.drifts.some((drift) => drift.type === DriftType.ORPHANED_OUTPUT && drift.promptStem === "A0_bootstrap")
    );
  });

  it("Fixture D: detects status mismatch between state and 99_status", async () => {
    const fixture = await createFixture("status-mismatch", {
      overallStatus: "complete",
      statusOverall: "🟡 In Progress",
      statusPromptStatus: { A0_bootstrap: "⏳ Pending" }
    });

    const report = await new DriftDetector().detect(fixture);
    assert.ok(report.drifts.some((drift) => drift.type === DriftType.STATUS_MISMATCH));
  });

  it("Fixture E: detects unlisted prompt file", async () => {
    const fixture = await createFixture("unlisted-prompt", {
      metaPrompts: ["A0_bootstrap"],
      promptFiles: ["A0_bootstrap", "A9_extra_prompt"]
    });

    const report = await new DriftDetector().detect(fixture);
    assert.ok(report.drifts.some((drift) => drift.type === DriftType.UNLISTED_PROMPT && drift.promptStem === "A9_extra_prompt"));
  });

  it("Fixture F: detects prompt listed in meta but missing on disk", async () => {
    const fixture = await createFixture("missing-prompt-file", {
      metaPrompts: ["A0_bootstrap", "A1_missing_prompt"],
      promptFiles: ["A0_bootstrap"]
    });

    const report = await new DriftDetector().detect(fixture);
    assert.ok(
      report.drifts.some(
        (drift) => drift.type === DriftType.MISSING_PROMPT_FILE && drift.promptStem === "A1_missing_prompt"
      )
    );
  });

  it("Fixture G: detects stale blocker when blocked workpack is complete", async () => {
    const fixture = await createFixture("stale-blocker", {
      blockedBy: ["02_core_complete"]
    });

    const siblingWorkpack = path.join(path.dirname(fixture), "02_core_complete");
    await fs.mkdir(path.join(siblingWorkpack, "prompts"), { recursive: true });
    await fs.mkdir(path.join(siblingWorkpack, "outputs"), { recursive: true });
    await fs.writeFile(
      path.join(siblingWorkpack, "workpack.meta.json"),
      JSON.stringify({ id: "02_core_complete", prompts: [] }, null, 2),
      "utf8"
    );
    await fs.writeFile(
      path.join(siblingWorkpack, "workpack.state.json"),
      JSON.stringify(
        {
          workpack_id: "02_core_complete",
          overall_status: "complete",
          prompt_status: {},
          blocked_by: [],
          agent_assignments: {},
          execution_log: []
        },
        null,
        2
      ),
      "utf8"
    );

    const report = await new DriftDetector().detect(fixture);
    assert.ok(report.drifts.some((drift) => drift.type === DriftType.STALE_BLOCKER));
  });

  it("autoFix: updates pending state to complete for orphaned outputs", async () => {
    const fixture = await createFixture("autofix-orphaned", {
      statePromptStatus: { A0_bootstrap: "pending" },
      outputFiles: ["A0_bootstrap"]
    });

    const detector = new DriftDetector();
    const report = await detector.detect(fixture);
    const fixes = await detector.autoFix(fixture, report);

    assert.ok(fixes.some((fix) => fix.type === DriftType.ORPHANED_OUTPUT));

    const updatedStateRaw = await fs.readFile(path.join(fixture, "workpack.state.json"), "utf8");
    const updatedState = JSON.parse(updatedStateRaw) as {
      prompt_status: Record<string, { status: string }>;
    };
    assert.equal(updatedState.prompt_status.A0_bootstrap.status, "complete");
  });

  it("autoFix: does not apply destructive fix for missing output", async () => {
    const fixture = await createFixture("autofix-missing-output", {
      statePromptStatus: { A0_bootstrap: "complete" },
      outputFiles: []
    });

    const detector = new DriftDetector();
    const report = await detector.detect(fixture);
    const fixes = await detector.autoFix(fixture, report);

    assert.equal(fixes.length, 0);
  });

  it("handles malformed workpack without crashing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "workpack-drift-malformed-"));
    tempFolders.push(root);
    await fs.mkdir(path.join(root, "prompts"), { recursive: true });

    const report = await new DriftDetector().detect(root);
    assert.ok(report.drifts.length >= 1);
  });
});