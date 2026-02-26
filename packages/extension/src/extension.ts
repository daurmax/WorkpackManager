import * as vscode from "vscode";
import { spawn } from "child_process";

export function activate(context: vscode.ExtensionContext): void {
  console.log("Workpack Manager extension activated");
  void context;
}

export function deactivate(): void {}

export function executePythonTool(toolName: string, args: string[]): void {
  // TODO: Wire this process to workspace-aware tool paths, output channels, and error handling.
  spawn("python", [toolName, ...args], { shell: false });
}
