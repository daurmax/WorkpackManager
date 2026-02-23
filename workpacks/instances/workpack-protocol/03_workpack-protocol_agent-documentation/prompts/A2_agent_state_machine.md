---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Agent State Machine Document Agent Prompt

> Write `workpacks/AGENT_STATE_MACHINE.md` — formal Mermaid state diagrams for workpack and prompt lifecycles, plus a decision tree for agent prompt execution.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/00_request.md`
2. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/01_plan.md`
3. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/workpack.state.json`
5. `workpacks/PROTOCOL_SPEC.md` — state transition rules
6. `workpacks/WORKPACK_STATE_SCHEMA.json` — valid state enums

## Context

Workpack: `workpack-protocol/03_workpack-protocol_agent-documentation`

## Delivery Mode

- PR-based

## Objective

Create `workpacks/AGENT_STATE_MACHINE.md` containing three visual artefacts that give an AI agent an unambiguous understanding of protocol state transitions:

1. **Workpack-level state diagram** — Mermaid `stateDiagram-v2` showing transitions between `not_started`, `in_progress`, `blocked`, `complete`, and `abandoned`.
2. **Prompt-level state diagram** — Mermaid `stateDiagram-v2` showing transitions for individual prompt execution: `pending` → `in_progress` → `complete` / `failed` / `skipped`.
3. **Agent decision tree** — a numbered flowchart or decision list: "I'm an agent, I just received a prompt — what do I do?". This tree guides the agent step-by-step from prompt receipt through verification and handoff.

## Reference Points

- `workpacks/PROTOCOL_SPEC.md` — defines all valid state transitions
- `workpacks/WORKPACK_STATE_SCHEMA.json` — `overall_status` and `prompts[].status` enums
- `workpacks/WORKPACK_META_SCHEMA.json` — DAG and dependency definitions
- `AGENT_RULES.md` (produced by A1) — rules that the decision tree must be consistent with

## Implementation Requirements

1. Create `workpacks/AGENT_STATE_MACHINE.md`.
2. **Workpack-level diagram** (§1):
   - All states: `not_started`, `in_progress`, `blocked`, `complete`, `abandoned`.
   - Transition triggers: first prompt started, all prompts complete, blocker detected, blocker resolved, manual abandon.
   - Use Mermaid `stateDiagram-v2` syntax.
3. **Prompt-level diagram** (§2):
   - All states: `pending`, `in_progress`, `complete`, `failed`, `skipped`.
   - Transition triggers: agent picks up prompt, verification passes, verification fails, prompt explicitly skipped.
   - Show that `failed` can transition back to `in_progress` (retry).
4. **Agent decision tree** (§3):
   - Numbered steps: (1) Read prompt YAML front-matter, (2) Check `depends_on` are all `complete`, (3) Read READ FIRST files, (4) Set prompt status to `in_progress`, (5) Execute Implementation Requirements, (6) Run Verification commands, (7) Write handoff JSON, (8) Commit changes, (9) Update `workpack.state.json`, (10) Update `99_status.md`.
   - Include branch points: "If dependency not complete → STOP, mark blocked", "If verification fails → mark failed, attempt fix or escalate".
5. All diagrams must be valid Mermaid syntax (renderable by GitHub markdown preview).
6. No narrative prose — only diagrams, labels, and numbered decision steps.

## Scope

### In Scope
- Workpack-level state diagram (AC4)
- Prompt-level state diagram (AC5)
- Agent decision tree (AC6)
- Valid Mermaid syntax

### Out of Scope
- Invariant rule content (A1_agent_rules)
- Agent context tool (A3_agent_context_tool)
- Human-readable explanations (human-documentation workpack)

## Acceptance Criteria

- [ ] AC4: `AGENT_STATE_MACHINE.md` exists with workpack-level state diagram.
- [ ] AC5: `AGENT_STATE_MACHINE.md` includes prompt-level state diagram.
- [ ] AC6: `AGENT_STATE_MACHINE.md` includes decision tree for "what to do when receiving a prompt".
- [ ] AC11: An agent following only `AGENT_RULES.md` + `AGENT_STATE_MACHINE.md` can correctly execute a prompt without reading PROTOCOL_SPEC.md.

## Verification

```bash
# File exists
test -f workpacks/AGENT_STATE_MACHINE.md && echo "OK"

# Contains Mermaid diagrams
grep -c "stateDiagram-v2" workpacks/AGENT_STATE_MACHINE.md

# Contains decision tree section
grep -c "Decision Tree\|decision tree" workpacks/AGENT_STATE_MACHINE.md
```

## Handoff Output (JSON)

Write `outputs/A2_agent_state_machine.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "03_workpack-protocol_agent-documentation",
  "prompt": "A2_agent_state_machine",
  "component": "agent-docs",
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
    "files_created": ["workpacks/AGENT_STATE_MACHINE.md"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "grep -c stateDiagram-v2 workpacks/AGENT_STATE_MACHINE.md", "result": "pass", "notes": "Two diagrams found" }
    ],
    "regression_added": false,
    "regression_notes": "Documentation file, no code tests"
  },
  "handoff": {
    "summary": "AGENT_STATE_MACHINE.md created with two state diagrams and a decision tree.",
    "next_steps": ["Proceed to V1_integration_meta (after A3_agent_context_tool completes)"],
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

- [ ] `workpacks/AGENT_STATE_MACHINE.md` created
- [ ] Workpack-level state diagram (Mermaid)
- [ ] Prompt-level state diagram (Mermaid)
- [ ] Agent decision tree (numbered steps)
- [ ] `outputs/A2_agent_state_machine.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
