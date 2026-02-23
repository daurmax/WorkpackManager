# Request

## Workpack Protocol Version

Workpack Protocol Version: 6

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `extension-agent-integration`

Design and implement the agent integration layer for the WorkpackManager VS Code extension. This includes a provider abstraction/adapter interface that decouples the extension from any specific AI agent, initial provider implementations for GitHub Copilot and OpenAI Codex, an assignment model that maps prompts to agents, and clear boundaries between assignment (which agent handles what) and execution orchestration (how work gets dispatched and tracked).

The architecture must be extensible: adding a new agent provider (e.g., Claude, Gemini, local models) should require only implementing the provider interface without modifying the core extension.

Constraints and notes:

- Depends on WP01 (extension-core-architecture) for data models and parser.
- Provider interface must be minimal and stable.
- Copilot integration: leverage VS Code chat API / language model API.
- Codex integration: use OpenAI API for Codex-class models.
- Agent assignments are tracked in `workpack.state.json`.
- Execution orchestration must respect the dependency DAG.
- Primary repo: `WorkpackManager`.

Preferred Delivery Mode: `PR`
Target Base Branch: `main`

## Acceptance Criteria

- [ ] AC1: `AgentProvider` interface exists with methods for capability reporting, prompt dispatch, and status polling.
- [ ] AC2: `CopilotProvider` implements `AgentProvider` using VS Code chat/language model API.
- [ ] AC3: `CodexProvider` implements `AgentProvider` using OpenAI API conventions.
- [ ] AC4: Provider registry supports dynamic provider registration and discovery.
- [ ] AC5: Assignment model persists prompt-to-agent mappings in `workpack.state.json`.
- [ ] AC6: Execution orchestrator respects prompt DAG (dispatches only ready prompts).
- [ ] AC7: Adding a new provider requires only implementing the interface (no core changes).
- [ ] AC8: Provider capabilities are queryable (what a provider can/cannot do).
- [ ] AC9: Unit tests cover provider registration, assignment, and orchestration logic.

## Constraints

- Provider interface must not leak VS Code API types to external providers.
- No hardcoded API keys or credentials. Use VS Code secrets API or settings.
- Execution orchestration must not bypass the dependency graph.
- No secrets in prompts or outputs.

## Acceptance Criteria → Verification Mapping

| AC ID | Criterion | How to Verify |
|-------|-----------|---------------|
| AC1 | Provider interface exists | `npx tsc --noEmit` + interface test |
| AC2 | Copilot provider compiles | `npx tsc --noEmit` |
| AC3 | Codex provider compiles | `npx tsc --noEmit` |
| AC4 | Registry works | Unit test for register/discover |
| AC5 | Assignments persist | Unit test for state file read/write |
| AC6 | DAG-aware dispatch | Unit test with mock DAG |
| AC7 | Extensibility | Adding a mock provider without core changes |
| AC8 | Capabilities queryable | Unit test for capability API |
| AC9 | Tests pass | `npm test` |

## Delivery Mode

- [x] PR-based (default)
- [ ] Direct push

## Scope

### In Scope

- Provider abstraction/interface
- Copilot provider (initial implementation)
- Codex provider (initial implementation)
- Provider registry
- Assignment model and persistence
- Execution orchestrator (DAG-aware dispatch)
- Unit tests

### Out of Scope

- UI for agent assignment (WP03)
- Full end-to-end agent execution (future work)
- Prompt rendering/formatting (may be a future enhancement)
