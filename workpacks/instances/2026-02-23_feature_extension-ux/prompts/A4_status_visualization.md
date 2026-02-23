---
prompt_id: A4_status_visualization
workpack: 2026-02-23_feature_extension-ux
agent_role: Status visualization and filtering
depends_on:
  - A1_tree_view
  - A2_detail_panel
repos:
  - WorkpackManager
estimated_effort: M
---

# A4 – Status Visualization, Filtering, and Sorting

## Objective

Implement comprehensive status visualization using Codicons and color-coded badges, add filtering and sorting capabilities to the tree view, and ensure consistent status representation across tree view and webview.

## Deliverables

### 1. Status Icon Mapping (`src/views/status-icons.ts`)

```typescript
import * as vscode from 'vscode';

export interface StatusIcon {
  codicon: string;
  color: vscode.ThemeColor;
  label: string;
  sortOrder: number;
}

/** Workpack overall status → visual representation. */
export const WORKPACK_STATUS_ICONS: Record<string, StatusIcon> = {
  'not_started':  { codicon: 'circle-outline',       color: new vscode.ThemeColor('disabledForeground'), label: 'Not Started', sortOrder: 0 },
  'in_progress':  { codicon: 'loading~spin',         color: new vscode.ThemeColor('progressBar.background'), label: 'In Progress', sortOrder: 1 },
  'blocked':      { codicon: 'error',                 color: new vscode.ThemeColor('errorForeground'), label: 'Blocked', sortOrder: 2 },
  'review':       { codicon: 'eye',                   color: new vscode.ThemeColor('editorInfo.foreground'), label: 'Review', sortOrder: 3 },
  'complete':     { codicon: 'check',                 color: new vscode.ThemeColor('testing.iconPassed'), label: 'Complete', sortOrder: 4 },
  'abandoned':    { codicon: 'close',                 color: new vscode.ThemeColor('errorForeground'), label: 'Abandoned', sortOrder: 5 },
};

/** Prompt status → visual representation. */
export const PROMPT_STATUS_ICONS: Record<string, StatusIcon> = {
  'pending':      { codicon: 'circle-outline',       color: new vscode.ThemeColor('disabledForeground'), label: 'Pending', sortOrder: 0 },
  'in_progress':  { codicon: 'loading~spin',         color: new vscode.ThemeColor('progressBar.background'), label: 'In Progress', sortOrder: 1 },
  'complete':     { codicon: 'pass-filled',          color: new vscode.ThemeColor('testing.iconPassed'), label: 'Complete', sortOrder: 2 },
  'blocked':      { codicon: 'error',                 color: new vscode.ThemeColor('errorForeground'), label: 'Blocked', sortOrder: 3 },
  'skipped':      { codicon: 'debug-step-over',      color: new vscode.ThemeColor('disabledForeground'), label: 'Skipped', sortOrder: 4 },
};
```

### 2. Tree View Filtering

Add filtering capabilities to `WorkpackTreeProvider`:

- **By status**: Show only workpacks with a specific status.
- **By category**: Show only feature, bugfix, etc.
- **By tag**: Show workpacks matching a tag.

```typescript
export interface TreeFilter {
  status?: string[];
  category?: string[];
  tags?: string[];
  searchText?: string;
}

export class WorkpackTreeProvider {
  private activeFilter: TreeFilter = {};

  setFilter(filter: TreeFilter): void {
    this.activeFilter = filter;
    this.refresh();
  }

  clearFilter(): void {
    this.activeFilter = {};
    this.refresh();
  }
}
```

### 3. Tree View Sorting

Support sorting tree items by:
- **Status** (sort by `sortOrder`).
- **Name** (alphabetical).
- **Date** (by `created_at`).

### 4. Progress Bar for Workpack Status

In the tree view, add a description showing prompt completion progress:

```
📦 extension-core-architecture     3 / 7 prompts
```

Use `TreeItem.description` for the progress indicator.

### 5. Webview Status Badges

Render status badges in the detail webview using CSS classes:

```html
<span class="badge badge--complete">Complete</span>
<span class="badge badge--blocked">Blocked</span>
```

### 6. Unit Tests (`src/views/__tests__/status-icons.test.ts`)

- All status values have icon mappings.
- Sort order is consistent.
- Filter logic correctly includes/excludes workpacks.
- Progress description format is correct.

## Constraints

- Use only Codicons available in VS Code 1.80+.
- Color theme colors must use `ThemeColor` (not hardcoded hex).
- Filtering state must survive tree refresh.

## Output

Write `outputs/A4_status_visualization.json`.

## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Unit tests pass.
- [ ] Status icons are visible and correct in tree view (manual test).
- [ ] Filtering reduces tree items correctly.
