---
prompt_id: A4_assignment_orchestrator
workpack: workpack-manager_agent-integration_03
agent_role: Assignment model and execution orchestrator
depends_on:
  - A1_provider_interface
repos:
  - WorkpackManager
estimated_effort: L
---

# A4 – Assignment Model and DAG-Aware Execution Orchestrator

## Objective

Implement the assignment model that maps prompts to agent providers, persists assignments in `workpack.state.json`, and an execution orchestrator that dispatches prompts in dependency order using topological traversal of the prompt DAG.

## Deliverables

### 1. Assignment Model (`src/agents/assignment.ts`)

Responsibilities:
- Read `workpack.state.json` to load current assignments.
- Write assignment changes back to `workpack.state.json`.
- Validate that assigned provider exists in the registry.
- Provide API for assignment CRUD.

```typescript
export class AssignmentModel {
  constructor(
    private stateFilePath: string,
    private registry: ProviderRegistry
  ) {}

  /** Assign a provider to a prompt. Validates provider exists. */
  async assign(promptStem: string, providerId: ProviderId): Promise<void>;

  /** Remove assignment for a prompt. */
  async unassign(promptStem: string): Promise<void>;

  /** Get current assignment for a prompt. */
  getAssignment(promptStem: string): ProviderId | undefined;

  /** Get all assignments. */
  getAllAssignments(): Record<string, ProviderId>;

  /** Auto-assign unassigned prompts based on capability matching. */
  async autoAssign(prompts: PromptMeta[]): Promise<Record<string, ProviderId>>;

  /** Persist current assignments to workpack.state.json. */
  async save(): Promise<void>;

  /** Load assignments from workpack.state.json. */
  async load(): Promise<void>;
}
```

### 2. Execution Orchestrator (`src/agents/orchestrator.ts`)

Responsibilities:
- Build a dependency graph from `workpack.meta.json` prompt DAG.
- Determine which prompts are "ready" (all dependencies satisfied).
- Dispatch ready prompts to their assigned providers.
- Update `workpack.state.json` prompt status after completion.
- Prevent dispatching prompts with unsatisfied dependencies.
- Support parallel dispatch of independent prompts.

```typescript
export interface OrchestratorOptions {
  /** Maximum parallel dispatches (default: 1 for safety). */
  maxParallel: number;
  /** Continue dispatching if a prompt fails? */
  continueOnError: boolean;
  /** Timeout per prompt dispatch in ms (default: 300000 = 5min). */
  timeoutMs: number;
}

export class ExecutionOrchestrator {
  constructor(
    private registry: ProviderRegistry,
    private assignment: AssignmentModel,
    private options: OrchestratorOptions
  ) {}

  /**
   * Execute all prompts in a workpack respecting the dependency DAG.
   * @param meta - Parsed workpack.meta.json.
   * @param stateFilePath - Path to workpack.state.json for status updates.
   * @returns Summary of execution results.
   */
  async execute(meta: WorkpackMeta, stateFilePath: string): Promise<ExecutionSummary>;

  /**
   * Get prompts that are ready to execute (all deps complete).
   */
  getReadyPrompts(meta: WorkpackMeta, state: WorkpackState): PromptMeta[];

  /**
   * Validate the prompt DAG for cycles.
   * @throws if a cycle is detected.
   */
  validateDAG(meta: WorkpackMeta): void;
}

export interface ExecutionSummary {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  results: Record<string, PromptResult>;
}
```

### 3. DAG Utilities (`src/agents/dag.ts`)

- Topological sort of prompts.
- Cycle detection (Kahn's algorithm or DFS-based).
- "Ready set" computation: prompts whose dependencies are all in "complete" status.

### 4. Unit Tests

#### `src/agents/__tests__/assignment.test.ts`
- Assign a provider to a prompt.
- Reject assignment with unknown provider ID.
- Auto-assign based on capabilities.
- Persist and reload from JSON file.
- Unassign and verify.

#### `src/agents/__tests__/orchestrator.test.ts`
- Execute a linear chain: A → B → C.
- Execute parallel-ready prompts: A → [B, C] → D.
- Detect and reject cyclic DAG.
- Stop on error when `continueOnError: false`.
- Continue on error when `continueOnError: true`.
- Respect timeout per prompt.
- Skip prompts with unsatisfied dependencies.

#### `src/agents/__tests__/dag.test.ts`
- Topological sort of a simple DAG.
- Detect cycle in a graph.
- Empty graph returns empty sort.
- Single-node graph.

## Constraints

- Orchestrator must NEVER bypass the dependency graph.
- State file writes must be atomic (write to temp file then rename).
- No prompt content rendering in this module (orchestrator loads raw prompt text from files).
- Execution must be cancellable (support `AbortSignal` or similar).

## Output

Write `outputs/A4_assignment_orchestrator.json`:

```json
{
  "workpack_id": "workpack-manager_agent-integration_03",
  "prompt_id": "A4_assignment_orchestrator",
  "status": "complete",
  "summary": "Assignment model with state persistence and DAG-aware execution orchestrator implemented with comprehensive tests.",
  "files_changed": [
    "src/agents/assignment.ts",
    "src/agents/orchestrator.ts",
    "src/agents/dag.ts",
    "src/agents/__tests__/assignment.test.ts",
    "src/agents/__tests__/orchestrator.test.ts",
    "src/agents/__tests__/dag.test.ts"
  ]
}
```

## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] All unit tests pass.
- [ ] DAG cycle detection works correctly.
- [ ] State file persistence is atomic.
- [ ] No dependency bypass is possible.
