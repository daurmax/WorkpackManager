import * as vscode from "vscode";

export function registerCommands(context: vscode.ExtensionContext): void {
  const noop = vscode.commands.registerCommand("workpackManager.openWorkpack", () => {
    void vscode.window.showInformationMessage("Open Workpack is not implemented yet.");
  });

  context.subscriptions.push(noop);
}
