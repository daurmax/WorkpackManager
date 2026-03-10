---
depends_on: [A0_bootstrap, A1_pixel_room_shell]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A3_desk_interactions_chat_preview

> Make desks interactive for agent assignment, prompt controls, and hover chat preview.

## READ FIRST

1. `workpacks/instances/workpack-manager-v3-pixel-office-ui/00_request.md`
2. `workpacks/instances/workpack-manager-v3-pixel-office-ui/01_plan.md`
3. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.meta.json`
4. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.state.json`
5. `outputs/A0_bootstrap.json` — message protocol, scene model, data flow contract
6. `outputs/A1_pixel_room_shell.json` — room structure, desk rendering, layout positions
7. Room rendering modules produced by A1 (desk element structure, event surface)
8. `src/commands/register-commands.ts` — existing commands: `executePrompt`, `stopExecution`, `retryExecution`, `provideHumanInput`, `assignAgent`
9. `src/agents/registry.ts` — `ProviderRegistry`, `listAll()` for available providers
10. `src/agents/execution-registry.ts` — `ExecutionRegistry`, `AgentRunSnapshot`, `HumanInputHandler`
11. `src/views/workpack-tree-item.ts` — `toPromptContextValue()` for status-aware context values
12. `src/views/workpack-detail-panel.ts` — existing webview message handling pattern

## Context

Workpack: `workpack-manager-v3-pixel-office-ui`

This prompt turns passive desk/station elements from A1 into interactive control surfaces. Users should be able to operate the entire prompt lifecycle (assign, execute, stop, retry, provide input) and inspect agent activity directly from the graphical room — without falling back to tree menus.

## Delivery Mode

- PR-based

## Objective

Add click and hover interactions to prompt desks so users can assign agents, trigger prompt controls, and preview ongoing agent conversations, all within the pixel-art room webview.

## Reference Points

- **Existing commands**: `registerCommands()` in `src/commands/register-commands.ts` — the same command IDs used by tree context menus (`workpackManager.executePrompt`, `workpackManager.stopExecution`, `workpackManager.retryExecution`, `workpackManager.provideHumanInput`, `workpackManager.assignAgent`).
- **Provider listing**: `ProviderRegistry.listAll()` returns available `AgentProvider` instances with `id` and `capabilities`.
- **Message protocol**: Use the webview→host message types defined by A0 (`DeskClicked`, `DeskHovered`, `AgentAssignRequested`, `PromptActionRequested`).
- **Runtime context**: `AgentRunSnapshot` provides current status and `providerId` for determining which actions are available (e.g., stop only when `in_progress`, retry only after `failed`).
- **Status-aware actions**: Reference `toPromptContextValue()` mapping in `src/views/workpack-tree-item.ts` for determining which actions are valid per status. The room UI should expose an equivalent set of actions.
- **Detail panel message handling**: `WorkpackDetailPanel` uses `webview.onDidReceiveMessage` in `src/views/workpack-detail-panel.ts` — follow the same pattern for room webview dispatching.

## Implementation Requirements

1. **Desk click interaction**: clicking a desk opens a contextual action menu (e.g., a quick-pick or an in-room overlay) showing available actions based on the prompt's current status:
   - `pending` / no agent: "Assign Copilot", "Assign Codex".
   - `pending` + agent assigned: "Execute".
   - `in_progress`: "Stop".
   - `failed` / `cancelled`: "Retry", "Re-assign".
   - `human_input_required`: "Provide Input".
   - `complete`: "View Output".

2. **Agent assignment**: implement the webview→host `AgentAssignRequested` message flow. The host calls `vscode.commands.executeCommand('workpackManager.assignAgent', ...)` or directly uses the `ProviderRegistry`. Show agent options (`copilot`, `codex`) in a quick-pick or in-room dropdown.

3. **Prompt action dispatch**: implement `PromptActionRequested` messages that map to existing VS Code commands. The webview sends the action type and prompt stem; the host resolves the command and arguments.

4. **Hover chat preview**: when the user hovers over (or focuses) a desk, display a compact overlay showing:
   - The agent provider name and current status.
   - The latest message or output excerpt from the agent conversation (if available via `ExecutionRegistry` or a future chat transcript source).
   - Truncation at a reasonable length (e.g., 200 characters) with a "View Full Chat" link.
   - If no chat data is available, show the prompt objective from `PromptEntry.agent_role`.

5. **Hover implementation**: use CSS-based tooltips or a positioned overlay div. The hover must:
   - Appear after a short delay (~300ms) to avoid flicker.
   - Dismiss when the pointer leaves the desk area.
   - Be keyboard-accessible (show on focus, dismiss on blur).
   - Not obstruct adjacent desks.

6. **Keyboard accessibility**: all desk interactions must be operable via keyboard (Tab to focus desk, Enter to open action menu, Escape to dismiss).

7. **Interaction consistency**: the set of actions available per status must match the actions available in tree context menus (same runtime checks, same safety guards).

## Constraints

- Do NOT modify avatar rendering or animation logic from A2.
- Do NOT modify room layout or station rendering from A1.
- Do NOT implement the Git diff panel — that belongs to A4.
- Reuse existing VS Code command infrastructure — do not duplicate command logic.
- Hover previews should be lightweight and not increase webview memory significantly.

## Scope

### In Scope

- Desk click → action menu flow
- Agent assignment from room UI
- Prompt action dispatch (execute, stop, retry, provide input)
- Hover/focus chat preview overlay
- Keyboard accessibility for desk interactions
- Message protocol wiring for desk interactions
- Tests for action-availability logic per status

### Out of Scope

- Avatar animation changes (A2)
- Room layout changes (A1)
- Git diff panel (A4)
- Visual polish beyond functional styling (A5)

## Acceptance Criteria

- [ ] AC1: Clicking a desk shows contextual actions appropriate for the prompt's current status.
- [ ] AC2: An agent (copilot or codex) can be assigned to a prompt directly from the room UI.
- [ ] AC3: Prompt controls (execute, stop, retry, provide input) work from the room without needing tree menus.
- [ ] AC4: Hovering/focusing a desk reveals a compact chat/status preview.
- [ ] AC5: All desk interactions are keyboard-accessible.
- [ ] AC6: `npm run build` and `npm test` pass.

## Verification

```bash
npm run build
npm test
```

## Handoff Output (JSON)

Write `outputs/A3_desk_interactions_chat_preview.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "workpack-manager-v3-pixel-office-ui",
  "prompt": "A3_desk_interactions_chat_preview",
  "component": "desk-interactions",
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
    "summary": "Desk interactions implemented with contextual actions, agent assignment, and hover chat previews.",
    "next_steps": ["A5_visual_polish_and_motion can start after A2 and A4 complete"],
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

- [ ] Desk click → action menu implemented
- [ ] Agent assignment flow from room UI
- [ ] Prompt action dispatch via existing commands
- [ ] Hover/focus chat preview overlay
- [ ] Keyboard accessibility for desks
- [ ] Tests for action-availability logic
- [ ] Commit(s) recorded in `artifacts.commit_shas`
- [ ] `outputs/A3_desk_interactions_chat_preview.json` written
