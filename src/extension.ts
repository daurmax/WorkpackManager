import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  const refreshCommand = vscode.commands.registerCommand("workpackManager.refresh", () => {
    void vscode.window.showInformationMessage("Workpack Manager refresh is not implemented yet.");
  });

  context.subscriptions.push(refreshCommand);
}

export function deactivate(): void {}
