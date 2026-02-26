import * as vscode from "vscode";

export function showWorkpackDetailPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "workpackDetail",
    "Workpack Detail",
    vscode.ViewColumn.Active,
    { enableScripts: false }
  );

  panel.webview.html = "<html><body><h1>Workpack Detail</h1><p>Not implemented yet.</p></body></html>";
  context.subscriptions.push(panel);
  return panel;
}
