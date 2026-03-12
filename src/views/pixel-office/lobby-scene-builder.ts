import type { WorkpackInstance } from "../../models";
import type {
  LobbyGroup,
  LobbyRoomDoor,
  LobbySceneState,
  LobbySettingsState,
} from "../../models/pixel-office";

export interface BuildLobbySceneOptions {
  generatedAt?: string;
  settings: LobbySettingsState;
}

function countCompleted(workpack: WorkpackInstance): number {
  if (!workpack.state?.promptStatus) {
    return 0;
  }
  return Object.values(workpack.state.promptStatus).filter(
    (entry) => entry.status === "complete" || entry.status === "skipped"
  ).length;
}

function buildDoor(workpack: WorkpackInstance): LobbyRoomDoor {
  return {
    workpackId: workpack.meta.id,
    title: workpack.meta.title,
    category: workpack.meta.category,
    overallStatus: workpack.state?.overallStatus ?? "unknown",
    promptCount: workpack.meta.prompts.length,
    completedCount: countCompleted(workpack),
    folderPath: workpack.folderPath,
    group: workpack.meta.group,
  };
}

export function buildLobbySceneState(
  workpacks: readonly WorkpackInstance[],
  options: BuildLobbySceneOptions,
): LobbySceneState {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const doors = workpacks.map(buildDoor);

  const groupMap = new Map<string, LobbyRoomDoor[]>();
  const ungrouped: LobbyRoomDoor[] = [];

  for (const door of doors) {
    if (door.group) {
      const list = groupMap.get(door.group) ?? [];
      list.push(door);
      groupMap.set(door.group, list);
    } else {
      ungrouped.push(door);
    }
  }

  const groups: LobbyGroup[] = Array.from(groupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, groupDoors]) => ({
      id,
      label: humanizeGroupId(id),
      doors: groupDoors.sort((a, b) => a.workpackId.localeCompare(b.workpackId)),
    }));

  ungrouped.sort((a, b) => a.workpackId.localeCompare(b.workpackId));

  return {
    version: 1,
    generatedAt,
    groups,
    ungrouped,
    settings: options.settings,
    totalWorkpacks: doors.length,
  };
}

function humanizeGroupId(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter((s) => s.length > 0)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
