import * as path from "node:path";
import type { AgentRunSnapshot } from "../../agents/execution-registry";
import type { WorkpackInstance } from "../../models";
import type {
  DeskRuntimeStatus,
  PixelOfficeProvider,
  PromptDesk,
  RoomStation,
  SceneState,
} from "../../models/pixel-office";
import { scanOutputs } from "../../state/output-scanner";
import { buildAgentAvatars } from "./avatar-runtime";
import { buildDeskPreview, getDeskActionItems } from "./desk-interactions";
import { createPixelRoomLayout } from "./room-layout";

const REQUEST_FILE = "00_request.md";
const PLAN_FILE = "01_plan.md";
const STATUS_FILE = "99_status.md";
const OUTPUTS_DIRECTORY = "outputs";
const PROMPTS_DIRECTORY = "prompts";

export interface BuildSceneStateOptions {
  generatedAt?: string;
  reducedMotion?: boolean;
  selectedDeskId?: string;
  hoveredDeskId?: string;
  runtimeRuns?: AgentRunSnapshot[];
  availableProviders?: PixelOfficeProvider[];
}

function humanizeLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getLatestRunsByPrompt(runtimeRuns: readonly AgentRunSnapshot[]): Map<string, AgentRunSnapshot> {
  const latestByPrompt = new Map<string, AgentRunSnapshot>();

  for (const run of runtimeRuns) {
    const current = latestByPrompt.get(run.promptStem);
    if (!current) {
      latestByPrompt.set(run.promptStem, run);
      continue;
    }

    if (run.updatedAt.localeCompare(current.updatedAt) >= 0) {
      latestByPrompt.set(run.promptStem, run);
    }
  }

  return latestByPrompt;
}

function resolveDeskStatus(
  workpack: WorkpackInstance,
  promptStem: string,
  latestRun?: AgentRunSnapshot,
): DeskRuntimeStatus {
  if (latestRun) {
    return latestRun.status;
  }

  return workpack.state?.promptStatus[promptStem]?.status ?? "pending";
}

function buildStations(workpack: WorkpackInstance, outputCount: number, generatedLayout: ReturnType<typeof createPixelRoomLayout>): RoomStation[] {
  const requestPath = path.join(workpack.folderPath, REQUEST_FILE);
  const planPath = path.join(workpack.folderPath, PLAN_FILE);
  const statusPath = path.join(workpack.folderPath, STATUS_FILE);
  const outputsPath = path.join(workpack.folderPath, OUTPUTS_DIRECTORY);

  return [
    {
      id: "station:request",
      kind: "request",
      label: REQUEST_FILE,
      filePath: requestPath,
      position: generatedLayout.stations.request.position,
      dimensions: generatedLayout.stations.request.dimensions,
      badgeText: humanizeLabel(workpack.meta.category),
      isPrimary: true,
    },
    {
      id: "station:plan",
      kind: "plan",
      label: PLAN_FILE,
      filePath: planPath,
      position: generatedLayout.stations.plan.position,
      dimensions: generatedLayout.stations.plan.dimensions,
      badgeText: `${workpack.meta.prompts.length} prompt${workpack.meta.prompts.length === 1 ? "" : "s"}`,
    },
    {
      id: "station:status",
      kind: "status",
      label: STATUS_FILE,
      filePath: statusPath,
      position: generatedLayout.stations.status.position,
      dimensions: generatedLayout.stations.status.dimensions,
      badgeText: humanizeLabel(workpack.state?.overallStatus ?? "unknown"),
    },
    {
      id: "station:output-board",
      kind: "output_board",
      label: OUTPUTS_DIRECTORY,
      filePath: outputsPath,
      position: generatedLayout.stations.output_board.position,
      dimensions: generatedLayout.stations.output_board.dimensions,
      badgeText: `${outputCount} artifact${outputCount === 1 ? "" : "s"}`,
    },
  ];
}

function buildDesks(
  workpack: WorkpackInstance,
  generatedLayout: ReturnType<typeof createPixelRoomLayout>,
  latestRunsByPrompt: ReadonlyMap<string, AgentRunSnapshot>,
  outputByPrompt: ReadonlyMap<string, { filePath: string }>,
  providerLabelsById: ReadonlyMap<string, string>,
): PromptDesk[] {
  return workpack.meta.prompts.map((prompt, index) => {
    const promptState = workpack.state?.promptStatus[prompt.stem];
    const latestRun = latestRunsByPrompt.get(prompt.stem);
    const assignedAgentId = latestRun?.providerId ?? promptState?.assignedAgent ?? workpack.state?.agentAssignments[prompt.stem];
    const providerDisplayName = assignedAgentId ? providerLabelsById.get(assignedAgentId) ?? assignedAgentId : undefined;
    const outputArtifact = outputByPrompt.get(prompt.stem);
    const frame = generatedLayout.desks[index];
    const status = resolveDeskStatus(workpack, prompt.stem, latestRun);
    const interactionState = {
      status,
      promptRole: prompt.agentRole,
      assignedAgentId,
      providerDisplayName,
      blockedReason: promptState?.blockedReason,
      latestRun,
      outputPath: outputArtifact?.filePath,
    };

    return {
      id: `desk:${prompt.stem}`,
      promptStem: prompt.stem,
      label: prompt.stem,
      promptFilePath: path.join(workpack.folderPath, PROMPTS_DIRECTORY, `${prompt.stem}.md`),
      position: frame.position,
      dimensions: frame.dimensions,
      promptRole: prompt.agentRole,
      dependsOn: prompt.dependsOn,
      repos: prompt.repos,
      status,
      assignedAgentId,
      providerDisplayName,
      latestRunId: latestRun?.runId,
      outputPath: outputArtifact?.filePath,
      actions: getDeskActionItems(interactionState),
      preview: buildDeskPreview(interactionState),
    };
  });
}

export function buildPixelOfficeSceneState(
  workpack: WorkpackInstance,
  options: BuildSceneStateOptions = {},
): SceneState {
  const runtimeRuns = (options.runtimeRuns ?? []).filter((run) => run.workpackId === workpack.meta.id);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const providers = [...(options.availableProviders ?? [])];
  const providerLabelsById = new Map(providers.map((provider) => [provider.id, provider.label]));
  const outputScan = scanOutputs(path.join(workpack.folderPath, OUTPUTS_DIRECTORY));
  const generatedLayout = createPixelRoomLayout(workpack.meta.prompts.length);
  const latestRunsByPrompt = getLatestRunsByPrompt(runtimeRuns);
  const stations = buildStations(workpack, outputScan.artifacts.length, generatedLayout);
  const desks = buildDesks(workpack, generatedLayout, latestRunsByPrompt, outputScan.outputByPrompt, providerLabelsById);
  const outputBoardStation = stations.find((station) => station.kind === "output_board");
  const avatars = buildAgentAvatars(desks, outputBoardStation, latestRunsByPrompt, generatedAt);

  return {
    version: 1,
    generatedAt,
    workpackId: workpack.meta.id,
    providers,
    selectedDeskId: options.selectedDeskId,
    hoveredDeskId: options.hoveredDeskId,
    reducedMotion: options.reducedMotion ?? false,
    room: {
      id: `room:${workpack.meta.id}`,
      workpackId: workpack.meta.id,
      title: workpack.meta.title,
      folderPath: workpack.folderPath,
      overallStatus: workpack.state?.overallStatus ?? "unknown",
      tileSize: generatedLayout.tileSize,
      dimensions: generatedLayout.dimensions,
      stations,
      desks,
      avatars,
    },
  };
}
