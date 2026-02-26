export type WorkpackStatus = "unknown" | "ok" | "running" | "failed";

export const STATUS_ICON: Record<WorkpackStatus, string> = {
  unknown: "question",
  ok: "check",
  running: "sync",
  failed: "error"
};
