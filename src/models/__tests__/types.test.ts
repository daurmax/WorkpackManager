import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, it } from "vitest";
import type { WorkpackMeta } from "../../models";

const FIXTURES_ROOT = path.resolve(process.cwd(), "src", "__fixtures__", "workpacks");

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function isPromptEntry(value: unknown): value is WorkpackMeta["prompts"][number] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.stem === "string" &&
    typeof candidate.agent_role === "string" &&
    Array.isArray(candidate.depends_on) &&
    Array.isArray(candidate.repos) &&
    typeof candidate.estimated_effort === "string"
  );
}

function isWorkpackMetaPayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.protocol_version === "string" &&
    Array.isArray(candidate.prompts) &&
    candidate.prompts.every((prompt) => isPromptEntry(prompt))
  );
}

function isWorkpackStatePayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.workpack_id === "string" &&
    typeof candidate.overall_status === "string" &&
    typeof candidate.last_updated === "string" &&
    typeof candidate.prompt_status === "object" &&
    candidate.prompt_status !== null
  );
}

describe("models type payload guards", () => {
  it("accepts a valid v6 metadata fixture payload", () => {
    const payload = readJson<unknown>(path.join(FIXTURES_ROOT, "valid-v6", "workpack.meta.json"));

    assert.equal(isWorkpackMetaPayload(payload), true);
    const typed = payload as WorkpackMeta;
    assert.equal(typed.id, "valid-v6");
    assert.equal(typed.prompts.length, 2);
  });

  it("accepts a valid v6 runtime state fixture payload", () => {
    const payload = readJson<unknown>(path.join(FIXTURES_ROOT, "valid-v6", "workpack.state.json"));

    assert.equal(isWorkpackStatePayload(payload), true);
    const statePayload = payload as Record<string, unknown>;
    assert.equal(statePayload.workpack_id, "valid-v6");
  });

  it("rejects payloads that do not expose required workpack shape", () => {
    const invalidPayload = readJson<unknown>(
      path.join(FIXTURES_ROOT, "invalid-missing-files", "workpack.meta.json")
    );

    const tampered = {
      ...(invalidPayload as Record<string, unknown>),
      prompts: [{ stem: "A0_invalid" }]
    };

    assert.equal(isWorkpackMetaPayload(tampered), false);
  });
});
