---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A1_pixel_room_shell

> Build the pixel-art room shell that turns a workpack into an explorable room with desks and fixed stations.

## READ FIRST

1. `workpacks/instances/workpack-manager-v3-pixel-office-ui/00_request.md`
2. `workpacks/instances/workpack-manager-v3-pixel-office-ui/01_plan.md`
3. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.meta.json`
4. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.state.json`
5. `outputs/A0_bootstrap.json` — UI host decision, scene model interfaces, message protocol
6. Scene model interfaces produced by A0 (under `src/views/pixel-office/` or `src/models/pixel-office/`)
7. `src/views/workpack-detail-panel.ts` — existing webview panel pattern
8. `src/views/workpack-tree-provider.ts` — workpack selection and data discovery
9. `src/models/workpack-instance.ts` — `WorkpackInstance` shape
10. `src/models/workpack-meta.ts` — `WorkpackMeta`, `PromptEntry`
11. `src/models/workpack-state.ts` — `WorkpackState`, `PromptStatus`
12. `package.json` — current contribution points

## Context

Workpack: `workpack-manager-v3-pixel-office-ui`

This prompt implements the first visible layer: a pixel-art room rendered in a VS Code webview, driven by real workpack data. The UI host and scene model contracts are defined in A0's output.

## Delivery Mode

- PR-based

## Objective

Create a functional pixel-art room view that can be opened for any discovered workpack. The room must render fixed stations for the always-present workpack documents (request, plan, status, outputs) and a desk for each prompt in the workpack's prompt DAG. The room must reflect the real workpack structure — not hardcoded test data.

## Reference Points

- **Webview panel pattern**: Follow the `WorkpackDetailPanel.createOrShow` singleton pattern for panel lifecycle management, including `onDidDispose` cleanup and `reveal()` for existing panels.
- **HTML generation**: Follow the CSP-nonce-based HTML generation pattern from `WorkpackDetailPanel.getHtmlContent` and `getNonce`.
- **Scene model**: Use the `PixelRoom`, `RoomStation`, `PromptDesk`, and `SceneState` interfaces defined by A0.
- **Message protocol**: Use the host→webview and webview→host message types defined by A0.
- **Workpack data**: Use `WorkpackInstance.meta.prompts` for desk generation, `WorkpackInstance.state.prompt_status` for desk visual state, and `WorkpackInstance.folderPath` for document station paths.
- **Tree integration**: The room should be openable via a command (e.g., `workpackManager.openPixelRoom`) triggered from the workpack tree node, similar to how `showDetail` opens `WorkpackDetailPanel`.

## Implementation Requirements

1. **Webview panel**: register a new webview panel type following the UI host decision from A0. Add the corresponding `package.json` contribution point (view or command registration).

2. **Room layout engine**: implement a layout algorithm that:
   - Places fixed stations (request, plan, status, output board) at predictable room positions.
   - Places prompt desks in a grid or row arrangement, scaling reasonably for 1–12 prompts.
   - Produces absolute pixel positions for each element.

3. **Pixel-art rendering**: the webview HTML/CSS must use a deliberately pixelated visual style:
   - Use a limited color palette (8–16 colors) and crisp edges (no anti-aliasing on key elements).
   - Render desks and stations as distinct pixel-art furniture sprites or CSS-drawn shapes.
   - Use a tiled or solid-color room background.
   - Apply `image-rendering: pixelated` where raster sprites are used.

4. **Data binding**: populate the room from real `WorkpackInstance` data:
   - Station labels from document filenames.
   - Desk labels from `PromptEntry.stem`.
   - Desk visual state from `PromptStatus.status` (color coding or status indicator).

5. **Selection binding**: the room must update when the user selects a different workpack (either via tree interaction or a workpack switcher within the room).

6. **Modular composition**: keep room rendering, layout, and data mapping in separate modules so A2 (avatars), A3 (interactions), and A5 (polish) can extend the room without conflicts.

7. **Command registration**: register `workpackManager.openPixelRoom` command and add a tree context menu entry or title action so users can open the room from the workpack tree.

## Constraints

- Do NOT implement avatar rendering or animation — that belongs to A2.
- Do NOT implement desk click/hover interactions — that belongs to A3.
- Do NOT implement the Git diff panel — that belongs to A4.
- Keep the room visually appealing but intentionally incomplete (no avatars, no overlays).
- The pixel-art style must be evident even without final polish (A5).
- Existing tree views, commands, and the detail panel must remain functional.

## Scope

### In Scope

- Webview panel registration and lifecycle
- Room layout engine
- Pixel-art CSS and visual treatment
- Fixed station and prompt desk rendering
- Data binding from `WorkpackInstance`
- Command registration for opening the room
- `package.json` contribution-point updates
- Scene model unit tests for layout logic (per A0 test strategy)

### Out of Scope

- Avatar rendering/animation (A2)
- Desk click/hover interactions (A3)
- Git diff side panel (A4)
- Final visual polish and motion tuning (A5)

## Acceptance Criteria

- [ ] AC1: A pixel-art room renders for a selected workpack with desks for each prompt and stations for fixed documents.
- [ ] AC2: Prompt desks visually reflect their runtime status via color coding or status indicators.
- [ ] AC3: The pixel-art style is immediately recognizable (not plain HTML/default styling).
- [ ] AC4: The room updates when a different workpack is selected.
- [ ] AC5: `npm run build` and `npm test` pass.

## Verification

```bash
npm run build
npm test
```

## Handoff Output (JSON)

Write `outputs/A1_pixel_room_shell.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "workpack-manager-v3-pixel-office-ui",
  "prompt": "A1_pixel_room_shell",
  "component": "room-shell",
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
    "summary": "Pixel room shell implemented with station and desk rendering, pixel-art styling, and workpack data binding.",
    "next_steps": ["A2_agent_animation_runtime and A3_desk_interactions_chat_preview can start"],
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

- [ ] Pixel room webview panel implemented and registered
- [ ] Room layout engine with stations and desks
- [ ] Pixel-art visual treatment applied
- [ ] Data binding from workpack model to room elements
- [ ] Command registered and accessible from tree view
- [ ] `package.json` contribution points updated
- [ ] Scene model / layout unit tests added
- [ ] Commit(s) recorded in `artifacts.commit_shas`
- [ ] `outputs/A1_pixel_room_shell.json` written
