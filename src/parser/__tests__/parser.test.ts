import { strict as assert } from "node:assert";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "vitest";
import {
  parseWorkpackInstance,
  parseWorkpackMarkdownFallback,
  parseWorkpackMeta,
  parseWorkpackState
} from "../workpack-parser";

const FIXTURES_ROOT = path.resolve(process.cwd(), "src", "__fixtures__", "workpacks");
const PARSER_FIXTURES_ROOT = path.resolve(process.cwd(), "src", "test", "parser", "fixtures");
const tempDirs: string[] = [];

function fixturePath(name: string): string {
  return path.join(FIXTURES_ROOT, name);
}

function parserFixturePath(...segments: string[]): string {
  return path.join(PARSER_FIXTURES_ROOT, ...segments);
}

async function createTempWorkpack(prefix: string): Promise<string> {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(folderPath);
  return folderPath;
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function captureWarnings<T>(operation: () => Promise<T>): Promise<{ result: T; warnings: string[] }> {
  const warnings: string[] = [];
  const originalWarn = console.warn;

  console.warn = (...args: unknown[]): void => {
    warnings.push(args.map((value) => String(value)).join(" "));
  };

  try {
    const result = await operation();
    return { result, warnings };
  } finally {
    console.warn = originalWarn;
  }
}

function buildValidMetaPayload(): Record<string, unknown> {
  return {
    id: "temp-workpack",
    title: "Temp Workpack",
    summary: "Temp fixture for parser mapping.",
    protocol_version: "2.0.0",
    workpack_version: "1.0.0",
    category: "feature",
    created_at: "2026-03-03",
    requires_workpack: [],
    tags: [],
    owners: [],
    repos: ["WorkpackManager"],
    delivery_mode: "pr",
    target_branch: "main",
    prompts: [
      {
        stem: "A0_bootstrap",
        agent_role: "Bootstrap",
        depends_on: [],
        repos: ["WorkpackManager"],
        estimated_effort: "S"
      }
    ]
  };
}

function buildValidStatePayload(): Record<string, unknown> {
  return {
    workpack_id: "temp-workpack",
    overall_status: "in_progress",
    last_updated: "2026-03-03T10:00:00Z",
    prompt_status: {
      A0_bootstrap: {
        status: "pending"
      }
    },
    agent_assignments: {},
    blocked_by: [],
    execution_log: []
  };
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const folderPath = tempDirs.pop();
    if (folderPath) {
      await fs.rm(folderPath, { recursive: true, force: true });
    }
  }
});

describe("parser", () => {
  it("parses schema-valid v6 metadata from fixture", async () => {
    const meta = await parseWorkpackMeta(fixturePath("valid-v6"));

    assert.ok(meta);
    assert.equal(meta.id, "valid-v6");
    assert.equal(meta.protocolVersion, "2.0.0");
    assert.equal(meta.prompts.length, 2);
  });

  it("parses schema-valid v6 runtime state from fixture", async () => {
    const state = await parseWorkpackState(fixturePath("valid-v6"));

    assert.ok(state);
    assert.equal(state.workpackId, "valid-v6");
    assert.equal(state.overallStatus, "in_progress");
  });

  it("parses full instance from v6 fixture", async () => {
    const instance = await parseWorkpackInstance(fixturePath("valid-v6"));

    assert.equal(instance.protocolVersion, "2.0.0");
    assert.equal(instance.meta.id, "valid-v6");
    assert.equal(instance.state?.workpackId, "valid-v6");
  });

  it("falls back to markdown parsing for v5 fixture", async () => {
    const fallback = await parseWorkpackMarkdownFallback(fixturePath("v5-legacy"));
    const instance = await parseWorkpackInstance(fixturePath("v5-legacy"));

    assert.ok(fallback.prompts && fallback.prompts.length > 0);
    assert.equal(instance.protocolVersion, "5");
    assert.equal(instance.meta.deliveryMode, "pr");
    assert.equal(instance.state, null);
  });

  it("throws for fixture with missing required parsing files", async () => {
    await assert.rejects(async () => {
      await parseWorkpackInstance(fixturePath("invalid-missing-files"));
    });
  });

  it("parses delivery mode from checked markdown checklist entries", async () => {
    const fallback = await parseWorkpackMarkdownFallback(
      parserFixturePath("workspace-b", "workpacks", "instances", "standalone-legacy")
    );

    assert.equal(fallback.deliveryMode, "pr");
  });

  it("parses checklist delivery mode and WBS-only plan fallback prompts", async () => {
    const folderPath = await createTempWorkpack("parser-fallback-wbs-");
    await writeTextFile(
      path.join(folderPath, "00_request.md"),
      `# Request

## Workpack Protocol Version

Workpack Protocol Version: 6

## Original Request

Short Slug: \`legacy-checklist\`
Legacy fallback summary sentence for parser coverage.

## Delivery Mode

- [ ] PR-based
- [x] Direct push

Target Branch: release/next
`
    );
    await writeTextFile(
      path.join(folderPath, "01_plan.md"),
      `# Plan

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Bootstrap | A0_bootstrap | - | \`XS\` |
| 2 | Broken row |
| 3 | Legacy parser flow | A1_legacy_flow | 1 | invalid-effort |
`
    );

    const fallback = await parseWorkpackMarkdownFallback(folderPath);
    const instance = await parseWorkpackInstance(folderPath);

    assert.equal(instance.protocolVersion, "2.0.0");
    assert.equal(fallback.protocolVersion, "2.0.0");
    assert.equal(fallback.deliveryMode, "direct_push");
    assert.equal(fallback.targetBranch, "release/next");
    assert.equal(fallback.title, "Legacy Checklist");
    assert.equal(fallback.summary, "Legacy fallback summary sentence for parser coverage.");
    assert.equal(fallback.requiresWorkpack, undefined);
    assert.ok(fallback.prompts);
    assert.equal(fallback.prompts?.length, 2);
    assert.equal(fallback.prompts?.[0].stem, "A0_bootstrap");
    assert.equal(fallback.prompts?.[0].estimatedEffort, "XS");
    assert.equal(fallback.prompts?.[1].estimatedEffort, "M");
  });

  it("parses DAG rows with dash, empty lists, bare tokens, and quoted tokens", async () => {
    const folderPath = await createTempWorkpack("parser-fallback-dag-");
    await writeTextFile(path.join(folderPath, "00_request.md"), "# Request\n\nLegacy parser fixture.\n");
    await writeTextFile(
      path.join(folderPath, "01_plan.md"),
      `# Plan

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Bootstrap | A0_bootstrap | - | XS |

## DAG Dependencies

| Prompt | depends_on | repos |
|--------|-----------|-------|
| Prompt | depends_on | repos |
| bad-row | two |
| A0_bootstrap | - | [] |
| A1_manual | A0_bootstrap | WorkpackManager |
| A2_missing_meta | [A1_manual] | [\`RepoA\`, "RepoB"] |
`
    );

    const fallback = await parseWorkpackMarkdownFallback(folderPath);

    assert.ok(fallback.prompts);
    assert.equal(fallback.prompts?.length, 3);
    assert.deepEqual(fallback.prompts?.[0].dependsOn, []);
    assert.deepEqual(fallback.prompts?.[0].repos, []);
    assert.equal(fallback.prompts?.[0].estimatedEffort, "XS");
    assert.equal(fallback.prompts?.[1].agentRole, "Legacy prompt A1_manual");
    assert.equal(fallback.prompts?.[1].estimatedEffort, "M");
    assert.deepEqual(fallback.prompts?.[1].dependsOn, ["A0_bootstrap"]);
    assert.deepEqual(fallback.prompts?.[1].repos, ["WorkpackManager"]);
    assert.deepEqual(fallback.prompts?.[2].dependsOn, ["A1_manual"]);
    assert.deepEqual(fallback.prompts?.[2].repos, ["RepoA", "RepoB"]);
  });

  it("parses semver protocol and preferred direct mode from markdown request", async () => {
    const folderPath = await createTempWorkpack("parser-fallback-semver-");
    await writeTextFile(
      path.join(folderPath, "00_request.md"),
      `# Request

## Workpack Protocol Version

Workpack Protocol Version: \`3.1.4\`

## Original Request

Request Type: \`REFRACTOR\`
Short Slug: \`semver-protocol\`
Semver protocol fallback summary.

Preferred Delivery Mode: \`Direct Push\`
Target Base Branch: \`release/main\`
`
    );

    const fallback = await parseWorkpackMarkdownFallback(folderPath);

    assert.equal(fallback.protocolVersion, "3.1.4");
    assert.equal(fallback.deliveryMode, "direct_push");
    assert.equal(fallback.targetBranch, "release/main");
    assert.equal(fallback.title, "Semver Protocol");
    assert.equal(fallback.summary, "Semver protocol fallback summary.");
  });

  it("leaves optional fallback fields undefined when markdown does not match known markers", async () => {
    const folderPath = await createTempWorkpack("parser-fallback-unstructured-");
    await writeTextFile(path.join(folderPath, "00_request.md"), "# Request\n\nNo structured markers.\n");
    await writeTextFile(path.join(folderPath, "01_plan.md"), "# Plan\n\nNo prompt tables.\n");

    const fallback = await parseWorkpackMarkdownFallback(folderPath);

    assert.equal(fallback.protocolVersion, undefined);
    assert.equal(fallback.deliveryMode, undefined);
    assert.equal(fallback.targetBranch, undefined);
    assert.equal(fallback.title, undefined);
    assert.equal(fallback.summary, undefined);
    assert.equal(fallback.prompts, undefined);
  });

  it("omits summary when Original Request only includes metadata lines", async () => {
    const folderPath = await createTempWorkpack("parser-fallback-summary-");
    await writeTextFile(
      path.join(folderPath, "00_request.md"),
      `# Request

## Original Request

Request Type: \`NEW_FEATURE\`
Short Slug: \`summary-only-metadata\`

## Delivery Mode

- [x] PR-based
`
    );

    const fallback = await parseWorkpackMarkdownFallback(folderPath);

    assert.equal(fallback.summary, undefined);
    assert.equal(fallback.title, "Summary Only Metadata");
  });

  it("builds legacy defaults and infers created_at from date-prefixed folder name", async () => {
    const folderPath = await createTempWorkpack("2026-04-01_legacy-parser-");
    await writeTextFile(path.join(folderPath, "01_plan.md"), "# Plan\n\nLegacy fixture.\n");

    const instance = await parseWorkpackInstance(folderPath);

    assert.equal(instance.protocolVersion, "5");
    assert.equal(instance.meta.protocolVersion, "2.0.0");
    assert.equal(instance.meta.createdAt, "2026-04-01");
    assert.equal(instance.meta.deliveryMode, "pr");
    assert.equal(instance.meta.targetBranch, "main");
    assert.deepEqual(instance.meta.tags, ["legacy"]);
    assert.equal(instance.meta.prompts.length, 0);
  });

  it("returns null for malformed metadata JSON with warning", async () => {
    const folderPath = parserFixturePath("workspace-b", "workpacks", "instances", "bad-workpack");
    const { result, warnings } = await captureWarnings(async () => parseWorkpackMeta(folderPath));

    assert.equal(result, null);
    assert.equal(warnings.some((warning) => warning.includes("Malformed JSON")), true);
  });

  it("returns null for malformed state JSON shape", async () => {
    const state = await parseWorkpackState(parserFixturePath("malformed-state"));
    assert.equal(state, null);
  });

  it("rejects schema-invalid metadata payload with warning", async () => {
    const folderPath = parserFixturePath("schema-invalid-meta");
    const { result, warnings } = await captureWarnings(async () => parseWorkpackMeta(folderPath));

    assert.equal(result, null);
    assert.equal(warnings.some((warning) => warning.includes("Schema validation failed")), true);
  });

  it("rejects schema-invalid state payload with warning", async () => {
    const folderPath = parserFixturePath("schema-invalid-state");
    const { result, warnings } = await captureWarnings(async () => parseWorkpackState(folderPath));

    assert.equal(result, null);
    assert.equal(warnings.some((warning) => warning.includes("Schema validation failed")), true);
  });

  it("returns null and warns when metadata path points to a directory", async () => {
    const folderPath = await createTempWorkpack("parser-meta-directory-");
    await fs.mkdir(path.join(folderPath, "workpack.meta.json"), { recursive: true });

    const { result, warnings } = await captureWarnings(async () => parseWorkpackMeta(folderPath));

    assert.equal(result, null);
    assert.equal(warnings.some((warning) => warning.includes("Unable to read")), true);
  });

  it("returns empty markdown fallback and warns when request path is unreadable", async () => {
    const folderPath = await createTempWorkpack("parser-request-directory-");
    await fs.mkdir(path.join(folderPath, "00_request.md"), { recursive: true });

    const { result, warnings } = await captureWarnings(async () => parseWorkpackMarkdownFallback(folderPath));

    assert.deepEqual(result, {});
    assert.equal(warnings.some((warning) => warning.includes("Unable to read")), true);
  });

  it("rejects invalid metadata payload shapes when schemas are unavailable", async () => {
    const metadataCases: Array<{ name: string; payload: unknown; warning: string }> = [
      {
        name: "metadata must be an object",
        payload: [],
        warning: "Invalid metadata"
      },
      {
        name: "metadata with missing required fields",
        payload: { id: "temp-workpack" },
        warning: "missing required fields"
      },
      {
        name: "invalid protocol version format",
        payload: { ...buildValidMetaPayload(), protocol_version: "6" },
        warning: "Invalid protocol_version"
      },
      {
        name: "invalid category value",
        payload: { ...buildValidMetaPayload(), category: "experimental" },
        warning: "Invalid category"
      },
      {
        name: "invalid delivery mode value",
        payload: { ...buildValidMetaPayload(), delivery_mode: "hybrid" },
        warning: "Invalid delivery_mode"
      },
      {
        name: "prompt entry must be an object",
        payload: { ...buildValidMetaPayload(), prompts: [42] },
        warning: "Invalid prompt entry"
      },
      {
        name: "prompt entry with missing fields",
        payload: { ...buildValidMetaPayload(), prompts: [{ stem: "A0_bootstrap" }] },
        warning: "Invalid prompt entry"
      },
      {
        name: "prompt entry with invalid estimated effort",
        payload: {
          ...buildValidMetaPayload(),
          prompts: [
            {
              stem: "A0_bootstrap",
              agent_role: "Bootstrap",
              depends_on: [],
              repos: ["WorkpackManager"],
              estimated_effort: "INVALID"
            }
          ]
        },
        warning: "invalid estimated_effort"
      }
    ];

    for (const metadataCase of metadataCases) {
      const folderPath = await createTempWorkpack("parser-meta-edge-");
      await writeJsonFile(path.join(folderPath, "workpack.meta.json"), metadataCase.payload);

      const { result, warnings } = await captureWarnings(async () => parseWorkpackMeta(folderPath));

      assert.equal(result, null, metadataCase.name);
      assert.equal(
        warnings.some((warning) => warning.includes(metadataCase.warning)),
        true,
        metadataCase.name
      );
    }
  });

  it("rejects invalid state payload shapes when schemas are unavailable", async () => {
    const stateCases: Array<{ name: string; payload: unknown; warning: string }> = [
      {
        name: "state must be an object",
        payload: [],
        warning: "Invalid state"
      },
      {
        name: "invalid overall status",
        payload: { ...buildValidStatePayload(), overall_status: "done" },
        warning: "missing required fields"
      },
      {
        name: "prompt_status entry must be an object",
        payload: { ...buildValidStatePayload(), prompt_status: { A0_bootstrap: 42 } },
        warning: "Invalid prompt_status entry"
      },
      {
        name: "prompt_status value must be known",
        payload: { ...buildValidStatePayload(), prompt_status: { A0_bootstrap: { status: "done" } } },
        warning: "Invalid prompt status value"
      },
      {
        name: "agent assignments must be strings",
        payload: { ...buildValidStatePayload(), agent_assignments: { A0_bootstrap: 42 } },
        warning: "Invalid agent assignment"
      },
      {
        name: "execution log entries must be objects",
        payload: { ...buildValidStatePayload(), execution_log: [42] },
        warning: "Invalid execution_log entry"
      },
      {
        name: "execution log events must be known",
        payload: {
          ...buildValidStatePayload(),
          execution_log: [{ timestamp: "2026-03-03T12:00:00Z", event: "unknown" }]
        },
        warning: "Invalid execution_log entry"
      }
    ];

    for (const stateCase of stateCases) {
      const folderPath = await createTempWorkpack("parser-state-edge-");
      await writeJsonFile(path.join(folderPath, "workpack.state.json"), stateCase.payload);

      const { result, warnings } = await captureWarnings(async () => parseWorkpackState(folderPath));

      assert.equal(result, null, stateCase.name);
      assert.equal(warnings.some((warning) => warning.includes(stateCase.warning)), true, stateCase.name);
    }
  });

  it("maps optional prompt fields and sanitizes invalid optional execution log values", async () => {
    const folderPath = await createTempWorkpack("parser-state-optional-");
    await writeJsonFile(path.join(folderPath, "workpack.state.json"), {
      ...buildValidStatePayload(),
      overall_status: "blocked",
      prompt_status: {
        A0_bootstrap: {
          status: "blocked",
          assigned_agent: "codex",
          started_at: null,
          completed_at: "2026-03-03T12:00:00Z",
          output_validated: false,
          blocked_reason: "waiting on review"
        }
      },
      agent_assignments: {
        A0_bootstrap: "codex"
      },
      execution_log: [
        {
          timestamp: "2026-03-03T12:00:00Z",
          event: "blocked",
          prompt_stem: 123,
          agent: { id: "codex" },
          notes: 456
        }
      ],
      notes: 789
    });

    const { result } = await captureWarnings(async () => parseWorkpackState(folderPath));
    assert.ok(result);

    const promptStatus = result.promptStatus.A0_bootstrap;
    assert.ok(promptStatus);
    assert.equal(promptStatus.assignedAgent, "codex");
    assert.equal(promptStatus.startedAt, null);
    assert.equal(promptStatus.completedAt, "2026-03-03T12:00:00Z");
    assert.equal(promptStatus.outputValidated, false);
    assert.equal(promptStatus.blockedReason, "waiting on review");
    assert.equal(result.executionLog.length, 1);
    assert.equal(result.executionLog[0].promptStem, undefined);
    assert.equal(result.executionLog[0].agent, undefined);
    assert.equal(result.executionLog[0].notes, undefined);
    assert.equal(result.notes, undefined);
  });
});
