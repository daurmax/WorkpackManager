---
depends_on: [V1_integration_meta]
repos: [WorkpackManager]
---
# Retrospective Agent Prompt — R1

> Capture execution outcomes, quality trends, and process improvements after the verification gate passes.

## READ FIRST

1. `workpacks/instances/workpack-manager-v3-pixel-office-ui/00_request.md`
2. `workpacks/instances/workpack-manager-v3-pixel-office-ui/01_plan.md`
3. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.state.json`
4. All outputs: `outputs/A0_bootstrap.json` through `outputs/V1_integration_meta.json`

## Context

Workpack: `workpack-manager-v3-pixel-office-ui`

This prompt runs after V1 passes. It does not produce code — it documents what worked, what caused friction, and what improvements should be carried forward. Because this workpack introduced the first webview-based pixel-art UI to WorkpackManager, the retrospective should evaluate both the implementation outcomes and the suitability of the workpack protocol for visual/UI-heavy features.

## Delivery Mode

- PR-based (retrospective document committed alongside any final state file updates)

## Objective

Document execution outcomes, quality analysis, and actionable process improvements for future workpacks.

## Required Sections

### 1. Scope and Delivery Summary

- What was requested (pixel office UI, avatars, desk interactions, diff panel, visual polish).
- What was delivered (reference V1 AC coverage table).
- Any scope adjustments made during execution.

### 2. What Went Well

- Identify patterns that should be repeated. Consider:
  - Prompt decomposition effectiveness (was the A0→A1/A4 parallel, A2→A3→A5 chain well-balanced?).
  - Scene model contract from A0 (did it serve as effective glue between prompts?).
  - Message protocol reuse from `WorkpackDetailPanel`.

### 3. What Caused Friction

- Identify bottleneck or confusion points. Consider:
  - Webview testing challenges (was the test strategy from A0 sufficient?).
  - CSS pixel-art approach (was `image-rendering: pixelated` with CSS-only sprites viable, or would canvas/WebGL have been better?).
  - Theme integration complexity (dark vs light vs high-contrast).
  - Git extension API reliability and typing.

### 4. Defects and Rework Analysis

- Count B-series bug-fix prompts (if any were created).
- Identify which A-series prompts required rework and why.
- Categorize root causes (under-specified requirements, incorrect assumptions, integration mismatches).

### 5. Estimation Accuracy

- Compare planned prompt count and DAG structure against what actually executed.
- Note any prompts that took significantly longer than expected.
- Assess whether the 6-prompt (A0–A5) decomposition was appropriate or if more/fewer were needed.

### 6. Pixel-Office-Specific Lessons

This section goes beyond generic retrospective items to capture domain-specific learnings:

- **Visual design quality**: was the pixel-art aesthetic achieved? What would improve it?
- **Animation performance**: any jank or memory issues at scale?
- **Webview architecture**: was a single webview panel the right choice, or would multiple panels or a sidebar webview work better?
- **Accessibility**: did the reduced-motion and focus-indicator work feel adequate?
- **Developer experience**: how easy is it for a contributor to modify the pixel room after this workpack?

### 7. Action Items

| # | Action | Owner | Target |
|---|--------|-------|--------|
| 1 | _e.g., "Add webview snapshot tests to CI"_ | _team/agent_ | _next workpack_ |
| 2 | | | |

## Metrics

| Metric | Value |
|--------|-------|
| Total prompts executed | _A0 + A1–A5 + V1 + R1 = 8_ |
| First-pass completions (no B-series needed) | |
| B-series bug-fix count | |
| Total elapsed wall-clock time | |
| Longest single prompt duration | |
| Lines of code added (approx) | |
| Test count delta (before → after) | |

## Constraints

- Do NOT write feature code — this prompt only documents outcomes.
- Base the analysis on actual outputs and execution data, not speculation.
- Keep action items concrete and scoped (avoid "improve everything").

## Handoff Output (JSON)

Write `outputs/R1_retrospective.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "workpack-manager-v3-pixel-office-ui",
  "prompt": "R1_retrospective",
  "component": "retrospective",
  "delivery_mode": "pr",
  "branch": {
    "base": "master",
    "work": "feature/workpack-manager-v3-pixel-office-ui",
    "merge_target": "master"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": ["<COMMIT_SHA>"],
    "branch_verified": false
  },
  "changes": {
    "files_modified": [],
    "files_created": [],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [],
    "regression_added": false,
    "regression_notes": ""
  },
  "handoff": {
    "summary": "Retrospective completed. Action items documented for future workpacks.",
    "next_steps": ["Merge PR to master", "Archive workpack instance"],
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

- [ ] All 7 required sections written with evidence-based analysis
- [ ] Metrics table populated with actual data
- [ ] Action items are concrete and scoped
- [ ] `outputs/R1_retrospective.json` written
