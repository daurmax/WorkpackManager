---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A4_git_diff_side_panel

> Provide a repository-aware Git diff side panel with full file paths and workspace integration.

## READ FIRST

1. `workpacks/instances/workpack-manager-v3-pixel-office-ui/00_request.md`
2. `workpacks/instances/workpack-manager-v3-pixel-office-ui/01_plan.md`
3. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.meta.json`
4. `workpacks/instances/workpack-manager-v3-pixel-office-ui/workpack.state.json`
5. `outputs/A0_bootstrap.json` — architectural decisions, message protocol
6. `src/extension.ts` — `getAllWorkspacePaths()` for multi-root workspace support
7. `src/views/workpack-detail-panel.ts` — existing webview panel implementation
8. `src/views/workpack-tree-provider.ts` — how workspace folders are discovered
9. `package.json` — current contribution points and activation events

## Context

Workpack: `workpack-manager-v3-pixel-office-ui`

This prompt runs in parallel with A1 (both depend only on A0). It builds an independent side panel that shows Git diffs grouped by repository. The panel will later be connected to the pixel room (A5 or as part of room station interactions), but it must also function as a standalone view.

## Delivery Mode

- PR-based

## Objective

Create a panel/view that presents changed files grouped by repository for all workspace folders, displaying full file paths and supporting navigation to the diff view. The panel must use VS Code's SCM or Git extension APIs for reliable data sourcing.

## Reference Points

- **VS Code Git API**: use `vscode.extensions.getExtension('vscode.git')` to access the built-in Git extension's API. The `GitExtension` exports `getAPI(1)` which provides `Repository` objects with `state.workingTreeChanges`, `state.indexChanges`, `state.mergeChanges`, and `diff()` methods.
- **Multi-root workspace**: `vscode.workspace.workspaceFolders` may contain multiple folders. Each may or may not be a Git repository. Group results by repository root path.
- **Webview panel pattern**: follow `WorkpackDetailPanel` for panel lifecycle, CSP nonces, and HTML generation if implemented as a webview. Alternatively, consider a `TreeDataProvider` for the side panel if a simpler hierarchical view suffices.
- **Diff navigation**: use `vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title)` to open VS Code's native diff editor for a selected file.
- **Extension activation**: the existing `package.json` activates on `onView:workpackManager`. New views need corresponding activation events.

## Implementation Requirements

1. **Data source**: use the VS Code built-in Git extension API (`vscode.git`) to fetch changed files. Do NOT shell out to `git` CLI — the extension API provides structured, observable data.

2. **Repository grouping**: group changed files by their repository root. For each repository:
   - Show the repository name (last segment of root path) as a group header.
   - List changed files with full relative paths within the repository.
   - Show change type indicators (modified, added, deleted, renamed).

3. **Panel implementation**: choose one of:
   - **Webview panel**: richer rendering, consistent with the pixel room aesthetic. Connect via message protocol.
   - **Tree view**: simpler, native VS Code look. Use a `TreeDataProvider` with repository nodes at the top and file nodes below.
   
   The tree view approach is recommended for the initial implementation (simpler, natively accessible, filterable). The pixel room can link to it via a command that reveals the view.

4. **Change detection**: subscribe to the Git extension's `onDidChangeState` or repository state changes to keep the panel updated in near-real-time.

5. **Diff navigation**: clicking a file entry should open the VS Code diff editor for that file.

6. **Empty state**: when no changes exist, show a clear "No changes detected" message rather than a blank panel.

7. **Error resilience**: handle gracefully:
   - Git extension not installed or disabled.
   - Workspace folder that is not a Git repository.
   - Large numbers of changed files (consider lazy loading or pagination for >100 files).

8. **Integration hook**: expose a command (e.g., `workpackManager.showDiffPanel`) that the pixel room can call to open/reveal the diff panel. Add it to `package.json` commands.

## Constraints

- Do NOT shell out to `git` CLI — use the VS Code Git extension API.
- Do NOT modify room rendering from A1 or avatar logic from A2.
- Do NOT implement desk interactions — that belongs to A3.
- The diff panel must work independently of the pixel room (standalone value).
- Keep the panel registration additive — do not remove or break existing views.

## Scope

### In Scope

- Git extension API integration for changed-file discovery
- Repository-grouped file listing with full paths
- Change type indicators (modified, added, deleted, renamed)
- Diff navigation (click → VS Code diff editor)
- Near-real-time updates on Git state changes
- Empty and error state handling
- Command registration for opening the panel
- `package.json` contribution-point updates
- Unit tests for data grouping logic

### Out of Scope

- Pixel-art styling of the diff panel (deferred to A5 if needed)
- Inline diff rendering within the panel (use native diff editor)
- Room layout or avatar changes

## Acceptance Criteria

- [ ] AC1: A panel shows modified files grouped by repository with full relative paths.
- [ ] AC2: Change type indicators distinguish modified, added, deleted, and renamed files.
- [ ] AC3: Clicking a file opens the VS Code diff editor.
- [ ] AC4: The panel updates when Git state changes (new commits, staging, unstaging).
- [ ] AC5: Empty state and error state (no Git extension) are handled gracefully.
- [ ] AC6: `npm run build` and `npm test` pass.

## Verification

```bash
npm run build
npm test
```

## Handoff Output (JSON)

Write `outputs/A4_git_diff_side_panel.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "workpack-manager-v3-pixel-office-ui",
  "prompt": "A4_git_diff_side_panel",
  "component": "diff-panel",
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
    "summary": "Git diff side panel implemented with repository grouping, full paths, change types, and diff navigation.",
    "next_steps": ["A5_visual_polish_and_motion can start after A2 and A3 complete"],
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

- [ ] Git extension API integration implemented
- [ ] Repository-grouped file listing with full paths
- [ ] Diff navigation on file click
- [ ] Near-real-time change detection
- [ ] Empty and error state handling
- [ ] Command registered and `package.json` updated
- [ ] Unit tests for grouping logic
- [ ] Commit(s) recorded in `artifacts.commit_shas`
- [ ] `outputs/A4_git_diff_side_panel.json` written
