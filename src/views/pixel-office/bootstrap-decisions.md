# Pixel Office Bootstrap Decisions

## Host Decision

Decision: host the pixel office in a new `vscode.window.createWebviewPanel`.

Rationale:

- The room UI needs predictable canvas size, freeform layout, and retained animation state that fits an editor-hosted panel better than a narrow explorer sidebar.
- The existing `WorkpackDetailPanel` already proves out the `createWebviewPanel` lifecycle, CSP nonce handling, and command bridge pattern, so A1 can reuse that model without coupling the pixel office to the current detail summary markup.
- Keeping `workpackManager` and `workpackManager.activeAgents` unchanged preserves a low-risk fallback path while the pixel office reaches parity.

Rejected alternatives:

- `vscode.WebviewView` in the sidebar: always visible, but width-constrained and a poor fit for a room scene with desks, avatars, hover previews, and a linked diff side panel.
- Extending `WorkpackDetailPanel`: mixes two distinct responsibilities in one class and makes the pixel office harder to evolve independently from the existing tabular detail view.

Implementation note for A1:

- Add a dedicated pixel-office panel class instead of mutating `WorkpackDetailPanel`.
- Reuse the existing panel security pattern: `enableScripts`, `retainContextWhenHidden`, local resource roots, nonce-based CSP, and `webview.onDidReceiveMessage`.

## Scene Contracts

Source contracts live in:

- `src/models/pixel-office/scene-contracts.ts`
- `src/views/pixel-office/message-protocol.ts`

Room mapping rules:

- One `PixelRoom` maps to one `WorkpackInstance`.
- Fixed `RoomStation` entries represent `00_request.md`, `01_plan.md`, `99_status.md`, and the output board.
- One `PromptDesk` maps to each `WorkpackMeta.prompts[]` entry.
- `AgentAvatar` is a view model over a live `AgentRunSnapshot`.
- `SceneState` is the serialized root payload sent to the webview.

## Runtime Data Flow

Host to webview:

1. Parse or refresh `WorkpackInstance` from disk.
2. Read `workpack.meta.json` and `workpack.state.json`.
3. Read `ExecutionRegistry` snapshots for active and latest prompt runs.
4. Adapt those sources into `SceneState`.
5. Send the initial full payload with `SceneUpdate`.
6. On runtime changes, send incremental `AvatarTransition` and `DeskStatusChange` messages, with a fallback full `SceneUpdate` when the adapter cannot derive a minimal delta safely.

Webview to host:

1. Desk interaction emits `DeskClicked`, `DeskHovered`, `AgentAssignRequested`, or `PromptActionRequested`.
2. The panel host receives messages through `webview.onDidReceiveMessage`.
3. The host translates each message into existing VS Code commands such as `workpackManager.assignAgent`, `workpackManager.executePrompt`, `workpackManager.stopPromptExecution`, `workpackManager.retryPrompt`, and file-open flows.
4. Tree views remain the source-of-truth fallback if the webview is hidden or unavailable.

## Reusable State Audit

| Existing source | Pixel office use | Reuse mode |
|---|---|---|
| `WorkpackInstance` | Room identity, title, folder path, overall workpack context | Direct |
| `WorkpackMeta.prompts` | Prompt desk list, prompt labels, role text, dependency edges | Direct |
| `WorkpackState.prompt_status` | Desk status coloring and terminal prompt outcome | Adapter |
| `WorkpackState.agent_assignments` | Default desk-assigned provider when no active run exists | Direct fallback |
| `ExecutionRegistry.AgentRunSnapshot` | Avatar identity, provider label, runtime timestamps, summary, error, input request | Direct |
| `ExecutionRegistry.onDidChangeRuns` | Trigger for incremental scene updates | Adapter |
| `ProviderRegistry` | Provider choices for `AgentAssignRequested` | Direct |
| `registerCommands` command IDs | Host dispatch target for desk actions | Direct |
| `WorkpackDetailPanel` webview patterns | CSP, retained context, message plumbing | Reuse pattern only |

Adapter work required:

- Convert `PromptStatusValue` and `AgentRunStatus` into the single desk-facing runtime status union.
- Resolve room coordinates and desk placement from prompt order plus a fixed station layout.
- Collapse latest-run and persisted-state data into one avatar list and one desk status per prompt.
- Derive output-board badges from `outputs/*.json` rather than storing duplicate state in workpack models.

## Test Strategy

Decision:

- Add scene model unit tests in A1/A2 for pure TypeScript adapters and layout helpers.
- Add message protocol tests in A1/A3 for message shape validation and round-trip serialization expectations.
- Defer VS Code webview integration tests to V1 once the panel exists and command wiring is stable.

Coverage expectation for downstream prompts:

- Pure scene builders should avoid VS Code API dependencies so they can be tested with Vitest.
- Message protocol tests should cover both host-to-webview and webview-to-host discriminated unions.
- Animation rendering, DOM timing, and panel contribution behavior are integration concerns and should not block A0.
