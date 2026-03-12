import type { PixelCoordinate, PixelDimensions, RoomStationKind } from "../../models/pixel-office";

export interface PositionedRoomElement {
  position: PixelCoordinate;
  dimensions: PixelDimensions;
}

export interface PixelRoomLayout {
  tileSize: number;
  dimensions: PixelDimensions;
  stations: Record<RoomStationKind, PositionedRoomElement>;
  desks: PositionedRoomElement[];
}

const TILE_SIZE = 8;
const ROOM_PADDING = 32;
const TOP_BAND_HEIGHT = 128;
const DESK_AREA_LEFT = 56;
const DESK_AREA_TOP = 176;
const DESK_WIDTH = 88;
const DESK_HEIGHT = 72;
const DESK_GAP_X = 32;
const DESK_GAP_Y = 28;
const STATION_WIDTH = 104;
const STATION_HEIGHT = 80;
const OUTPUT_BOARD_WIDTH = 128;
const OUTPUT_BOARD_HEIGHT = 112;
const OUTPUT_BOARD_GAP = 44;
const MIN_ROOM_WIDTH = 760;
const MIN_ROOM_HEIGHT = 560;
const BOTTOM_PADDING = 48;

function resolveDeskColumns(promptCount: number): number {
  if (promptCount <= 1) {
    return 1;
  }

  if (promptCount <= 4) {
    return promptCount;
  }

  if (promptCount <= 6) {
    return 3;
  }

  return 4;
}

function toFrame(x: number, y: number, width: number, height: number): PositionedRoomElement {
  return {
    position: {
      x,
      y,
      z: y + height,
    },
    dimensions: {
      width,
      height,
    },
  };
}

export function createPixelRoomLayout(promptCount: number): PixelRoomLayout {
  const safePromptCount = Math.max(0, promptCount);
  const columns = resolveDeskColumns(safePromptCount);
  const rows = safePromptCount > 0 ? Math.ceil(safePromptCount / columns) : 0;
  const widestDeskRow = safePromptCount > 0
    ? (Math.min(columns, safePromptCount) * DESK_WIDTH) + (Math.max(0, Math.min(columns, safePromptCount) - 1) * DESK_GAP_X)
    : DESK_WIDTH;
  const deskAreaHeight = safePromptCount > 0
    ? (rows * DESK_HEIGHT) + (Math.max(0, rows - 1) * DESK_GAP_Y)
    : DESK_HEIGHT;
  const roomWidth = Math.max(
    MIN_ROOM_WIDTH,
    DESK_AREA_LEFT + widestDeskRow + OUTPUT_BOARD_GAP + OUTPUT_BOARD_WIDTH + ROOM_PADDING,
    (ROOM_PADDING * 2) + (STATION_WIDTH * 3) + 96,
  );
  const roomHeight = Math.max(
    MIN_ROOM_HEIGHT,
    DESK_AREA_TOP + deskAreaHeight + BOTTOM_PADDING,
  );
  const deskAreaWidth = roomWidth - DESK_AREA_LEFT - ROOM_PADDING - OUTPUT_BOARD_GAP - OUTPUT_BOARD_WIDTH;
  const desks: PositionedRoomElement[] = [];

  for (let index = 0; index < safePromptCount; index += 1) {
    const rowIndex = Math.floor(index / columns);
    const indexInRow = index % columns;
    const remaining = safePromptCount - (rowIndex * columns);
    const desksInRow = Math.min(columns, remaining);
    const rowWidth = (desksInRow * DESK_WIDTH) + (Math.max(0, desksInRow - 1) * DESK_GAP_X);
    const rowX = DESK_AREA_LEFT + Math.max(0, Math.floor((deskAreaWidth - rowWidth) / 2));
    const x = rowX + (indexInRow * (DESK_WIDTH + DESK_GAP_X));
    const y = DESK_AREA_TOP + (rowIndex * (DESK_HEIGHT + DESK_GAP_Y));
    desks.push(toFrame(x, y, DESK_WIDTH, DESK_HEIGHT));
  }

  return {
    tileSize: TILE_SIZE,
    dimensions: {
      width: roomWidth,
      height: roomHeight,
    },
    stations: {
      request: toFrame(ROOM_PADDING, ROOM_PADDING, STATION_WIDTH, STATION_HEIGHT),
      plan: toFrame(Math.floor((roomWidth - STATION_WIDTH) / 2), ROOM_PADDING, STATION_WIDTH, STATION_HEIGHT),
      status: toFrame(roomWidth - ROOM_PADDING - STATION_WIDTH, ROOM_PADDING, STATION_WIDTH, STATION_HEIGHT),
      output_board: toFrame(
        roomWidth - ROOM_PADDING - OUTPUT_BOARD_WIDTH,
        Math.max(TOP_BAND_HEIGHT + 64, roomHeight - ROOM_PADDING - OUTPUT_BOARD_HEIGHT),
        OUTPUT_BOARD_WIDTH,
        OUTPUT_BOARD_HEIGHT,
      ),
    },
    desks,
  };
}
