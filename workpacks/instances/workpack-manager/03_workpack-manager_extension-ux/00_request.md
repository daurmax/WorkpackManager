# Request

## Workpack Protocol Version

Workpack Protocol Version: 2.0.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `extension-ux`

Design and implement the user-facing components of the WorkpackManager VS Code extension. This includes a tree view for workpack navigation and status overview, a detail panel (webview) for rich workpack inspection, commands and context menu actions for common operations, and status visualization with filtering/sorting capabilities.

The UX must provide a clear, at-a-glance view of workpack status across all instances, allow drill-down into individual workpacks and prompts, and support common actions like assigning agents, viewing outputs, and triggering execution.

Constraints and notes:

- Depends on WP01 (core architecture) for data models and parser.
- Uses VS Code TreeView API, Webview API, Command API.
- Agent assignment UI integrates with WP02 (agent integration).
- Must follow VS Code UX guidelines (Codicons, native feel, keyboard accessible).
- Primary repo: `WorkpackManager`.

Preferred Delivery Mode: `PR`
Target Base Branch: `main`

## Acceptance Criteria

- [ ] AC1: Tree view displays workpack instances with status icons and hierarchical prompt breakdown.
- [ ] AC2: Tree view supports filtering by status, category, and tag.
- [ ] AC3: Detail webview shows workpack metadata, plan, prompt status, and outputs.
- [ ] AC4: Context menu on workpack nodes provides: open request, open plan, assign agent, execute, view status.
- [ ] AC5: Command palette commands exist for: create workpack, scaffold from template, lint workpack.
- [ ] AC6: Status visualization uses Codicons and color-coded badges.
- [ ] AC7: Tree view auto-refreshes when workpack files change (FileSystemWatcher integration).
- [ ] AC8: Keyboard navigation works for all tree view and webview interactions.
- [ ] AC9: Unit tests cover tree data provider and command registration.

## Constraints

- Must not bundle large CSS/JS frameworks in webview (keep lightweight).
- Webview must use VS Code webview toolkit (or plain HTML/CSS with Codicon font).
- All interactive elements must be keyboard accessible.

## Acceptance Criteria → Verification Mapping

| AC ID | Criterion | How to Verify |
|-------|-----------|---------------|
| AC1 | Tree view with status icons | Visual inspection + tree data provider test |
| AC2 | Filtering | Unit test for filter logic |
| AC3 | Detail webview | Visual inspection + webview content test |
| AC4 | Context menu | package.json menus contribution + test |
| AC5 | Commands | package.json contributes.commands + test |
| AC6 | Status visualization | Codicon mapping test |
| AC7 | Auto-refresh | FileSystemWatcher integration test |
| AC8 | Keyboard nav | Manual accessibility test |
| AC9 | Tests pass | `npm test` |

## Delivery Mode

- [x] PR-based (default)
- [ ] Direct push

## Scope

### In Scope

- Tree view provider (workpacks, prompts, status)
- Detail webview panel
- Commands and context menus
- Status icons and badges
- Filtering and sorting
- File watcher integration
- Unit tests

### Out of Scope

- Full end-to-end execution UI (basic trigger only)
- Webview-based editor for workpack files
- Multi-repo workpack views (future enhancement)
