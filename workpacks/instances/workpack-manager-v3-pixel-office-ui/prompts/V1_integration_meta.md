---
depends_on: [A1_pixel_room_shell, A2_agent_animation_runtime, A3_desk_interactions_chat_preview, A4_git_diff_side_panel, A5_visual_polish_and_motion]
repos: [WorkpackManager]
---
# Integration and Verification Agent Prompt — V1 Gate

> Validate all required deliverables for merge readiness.

## READ FIRST

1. `workpacks/instances/workpack-manager-v3-pixel-office-ui/00_request.md`
2. `workpacks/instances/workpack-manager-v3-pixel-office-ui/01_plan.md`
3. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.meta.json`
4. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.state.json`
5. `workpacks/WORKPACK_OUTPUT_SCHEMA.json`
6. All completed prompt outputs: `outputs/A0_bootstrap.json`, `outputs/A1_pixel_room_shell.json`, `outputs/A2_agent_animation_runtime.json`, `outputs/A3_desk_interactions_chat_preview.json`, `outputs/A4_git_diff_side_panel.json`, `outputs/A5_visual_polish_and_motion.json`

## Context

Workpack: `workpack-manager-v3-pixel-office-ui`

This is the mandatory verification gate. It runs only after ALL A-series prompts (A0–A5) have completed successfully. The gate validates that every deliverable exists, every acceptance criterion has evidence, and the branch is merge-ready.

## Delivery Mode

- PR-based (the verification agent does NOT merge; it declares pass/fail)

## Objective

Run the integration gate: validate output payloads against the schema, verify acceptance criteria coverage, confirm all commits exist on the work branch, and produce a clear pass/fail decision.

## Implementation Requirements

### 1. Output JSON Validation

For each `outputs/*.json`:
- Validate against `workpacks/WORKPACK_OUTPUT_SCHEMA.json`.
- Verify `schema_version` is `"1.2"`.
- Verify `workpack` is `"workpack-manager-v3-pixel-office-ui"`.
- Verify `prompt` matches the file name stem.
- Verify `repos` includes `"WorkpackManager"`.

### 2. Build and Test Verification

```bash
npm run build
npm test
```

Both must pass with exit code 0.

### 3. Commit Verification

For each prior prompt output JSON:
1. Extract `artifacts.commit_shas`.
2. For each SHA, run `git log --oneline feature/workpack-manager-v3-pixel-office-ui | grep <SHA>` — fail on missing SHAs.
3. For each SHA, run `git show --stat <SHA>` and extract the changed file list.
4. Compare git changed files with that prompt's `change_details[].file` entries.
5. Record both mismatch classes:
   - File exists in commit but is missing from `change_details`.
   - File declared in `change_details` but absent from commit.

Set `artifacts.branch_verified` to `true` only when ALL commit checks pass.

### 4. DAG and Dependency Verification

- Verify the prompt DAG from `workpack.meta.json` is acyclic.
- Verify prompt completion order (from `workpack.state.json`) respects `depends_on` relationships.
- Verify every A-series prompt has a corresponding `outputs/<PROMPT>.json`.

### 5. Status/State File Consistency

- Confirm `workpack.state.json` shows all A-series prompts as `complete`.
- Confirm `99_status.md` is up to date with output references.

## Acceptance Criteria Coverage Table

Map each request-level AC to evidence from the implementation prompts:

| AC ID | Criterion Summary | Covering Prompt(s) | Status | Evidence |
|-------|-------------------|---------------------|--------|----------|
| AC1 | Pixel room with desks + fixed stations | A1 | pass/fail | Files created, visual inspection |
| AC2 | Desks show live runtime state | A1, A2 | pass/fail | Status binding verified |
| AC3 | Animated agent avatars with state-driven motion | A2 | pass/fail | Animation state machine verified |
| AC4 | Desk interaction assigns/controls agents | A3 | pass/fail | Command + menu integration verified |
| AC5 | Hover reveals chat preview | A3 | pass/fail | Hover delay + content rendering verified |
| AC6 | Git diff side panel grouped by repo | A4 | pass/fail | Panel opens, grouping correct |
| AC7 | Visual polish, coherent pixel-art | A5 | pass/fail | Palette, theme, motion audit |
| AC8 | Accessibility and reduced-motion fallback | A5 | pass/fail | `prefers-reduced-motion` + focus indicators |
| AC9 | Build and tests pass | V1 (this gate) | pass/fail | `npm run build` + `npm test` exit 0 |

## Constraints

- Do NOT write new feature code — this prompt only verifies.
- Do NOT merge the branch — only declare merge readiness.
- If any AC fails, list it as a blocking issue in the output.

## Acceptance Criteria

- [ ] AC1: All `outputs/*.json` validate against the output schema.
- [ ] AC2: `npm run build` exits 0.
- [ ] AC3: `npm test` exits 0.
- [ ] AC4: All commit SHAs from output JSONs exist on the work branch.
- [ ] AC5: File declaration in `change_details` matches actual commits.
- [ ] AC6: All 9 request-level ACs have pass/fail evidence.
- [ ] AC7: `artifacts.branch_verified` set to `true` (or `false` with blocker list).

## Verification

```bash
npm run build
npm test
git log --oneline feature/workpack-manager-v3-pixel-office-ui
```

## Handoff Output (JSON)

Write `outputs/V1_integration_meta.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "workpack-manager-v3-pixel-office-ui",
  "prompt": "V1_integration_meta",
  "component": "verification",
  "delivery_mode": "pr",
  "branch": {
    "base": "master",
    "work": "feature/workpack-manager-v3-pixel-office-ui",
    "merge_target": "master"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": [],
    "branch_verified": false
  },
  "changes": {
    "files_modified": [],
    "files_created": [],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "npm run build", "result": "pass", "notes": "" },
      { "cmd": "npm test", "result": "pass", "notes": "" },
      { "cmd": "git log --oneline feature/workpack-manager-v3-pixel-office-ui", "result": "pass", "notes": "" }
    ],
    "regression_added": false,
    "regression_notes": ""
  },
  "handoff": {
    "summary": "Integration gate executed. All ACs verified. Branch merge-ready.",
    "next_steps": ["R1_retrospective", "Merge PR to master"],
    "known_issues": []
  },
  "repos": ["WorkpackManager"],
  "execution": {
    "model": "<MODEL_ID>",
    "tokens_in": 0,
    "tokens_out": 0,
    "duration_ms": 0
  },
  "change_details": [],
  "notes": ""
}
```

## Deliverables

- [ ] All output JSONs validated against schema
- [ ] Build and tests pass
- [ ] Commit SHAs verified on work branch
- [ ] File declarations cross-referenced with commits
- [ ] AC coverage table completed with evidence
- [ ] Pass/fail decision documented
- [ ] `outputs/V1_integration_meta.json` written
