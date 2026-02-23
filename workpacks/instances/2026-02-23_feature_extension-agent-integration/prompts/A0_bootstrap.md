---
prompt_id: A0_bootstrap
workpack: 2026-02-23_feature_extension-agent-integration
agent_role: Bootstrap
depends_on: []
repos:
  - WorkpackManager
estimated_effort: XS
---

# A0 – Bootstrap: Agent Integration Layer

## Objective

Prepare the development environment for the agent integration workpack. Verify that WP01 (extension-core-architecture) deliverables are available and set up the feature branch.

## Pre-Conditions

1. WP01 (`2026-02-23_feature_extension-core-architecture`) is merged or its core data models are available.
2. Repository `WorkpackManager` is cloned and build tools are installed.

## Tasks

### Task 1: Create Feature Branch

```bash
cd <repo-root>
git checkout main && git pull
git checkout -b feature/extension-agent-integration
```

### Task 2: Verify WP01 Deliverables

Confirm the following exist and compile:

- `src/models/` — TypeScript interfaces for workpack, prompt, state.
- `src/parser/` — Parser/indexer module.
- `src/state/` — State reconciliation module.

### Task 3: Scaffold Agent Module

Create the module directory structure:

```
src/
  agents/
    index.ts                     # Public barrel export
    types.ts                     # AgentProvider interface, capability types
    registry.ts                  # Provider registry (registration, discovery)
    providers/
      copilot-provider.ts        # GitHub Copilot provider
      codex-provider.ts          # OpenAI Codex provider
    orchestrator.ts              # DAG-aware assignment and dispatch
    assignment.ts                # Assignment model (reads/writes state.json)
```

### Task 4: Stub Exports

Create minimal stub implementations that compile:

```typescript
// src/agents/types.ts
export interface AgentProvider { /* stub */ }
export interface AgentCapability { /* stub */ }

// src/agents/registry.ts
export class ProviderRegistry { /* stub */ }

// src/agents/index.ts
export * from './types';
export * from './registry';
```

Verify: `npx tsc --noEmit` passes.

## Output

Write `outputs/A0_bootstrap.json` per WORKPACK_OUTPUT_SCHEMA.json.

```json
{
  "workpack_id": "2026-02-23_feature_extension-agent-integration",
  "prompt_id": "A0_bootstrap",
  "status": "complete",
  "summary": "Feature branch created, WP01 deliverables verified, agent module scaffolded.",
  "files_changed": [],
  "commands_run": ["git checkout -b feature/extension-agent-integration", "npx tsc --noEmit"]
}
```

## Gate

- [ ] Feature branch exists.
- [ ] WP01 data models compile.
- [ ] `src/agents/` directory structure exists with stubs.
- [ ] `npx tsc --noEmit` — 0 errors.
