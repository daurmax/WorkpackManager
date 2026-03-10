# Request

## Workpack Protocol Version

Workpack Protocol Version: 3.0.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `pixel-office-ui`

For version 0.0.3 of WorkpackManager, introduce a colorful pixel-art interface where each workpack is represented as a room and each prompt is a desk within that room. The room must also contain fixed interaction points for request, plan, status, and other always-present workpack documents.

Agent providers must be represented physically as little people in the scene:
- when an agent is actively executing a prompt it should visibly stand or sit at the related desk,
- when the prompt is complete it should move toward a board and pin the output `.json`,
- when manual input is required it should visibly raise a hand.

Desk interaction must support assigning an agent (Codex or Copilot) directly from the UI via contextual actions, and hovering a desk should surface a preview of the ongoing agent chat.

In addition, provide a side panel that shows Git diffs for modified files with full paths, ideally grouped by repository.

The user explicitly wants a visually pleasing, animated, colorful interface with a clear pixel-art identity.

Preferred Delivery Mode: `PR`
Target Base Branch: `master`
Feature Branch: `feature/workpack-manager-v3-pixel-office-ui`

## Acceptance Criteria

- [ ] AC1: A dedicated pixel-art workspace view exists where a workpack is rendered as a room with fixed stations for request, plan, status, outputs, and prompt desks.
- [ ] AC2: Prompt desks render live runtime state, including active work, completion, failure, cancellation, and human-input-needed signals.
- [ ] AC3: Animated agent avatars visually occupy desks while working, move to an output board when work completes, and raise a hand when manual input is required.
- [ ] AC4: Clicking or context-interacting with a desk allows assigning `copilot` or `codex` and triggering prompt controls without leaving the graphical UI.
- [ ] AC5: Hovering a desk reveals a compact preview of the agent conversation or latest execution transcript for that prompt.
- [ ] AC6: A side panel exists that displays Git diffs grouped by repository, includes full file paths, and is linkable from the pixel workspace.
- [ ] AC7: The pixel interface is colorful and visually coherent, with motion and layout polish that makes the feature feel intentionally designed rather than purely functional.
- [ ] AC8: Accessibility and fallback behavior exist so the extension still communicates state when animations are reduced or graphical assets are unavailable.
- [ ] AC9: Build and relevant tests pass for the extension after the new UI surfaces and state bindings are introduced.

## Constraints

- Keep existing WorkpackManager command workflows functional while introducing the new graphical layer.
- Prefer additive changes over breaking replacement until the pixel workspace reaches parity for core interactions.
- The implementation must stay inside the WorkpackManager repository and use extension-compatible VS Code UI surfaces (tree view, webview, panel, commands, or supporting services).
- Use repository-aware diff data rather than ad-hoc text blobs so file paths and grouping remain trustworthy.
- Avoid shipping an empty visual shell; the first integrated version must already include animations, state-driven avatars, and meaningful controls.

## Acceptance Criteria → Verification Mapping

| AC ID | Acceptance Criterion | How to Verify |
|-------|----------------------|---------------|
| AC1 | Pixel room workspace exists | Open the new UI and verify room layout contains desks + fixed stations |
| AC2 | Desks show live state | Trigger runtime status changes and verify desk visuals update |
| AC3 | Agent avatars animate by state | Run, complete, and block prompts; verify avatar movement/hand-raise states |
| AC4 | Desk interaction assigns/controls agent | Use desk menu or click actions to assign `copilot`/`codex` and invoke controls |
| AC5 | Desk hover reveals chat preview | Hover an active desk and verify preview content appears |
| AC6 | Git diff side panel grouped by repo | Open diff panel and verify grouping + full file paths |
| AC7 | Visual polish is present | Manual UX review of palette, layering, and motion quality |
| AC8 | Accessibility/fallback works | Test reduced motion or no-animation path and confirm state remains understandable |
| AC9 | Extension remains healthy | `npm run build` and targeted tests pass |

## Delivery Mode

- [x] **PR-based** (default)
- [ ] **Direct push**

## Scope

### In Scope

- Pixel-art room rendering for workpacks
- Desk and fixed-station spatial model for prompts and documents
- Animated agent avatars and runtime motion states
- Desk interactions for assignment, stop/retry/input, and related controls
- Hover chat previews tied to prompt runtime/execution data
- Git diff side panel grouped by repository with full-path entries
- Visual theming, animation timing, and fallback accessibility affordances
- Supporting services/state adapters needed to feed the new UI

### Out of Scope

- Real-time multiplayer or multi-user co-presence
- External asset pipelines requiring cloud services
- Replacing every existing view on day one if fallback parity is still needed
- Non-WorkpackManager repositories or protocol changes outside what the extension needs for this feature
