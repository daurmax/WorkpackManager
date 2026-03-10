# Plan

## Summary

Deliver WorkpackManager 0.0.3 as a high-touch pixel-art control room where each workpack is spatially represented as a room and each prompt as a desk with live state, direct controls, animated agent avatars, and integrated repository-aware Git diff inspection. The work will keep existing orchestration and command infrastructure intact while layering a richer graphical workspace that can gradually become the primary operational surface.

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Baseline architecture, feature branch, and scene/state contract audit | A0_bootstrap | - | S |
| 2 | Pixel room shell and room-to-workpack mapping | A1_pixel_room_shell | 1 | L |
| 3 | Agent avatar animation runtime and state choreography | A2_agent_animation_runtime | 1, 2 | L |
| 4 | Desk interaction model, assignment menus, and hover chat previews | A3_desk_interactions_chat_preview | 1, 2 | L |
| 5 | Repository-grouped Git diff side panel | A4_git_diff_side_panel | 1 | M |
| 6 | Visual polish, motion tuning, accessibility fallback, final composition | A5_visual_polish_and_motion | 3, 4, 5 | M |
| 7 | Integration gate | V1_integration_meta | 6 | M |
| 8 | Retrospective | R1_retrospective | 7 | XS |

Effort scale: XS <30m, S 30m-2h, M 2h-4h, L 4h-8h, XL >8h.

## DAG Dependencies

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_pixel_room_shell | [A0_bootstrap] | [WorkpackManager] |
| A2_agent_animation_runtime | [A0_bootstrap, A1_pixel_room_shell] | [WorkpackManager] |
| A3_desk_interactions_chat_preview | [A0_bootstrap, A1_pixel_room_shell] | [WorkpackManager] |
| A4_git_diff_side_panel | [A0_bootstrap] | [WorkpackManager] |
| A5_visual_polish_and_motion | [A2_agent_animation_runtime, A3_desk_interactions_chat_preview, A4_git_diff_side_panel] | [WorkpackManager] |
| V1_integration_meta | [A5_visual_polish_and_motion] | [WorkpackManager] |
| R1_retrospective | [V1_integration_meta] | [WorkpackManager] |

## Cross-Workpack References

requires_workpack: []

## Parallelization Map

```
Phase 0 (sequential):  A0_bootstrap
Phase 1 (parallel):    A1_pixel_room_shell, A4_git_diff_side_panel
Phase 2 (parallel):    A2_agent_animation_runtime, A3_desk_interactions_chat_preview
Phase 3 (sequential):  A5_visual_polish_and_motion
Phase 4 (sequential):  V1_integration_meta
Phase 5 (post-merge):  R1_retrospective
```

### B-series DAG (post-verification)

Populate this section only if V1 generates B-series bug-fix prompts.

| B Prompt | depends_on | DAG Depth | Parallel Group | Notes |
|----------|------------|-----------|----------------|-------|
| B1_example_fix | [] | 0 | P0 | Placeholder only |

## Branch Strategy

| Component | Branch | Base | PR Target |
|-----------|--------|------|-----------|
| Pixel office UI feature | feature/workpack-manager-v3-pixel-office-ui | master | master |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Pixel-art UI becomes a cosmetic shell with weak operational depth | Med | High | Tie every visual node to real runtime state and commands from the first slice |
| Animated scene becomes too complex for maintainability | Med | High | Isolate scene model, rendering helpers, and state adapters into composable modules |
| Git diff side panel becomes slow on large repositories | Med | Med | Cache diff snapshots, group by repo, and lazy-load detailed hunks |
| Hover chat previews expose too much noisy content | Med | Med | Use compact previews with truncation and latest-message prioritization |
| Motion-heavy UI hurts accessibility or usability | Low | High | Provide reduced-motion path and non-animated fallback state signals |

## Security and Tool Safety

- No secrets in prompts, state, preview payloads, or outputs.
- Limit writes to repository workspace only.
- Do not execute arbitrary shell commands from the graphical layer without reusing existing command infrastructure.
- Treat diff rendering as read-only inspection.

## Handoff Outputs Plan

- Each completed prompt writes `outputs/<PROMPT>.json`.
- Schema: `workpacks/WORKPACK_OUTPUT_SCHEMA.json`.
- Output JSON MUST include `repos`, `execution`, and `change_details`.
- `V1_integration_meta` validates outputs, UX acceptance criteria, and verification commands.
- `workpack.state.json` is updated after each prompt completion.
