---
prompt_id: A5_integration_meta
workpack: workpack-manager_extension-ux_03
agent_role: V1 verification gate
depends_on:
  - A1_tree_view
  - A2_detail_panel
  - A3_commands_actions
  - A4_status_visualization
repos:
  - WorkpackManager
estimated_effort: M
---

# A5 – V1 Verification Gate: Extension UX Layer

## Objective

Comprehensive verification of all UX deliverables from A1–A4: tree view, detail panel, commands, and status visualization.

## Verification Checklist

### 1. Compilation

```bash
npx tsc --noEmit
```
- [ ] 0 errors, 0 warnings.

### 2. Unit Tests

```bash
npm test -- --grep "views\|commands"
```
- [ ] Tree data provider tests pass.
- [ ] Detail panel tests pass.
- [ ] Command registration tests pass.
- [ ] Status icon tests pass.

### 3. Package.json Validation

- [ ] All commands declared in `contributes.commands`.
- [ ] Tree view declared in `contributes.views`.
- [ ] Context menus have correct `when` clauses.
- [ ] View container with activity bar icon.

### 4. Manual Verification

- [ ] Tree view renders workpack instances.
- [ ] Clicking a workpack opens the detail panel.
- [ ] Context menus show correct items for workpack vs prompt nodes.
- [ ] Status icons update when `workpack.state.json` changes.
- [ ] File watcher triggers tree refresh.
- [ ] Filtering by status works.
- [ ] Quick pick for create workpack works.
- [ ] Detail panel themes correctly in dark and light modes.
- [ ] Keyboard navigation works in tree view.

### 5. Accessibility

- [ ] All interactive elements have labels.
- [ ] Keyboard focus is visible.
- [ ] Screen reader compatibility (ARIA labels on webview elements).

## Acceptance Criteria Coverage

| AC | Status | Evidence |
|----|--------|----------|
| AC1: Tree view with status | ✅/❌ | Tree provider + manual test |
| AC2: Filtering | ✅/❌ | Filter logic + test |
| AC3: Detail webview | ✅/❌ | Detail panel + manual test |
| AC4: Context menu | ✅/❌ | package.json + test |
| AC5: Commands | ✅/❌ | Command registration + test |
| AC6: Status visualization | ✅/❌ | Status icons + test |
| AC7: Auto-refresh | ✅/❌ | FileSystemWatcher + test |
| AC8: Keyboard nav | ✅/❌ | Manual test |
| AC9: Tests pass | ✅/❌ | `npm test` |

## Output

Write `outputs/A5_integration_meta.json`.

## Gate

- [ ] All ACs verified.
- [ ] PR is ready for review.
