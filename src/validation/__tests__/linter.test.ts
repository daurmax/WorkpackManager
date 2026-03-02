import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { WorkpackLinter } from "../linter";

const tempFolders: string[] = [];

interface WorkpackSetupOptions {
  folderName?: string;
  workpackId?: string;
  protocolVersion?: string;
  requiresWorkpack?: string[];
  metaPrompts?: Array<{ stem: string; dependsOn?: string[] }>;
  promptFiles?: Record<string, { promptId?: string; dependsOn?: string[]; includeFrontMatter?: boolean }>;
  includeOutputs?: boolean;
}

async function scaffoldSchemas(workspaceRoot: string): Promise<void> {
  const sourceRoot = path.resolve(process.cwd(), "workpacks");
  const targetRoot = path.join(workspaceRoot, "workpacks");

  await mkdir(targetRoot, { recursive: true });
  await cp(path.join(sourceRoot, "WORKPACK_META_SCHEMA.json"), path.join(targetRoot, "WORKPACK_META_SCHEMA.json"));
  await cp(path.join(sourceRoot, "WORKPACK_STATE_SCHEMA.json"), path.join(targetRoot, "WORKPACK_STATE_SCHEMA.json"));
  await cp(path.join(sourceRoot, "WORKPACK_OUTPUT_SCHEMA.json"), path.join(targetRoot, "WORKPACK_OUTPUT_SCHEMA.json"));
}

function renderPromptMarkdown(
  stem: string,
  options?: { promptId?: string; dependsOn?: string[]; includeFrontMatter?: boolean }
): string {
  const includeFrontMatter = options?.includeFrontMatter ?? true;
  if (!includeFrontMatter) {
    return `# ${stem}\n`;
  }

  const dependsOn = options?.dependsOn ?? [];
  const dependsOnBlock = dependsOn.length > 0 ? dependsOn.map((entry) => `  - ${entry}`).join("\n") : "  []";

  return [
    "---",
    `prompt_id: ${options?.promptId ?? stem}`,
    "workpack: sample-workpack",
    "agent_role: Test agent",
    "depends_on:",
    dependsOnBlock,
    "repos:",
    "  - WorkpackManager",
    "estimated_effort: S",
    "---",
    "",
    `# ${stem}`,
    ""
  ].join("\n");
}

async function createWorkpack(
  workspaceRoot: string,
  options?: WorkpackSetupOptions
): Promise<{ workpackPath: string; workpackId: string }> {
  const workpackId = options?.workpackId ?? "04_validation_quality";
  const folderName = options?.folderName ?? workpackId;
  const instancesPath = path.join(workspaceRoot, "workpacks", "instances", "group-a");
  const workpackPath = path.join(instancesPath, folderName);

  await mkdir(path.join(workpackPath, "prompts"), { recursive: true });
  if (options?.includeOutputs !== false) {
    await mkdir(path.join(workpackPath, "outputs"), { recursive: true });
  }

  await writeFile(path.join(workpackPath, "00_request.md"), "# Request\n");
  await writeFile(path.join(workpackPath, "01_plan.md"), "# Plan\n");
  await writeFile(path.join(workpackPath, "99_status.md"), "# Status\n");

  const metaPrompts =
    options?.metaPrompts ?? [
      { stem: "A0_bootstrap", dependsOn: [] },
      { stem: "A1_validate", dependsOn: ["A0_bootstrap"] }
    ];

  const meta = {
    id: workpackId,
    group: "group-a",
    title: "Validation Quality",
    summary: "Validate workpack protocol implementation quality.",
    protocol_version: options?.protocolVersion ?? "6.0.0",
    workpack_version: "1.0.0",
    category: "feature",
    created_at: "2026-02-26",
    requires_workpack: options?.requiresWorkpack ?? [],
    tags: ["validation"],
    owners: ["team"],
    repos: ["WorkpackManager"],
    delivery_mode: "pr",
    target_branch: "main",
    prompts: metaPrompts.map((prompt) => ({
      stem: prompt.stem,
      agent_role: "Protocol linter architect",
      depends_on: prompt.dependsOn ?? [],
      repos: ["WorkpackManager"],
      estimated_effort: "L"
    }))
  };

  const state = {
    workpack_id: workpackId,
    overall_status: "in_progress",
    last_updated: "2026-02-26T10:00:00Z",
    prompt_status: {
      A0_bootstrap: {
        status: "complete",
        completed_at: "2026-02-26T10:10:00Z"
      },
      A1_validate: {
        status: "in_progress",
        started_at: "2026-02-26T10:11:00Z"
      }
    },
    agent_assignments: {
      A0_bootstrap: "codex",
      A1_validate: "copilot"
    },
    blocked_by: [],
    execution_log: [
      {
        timestamp: "2026-02-26T10:00:00Z",
        event: "started",
        prompt_stem: null,
        agent: null,
        notes: null
      }
    ]
  };

  await writeFile(path.join(workpackPath, "workpack.meta.json"), JSON.stringify(meta, null, 2));
  await writeFile(path.join(workpackPath, "workpack.state.json"), JSON.stringify(state, null, 2));

  const promptDefinitions =
    options?.promptFiles ?? {
      A0_bootstrap: { promptId: "A0_bootstrap", dependsOn: [] },
      A1_validate: { promptId: "A1_validate", dependsOn: ["A0_bootstrap"] }
    };

  for (const [stem, promptOptions] of Object.entries(promptDefinitions)) {
    await writeFile(path.join(workpackPath, "prompts", `${stem}.md`), renderPromptMarkdown(stem, promptOptions));
  }

  if (options?.includeOutputs !== false) {
    const outputPayload = {
      schema_version: "1.1",
      workpack: workpackId,
      prompt: "A1_validate",
      component: "validation",
      delivery_mode: "pr",
      branch: {
        base: "main",
        work: "feature/linter",
        merge_target: "main"
      },
      changes: {
        files_modified: ["src/validation/linter.ts"],
        files_created: ["src/validation/lint-rules.ts"],
        contracts_changed: [],
        breaking_change: false
      },
      verification: {
        commands: [
          {
            cmd: "npx tsc --noEmit",
            result: "pass"
          }
        ]
      },
      handoff: {
        summary: "Implemented linter.",
        next_steps: [],
        known_issues: []
      },
      artifacts: {
        pr_url: "",
        commit_shas: [],
        branch_verified: false
      },
      repos: ["WorkpackManager"],
      execution: {
        model: "gpt-5.3-codex",
        tokens_in: 1,
        tokens_out: 1,
        duration_ms: 1
      },
      change_details: []
    };

    await writeFile(path.join(workpackPath, "outputs", "A1_validate.json"), JSON.stringify(outputPayload, null, 2));
  }

  return { workpackPath, workpackId };
}

async function createWorkspaceWithWorkpack(
  options?: WorkpackSetupOptions
): Promise<{ workspaceRoot: string; workpackPath: string; workpackId: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "workpack-linter-"));
  tempFolders.push(workspaceRoot);

  await scaffoldSchemas(workspaceRoot);
  const created = await createWorkpack(workspaceRoot, options);
  return {
    workspaceRoot,
    workpackPath: created.workpackPath,
    workpackId: created.workpackId
  };
}

function findByRule(ruleId: string, diagnostics: Awaited<ReturnType<WorkpackLinter["lintWorkpack"]>>):
  | { ruleId: string; severity: "error" | "warning" | "info"; message: string }
  | undefined {
  return diagnostics.find((diagnostic) => diagnostic.ruleId === ruleId);
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

describe("workpack linter rules", () => {
  it("passes a valid workpack", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack();
    const linter = new WorkpackLinter();

    const diagnostics = await linter.lintWorkpack(workpackPath);

    assert.equal(diagnostics.length, 0);
  });

  it("WP001 reports invalid folder naming", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack({ folderName: "Invalid Folder" });
    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);

    const finding = findByRule("WP001", diagnostics);
    assert.ok(finding);
    assert.equal(finding.severity, "error");
  });

  it("WP002 reports missing required files", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack();
    await rm(path.join(workpackPath, "01_plan.md"));

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const finding = findByRule("WP002", diagnostics);

    assert.ok(finding);
    assert.equal(finding.severity, "error");
  });

  it("WP003 reports schema validation issues in meta", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack();
    await writeFile(path.join(workpackPath, "workpack.meta.json"), JSON.stringify({ id: "x" }, null, 2));

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const finding = findByRule("WP003", diagnostics);

    assert.ok(finding);
    assert.equal(finding.severity, "error");
  });

  it("WP004 reports malformed state JSON without crashing", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack();
    await writeFile(path.join(workpackPath, "workpack.state.json"), "{\n  \"workpack_id\":\n");

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const finding = findByRule("WP004", diagnostics);

    assert.ok(finding);
    assert.equal(finding.severity, "error");
  });

  it("WP005 reports missing outputs directory", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack({ includeOutputs: false });

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const finding = findByRule("WP005", diagnostics);

    assert.ok(finding);
    assert.equal(finding.severity, "warning");
  });

  it("WP006 reports prompt stems listed in meta but missing files", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack();
    await rm(path.join(workpackPath, "prompts", "A1_validate.md"));

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const finding = findByRule("WP006", diagnostics);

    assert.ok(finding);
    assert.equal(finding.severity, "error");
  });

  it("WP007 reports orphan prompt files", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack();
    await writeFile(path.join(workpackPath, "prompts", "A2_orphan.md"), renderPromptMarkdown("A2_orphan"));

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const finding = findByRule("WP007", diagnostics);

    assert.ok(finding);
    assert.equal(finding.severity, "warning");
  });

  it("WP008 reports cycles in prompt DAG", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack({
      metaPrompts: [
        { stem: "A0_bootstrap", dependsOn: ["A1_validate"] },
        { stem: "A1_validate", dependsOn: ["A0_bootstrap"] }
      ]
    });

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const finding = findByRule("WP008", diagnostics);

    assert.ok(finding);
    assert.equal(finding.severity, "error");
  });

  it("WP009 reports unresolved depends_on in prompt front matter", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack({
      promptFiles: {
        A0_bootstrap: { promptId: "A0_bootstrap", dependsOn: [] },
        A1_validate: { promptId: "A1_validate", dependsOn: ["A9_missing"] }
      }
    });

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const finding = findByRule("WP009", diagnostics);

    assert.ok(finding);
    assert.equal(finding.severity, "error");
  });

  it("WP010 reports unknown requires_workpack references", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack({ requiresWorkpack: ["99_missing_dependency"] });

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const finding = findByRule("WP010", diagnostics);

    assert.ok(finding);
    assert.equal(finding.severity, "warning");
  });

  it("WP011 reports mismatched workpack IDs between meta and state", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack();
    const mismatchedState = {
      workpack_id: "other_workpack_id",
      overall_status: "in_progress",
      last_updated: "2026-02-26T10:00:00Z",
      prompt_status: {},
      agent_assignments: {},
      blocked_by: [],
      execution_log: []
    };

    await writeFile(path.join(workpackPath, "workpack.state.json"), JSON.stringify(mismatchedState, null, 2));

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const finding = findByRule("WP011", diagnostics);

    assert.ok(finding);
    assert.equal(finding.severity, "error");
  });

  it("WP012 warns on unsupported protocol versions", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack({ protocolVersion: "2.0.0" });

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const finding = findByRule("WP012", diagnostics);

    assert.ok(finding);
    assert.equal(finding.severity, "warning");
  });

  it("WP013 warns when prompt_id is missing or invalid", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack({
      promptFiles: {
        A0_bootstrap: { includeFrontMatter: false },
        A1_validate: { promptId: "invalid" }
      }
    });

    const diagnostics = await new WorkpackLinter().lintWorkpack(workpackPath);
    const findings = diagnostics.filter((diagnostic) => diagnostic.ruleId === "WP013");

    assert.equal(findings.length >= 1, true);
    assert.equal(findings[0].severity, "warning");
  });

  it("lintAll lints multiple workpacks in an instances directory", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "workpack-linter-"));
    tempFolders.push(workspaceRoot);
    await scaffoldSchemas(workspaceRoot);

    const first = await createWorkpack(workspaceRoot, { workpackId: "01_alpha" });
    const second = await createWorkpack(workspaceRoot, {
      workpackId: "02_beta",
      requiresWorkpack: ["missing-workpack"]
    });

    void first;
    void second;

    const linter = new WorkpackLinter();
    const lintMap = await linter.lintAll(path.join(workspaceRoot, "workpacks", "instances"));

    assert.equal(lintMap.size, 2);
    assert.equal(
      [...lintMap.keys()].every((workpackPath) => workpackPath.includes(path.join("workpacks", "instances"))),
      true
    );
  });

  it("supports disabling individual rules", async () => {
    const { workpackPath } = await createWorkspaceWithWorkpack({ includeOutputs: false });
    const linter = new WorkpackLinter({ disabledRuleIds: ["WP005"] });

    const diagnostics = await linter.lintWorkpack(workpackPath);

    assert.equal(diagnostics.some((diagnostic) => diagnostic.ruleId === "WP005"), false);
  });
});
