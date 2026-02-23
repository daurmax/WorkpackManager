---
prompt_id: A2_detail_panel
workpack: 2026-02-23_feature_extension-ux
agent_role: Detail webview panel implementer
depends_on:
  - A0_bootstrap
repos:
  - WorkpackManager
estimated_effort: M
---

# A2 – Detail Webview Panel

## Objective

Implement a VS Code webview panel that shows rich detail for a selected workpack: metadata, plan summary, prompt status table, output links, and dependency visualization.

## Deliverables

### 1. WorkpackDetailPanel (`src/views/workpack-detail-panel.ts`)

Requirements:
- Opens as a VS Code webview panel (`vscode.window.createWebviewPanel`).
- Displays data for a single workpack.
- Sections:
  - **Header**: Title, ID, category badge, protocol version.
  - **Metadata**: From `workpack.meta.json` — tags, owners, repos, delivery mode.
  - **Status**: Overall status badge from `workpack.state.json`.
  - **Dependencies**: Cross-workpack dependencies with status indicators.
  - **Prompt Table**: List of prompts with status, assigned agent, effort estimate.
  - **Outputs**: Links to output JSON files (opens in editor on click).
- Refreshes when underlying files change.

```typescript
export class WorkpackDetailPanel {
  public static currentPanel: WorkpackDetailPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    workpack: WorkpackInstance
  ): void;

  private getHtmlContent(workpack: WorkpackInstance): string;

  private update(): void;

  public dispose(): void;
}
```

### 2. HTML Content

The webview HTML must:
- Use VS Code CSS custom properties for theming (`--vscode-editor-background`, etc.).
- Use Codicon font for status icons.
- Be self-contained (no external resources due to CSP).
- Support dark and light themes automatically.
- Handle webview message passing for interactive elements (e.g., clicking an output link).

### 3. Message Passing

```typescript
// Webview → Extension
interface WebviewMessage {
  command: 'openFile' | 'assignAgent' | 'executePrompt';
  payload: { filePath?: string; promptStem?: string };
}

// Panel receives messages:
this.panel.webview.onDidReceiveMessage(
  (message: WebviewMessage) => { /* handle */ },
  null,
  this.disposables
);
```

### 4. Unit Tests (`src/views/__tests__/detail-panel.test.ts`)

- `getHtmlContent()` includes workpack title.
- `getHtmlContent()` includes all prompt rows.
- `getHtmlContent()` includes correct status badges.
- Message handling dispatches `openFile` correctly.
- Panel disposes without errors.

## Constraints

- No external CSS/JS frameworks. Use VS Code toolkit patterns or plain HTML/CSS.
- CSP must be set correctly (no inline scripts, use nonce).
- Webview must work in both panel and editor column positions.

## Output

Write `outputs/A2_detail_panel.json`.

## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Unit tests pass.
- [ ] Webview renders correctly in dark and light themes (manual test).
- [ ] CSP is correctly configured.
