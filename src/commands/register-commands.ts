import { promises as fs } from "node:fs";
import * as path from "node:path";
import type * as vscode from "vscode";
import { AssignmentModel, loadWorkpackState, saveWorkpackStateAtomic } from "../agents/assignment";
import type { ExecutionRegistry } from "../agents/execution-registry";
import { ExecutionOrchestrator, type ExecutionSummary } from "../agents/orchestrator";
import type { ProviderRegistry } from "../agents/registry";
import type { AgentProvider, PromptResult } from "../agents/types";
import type { WorkpackCategory, WorkpackInstance } from "../models";
import { discoverWorkpacks } from "../parser/workpack-discoverer";
import { parseWorkpackInstance } from "../parser/workpack-parser";

const TEMPLATE_DIRECTORY = path.join("workpacks", "_template");
const INSTANCES_DIRECTORY = path.join("workpacks", "instances");
const WORKPACK_FILES = {
  request: "00_request.md",
  plan: "01_plan.md",
  status: "99_status.md",
  meta: "workpack.meta.json",
  state: "workpack.state.json"
} as const;

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const CATEGORY_OPTIONS: Array<{ category: WorkpackCategory; detail: string }> = [
  { category: "feature", detail: "New end-user functionality." },
  { category: "bugfix", detail: "Correct behavior that is currently wrong." },
  { category: "refactor", detail: "Structural improvements without behavior changes." },
  { category: "hotfix", detail: "Urgent production fix." },
  { category: "debug", detail: "Investigation and diagnosis tasking." },
  { category: "docs", detail: "Documentation updates." },
  { category: "perf", detail: "Performance and efficiency improvements." },
  { category: "security", detail: "Security hardening or vulnerability fixes." }
];
const EXECUTION_OUTPUT_CHANNEL_NAME = "Workpack Manager Execution";
const ORCHESTRATOR_TIMEOUT_MS = 300_000;
const EXECUTE_ALL_MAX_PARALLEL = 4;

export const WORKPACK_MANAGER_COMMANDS = {
  createWorkpack: "workpackManager.createWorkpack",
  scaffoldFromTemplate: "workpackManager.scaffoldFromTemplate",
  lintWorkpack: "workpackManager.lintWorkpack",
  openRequest: "workpackManager.openRequest",
  openPlan: "workpackManager.openPlan",
  openStatus: "workpackManager.openStatus",
  openPixelRoom: "workpackManager.openPixelRoom",
  viewDetails: "workpackManager.viewDetails",
  assignAgent: "workpackManager.assignAgent",
  executePrompt: "workpackManager.executePrompt",
  executeAll: "workpackManager.executeAll",
  stopPromptExecution: "workpackManager.stopPromptExecution",
  retryPrompt: "workpackManager.retryPrompt",
  provideAgentInput: "workpackManager.provideAgentInput",
  refreshTree: "workpackManager.refreshTree"
} as const;

interface CommandTreeNode {
  contextValue?: string;
  workpackId?: string;
  folderPath?: string;
  filePath?: string;
  promptStem?: string;
  runId?: string;
}

interface OutputChannelLike {
  appendLine(value: string): void;
  show(preserveFocus?: boolean): void;
  dispose(): void;
}

interface VscodeLike {
  commands: Pick<typeof import("vscode").commands, "registerCommand">;
  window: Pick<
    typeof import("vscode").window,
    | "showQuickPick"
    | "showInputBox"
    | "showInformationMessage"
    | "showWarningMessage"
    | "showErrorMessage"
    | "showTextDocument"
    | "createTerminal"
    | "withProgress"
    | "createOutputChannel"
  >;
  workspace: Pick<typeof import("vscode").workspace, "workspaceFolders" | "openTextDocument">;
  Uri: Pick<typeof import("vscode").Uri, "file">;
  ProgressLocation: Pick<typeof import("vscode").ProgressLocation, "Notification">;
}

interface TreeRefresher {
  refresh(): void;
}

export interface RegisterCommandsOptions {
  vscodeApi: VscodeLike;
  treeProvider?: TreeRefresher;
  providerRegistry?: ProviderRegistry;
  executionRegistry?: ExecutionRegistry;
  discoverWorkpacksFn?: (workspaceFolders: string[]) => Promise<WorkpackInstance[]>;
  scaffoldWorkpackFn?: (request: ScaffoldWorkpackRequest) => Promise<ScaffoldWorkpackResult>;
  onLintWorkpack?: (workpackFolderPath: string) => Promise<void>;
  extensionUri?: vscode.Uri;
}

export interface ScaffoldWorkpackRequest {
  workspaceRoot: string;
  category: WorkpackCategory;
  slug: string;
  summary: string;
}

export interface ScaffoldWorkpackResult {
  workpackId: string;
  workpackFolderPath: string;
  requestFilePath: string;
}

interface CategoryQuickPickItem extends vscode.QuickPickItem {
  category: WorkpackCategory;
}

interface WorkpackQuickPickItem extends vscode.QuickPickItem {
  folderPath: string;
  workpackId: string;
  instance: WorkpackInstance;
}

interface PromptQuickPickItem extends vscode.QuickPickItem {
  promptStem: string;
}

interface ProviderQuickPickItem extends vscode.QuickPickItem {
  provider: AgentProvider;
}

interface WorkspaceQuickPickItem extends vscode.QuickPickItem {
  folderPath: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayDateStamp(): string {
  return nowIso().slice(0, 10);
}

function toTitleCaseFromSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter((token) => token.length > 0)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function replaceAllTokens(input: string, replacements: Record<string, string>): string {
  let output = input;
  for (const [token, replacement] of Object.entries(replacements)) {
    output = output.split(token).join(replacement);
  }

  return output;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectFilesRecursively(rootPath: string): Promise<string[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFilesRecursively(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function replaceTokensInCopiedTemplate(
  destinationPath: string,
  replacements: Record<string, string>
): Promise<void> {
  const files = await collectFilesRecursively(destinationPath);
  await Promise.all(
    files.map(async (filePath) => {
      const current = await fs.readFile(filePath, "utf8");
      const updated = replaceAllTokens(current, replacements);
      if (updated !== current) {
        await fs.writeFile(filePath, updated, "utf8");
      }
    })
  );
}

async function updateJsonFile(
  filePath: string,
  mutate: (input: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const updated = mutate(parsed);
  await fs.writeFile(filePath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
}

async function seedRequestMarkdown(
  requestFilePath: string,
  category: WorkpackCategory,
  slug: string,
  summary: string
): Promise<void> {
  const content = await fs.readFile(requestFilePath, "utf8");
  const seededBlock = `Request Type: ${category}\nShort Slug: ${slug}\n\n${summary}`;
  const updated = content.replace("<!-- Paste the original request verbatim here -->", seededBlock);
  await fs.writeFile(requestFilePath, updated, "utf8");
}

function getWorkspaceFolderPaths(vscodeApi: VscodeLike): string[] {
  return (vscodeApi.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
}

function escapeForShell(value: string): string {
  return value.replace(/"/g, '\\"');
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatPromptResultLine(promptStem: string, result: PromptResult): string {
  const status = result.success ? "completed" : "failed";
  const details = result.error ? `${result.summary} (${result.error})` : result.summary;
  return `  - ${promptStem}: ${status} - ${details}`;
}

async function getAvailableProviders(registry: ProviderRegistry): Promise<AgentProvider[]> {
  const providers = registry.listAll();
  if (providers.length === 0) {
    return [];
  }

  const availability = await Promise.all(
    providers.map(async (provider) => {
      try {
        return {
          provider,
          available: await provider.isAvailable()
        };
      } catch {
        return {
          provider,
          available: false
        };
      }
    })
  );

  return availability.filter((entry) => entry.available).map((entry) => entry.provider);
}

function deriveWorkpackFolderFromNode(node?: CommandTreeNode): string | undefined {
  if (!node) {
    return undefined;
  }

  if (typeof node.folderPath === "string" && node.folderPath.length > 0) {
    return node.folderPath;
  }

  if (typeof node.filePath !== "string" || node.filePath.length === 0) {
    return undefined;
  }

  const directParent = path.dirname(node.filePath);
  const parentName = path.basename(directParent).toLowerCase();
  if (parentName === "prompts" || parentName === "outputs") {
    return path.dirname(directParent);
  }

  return directParent;
}

function derivePromptStemFromNode(node?: CommandTreeNode): string | undefined {
  if (node?.promptStem && node.promptStem.length > 0) {
    return node.promptStem;
  }

  if (!node?.filePath) {
    return undefined;
  }

  const parentName = path.basename(path.dirname(node.filePath)).toLowerCase();
  if (parentName !== "prompts") {
    return undefined;
  }

  return path.parse(node.filePath).name;
}

async function openFileInEditor(vscodeApi: VscodeLike, filePath: string): Promise<void> {
  const document = await vscodeApi.workspace.openTextDocument(vscodeApi.Uri.file(filePath));
  await vscodeApi.window.showTextDocument(document, { preview: false });
}

function formatProviderCapabilities(provider: AgentProvider): string {
  const capability = provider.capabilities();
  const tags = capability.tags.length > 0 ? capability.tags.join(", ") : "none";

  return [
    `Shell: ${capability.commandExecution ? "yes" : "no"}`,
    `Multi-file: ${capability.multiFileEdit ? "yes" : "no"}`,
    `Long-running: ${capability.longRunning ? "yes" : "no"}`,
    `Max tokens: ${capability.maxPromptTokens}`,
    `Tags: ${tags}`
  ].join(" | ");
}

async function pickWorkspaceFolder(vscodeApi: VscodeLike): Promise<string | undefined> {
  const workspaceFolders = vscodeApi.workspace.workspaceFolders ?? [];
  if (workspaceFolders.length === 0) {
    await vscodeApi.window.showWarningMessage(
      "Open a workspace folder containing workpacks before running this command."
    );
    return undefined;
  }

  if (workspaceFolders.length === 1) {
    return workspaceFolders[0].uri.fsPath;
  }

  const picked = await vscodeApi.window.showQuickPick<WorkspaceQuickPickItem>(
    workspaceFolders.map((folder) => ({
      label: path.basename(folder.uri.fsPath),
      description: folder.uri.fsPath,
      folderPath: folder.uri.fsPath
    })),
    {
      placeHolder: "Select the workspace folder to use for workpack operations."
    }
  );

  return picked?.folderPath;
}

async function discoverWorkpackInstances(
  vscodeApi: VscodeLike,
  discoverFn: (workspaceFolders: string[]) => Promise<WorkpackInstance[]>
): Promise<WorkpackInstance[]> {
  const workspaceFolderPaths = getWorkspaceFolderPaths(vscodeApi);
  if (workspaceFolderPaths.length === 0) {
    return [];
  }

  return discoverFn(workspaceFolderPaths);
}

async function pickWorkpackInstance(
  vscodeApi: VscodeLike,
  discoverFn: (workspaceFolders: string[]) => Promise<WorkpackInstance[]>,
  placeHolder: string
): Promise<WorkpackInstance | undefined> {
  const instances = await discoverWorkpackInstances(vscodeApi, discoverFn);
  if (instances.length === 0) {
    await vscodeApi.window.showWarningMessage("No workpack instances were found in the open workspace.");
    return undefined;
  }

  if (instances.length === 1) {
    return instances[0];
  }

  const picked = await vscodeApi.window.showQuickPick<WorkpackQuickPickItem>(
    instances.map((instance) => ({
      label: instance.meta.id,
      description: instance.meta.title,
      detail: instance.folderPath,
      folderPath: instance.folderPath,
      workpackId: instance.meta.id,
      instance
    })),
    { placeHolder }
  );

  return picked?.instance;
}

async function resolveWorkpackFolderPath(
  vscodeApi: VscodeLike,
  node: CommandTreeNode | undefined,
  discoverFn: (workspaceFolders: string[]) => Promise<WorkpackInstance[]>,
  placeHolder: string
): Promise<string | undefined> {
  const nodeFolderPath = deriveWorkpackFolderFromNode(node);
  if (nodeFolderPath) {
    return nodeFolderPath;
  }

  if (node?.workpackId) {
    const instances = await discoverWorkpackInstances(vscodeApi, discoverFn);
    const fromId = instances.find((instance) => instance.meta.id === node.workpackId);
    if (fromId) {
      return fromId.folderPath;
    }
  }

  const pickedWorkpack = await pickWorkpackInstance(vscodeApi, discoverFn, placeHolder);
  return pickedWorkpack?.folderPath;
}

async function resolvePromptTarget(
  vscodeApi: VscodeLike,
  node: CommandTreeNode | undefined,
  discoverFn: (workspaceFolders: string[]) => Promise<WorkpackInstance[]>
): Promise<{ folderPath: string; workpackId: string; promptStem: string } | undefined> {
  const promptStem = derivePromptStemFromNode(node);
  const folderPath = deriveWorkpackFolderFromNode(node);

  if (promptStem && folderPath) {
    const workpackId = node?.workpackId ?? path.basename(folderPath);
    return {
      folderPath,
      workpackId,
      promptStem
    };
  }

  const workpack = await pickWorkpackInstance(
    vscodeApi,
    discoverFn,
    "Select the workpack containing the prompt you want to assign."
  );
  if (!workpack) {
    return undefined;
  }

  if (workpack.meta.prompts.length === 0) {
    await vscodeApi.window.showWarningMessage(`Workpack ${workpack.meta.id} has no prompts to assign.`);
    return undefined;
  }

  if (workpack.meta.prompts.length === 1) {
    return {
      folderPath: workpack.folderPath,
      workpackId: workpack.meta.id,
      promptStem: workpack.meta.prompts[0].stem
    };
  }

  const pickedPrompt = await vscodeApi.window.showQuickPick<PromptQuickPickItem>(
    workpack.meta.prompts.map((prompt) => ({
      label: prompt.stem,
      description: prompt.agentRole,
      detail: `Depends on: ${prompt.dependsOn.join(", ") || "-"}`,
      promptStem: prompt.stem
    })),
    {
      placeHolder: `Select a prompt in ${workpack.meta.id}.`
    }
  );

  if (!pickedPrompt) {
    return undefined;
  }

  return {
    folderPath: workpack.folderPath,
    workpackId: workpack.meta.id,
    promptStem: pickedPrompt.promptStem
  };
}

async function runLintCommand(
  vscodeApi: VscodeLike,
  workpackFolderPath: string,
  workspaceRoot: string
): Promise<void> {
  const lintScriptPath = path.join(workspaceRoot, "workpacks", "tools", "workpack_lint.py");
  if (!(await pathExists(lintScriptPath))) {
    await vscodeApi.window.showWarningMessage(
      `Lint script not found at ${lintScriptPath}. Unable to run lint command.`
    );
    return;
  }

  const terminal = vscodeApi.window.createTerminal("Workpack Lint");
  terminal.show(true);
  terminal.sendText(`python "${escapeForShell(lintScriptPath)}" "${escapeForShell(workpackFolderPath)}"`);
}

async function runWithExecutionProgress(
  vscodeApi: VscodeLike,
  title: string,
  initialMessage: string,
  outputChannel: OutputChannelLike,
  execute: (signal: AbortSignal) => Promise<ExecutionSummary>
): Promise<{ summary: ExecutionSummary; wasCancelled: boolean }> {
  const abortController = new AbortController();
  let wasCancelled = false;

  const summary = await vscodeApi.window.withProgress<ExecutionSummary>(
    {
      location: vscodeApi.ProgressLocation.Notification,
      title,
      cancellable: true
    },
    async (progress, token) => {
      progress.report({ message: initialMessage });

      const cancellationListener = token.onCancellationRequested(() => {
        wasCancelled = true;
        outputChannel.appendLine("[execution] Cancellation requested.");
        abortController.abort();
        progress.report({ message: "Cancelling execution..." });
      });

      try {
        const executionSummary = await execute(abortController.signal);
        progress.report({
          increment: 100,
          message: `Completed: ${executionSummary.completed}, Failed: ${executionSummary.failed}, Skipped: ${executionSummary.skipped}`
        });
        return executionSummary;
      } finally {
        cancellationListener.dispose();
      }
    }
  );

  return {
    summary,
    wasCancelled
  };
}

export async function scaffoldWorkpackFromTemplate(
  request: ScaffoldWorkpackRequest
): Promise<ScaffoldWorkpackResult> {
  const workspaceRoot = path.resolve(request.workspaceRoot);
  const templatePath = path.join(workspaceRoot, TEMPLATE_DIRECTORY);
  const instancesPath = path.join(workspaceRoot, INSTANCES_DIRECTORY);
  const slug = request.slug.trim();
  const summary = request.summary.trim();
  const workpackId = slug;
  const destinationPath = path.join(instancesPath, workpackId);

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("The workpack slug must be kebab-case and alphanumeric.");
  }

  if (!(await pathExists(templatePath))) {
    throw new Error(`Template folder not found: ${templatePath}`);
  }

  if (await pathExists(destinationPath)) {
    throw new Error(`Workpack folder already exists: ${destinationPath}`);
  }

  const createdAt = todayDateStamp();
  const timestamp = nowIso();
  const repoName = path.basename(workspaceRoot);
  const replacements: Record<string, string> = {
    "__WORKPACK_ID__": workpackId,
    "__WORKPACK_TITLE__": toTitleCaseFromSlug(slug),
    "__WORKPACK_SUMMARY__": summary,
    "__CREATED_AT__": createdAt,
    "__LAST_UPDATED__": timestamp,
    "__REPO_NAME__": repoName,
    "<WORKPACK_ID>": workpackId,
    "<REPO_NAME>": repoName,
    "<MODEL_ID>": "gpt-4o",
    "<group>": path.basename(path.dirname(destinationPath)),
    "<workpack>": workpackId
  };

  await fs.mkdir(instancesPath, { recursive: true });
  await fs.cp(templatePath, destinationPath, { recursive: true, errorOnExist: true, force: false });
  await replaceTokensInCopiedTemplate(destinationPath, replacements);

  const metaPath = path.join(destinationPath, WORKPACK_FILES.meta);
  const statePath = path.join(destinationPath, WORKPACK_FILES.state);
  const requestPath = path.join(destinationPath, WORKPACK_FILES.request);

  await updateJsonFile(metaPath, (input) => {
    const output: Record<string, unknown> = { ...input };
    output.id = workpackId;
    output.title = toTitleCaseFromSlug(slug);
    output.summary = summary;
    output.category = request.category;
    output.created_at = createdAt;
    output.repos = [repoName];
    return output;
  });

  await updateJsonFile(statePath, (input) => {
    const output: Record<string, unknown> = { ...input };
    output.workpack_id = workpackId;
    output.last_updated = timestamp;
    return output;
  });

  await seedRequestMarkdown(requestPath, request.category, slug, summary);

  return {
    workpackId,
    workpackFolderPath: destinationPath,
    requestFilePath: requestPath
  };
}

export function registerCommands(
  context: Pick<vscode.ExtensionContext, "subscriptions">,
  options: RegisterCommandsOptions
): void {
  const { vscodeApi, treeProvider, providerRegistry } = options;
  const discoverFn = options.discoverWorkpacksFn ?? discoverWorkpacks;
  const scaffoldFn = options.scaffoldWorkpackFn ?? scaffoldWorkpackFromTemplate;
  let executionOutputChannel: OutputChannelLike | undefined;

  const getExecutionOutputChannel = (): OutputChannelLike => {
    if (!executionOutputChannel) {
      executionOutputChannel = vscodeApi.window.createOutputChannel(EXECUTION_OUTPUT_CHANNEL_NAME);
      context.subscriptions.push(executionOutputChannel as unknown as vscode.Disposable);
    }

    return executionOutputChannel;
  };

  const logExecutionSummary = (
    outputChannel: OutputChannelLike,
    mode: "single" | "all",
    summary: ExecutionSummary
  ): void => {
    outputChannel.appendLine(
      `[execution] Finished ${mode === "single" ? "executePrompt" : "executeAll"}: total=${summary.total}, completed=${summary.completed}, failed=${summary.failed}, skipped=${summary.skipped}`
    );

    for (const [promptStem, result] of Object.entries(summary.results).sort(([left], [right]) =>
      left.localeCompare(right)
    )) {
      outputChannel.appendLine(formatPromptResultLine(promptStem, result));
    }
  };

  const executePromptTarget = async (
    promptTarget: { folderPath: string; workpackId: string; promptStem: string },
    titlePrefix: string,
    startVerb: string
  ): Promise<void> => {
    const outputChannel = getExecutionOutputChannel();

    if (!providerRegistry) {
      const message = "Provider registry is not configured. Prompt execution is unavailable.";
      outputChannel.appendLine(`[execution] ${message}`);
      await vscodeApi.window.showErrorMessage(message);
      return;
    }

    if (providerRegistry.listAll().length === 0) {
      const message = "No agent providers are registered. Configure providers before execution.";
      outputChannel.appendLine(`[execution] ${message}`);
      await vscodeApi.window.showErrorMessage(message);
      return;
    }

    const availableProviders = await getAvailableProviders(providerRegistry);
    if (availableProviders.length === 0) {
      const message =
        "No configured providers are currently available. Check provider credentials and retry.";
      outputChannel.appendLine(`[execution] ${message}`);
      await vscodeApi.window.showErrorMessage(message);
      return;
    }

    const workpack = await parseWorkpackInstance(promptTarget.folderPath);
    const statePath = path.join(promptTarget.folderPath, WORKPACK_FILES.state);
    outputChannel.show(true);
    outputChannel.appendLine(
      `[execution] ${startVerb} ${promptTarget.promptStem} in ${workpack.meta.id}.`
    );

    const { summary, wasCancelled } = await runWithExecutionProgress(
      vscodeApi,
      `${titlePrefix}: ${promptTarget.promptStem}`,
      "Dispatching prompt...",
      outputChannel,
      async (signal) => {
        const assignment = new AssignmentModel(statePath, providerRegistry);
        const orchestrator = new ExecutionOrchestrator(providerRegistry, assignment, {
          maxParallel: 1,
          continueOnError: false,
          timeoutMs: ORCHESTRATOR_TIMEOUT_MS,
          signal,
          executionRegistry: options.executionRegistry
        });

        return orchestrator.executeOne(workpack.meta, statePath, promptTarget.promptStem);
      }
    );

    logExecutionSummary(outputChannel, "single", summary);

    const selectedPromptResult = summary.results[promptTarget.promptStem];
    if (wasCancelled) {
      await vscodeApi.window.showWarningMessage(
        `Execution cancelled for ${promptTarget.promptStem}.`
      );
      return;
    }

    if (selectedPromptResult?.success) {
      await vscodeApi.window.showInformationMessage(
        `Prompt ${promptTarget.promptStem} completed successfully.`
      );
      return;
    }

    const failureDetail = selectedPromptResult?.error ?? selectedPromptResult?.summary ?? "Unknown error.";
    await vscodeApi.window.showErrorMessage(
      `Prompt ${promptTarget.promptStem} failed: ${failureDetail}`
    );
  };

  const register = <TArgs extends unknown[]>(
    commandId: string,
    callback: (...args: TArgs) => unknown | Promise<unknown>
  ): void => {
    context.subscriptions.push(
      vscodeApi.commands.registerCommand(commandId, (...args: unknown[]) => {
        return callback(...(args as TArgs));
      })
    );
  };

  const runCreateWorkpack = async (): Promise<void> => {
    try {
      const workspaceRoot = await pickWorkspaceFolder(vscodeApi);
      if (!workspaceRoot) {
        return;
      }

      const categorySelection = await vscodeApi.window.showQuickPick<CategoryQuickPickItem>(
        CATEGORY_OPTIONS.map((option) => ({
          label: option.category,
          description: `Category: ${option.category}`,
          detail: option.detail,
          category: option.category
        })),
        {
          placeHolder: "Select the new workpack category."
        }
      );
      if (!categorySelection) {
        return;
      }

      const slug = await vscodeApi.window.showInputBox({
        placeHolder: "short-kebab-slug",
        prompt: "Enter a short slug for the workpack.",
        validateInput: (value) =>
          SLUG_PATTERN.test(value.trim())
            ? undefined
            : "Use lowercase letters, numbers, and dashes (kebab-case)."
      });
      if (!slug) {
        return;
      }

      const summary = await vscodeApi.window.showInputBox({
        placeHolder: "Short summary of the objective",
        prompt: "Enter a concise workpack summary.",
        validateInput: (value) =>
          value.trim().length > 0 ? undefined : "Summary cannot be empty."
      });
      if (!summary) {
        return;
      }

      const result = await scaffoldFn({
        workspaceRoot,
        category: categorySelection.category,
        slug: slug.trim(),
        summary: summary.trim()
      });

      await openFileInEditor(vscodeApi, result.requestFilePath);
      treeProvider?.refresh();
      await vscodeApi.window.showInformationMessage(`Created workpack ${result.workpackId}.`);
    } catch (error) {
      await vscodeApi.window.showErrorMessage(
        `Unable to create workpack: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  register(WORKPACK_MANAGER_COMMANDS.createWorkpack, runCreateWorkpack);
  register(WORKPACK_MANAGER_COMMANDS.scaffoldFromTemplate, runCreateWorkpack);

  register(WORKPACK_MANAGER_COMMANDS.openRequest, async (node?: CommandTreeNode) => {
    try {
      const folderPath = await resolveWorkpackFolderPath(
        vscodeApi,
        node,
        discoverFn,
        "Select the workpack to open its request file."
      );
      if (!folderPath) {
        return;
      }

      const requestPath = path.join(folderPath, WORKPACK_FILES.request);
      if (!(await pathExists(requestPath))) {
        await vscodeApi.window.showWarningMessage(`Request file not found: ${requestPath}`);
        return;
      }

      await openFileInEditor(vscodeApi, requestPath);
    } catch (error) {
      await vscodeApi.window.showErrorMessage(
        `Unable to open request: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  register(WORKPACK_MANAGER_COMMANDS.openPlan, async (node?: CommandTreeNode) => {
    try {
      const folderPath = await resolveWorkpackFolderPath(
        vscodeApi,
        node,
        discoverFn,
        "Select the workpack to open its plan file."
      );
      if (!folderPath) {
        return;
      }

      const planPath = path.join(folderPath, WORKPACK_FILES.plan);
      if (!(await pathExists(planPath))) {
        await vscodeApi.window.showWarningMessage(`Plan file not found: ${planPath}`);
        return;
      }

      await openFileInEditor(vscodeApi, planPath);
    } catch (error) {
      await vscodeApi.window.showErrorMessage(
        `Unable to open plan: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  register(WORKPACK_MANAGER_COMMANDS.openStatus, async (node?: CommandTreeNode) => {
    try {
      const folderPath = await resolveWorkpackFolderPath(
        vscodeApi,
        node,
        discoverFn,
        "Select the workpack to open its status file."
      );
      if (!folderPath) {
        return;
      }

      const statusPath = path.join(folderPath, WORKPACK_FILES.status);
      if (!(await pathExists(statusPath))) {
        await vscodeApi.window.showWarningMessage(`Status file not found: ${statusPath}`);
        return;
      }

      await openFileInEditor(vscodeApi, statusPath);
    } catch (error) {
      await vscodeApi.window.showErrorMessage(
        `Unable to open status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  register(WORKPACK_MANAGER_COMMANDS.viewDetails, async (node?: CommandTreeNode) => {
    try {
      const folderPath = await resolveWorkpackFolderPath(
        vscodeApi,
        node,
        discoverFn,
        "Select the workpack to inspect."
      );
      if (!folderPath) {
        return;
      }

      const metaPath = path.join(folderPath, WORKPACK_FILES.meta);
      if (!(await pathExists(metaPath))) {
        await vscodeApi.window.showWarningMessage(`Metadata file not found: ${metaPath}`);
        return;
      }

      if (!options.extensionUri) {
        await openFileInEditor(vscodeApi, metaPath);
        return;
      }

      const workpack = await parseWorkpackInstance(folderPath);
      const { WorkpackDetailPanel } = await import("../views/workpack-detail-panel");
      WorkpackDetailPanel.createOrShow(options.extensionUri, workpack);
    } catch (error) {
      await vscodeApi.window.showErrorMessage(
        `Unable to show workpack details: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  register(WORKPACK_MANAGER_COMMANDS.openPixelRoom, async (node?: CommandTreeNode) => {
    try {
      const folderPath = await resolveWorkpackFolderPath(
        vscodeApi,
        node,
        discoverFn,
        "Select the workpack to open in the pixel room."
      );
      if (!folderPath) {
        return;
      }

      const metaPath = path.join(folderPath, WORKPACK_FILES.meta);
      if (!(await pathExists(metaPath))) {
        await vscodeApi.window.showWarningMessage(`Metadata file not found: ${metaPath}`);
        return;
      }

      if (!options.extensionUri) {
        await openFileInEditor(vscodeApi, metaPath);
        return;
      }

      const workpack = await parseWorkpackInstance(folderPath);
      const { WorkpackPixelRoomPanel } = await import("../views/workpack-pixel-room-panel");
      WorkpackPixelRoomPanel.createOrShow(options.extensionUri, workpack, {
        executionRegistry: options.executionRegistry
      });
    } catch (error) {
      await vscodeApi.window.showErrorMessage(
        `Unable to open pixel room: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  register(WORKPACK_MANAGER_COMMANDS.lintWorkpack, async (node?: CommandTreeNode) => {
    try {
      const workspaceRoot = await pickWorkspaceFolder(vscodeApi);
      if (!workspaceRoot) {
        return;
      }

      const folderPath = await resolveWorkpackFolderPath(
        vscodeApi,
        node,
        discoverFn,
        "Select the workpack to lint."
      );
      if (!folderPath) {
        return;
      }

      if (options.onLintWorkpack) {
        try {
          await options.onLintWorkpack(folderPath);
        } catch (error) {
          await vscodeApi.window.showWarningMessage(
            `Lint diagnostics could not be published: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      await runLintCommand(vscodeApi, folderPath, workspaceRoot);
    } catch (error) {
      await vscodeApi.window.showErrorMessage(
        `Unable to lint workpack: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  register(WORKPACK_MANAGER_COMMANDS.assignAgent, async (node?: CommandTreeNode) => {
    try {
      if (!providerRegistry) {
        await vscodeApi.window.showWarningMessage(
          "Provider registry is not configured. Assign Agent is unavailable."
        );
        return;
      }

      const providers = providerRegistry.listAll();
      if (providers.length === 0) {
        await vscodeApi.window.showWarningMessage(
          "No agent providers are registered. Configure providers before assigning."
        );
        return;
      }

      const promptTarget = await resolvePromptTarget(vscodeApi, node, discoverFn);
      if (!promptTarget) {
        return;
      }

      const pickedProvider = await vscodeApi.window.showQuickPick<ProviderQuickPickItem>(
        providers.map((provider) => ({
          label: provider.displayName,
          description: provider.id,
          detail: formatProviderCapabilities(provider),
          provider
        })),
        {
          placeHolder: `Assign an agent to ${promptTarget.promptStem}.`
        }
      );
      if (!pickedProvider) {
        return;
      }

      const statePath = path.join(promptTarget.folderPath, WORKPACK_FILES.state);
      const assignment = new AssignmentModel(statePath, providerRegistry);
      await assignment.load();
      await assignment.assign(promptTarget.promptStem, pickedProvider.provider.id);
      await assignment.save();
      treeProvider?.refresh();

      await vscodeApi.window.showInformationMessage(
        `Assigned ${pickedProvider.provider.displayName} to ${promptTarget.promptStem}.`
      );
    } catch (error) {
      await vscodeApi.window.showErrorMessage(
        `Unable to assign agent: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  register(WORKPACK_MANAGER_COMMANDS.executePrompt, async (node?: CommandTreeNode) => {
    try {
      const promptTarget = await resolvePromptTarget(vscodeApi, node, discoverFn);
      if (!promptTarget) {
        return;
      }
      await executePromptTarget(
        promptTarget,
        "Execute Prompt",
        "Starting executePrompt for"
      );
    } catch (error) {
      const message = toErrorMessage(error);
      getExecutionOutputChannel().appendLine(`[execution] executePrompt failed: ${message}`);
      await vscodeApi.window.showErrorMessage(`Unable to execute prompt: ${message}`);
    } finally {
      treeProvider?.refresh();
    }
  });

  register(WORKPACK_MANAGER_COMMANDS.retryPrompt, async (node?: CommandTreeNode) => {
    try {
      const promptTarget = await resolvePromptTarget(vscodeApi, node, discoverFn);
      if (!promptTarget) {
        return;
      }

      const activeRun = options.executionRegistry?.getLatestRunForPrompt(
        promptTarget.workpackId,
        promptTarget.promptStem
      );
      if (activeRun && (activeRun.status === "queued" || activeRun.status === "in_progress")) {
        await vscodeApi.window.showWarningMessage(
          `Prompt ${promptTarget.promptStem} is already running.`
        );
        return;
      }

      const statePath = path.join(promptTarget.folderPath, WORKPACK_FILES.state);
      const state = await loadWorkpackState(statePath, promptTarget.workpackId);
      const existingPromptState = state.promptStatus[promptTarget.promptStem] ?? { status: "pending" };
      state.promptStatus[promptTarget.promptStem] = {
        ...existingPromptState,
        status: "pending",
        completedAt: null,
        blockedReason: null,
        outputValidated: false
      };
      state.lastUpdated = nowIso();
      await saveWorkpackStateAtomic(statePath, state);

      await executePromptTarget(
        promptTarget,
        "Retry Prompt",
        "Retrying prompt"
      );
    } catch (error) {
      const message = toErrorMessage(error);
      getExecutionOutputChannel().appendLine(`[execution] retryPrompt failed: ${message}`);
      await vscodeApi.window.showErrorMessage(`Unable to retry prompt: ${message}`);
    } finally {
      treeProvider?.refresh();
    }
  });

  register(WORKPACK_MANAGER_COMMANDS.executeAll, async (node?: CommandTreeNode) => {
    const outputChannel = getExecutionOutputChannel();
    try {
      const folderPath = await resolveWorkpackFolderPath(
        vscodeApi,
        node,
        discoverFn,
        "Select the workpack to execute."
      );
      if (!folderPath) {
        return;
      }

      if (!providerRegistry) {
        const message = "Provider registry is not configured. Batch execution is unavailable.";
        outputChannel.appendLine(`[execution] ${message}`);
        await vscodeApi.window.showErrorMessage(message);
        return;
      }

      if (providerRegistry.listAll().length === 0) {
        const message = "No agent providers are registered. Configure providers before execution.";
        outputChannel.appendLine(`[execution] ${message}`);
        await vscodeApi.window.showErrorMessage(message);
        return;
      }

      const availableProviders = await getAvailableProviders(providerRegistry);
      if (availableProviders.length === 0) {
        const message =
          "No configured providers are currently available. Check provider credentials and retry.";
        outputChannel.appendLine(`[execution] ${message}`);
        await vscodeApi.window.showErrorMessage(message);
        return;
      }

      const workpack = await parseWorkpackInstance(folderPath);
      const statePath = path.join(folderPath, WORKPACK_FILES.state);
      const state = workpack.state ?? (await loadWorkpackState(statePath, workpack.meta.id));
      const preflightOrchestrator = new ExecutionOrchestrator(
        providerRegistry,
        new AssignmentModel(statePath, providerRegistry),
        {
          maxParallel: EXECUTE_ALL_MAX_PARALLEL,
          continueOnError: false,
          timeoutMs: ORCHESTRATOR_TIMEOUT_MS,
          executionRegistry: options.executionRegistry
        }
      );
      const readyPrompts = preflightOrchestrator.getReadyPrompts(workpack.meta, state);
      if (readyPrompts.length === 0) {
        const message = `No ready prompts to execute for ${workpack.meta.id}.`;
        outputChannel.appendLine(`[execution] ${message}`);
        await vscodeApi.window.showInformationMessage(message);
        return;
      }

      outputChannel.show(true);
      outputChannel.appendLine(
        `[execution] Starting executeAll for ${workpack.meta.id}. Ready prompts: ${readyPrompts.join(", ")}`
      );

      const { summary, wasCancelled } = await runWithExecutionProgress(
        vscodeApi,
        `Execute All: ${workpack.meta.id}`,
        `Dispatching ${readyPrompts.length} ready prompt(s)...`,
        outputChannel,
        async (signal) => {
          const assignment = new AssignmentModel(statePath, providerRegistry);
          const orchestrator = new ExecutionOrchestrator(providerRegistry, assignment, {
            maxParallel: EXECUTE_ALL_MAX_PARALLEL,
            continueOnError: false,
            timeoutMs: ORCHESTRATOR_TIMEOUT_MS,
            signal,
            executionRegistry: options.executionRegistry
          });

          return orchestrator.execute(workpack.meta, statePath);
        }
      );

      logExecutionSummary(outputChannel, "all", summary);

      if (wasCancelled) {
        await vscodeApi.window.showWarningMessage(`Execution cancelled for ${workpack.meta.id}.`);
        return;
      }

      if (summary.failed > 0) {
        await vscodeApi.window.showWarningMessage(
          `Execution completed with failures for ${workpack.meta.id}: ${summary.failed} failed, ${summary.completed} completed, ${summary.skipped} skipped.`
        );
        return;
      }

      await vscodeApi.window.showInformationMessage(
        `Execution completed for ${workpack.meta.id}: ${summary.completed} completed, ${summary.skipped} skipped.`
      );
    } catch (error) {
      const message = toErrorMessage(error);
      outputChannel.appendLine(`[execution] executeAll failed: ${message}`);
      await vscodeApi.window.showErrorMessage(`Unable to execute all prompts: ${message}`);
    } finally {
      treeProvider?.refresh();
    }
  });

  register(WORKPACK_MANAGER_COMMANDS.refreshTree, async () => {
    treeProvider?.refresh();
  });

  register(WORKPACK_MANAGER_COMMANDS.stopPromptExecution, async (node?: CommandTreeNode) => {
    try {
      if (!options.executionRegistry) {
        await vscodeApi.window.showWarningMessage(
          "Execution registry is not configured. Stop Prompt is unavailable."
        );
        return;
      }

      if (node?.runId) {
        const stopped = options.executionRegistry.stopRun(node.runId);
        if (!stopped) {
          await vscodeApi.window.showWarningMessage(
            "No active prompt execution was found for the selected run."
          );
          return;
        }

        treeProvider?.refresh();
        await vscodeApi.window.showInformationMessage("Stop requested for the selected prompt.");
        return;
      }

      const promptTarget = await resolvePromptTarget(vscodeApi, node, discoverFn);
      if (!promptTarget) {
        return;
      }

      const activeRun = options.executionRegistry.getLatestRunForPrompt(
        promptTarget.workpackId,
        promptTarget.promptStem
      );
      if (!activeRun || (activeRun.status !== "queued" && activeRun.status !== "in_progress")) {
        await vscodeApi.window.showWarningMessage(
          `No active execution found for ${promptTarget.promptStem}.`
        );
        return;
      }

      options.executionRegistry.stopRun(activeRun.runId);
      treeProvider?.refresh();
      await vscodeApi.window.showInformationMessage(`Stop requested for ${promptTarget.promptStem}.`);
    } catch (error) {
      await vscodeApi.window.showErrorMessage(
        `Unable to stop prompt execution: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  register(WORKPACK_MANAGER_COMMANDS.provideAgentInput, async (node?: CommandTreeNode) => {
    try {
      if (!options.executionRegistry) {
        await vscodeApi.window.showWarningMessage(
          "Execution registry is not configured. Provide Input is unavailable."
        );
        return;
      }

      let targetRun = node?.runId ? options.executionRegistry.getRun(node.runId) : undefined;
      if (!targetRun) {
        const promptTarget = await resolvePromptTarget(vscodeApi, node, discoverFn);
        if (!promptTarget) {
          return;
        }

        targetRun = options.executionRegistry.getLatestRunForPrompt(
          promptTarget.workpackId,
          promptTarget.promptStem
        );
      }

      if (!targetRun || targetRun.status !== "human_input_required") {
        await vscodeApi.window.showWarningMessage(
          "The selected agent is not waiting for human input."
        );
        return;
      }

      const input = await vscodeApi.window.showInputBox({
        prompt: targetRun.inputRequest ?? `Provide input for ${targetRun.promptStem}`,
        placeHolder: "Type the response to send back to the agent"
      });

      if (input === undefined) {
        return;
      }

      const submitted = await options.executionRegistry.submitHumanInput(targetRun.runId, input);
      if (!submitted) {
        await vscodeApi.window.showWarningMessage(
          "The current agent provider cannot resume from human input yet."
        );
        return;
      }

      treeProvider?.refresh();
      await vscodeApi.window.showInformationMessage(`Input submitted for ${targetRun.promptStem}.`);
    } catch (error) {
      await vscodeApi.window.showErrorMessage(
        `Unable to provide agent input: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
