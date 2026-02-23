---
prompt_id: A3_commands_actions
workpack: 2026-02-23_feature_extension-ux
agent_role: Commands and actions implementer
depends_on:
  - A0_bootstrap
repos:
  - WorkpackManager
estimated_effort: M
---

# A3 – Commands, Context Menus, and Quick Picks

## Objective

Register all VS Code commands for workpack management, configure context menus for tree view items, and implement quick picks for interactive workflows.

## Deliverables

### 1. Command Registration (`src/commands/register-commands.ts`)

Commands to register:

| Command ID | Title | When / Where |
|------------|-------|-------------|
| `workpackManager.createWorkpack` | Workpack: Create New | Command palette |
| `workpackManager.scaffoldFromTemplate` | Workpack: Scaffold from Template | Command palette |
| `workpackManager.lintWorkpack` | Workpack: Lint | Command palette + context menu |
| `workpackManager.openRequest` | Workpack: Open Request | Context menu |
| `workpackManager.openPlan` | Workpack: Open Plan | Context menu |
| `workpackManager.openStatus` | Workpack: Open Status | Context menu |
| `workpackManager.viewDetails` | Workpack: View Details | Context menu |
| `workpackManager.assignAgent` | Workpack: Assign Agent | Context menu (prompt node) |
| `workpackManager.executePrompt` | Workpack: Execute Prompt | Context menu (prompt node) |
| `workpackManager.executeAll` | Workpack: Execute All Ready Prompts | Context menu (workpack node) |
| `workpackManager.refreshTree` | Workpack: Refresh | Tree view title actions |

### 2. Package.json Contributions

```json
{
  "contributes": {
    "commands": [
      { "command": "workpackManager.createWorkpack", "title": "Create New", "category": "Workpack" },
      { "command": "workpackManager.refreshTree", "title": "Refresh", "category": "Workpack", "icon": "$(refresh)" }
    ],
    "menus": {
      "view/title": [
        { "command": "workpackManager.refreshTree", "when": "view == workpackManager", "group": "navigation" }
      ],
      "view/item/context": [
        { "command": "workpackManager.openRequest", "when": "viewItem == workpack", "group": "1_open@1" },
        { "command": "workpackManager.openPlan", "when": "viewItem == workpack", "group": "1_open@2" },
        { "command": "workpackManager.viewDetails", "when": "viewItem == workpack", "group": "1_open@3" },
        { "command": "workpackManager.lintWorkpack", "when": "viewItem == workpack", "group": "2_actions@1" },
        { "command": "workpackManager.executeAll", "when": "viewItem == workpack", "group": "2_actions@2" },
        { "command": "workpackManager.assignAgent", "when": "viewItem == prompt", "group": "1_agent@1" },
        { "command": "workpackManager.executePrompt", "when": "viewItem == prompt", "group": "1_agent@2" }
      ]
    }
  }
}
```

### 3. Quick Picks

#### Create Workpack Quick Pick
1. Prompt for category (feature, bugfix, refactor, etc.).
2. Prompt for short slug.
3. Prompt for summary.
4. Scaffold from template.
5. Open `00_request.md` in editor.

#### Assign Agent Quick Pick
1. List available providers from `ProviderRegistry`.
2. Show capability summary for each.
3. Assign selected provider to prompt.
4. Update `workpack.state.json`.

### 4. Unit Tests (`src/commands/__tests__/commands.test.ts`)

- All commands are registered.
- `createWorkpack` invokes scaffolding logic.
- `assignAgent` updates state file.
- `refreshTree` triggers tree data change event.
- Context menu `when` clauses are correct.

## Constraints

- Commands must fail gracefully if no workpack workspace is open.
- Quick picks must be cancellable (handle `undefined` selection).
- Command titles must follow VS Code naming conventions ("Category: Action").

## Output

Write `outputs/A3_commands_actions.json`.

## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Unit tests pass.
- [ ] All commands appear in command palette.
- [ ] Context menus show correct items for workpack and prompt nodes.
