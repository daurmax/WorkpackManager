---
prompt_id: A1_tree_view
workpack: 03_workpack-manager_extension-ux
agent_role: Tree view provider architect
depends_on:
  - A0_bootstrap
repos:
  - WorkpackManager
estimated_effort: L
---

# A1 – Tree View Data Provider

## Objective

Implement a VS Code `TreeDataProvider` that displays workpack instances as a hierarchical tree with status icons, drill-down into prompts, and auto-refresh on file system changes.

## Deliverables

### 1. WorkpackTreeProvider (`src/views/workpack-tree-provider.ts`)

Requirements:
- Implements `vscode.TreeDataProvider<WorkpackTreeItem>`.
- Root level: list of workpack instances (from parser/indexer).
- Second level: workpack sections (Request, Plan, Prompts, Outputs, Status).
- Third level: individual prompt files, output files.
- Each node shows a Codicon status icon (see A4 for full mapping).
- Supports `onDidChangeTreeData` for refresh.
- Integrates with `FileSystemWatcher` to auto-refresh when workpack files change.

```typescript
export class WorkpackTreeProvider implements vscode.TreeDataProvider<WorkpackTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<WorkpackTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private parser: WorkpackParser,
    private workspacePath: string
  ) {
    // Set up FileSystemWatcher for workpacks/instances/**
  }

  getTreeItem(element: WorkpackTreeItem): vscode.TreeItem { /* ... */ }
  getChildren(element?: WorkpackTreeItem): Thenable<WorkpackTreeItem[]> { /* ... */ }
  refresh(): void { this._onDidChangeTreeData.fire(undefined); }
}
```

### 2. WorkpackTreeItem (`src/views/workpack-tree-item.ts`)

```typescript
export enum TreeItemKind {
  Workpack,
  Section,
  PromptFile,
  OutputFile,
  StatusFile,
  MetaFile,
  StateFile,
}

export class WorkpackTreeItem extends vscode.TreeItem {
  constructor(
    public readonly kind: TreeItemKind,
    public readonly workpackId: string,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly filePath?: string
  ) {
    super(label, collapsibleState);
    // Set iconPath based on kind and status.
    // Set command to open file on click.
    // Set contextValue for context menu filtering.
  }
}
```

### 3. FileSystemWatcher Integration

```typescript
const watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(workspacePath, 'workpacks/instances/**')
);
watcher.onDidCreate(() => this.refresh());
watcher.onDidChange(() => this.refresh());
watcher.onDidDelete(() => this.refresh());
```

### 4. Package.json Contributions

```json
{
  "contributes": {
    "views": {
      "explorer": [{
        "id": "workpackManager",
        "name": "Workpacks",
        "icon": "$(tasklist)",
        "contextualTitle": "Workpack Manager"
      }]
    },
    "viewsContainers": {
      "activitybar": [{
        "id": "workpack-manager",
        "title": "Workpack Manager",
        "icon": "$(tasklist)"
      }]
    }
  }
}
```

### 5. Unit Tests (`src/views/__tests__/tree-provider.test.ts`)

- Returns workpack instances as root nodes.
- Returns sections as children of a workpack node.
- Returns prompt files as children of the Prompts section.
- Each node has the correct `contextValue`.
- `refresh()` fires the change event.
- Empty workspace returns empty tree.

## Constraints

- Must not read file contents synchronously (use async parsing).
- Tree items must have unique IDs for proper tree state management.
- `contextValue` must be set correctly for context menu targeting.

## Output

Write `outputs/A1_tree_view.json`.

## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Unit tests pass.
- [ ] Tree view renders in VS Code (manual test).
- [ ] File watcher triggers refresh on file changes.
