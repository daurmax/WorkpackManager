---
depends_on: [A1_agent_rules]
repos: [WorkpackManager]
---
# Agent Context Generator Tool Agent Prompt

> Build `workpacks/tools/agent_context.py` — a Python tool that reads workpack metadata and state to produce a structured `agent-context.json` for agent consumption.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/00_request.md`
2. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/01_plan.md`
3. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/workpack.state.json`
5. `workpacks/WORKPACK_META_SCHEMA.json` — prompts DAG structure
6. `workpacks/WORKPACK_STATE_SCHEMA.json` — state and prompt status fields

## Context

Workpack: `workpack-protocol/03_workpack-protocol_agent-documentation`

## Delivery Mode

- PR-based

## Objective

Create `workpacks/tools/agent_context.py` — a CLI tool that reads a workpack's `workpack.meta.json` and `workpack.state.json` files and outputs structured JSON summarizing the current workpack context. This JSON can be fed directly to an AI agent as pre-execution context. The tool must:

1. Parse the DAG from `workpack.meta.json` to compute which prompts are available (all dependencies complete), which are blocked, and which are done.
2. Identify blockers and next actions.
3. Output a well-defined JSON structure to stdout (or to a file via `--output`).

## Reference Points

- `workpacks/WORKPACK_META_SCHEMA.json` — `prompts` array with `depends_on`
- `workpacks/WORKPACK_STATE_SCHEMA.json` — `prompts` array with `status`, `overall_status`
- `workpacks/tools/workpack_lint.py` — CLI patterns and file discovery
- `workpacks/AGENT_RULES.md` (from A1) — rules that reference context requirements

## Implementation Requirements

1. Create `workpacks/tools/agent_context.py`:
   - `argparse` CLI: `--workpack <path>` (path to workpack directory), `--output <file>` (optional, default: stdout).
   - Load `workpack.meta.json` and `workpack.state.json` from the given directory.
   - Build prompt DAG from meta's `prompts[].depends_on` fields.
   - Cross-reference against state's `prompts[].status` to classify each prompt as:
     - `completed` — status is `complete`
     - `available` — all `depends_on` prompts are `complete`, but this prompt is `pending`
     - `blocked` — at least one `depends_on` prompt is not `complete`
     - `in_progress` — status is `in_progress`
     - `failed` — status is `failed`
     - `skipped` — status is `skipped`
   - Compute `blockers` list: for each blocked prompt, list which dependencies are incomplete.
   - Compute `next_actions`: list of available prompts sorted by DAG topological order.
2. Output JSON schema:
   ```json
   {
     "workpack_id": "string",
     "overall_status": "string",
     "available_prompts": ["string"],
     "blocked_prompts": [{"prompt": "string", "waiting_on": ["string"]}],
     "completed_prompts": ["string"],
     "in_progress_prompts": ["string"],
     "blockers": ["string"],
     "next_actions": ["string"]
   }
   ```
3. Create `workpacks/tools/tests/test_agent_context.py` with:
   - Test with a fixture workpack (known DAG and state) to verify classification.
   - Test that available_prompts respects DAG order.
   - Test with all-complete state returns empty blockers and available.
   - Test with circular dependency detection (if applicable).
4. Exit code: 0 on success, 1 on invalid input (missing files, malformed JSON).

## Scope

### In Scope
- `agent_context.py` tool (AC7, AC8, AC9)
- Unit tests (AC10)
- DAG-aware prompt classification
- JSON output to stdout or file

### Out of Scope
- Agent rules document (A1_agent_rules)
- State machine diagrams (A2_agent_state_machine)
- VS Code extension integration
- Modifying workpack state (read-only tool)

## Acceptance Criteria

- [ ] AC7: Agent context generator tool exists as `workpacks/tools/agent_context.py`.
- [ ] AC8: Generator produces valid JSON with fields: `workpack_id`, `overall_status`, `available_prompts`, `blocked_prompts`, `completed_prompts`, `blockers`, `next_actions`.
- [ ] AC9: Generator respects DAG dependencies when computing `available_prompts`.
- [ ] AC10: Unit tests cover the agent context generator.

## Verification

```bash
# Tool runs on a real workpack instance
python workpacks/tools/agent_context.py --workpack workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation

# Unit tests pass
python -m pytest workpacks/tools/tests/test_agent_context.py -v

# JSON output is valid
python workpacks/tools/agent_context.py --workpack workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation | python -m json.tool
```

## Handoff Output (JSON)

Write `outputs/A3_agent_context_tool.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "03_workpack-protocol_agent-documentation",
  "prompt": "A3_agent_context_tool",
  "component": "agent-tooling",
  "delivery_mode": "pr",
  "branch": {
    "base": "main",
    "work": "feature/agent-documentation",
    "merge_target": "main"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": ["<COMMIT_SHA>"],
    "branch_verified": false
  },
  "changes": {
    "files_modified": [],
    "files_created": ["workpacks/tools/agent_context.py", "workpacks/tools/tests/test_agent_context.py"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "python -m pytest workpacks/tools/tests/test_agent_context.py -v", "result": "pass", "notes": "" },
      { "cmd": "python workpacks/tools/agent_context.py --workpack workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation | python -m json.tool", "result": "pass", "notes": "Valid JSON" }
    ],
    "regression_added": true,
    "regression_notes": "Unit tests for agent context generator"
  },
  "handoff": {
    "summary": "Agent context generator tool implemented with DAG-aware prompt classification and unit tests.",
    "next_steps": ["Proceed to V1_integration_meta"],
    "known_issues": []
  },
  "repos": ["WorkpackManager"],
  "execution": {
    "model": "<MODEL_ID>",
    "tokens_in": 0,
    "tokens_out": 0,
    "duration_ms": 0
  },
  "change_details": [],
  "notes": ""
}
```

## Deliverables

- [ ] `workpacks/tools/agent_context.py` created
- [ ] `workpacks/tools/tests/test_agent_context.py` created
- [ ] Tool produces valid JSON with all required fields
- [ ] DAG dependency resolution verified by tests
- [ ] `outputs/A3_agent_context_tool.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
