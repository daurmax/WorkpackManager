import type { OverallStatus } from "../workpack-state";
import type { WorkpackCategory } from "../workpack-meta";

export interface LobbyRoomDoor {
  workpackId: string;
  title: string;
  category: WorkpackCategory;
  overallStatus: OverallStatus | "unknown";
  promptCount: number;
  completedCount: number;
  folderPath: string;
  group?: string;
}

export interface LobbyGroup {
  id: string;
  label: string;
  doors: LobbyRoomDoor[];
}

export interface LobbySettingsState {
  codexApiKey: string;
  codexBaseUrl: string;
  codexModel: string;
  copilotMaxPromptTokens: number;
}

export interface LobbySceneState {
  version: 1;
  generatedAt: string;
  groups: LobbyGroup[];
  ungrouped: LobbyRoomDoor[];
  settings: LobbySettingsState;
  totalWorkpacks: number;
}
