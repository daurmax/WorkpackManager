---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Agent Rules Document Agent Prompt

> Write `workpacks/AGENT_RULES.md` — a compact, numbered invariant rule set that an AI agent must follow when executing any workpack prompt.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/00_request.md`
2. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/01_plan.md`
3. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/03_workpack-protocol_agent-documentation/workpack.state.json`
5. `workpacks/PROTOCOL_SPEC.md` — normative spec to distill rules from
6. `workpacks/WORKPACK_META_SCHEMA.json`, `workpacks/WORKPACK_STATE_SCHEMA.json` — schema constraints

## Context

Workpack: `workpack-protocol/03_workpack-protocol_agent-documentation`

## Delivery Mode

- PR-based

## Objective

Create `workpacks/AGENT_RULES.md` — a self-contained reference document that an AI agent reads **before** executing any prompt. The document must:

1. Express every protocol invariant as a short, numbered, imperative rule.
2. Organize rules into categories: Pre-Prompt Checklist, Execution Flow, Output Requirements, Commit Tracking, State Updates, Post-Prompt Checklist.
3. Stay under 200 lines total (conciseness is a hard constraint).
4. Be written in imperative style ("DO X", "NEVER Y") — no narrative or explanatory prose.
5. Be self-contained: an agent reading only this file plus the target prompt must know all behavioural constraints.

## Reference Points

- `workpacks/PROTOCOL_SPEC.md` — source of truth for all invariants
- `workpacks/WORKPACK_META_SCHEMA.json` — required fields and valid values
- `workpacks/WORKPACK_STATE_SCHEMA.json` — state enum, execution log schema
- `workpacks/WORKPACK_OUTPUT_SCHEMA.json` — output artifact schema
- `workpacks/_template/` — canonical file structure

## Implementation Requirements

1. Create `workpacks/AGENT_RULES.md` with the following sections:
   - **Header**: Title, protocol version, purpose statement (2 lines max).
   - **§1 Pre-Prompt Checklist**: Rules for what to verify before starting work (branch, state file, dependencies resolved, etc.).
   - **§2 Execution Flow**: Rules for reading the prompt, following Implementation Requirements, staying in scope.
   - **§3 Output Requirements**: Rules for writing the handoff JSON, populating all required fields, writing to `outputs/`.
   - **§4 Commit Tracking**: Rules for recording commit SHAs in `change_details`, verifying SHA existence, linking files.
   - **§5 State Updates**: Rules for updating `workpack.state.json` (prompt status, execution log, overall_status transitions).
   - **§6 Post-Prompt Checklist**: Rules for verification commands, updating `99_status.md`, checking no regressions.
2. Each rule must be numbered within its section (e.g., `§1.1`, `§1.2`, …).
3. Include a quick-reference table at the top mapping rule categories to sections.
4. Total line count MUST be ≤ 200 lines.
5. Do NOT duplicate full protocol spec content — distill into actionable rules.

## Scope

### In Scope
- `workpacks/AGENT_RULES.md` creation (AC1, AC2, AC3)
- Six rule categories covering the full prompt execution lifecycle
- Conciseness constraint (< 200 lines)

### Out of Scope
- State diagrams (handled by A2_agent_state_machine)
- Agent context tool (handled by A3_agent_context_tool)
- Prompt formatting or style rules (PROMPT_STYLE_GUIDE.md)
- Human-readable documentation (human-documentation workpack)

## Acceptance Criteria

- [ ] AC1: `AGENT_RULES.md` exists in `workpacks/` with numbered rules covering all protocol invariants.
- [ ] AC2: Rules cover: pre-prompt checklist, execution flow, output requirements, commit tracking, state updates, post-prompt checklist.
- [ ] AC3: `AGENT_RULES.md` is under 200 lines (conciseness constraint).
- [ ] AC11: An agent following only `AGENT_RULES.md` + `AGENT_STATE_MACHINE.md` can correctly execute a prompt without reading PROTOCOL_SPEC.md.

## Verification

```bash
# Line count must be under 200
wc -l workpacks/AGENT_RULES.md

# Must contain all six sections
grep -c "^##" workpacks/AGENT_RULES.md

# Numbered rules present
grep -cE "^§[0-9]+\.[0-9]+" workpacks/AGENT_RULES.md
```

## Handoff Output (JSON)

Write `outputs/A1_agent_rules.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "03_workpack-protocol_agent-documentation",
  "prompt": "A1_agent_rules",
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
    "files_created": ["workpacks/AGENT_RULES.md"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "wc -l workpacks/AGENT_RULES.md", "result": "pass", "notes": "Under 200 lines" }
    ],
    "regression_added": false,
    "regression_notes": "Documentation file, no code tests"
  },
  "handoff": {
    "summary": "AGENT_RULES.md created with numbered invariant rules across six categories.",
    "next_steps": ["Proceed to A3_agent_context_tool"],
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

- [ ] `workpacks/AGENT_RULES.md` created (< 200 lines)
- [ ] All six rule categories present with numbered rules
- [ ] `outputs/A1_agent_rules.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
