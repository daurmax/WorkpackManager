# Request

## Workpack Protocol Version

Workpack Protocol Version: 2.2.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `agent-documentation`

Create documentation optimized for AI agent consumption. Today all protocol documentation is written in a hybrid style that is neither concise enough for agents nor accessible enough for human newcomers. This workpack creates a dedicated documentation layer for agents:

1. **AGENT_RULES.md** — a compact, numbered rule set covering every invariant an agent must obey when executing a workpack prompt. Written in imperative style, no narrative.
2. **AGENT_STATE_MACHINE.md** — formal state diagrams for both workpack-level and prompt-level lifecycles, plus a decision tree ("I'm an agent, I just received a prompt — what do I do?").
3. **Agent context generator** — a Python tool that reads `workpack.meta.json` and `workpack.state.json` to produce a `.workpack/agent-context.json` file containing the current workpack state, available next prompts, blockers, and verification requirements. This file can be fed directly to an agent as structured context.

Constraints and notes:

- Depends on verification-hardening and project-config for referencing the complete invariant set and configuration.
- Agent documentation must be self-contained: an agent should be able to operate correctly by reading only `AGENT_RULES.md` + `AGENT_STATE_MACHINE.md` + the target prompt file.
- Primary repo: `WorkpackManager`.

Preferred Delivery Mode: `PR`
Target Base Branch: `main`

## Acceptance Criteria

- [ ] AC1: `AGENT_RULES.md` exists in `workpacks/` with numbered rules covering all protocol invariants.
- [ ] AC2: Rules cover: pre-prompt checklist, execution flow, output requirements, commit tracking, state updates, post-prompt checklist.
- [ ] AC3: `AGENT_RULES.md` is under 200 lines (conciseness constraint).
- [ ] AC4: `AGENT_STATE_MACHINE.md` exists with workpack-level state diagram.
- [ ] AC5: `AGENT_STATE_MACHINE.md` includes prompt-level state diagram.
- [ ] AC6: `AGENT_STATE_MACHINE.md` includes decision tree for "what to do when receiving a prompt".
- [ ] AC7: Agent context generator tool exists as `workpacks/tools/agent_context.py`.
- [ ] AC8: Generator produces valid JSON with fields: `workpack_id`, `overall_status`, `available_prompts`, `blocked_prompts`, `completed_prompts`, `blockers`, `next_actions`.
- [ ] AC9: Generator respects DAG dependencies when computing `available_prompts`.
- [ ] AC10: Unit tests cover the agent context generator.
- [ ] AC11: An agent following only `AGENT_RULES.md` + `AGENT_STATE_MACHINE.md` can correctly execute a prompt without reading PROTOCOL_SPEC.md.

## Constraints

- Agent docs must not duplicate the full protocol spec (reference, don't repeat).
- Agent docs are normative for agent behavior (agents should follow them, not PROTOCOL_SPEC.md).
- No framework-specific references.

## Acceptance Criteria → Verification Mapping

| AC ID | Criterion | How to Verify |
|-------|-----------|---------------|
| AC1-AC3 | AGENT_RULES.md | Line count + content review |
| AC4-AC6 | AGENT_STATE_MACHINE.md | Content review + diagram validation |
| AC7 | Tool exists | File exists and is executable |
| AC8 | Valid JSON output | Unit test with fixture workpack |
| AC9 | DAG-aware available prompts | Unit test with known DAG |
| AC10 | Unit tests | `python -m pytest workpacks/tools/tests/ -v` |
| AC11 | Self-contained agent docs | Manual test: agent prompt with only agent docs |

## Delivery Mode

- [x] PR-based (default)
- [ ] Direct push

## Scope

### In Scope

- `AGENT_RULES.md` — numbered invariant rules for agents
- `AGENT_STATE_MACHINE.md` — state diagrams and decision tree
- `agent_context.py` — Python tool to generate agent-context.json
- Unit tests for the generator

### Out of Scope

- VS Code extension integration (extension workpack scope)
- Agent-specific prompt formatting (future enhancement)
- Localization of agent docs
