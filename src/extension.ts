import * as vscode from "vscode";
import { CodexProvider, CopilotProvider, ExecutionRegistry, ProviderRegistry } from "./agents";
import { registerCommands } from "./commands";
import { WorkpackDiagnosticProvider } from "./validation";
import { GitDiffTreeProvider } from "./views/git-diff-tree-provider";
import { ActiveAgentsTreeProvider, DiscovererWorkpackParser, WorkpackTreeProvider } from "./views";

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
  const executionRegistry = new ExecutionRegistry();
  treeProvider.setExecutionRegistry(executionRegistry);
  const activeAgentsProvider = new ActiveAgentsTreeProvider(executionRegistry);
  const gitDiffProvider = new GitDiffTreeProvider(() => getAllWorkspacePaths());
  const diagnosticProvider = new WorkpackDiagnosticProvider();
  const providerRegistry = createProviderRegistry();

  const treeView = vscode.window.createTreeView("workpackManager", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  const activeAgentsView = vscode.window.createTreeView("workpackManager.activeAgents", {
    treeDataProvider: activeAgentsProvider,
    showCollapseAll: false
  });
  const gitDiffView = vscode.window.createTreeView("workpackManager.gitDiff", {
    treeDataProvider: gitDiffProvider,
    showCollapseAll: true
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("workpackManager.showDiffPanel", async () => {
      await vscode.commands.executeCommand("workbench.view.explorer");
      await vscode.commands.executeCommand("workpackManager.gitDiff.focus");
    }),
    vscode.commands.registerCommand("workpackManager.refreshGitDiff", () => {
      gitDiffProvider.refresh();
    })
  );

  context.subscriptions.push(
    treeProvider,
    activeAgentsProvider,
    gitDiffProvider,
    treeView,
    activeAgentsView,
    gitDiffView,
    diagnosticProvider,
    executionRegistry
  );
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
    executionRegistry,
    extensionUri: context.extensionUri,
    onLintWorkpack: async (workpackFolderPath: string) => {
      await diagnosticProvider.publishDiagnostics(workpackFolderPath);
    }
  });
}

export function deactivate(): void {}
