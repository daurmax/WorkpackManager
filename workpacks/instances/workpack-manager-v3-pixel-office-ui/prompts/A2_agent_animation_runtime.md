---
depends_on: [A0_bootstrap, A1_pixel_room_shell]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A2_agent_animation_runtime

> Animate agent avatars so runtime activity becomes spatially visible inside the pixel-art room.

## READ FIRST

1. `workpacks/instances/workpack-manager-v3-pixel-office-ui/00_request.md`
2. `workpacks/instances/workpack-manager-v3-pixel-office-ui/01_plan.md`
3. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.meta.json`
4. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.state.json`
5. `outputs/A0_bootstrap.json` — scene model, avatar interfaces, message protocol
6. `outputs/A1_pixel_room_shell.json` — room structure, rendering modules, template used
7. Scene model interfaces produced by A0 (especially `AgentAvatar`, `AvatarAnimationState`)
8. Room rendering modules produced by A1
9. `src/agents/execution-registry.ts` — `ExecutionRegistry`, `AgentRunSnapshot`, `AgentRunStatus`, `onDidChange` event
10. `src/views/active-agents-tree-provider.ts` — how `ActiveAgentsTreeProvider` maps run status to display (for reference)

## Context

Workpack: `workpack-manager-v3-pixel-office-ui`

This prompt adds animated agent avatars to the pixel-art room built by A1. Avatars are bound to live runtime data from `ExecutionRegistry` and visually represent what agents are doing in the workspace.

## Delivery Mode

- PR-based

## Objective

Introduce agent avatars into the pixel-art room scene so that active agent runs are spatially visible. Each avatar must reflect the associated prompt's runtime status with distinct visual behavior: sitting at a desk while working, moving toward an output board on completion, and raising a hand when manual input is required.

## Reference Points

- **Execution registry**: `ExecutionRegistry` in `src/agents/execution-registry.ts` — `startAgentRun`, `updateAgentRun`, `completeAgentRun`, `cancelAgentRun`. The `onDidChange` event fires on every status transition. `AgentRunSnapshot` contains `promptStem`, `status`, `providerId`, `startedAt`.
- **Agent run status enum**: `AgentRunStatus` — `queued`, `in_progress`, `human_input_required`, `complete`, `failed`, `cancelled`.
- **Scene model contracts**: `AgentAvatar` and `AvatarAnimationState` interfaces from A0.
- **Room rendering**: The pixel-art room shell from A1 provides the canvas/container, desk positions, and output board location. Build avatar rendering as a composable layer on top of the room shell.
- **Active agents tree**: `ActiveAgentsTreeProvider.getActiveAgentContextValue()` maps status to context values — reference for status-to-visual mapping logic.
- **Prompt desk positions**: The layout engine from A1 provides absolute desk coordinates for avatar placement.

## Implementation Requirements

1. **Avatar rendering**: render small person-shaped pixel-art sprites at desk positions. Each avatar should:
   - Be visually distinct enough to identify (optionally show a label with `providerId` — `copilot` or `codex`).
   - Use a limited sprite set (idle, working, walking, hand-raised) — can be CSS-drawn or tiny inline images.

2. **Status-to-animation mapping**: bind `AgentRunStatus` to `AvatarAnimationState`:
   - `queued` → avatar appears at desk in `idle` pose.
   - `in_progress` → avatar at desk in `working` pose (subtle animation loop, e.g., bobbing or typing).
   - `human_input_required` → avatar at desk with `hand_raised` (visually prominent signal).
   - `complete` → avatar transitions to `walking_to_board`, then `pinning_output` at the output board area.
   - `failed` → avatar at desk with a failure indicator (red glow, X mark, or slumped pose).
   - `cancelled` → avatar fades out or walks away.

3. **Event-driven updates**: listen to `ExecutionRegistry.onDidChange` in the extension host and dispatch `AvatarTransition` messages to the webview via `postMessage`. The webview must handle these messages to update avatar positions and animation states.

4. **Completion choreography**: when a prompt completes, animate the avatar moving from its desk toward the output board station. This can be a simple CSS transition (translate over ~500ms) rather than sprite-based frame animation.

5. **Reduced-motion fallback**: when `prefers-reduced-motion` is active or animations are globally disabled:
   - Skip movement transitions — avatars appear directly at their final position.
   - Replace animation loops with static status badges on the avatar.
   - Ensure all states remain distinguishable without motion cues (use color + icon).

6. **Multiple concurrent avatars**: support multiple agents running simultaneously (one per prompt desk). The room must not break when 0, 1, or many avatars are active.

7. **Avatar lifecycle**: avatars should appear when a run starts and eventually leave the scene after completion (with configurable linger time or manual dismissal). Do NOT leave stale avatars visible indefinitely.

## Constraints

- Do NOT implement desk click/hover interactions — that belongs to A3.
- Do NOT modify the room layout engine or station/desk structure from A1.
- Do NOT implement the Git diff panel — that belongs to A4.
- Keep animation logic in a separate module (e.g., `src/views/pixel-office/avatar-renderer.ts`) — do not pollute the room shell code.
- Animations must be lightweight: prefer CSS transitions and transforms over JavaScript requestAnimationFrame loops where possible.

## Scope

### In Scope

- Avatar sprite/CSS rendering
- Status-to-animation-state mapping
- `ExecutionRegistry.onDidChange` event wiring to webview messages
- Completion choreography (desk → output board transition)
- Reduced-motion fallback path
- Multi-avatar rendering support
- Avatar lifecycle management (appear/leave)
- Unit tests for status-to-animation mapping logic

### Out of Scope

- Desk click/hover menus (A3)
- Chat preview overlays (A3)
- Room layout changes (A1)
- Git diff panel (A4)
- Final animation timing/polish (A5)

## Acceptance Criteria

- [ ] AC1: An avatar appears at the corresponding desk when an agent run starts.
- [ ] AC2: Avatar visual state changes in response to `AgentRunStatus` transitions (working, hand-raised, etc.).
- [ ] AC3: Completed prompts trigger a visible transition toward the output board area.
- [ ] AC4: Reduced-motion mode communicates the same states without animation.
- [ ] AC5: Multiple concurrent avatars render correctly without overlapping or breaking layout.
- [ ] AC6: `npm run build` and `npm test` pass.

## Verification

```bash
npm run build
npm test
```

## Handoff Output (JSON)

Write `outputs/A2_agent_animation_runtime.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "workpack-manager-v3-pixel-office-ui",
  "prompt": "A2_agent_animation_runtime",
  "component": "avatar-runtime",
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
    "commands": [
      { "cmd": "npm run build", "result": "pass", "notes": "" },
      { "cmd": "npm test", "result": "pass", "notes": "" }
    ],
    "regression_added": false,
    "regression_notes": ""
  },
  "handoff": {
    "summary": "Agent avatars render at desks with status-driven animation, completion choreography, and reduced-motion fallback.",
    "next_steps": ["A5_visual_polish_and_motion can start after A3 and A4 complete"],
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

- [ ] Avatar rendering module implemented
- [ ] Status-to-animation mapping logic
- [ ] Event wiring from `ExecutionRegistry` to webview
- [ ] Completion choreography (desk → board)
- [ ] Reduced-motion fallback
- [ ] Multi-avatar support validated
- [ ] Unit tests for mapping logic
- [ ] Commit(s) recorded in `artifacts.commit_shas`
- [ ] `outputs/A2_agent_animation_runtime.json` written
