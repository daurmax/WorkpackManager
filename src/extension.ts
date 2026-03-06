import * as vscode from "vscode";
import { CodexProvider, CopilotProvider, ProviderRegistry } from "./agents";
import { registerCommands } from "./commands";
import { WorkpackDiagnosticProvider } from "./validation";
import { DiscovererWorkpackParser, WorkpackTreeProvider } from "./views";

function getAllWorkspacePaths(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
}

function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  const configuration = vscode.workspace.getConfiguration("workpackManager");

  registry.register(
    new CopilotProvider({
      maxPromptTokens: configuration.get<number>("copilot.maxPromptTokens", 8_192)
    })
  );
  registry.register(
    new CodexProvider(
      {
        baseUrl: configuration.get<string>("codex.baseUrl", "https://api.openai.com/v1"),
        model: configuration.get<string>("codex.model", "gpt-4o"),
        maxResponseTokens: configuration.get<number>("codex.maxResponseTokens", 4096),
        requestTimeoutMs: configuration.get<number>("codex.requestTimeoutMs", 120_000)
      },
      async () => process.env.OPENAI_API_KEY ?? process.env.CODEX_API_KEY
    )
  );

  return registry;
}

export function activate(context: vscode.ExtensionContext): void {
  const workspacePaths = getAllWorkspacePaths();
  const treeProvider = new WorkpackTreeProvider(new DiscovererWorkpackParser(), workspacePaths, {
    watchFileSystem: workspacePaths.length > 0
  });
  const diagnosticProvider = new WorkpackDiagnosticProvider();
  const providerRegistry = createProviderRegistry();

  const treeView = vscode.window.createTreeView("workpackManager", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeProvider, treeView, diagnosticProvider);
  context.subscriptions.push({
    dispose: () => {
      for (const agentProvider of providerRegistry.listAll()) {
        providerRegistry.deregister(agentProvider.id);
      }
    }
  });

  registerCommands(context, {
    vscodeApi: vscode,
    treeProvider,
    providerRegistry,
    onLintWorkpack: async (workpackFolderPath: string) => {
      await diagnosticProvider.publishDiagnostics(workpackFolderPath);
    }
  });
}

export function deactivate(): void {}
