import { strict as assert } from "node:assert";
import * as path from "node:path";
import { describe, it } from "node:test";
import {
  parseWorkpackInstance,
  parseWorkpackMarkdownFallback,
  parseWorkpackMeta,
  parseWorkpackState
} from "../../parser/workpack-parser";

const FIXTURES_ROOT = path.resolve(process.cwd(), "src", "test", "parser", "fixtures");

function fixturePath(...segments: string[]): string {
  return path.join(FIXTURES_ROOT, ...segments);
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

describe("parser", () => {
  it("parses schema-valid semver metadata from workpack.meta.json", async () => {
    const folderPath = fixturePath(
      "workspace-a",
      "workpacks",
      "instances",
      "sample-group",
      "01_sample-group_parser-v6"
    );

    const meta = await parseWorkpackMeta(folderPath);

    assert.ok(meta);
    assert.equal(meta.id, "01_sample-group_parser-v6");
    assert.equal(meta.protocolVersion, "2.0.0");
    assert.equal(meta.prompts.length, 2);
    assert.equal(meta.prompts[1].dependsOn[0], "A0_bootstrap");
  });

  it("parses runtime state from workpack.state.json", async () => {
    const folderPath = fixturePath(
      "workspace-a",
      "workpacks",
      "instances",
      "sample-group",
      "01_sample-group_parser-v6"
    );

    const state = await parseWorkpackState(folderPath);

    assert.ok(state);
    assert.equal(state.workpackId, "01_sample-group_parser-v6");
    assert.equal(state.overallStatus, "in_progress");
    assert.equal(state.promptStatus.A1_parser.status, "in_progress");
  });

  it("extracts legacy metadata from markdown fallback", async () => {
    const folderPath = fixturePath(
      "workspace-a",
      "workpacks",
      "instances",
      "sample-group",
      "02_sample-group_legacy-fallback"
    );

    const fallback = await parseWorkpackMarkdownFallback(folderPath);

    assert.equal(fallback.deliveryMode, "pr");
    assert.equal(fallback.targetBranch, "main");
    assert.ok(fallback.prompts);
    assert.equal(fallback.prompts.length, 2);
    assert.deepEqual(fallback.requiresWorkpack, ["01_sample-group_parser-v6"]);
  });

  it("parses workpack instance using metadata when available", async () => {
    const folderPath = fixturePath(
      "workspace-a",
      "workpacks",
      "instances",
      "sample-group",
      "01_sample-group_parser-v6"
    );

    const instance = await parseWorkpackInstance(folderPath);

    assert.equal(instance.protocolVersion, "2.0.0");
    assert.equal(instance.meta.id, "01_sample-group_parser-v6");
    assert.equal(instance.state?.workpackId, "01_sample-group_parser-v6");
  });

  it("falls back to markdown parsing for legacy workpacks", async () => {
    const folderPath = fixturePath(
      "workspace-a",
      "workpacks",
      "instances",
      "sample-group",
      "02_sample-group_legacy-fallback"
    );

    const instance = await parseWorkpackInstance(folderPath);

    assert.equal(instance.protocolVersion, "5");
    assert.equal(instance.meta.id, "02_sample-group_legacy-fallback");
    assert.equal(instance.meta.deliveryMode, "pr");
    assert.equal(instance.meta.prompts[1].stem, "A1_parser_indexer");
    assert.equal(instance.state, null);
  });

  it("returns null for malformed metadata JSON", async () => {
    const folderPath = fixturePath("workspace-b", "workpacks", "instances", "bad-workpack");
    const meta = await parseWorkpackMeta(folderPath);

    assert.equal(meta, null);
  });

  it("returns null for malformed state JSON shape", async () => {
    const folderPath = fixturePath("malformed-state");
    const state = await parseWorkpackState(folderPath);

    assert.equal(state, null);
  });

  it("rejects schema-invalid metadata payload with non-crashing warning", async () => {
    const folderPath = fixturePath("schema-invalid-meta");
    const { result, warnings } = await captureWarnings(async () => parseWorkpackMeta(folderPath));

    assert.equal(result, null);
    assert.equal(
      warnings.some((warning) => warning.includes("Schema validation failed")),
      true
    );
  });

  it("rejects schema-invalid state payload with non-crashing warning", async () => {
    const folderPath = fixturePath("schema-invalid-state");
    const { result, warnings } = await captureWarnings(async () => parseWorkpackState(folderPath));

    assert.equal(result, null);
    assert.equal(
      warnings.some((warning) => warning.includes("Schema validation failed")),
      true
    );
  });

  it("throws when neither metadata nor fallback markdown files are parseable", async () => {
    const folderPath = fixturePath("workspace-b", "workpacks", "instances", "bad-workpack");

    await assert.rejects(async () => {
      await parseWorkpackInstance(folderPath);
    });
  });
});
