import { strict as assert } from "node:assert";
import { describe, it } from "vitest";
import type { OverallStatus, PromptStatusValue } from "../../models";
import {
  PROMPT_STATUS_ICONS,
  WORKPACK_STATUS_ICONS,
  getPromptStatusIcon,
  getPromptStatusSortOrder,
  getPromptThemeIcon,
  getWorkpackStatusIcon,
  getWorkpackStatusSortOrder,
  getWorkpackThemeIcon
} from "../status-icons";

describe("status-icons", () => {
  it("returns icon metadata for every declared workpack and prompt status", () => {
    const workpackStatuses: OverallStatus[] = [
      "not_started",
      "in_progress",
      "blocked",
      "review",
      "complete",
      "abandoned"
    ];
    const promptStatuses: PromptStatusValue[] = ["pending", "in_progress", "complete", "blocked", "skipped"];

    for (const status of workpackStatuses) {
      assert.equal(getWorkpackStatusIcon(status), WORKPACK_STATUS_ICONS[status]);
    }

    for (const status of promptStatuses) {
      assert.equal(getPromptStatusIcon(status), PROMPT_STATUS_ICONS[status]);
    }
  });

  it("uses unknown and pending fallbacks for unsupported statuses", () => {
    const unknown = getWorkpackStatusIcon("unknown");
    assert.equal(unknown.codicon, "question");
    assert.equal(unknown.label, "Unknown");
    assert.equal(unknown.sortOrder, Number.MAX_SAFE_INTEGER);

    const invalidWorkpack = getWorkpackStatusIcon("bad-status" as unknown as OverallStatus);
    assert.equal(invalidWorkpack, unknown);

    const pending = PROMPT_STATUS_ICONS.pending;
    const invalidPrompt = getPromptStatusIcon("bad-status" as unknown as PromptStatusValue);
    assert.equal(invalidPrompt, pending);
  });

  it("builds theme icons from resolved status metadata", () => {
    const workpackTheme = getWorkpackThemeIcon("complete");
    assert.equal(workpackTheme.id, "check");
    assert.equal(workpackTheme.color?.id, "testing.iconPassed");

    const promptTheme = getPromptThemeIcon("skipped");
    assert.equal(promptTheme.id, "debug-step-over");
    assert.equal(promptTheme.color?.id, "disabledForeground");
  });

  it("returns status sort order values from icon metadata", () => {
    assert.equal(getWorkpackStatusSortOrder("not_started"), 0);
    assert.equal(getWorkpackStatusSortOrder("complete"), 4);
    assert.equal(getWorkpackStatusSortOrder("unknown"), Number.MAX_SAFE_INTEGER);

    assert.equal(getPromptStatusSortOrder("pending"), 0);
    assert.equal(getPromptStatusSortOrder("skipped"), 4);
  });
});
