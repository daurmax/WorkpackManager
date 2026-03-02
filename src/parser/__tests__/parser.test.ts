import { strict as assert } from "node:assert";
import * as path from "node:path";
import { describe, it } from "vitest";
import {
  parseWorkpackInstance,
  parseWorkpackMarkdownFallback,
  parseWorkpackMeta,
  parseWorkpackState
} from "../workpack-parser";

const FIXTURES_ROOT = path.resolve(process.cwd(), "src", "__fixtures__", "workpacks");

function fixturePath(name: string): string {
  return path.join(FIXTURES_ROOT, name);
}

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
});
