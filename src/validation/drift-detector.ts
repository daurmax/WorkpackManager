export type Drift = {
  resource: string;
  expected: unknown;
  actual: unknown;
  reason?: string;
};

export function detectDriftFromState(state: unknown, artifacts: unknown): Drift[] {
  // Placeholder: real implementation would compare `state` vs `artifacts`.
  return [];
}
