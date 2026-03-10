---
depends_on: []
repos: [WorkpackManager]
---
# Bootstrap Agent Prompt

> Baseline the current extension architecture and define scene/state contracts for the 0.0.3 pixel office UI.

## READ FIRST

1. `workpacks/instances/workpack-manager-v3-pixel-office-ui/00_request.md`
2. `workpacks/instances/workpack-manager-v3-pixel-office-ui/01_plan.md`
3. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.meta.json`
4. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.state.json`
5. `workpacks/_template/prompts/PROMPT_STYLE_GUIDE.md`
6. `src/extension.ts`
7. `src/views/workpack-detail-panel.ts`
8. `src/views/workpack-tree-provider.ts`
9. `src/views/active-agents-tree-provider.ts`
10. `src/agents/execution-registry.ts`
11. `src/agents/orchestrator.ts`
12. `src/agents/registry.ts`
13. `src/models/workpack-instance.ts`
14. `src/models/workpack-state.ts`
15. `src/models/workpack-meta.ts`
16. `package.json` — `contributes.views`, `contributes.commands`, `contributes.menus`

## Context

Workpack: `workpack-manager-v3-pixel-office-ui`

This is the architectural bootstrap for a pixel-art room-based workspace view that will coexist with the existing tree views (`workpackManager`, `workpackManager.activeAgents`) and the `WorkpackDetailPanel` webview.

## Delivery Mode

- PR-based

## Objective

Prepare the feature branch, audit the current extension UI surfaces, decide on the hosting surface for the pixel office scene, and define the data contracts that downstream prompts will implement. This prompt does NOT implement any rendering or animation — it produces decisions and contracts only.

## Reference Points

- **Extension activation**: `activate()` in `src/extension.ts` — registers `WorkpackTreeProvider`, `ActiveAgentsTreeProvider`, `ExecutionRegistry`, `ProviderRegistry`, and calls `registerCommands`.
- **Existing webview**: `WorkpackDetailPanel` in `src/views/workpack-detail-panel.ts` — singleton pattern via `createOrShow`, uses `vscode.window.createWebviewPanel` with inline HTML generation (`getHtmlContent`), CSP nonce handling (`getNonce`).
- **Tree provider**: `WorkpackTreeProvider` in `src/views/workpack-tree-provider.ts` — discovers and parses workpack instances from workspace folders, emits `WorkpackTreeItem` nodes.
- **Active agents**: `ActiveAgentsTreeProvider` in `src/views/active-agents-tree-provider.ts` — listens to `ExecutionRegistry.onDidChange`, renders running/completed agent run snapshots.
- **Execution registry**: `ExecutionRegistry` in `src/agents/execution-registry.ts` — `AgentRunSnapshot`, `AgentRunStatus` (`queued`, `in_progress`, `human_input_required`, `complete`, `failed`, `cancelled`), event-driven lifecycle.
- **Provider registry**: `ProviderRegistry` in `src/agents/registry.ts` — holds `CopilotProvider` and `CodexProvider`, exposed to commands for assignment.
- **Data models**: `WorkpackInstance` in `src/models/workpack-instance.ts`, `WorkpackState` / `PromptStatus` / `PromptStatusValue` in `src/models/workpack-state.ts`, `WorkpackMeta` / `PromptEntry` in `src/models/workpack-meta.ts`.
- **View contribution points**: `package.json` contributes `workpackManager` and `workpackManager.activeAgents` under `views.explorer`, with an activity-bar container `workpack-manager`.
- **Command wiring**: `registerCommands()` in `src/commands/register-commands.ts` — existing commands for `executePrompt`, `executeAll`, `showDetail`, etc.

## Implementation Requirements

1. **Branch verification**: confirm the current branch is `feature/workpack-manager-v3-pixel-office-ui` and that `npm run build` and `npm test` pass on the baseline.

2. **UI host decision**: evaluate hosting the pixel office as:
   - (a) A new `vscode.WebviewView` contributed to the sidebar (permanent panel), or
   - (b) A new `vscode.window.createWebviewPanel` (editor-tab hosted, like `WorkpackDetailPanel`), or
   - (c) An extension of the existing `WorkpackDetailPanel`.

   Document the decision with rationale. Prefer a new webview panel for maximum canvas control, keeping tree views operational as fallback.

3. **Scene model contract**: define TypeScript interfaces (signatures only) for the spatial entities:
   - `PixelRoom` — one per workpack, containing stations and desks.
   - `RoomStation` — fixed positions for `00_request.md`, `01_plan.md`, `99_status.md`, output board.
   - `PromptDesk` — one per prompt, with layout position, prompt stem, and runtime status binding.
   - `AgentAvatar` — visual representation of an agent run, bound to `AgentRunSnapshot`.
   - `AvatarAnimationState` — enum values: `idle`, `working`, `walking_to_board`, `pinning_output`, `hand_raised`, `leaving`.
   - `SceneState` — composite root that the webview receives as serialized data.

4. **Message protocol contract**: define the typed messages exchanged between extension host and webview:
   - Host → Webview: `SceneUpdate`, `AvatarTransition`, `DeskStatusChange`.
   - Webview → Host: `DeskClicked`, `DeskHovered`, `AgentAssignRequested`, `PromptActionRequested`.

5. **Data flow documentation**: document how runtime data flows:
   - `ExecutionRegistry` events → scene state adapter → `webview.postMessage`.
   - `WorkpackInstance`/`WorkpackState` → room/desk/station mapping.
   - User interactions in webview → `webview.onDidReceiveMessage` → VS Code command dispatch.

6. **Reusable state audit**: identify which existing models and registries can be consumed directly vs. need adapters. For example, `AgentRunSnapshot` maps cleanly to avatar state; `PromptStatusValue` maps to desk status; `WorkpackMeta.prompts` maps to desk layout.

7. **Test strategy decision**: decide whether the pixel office will have:
   - Scene model unit tests (pure TypeScript, no VS Code API dependency).
   - Message protocol tests (serialization/deserialization).
   - Integration tests deferred to V1.

   Record the decision so downstream prompts know what test coverage is expected.

## Constraints

- Do NOT implement rendering, animations, or visual assets.
- Do NOT add `package.json` contribution points yet (saved for A1).
- Do NOT break existing tree views, commands, or the detail panel.
- Place all new files under `src/views/pixel-office/` or `src/models/pixel-office/` to isolate the feature.

## Scope

### In Scope

- Branch verification and baseline build/test pass
- UI host decision and rationale
- Scene model interface definitions (TypeScript signatures only)
- Message protocol type definitions
- Data flow documentation
- Reusable state audit
- Test strategy decision

### Out of Scope

- Scene rendering implementation
- Animation logic
- Visual assets (sprites, colors, CSS)
- Git diff panel
- Any changes to `package.json` contribution points

## Acceptance Criteria

- [ ] AC1: Scene model interfaces exist as TypeScript files under the chosen directory.
- [ ] AC2: Message protocol types are defined for host↔webview communication.
- [ ] AC3: The UI host decision is documented with rationale.
- [ ] AC4: Data flow from `ExecutionRegistry`/`WorkpackState` to webview is documented.
- [ ] AC5: Test strategy is documented for downstream prompts.
- [ ] AC6: `npm run build` and `npm test` pass without regressions.

## Verification

```bash
npm run build
npm test
```

## Handoff Output (JSON)

Write `outputs/A0_bootstrap.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "workpack-manager-v3-pixel-office-ui",
  "prompt": "A0_bootstrap",
  "component": "bootstrap",
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
    "summary": "Architectural baseline complete. Scene model interfaces defined, UI host decided, data flow documented.",
    "next_steps": ["A1_pixel_room_shell and A4_git_diff_side_panel can proceed in parallel"],
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

- [ ] Branch verified and baseline checks pass
- [ ] UI host decision documented
- [ ] Scene model interfaces created
- [ ] Message protocol types defined
- [ ] Data flow documented
- [ ] Test strategy documented
- [ ] Commit(s) recorded in `artifacts.commit_shas`
- [ ] `outputs/A0_bootstrap.json` written
