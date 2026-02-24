---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Concepts Guide Agent Prompt

> Write `docs/CONCEPTS.md` — the mental-model document explaining workpack architecture, DAG orchestration, prompt lifecycle, commit tracking, and integration gates with Mermaid diagrams.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/00_request.md`
2. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/01_plan.md`
3. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/workpack.state.json`
5. `workpacks/PROTOCOL_SPEC.md` — normative spec (source concepts)
6. `workpacks/WORKPACK_META_SCHEMA.json`, `workpacks/WORKPACK_STATE_SCHEMA.json` — schemas to explain

## Context

Workpack: `workpack-protocol/03_workpack-protocol_human-documentation`

## Delivery Mode

- PR-based

## Objective

Create `docs/CONCEPTS.md` — a descriptive (non-normative) guide that a developer new to the workpack protocol can read to understand the key concepts. This document:

1. Explains the metadata/state split, DAG-based prompt orchestration, prompt lifecycle, commit tracking, and integration gates.
2. Uses at least two Mermaid diagrams to visually communicate concepts.
3. Links out to normative sources (`PROTOCOL_SPEC.md`, schemas) for authoritative detail.
4. Is written at a level accessible to developers without prior workpack knowledge.
5. Cross-references other docs (`QUICKSTART.md`, `INTEGRATION.md`, `TROUBLESHOOTING.md`).

## Reference Points

- `workpacks/PROTOCOL_SPEC.md` — all concepts originate here
- `workpacks/WORKPACK_META_SCHEMA.json` — meta file structure
- `workpacks/WORKPACK_STATE_SCHEMA.json` — state file structure
- `workpacks/WORKPACK_OUTPUT_SCHEMA.json` — output artifact structure
- `workpacks/_template/` — canonical example of the file layout

## Implementation Requirements

1. Create `docs/CONCEPTS.md` with the following sections:
   - **What is a Workpack?** — brief definition and purpose.
   - **Metadata vs State** — explain the `workpack.meta.json` / `workpack.state.json` split and why it matters (immutable plan vs mutable execution state).
   - **Prompt Lifecycle** — the `A0 → A-series → V1 → R1` flow. Include a Mermaid flowchart.
   - **DAG-Based Orchestration** — explain `depends_on`, parallelization, and how agents determine what to work on next. Include a Mermaid DAG example.
   - **Commit Tracking** — how `change_details` in state links actual Git commits to prompts.
   - **Integration Gates (V1)** — what the V1 gate checks and why it exists.
   - **Workpack Groups** — brief explanation of `group.meta.json` and multi-workpack coordination.
   - **Key Files Reference** — table mapping file names to purposes.
2. Include at least **two Mermaid diagrams** (AC2): one for prompt lifecycle flow, one for DAG example.
3. Add cross-reference links to `QUICKSTART.md`, `INTEGRATION.md`, and `TROUBLESHOOTING.md` (AC9).
4. Tone: descriptive and educational. Use examples where helpful.
5. Place file at `docs/CONCEPTS.md` (create `docs/` directory if needed).

## Scope

### In Scope
- `docs/CONCEPTS.md` creation (AC1, AC2)
- Two or more Mermaid diagrams
- Cross-reference links to sibling docs (AC9)
- Accessible language (AC12)

### Out of Scope
- Step-by-step walkthrough (A2_quickstart_guide)
- Integration scenarios (A3_integration_guide)
- Troubleshooting catalog (A4_troubleshooting_guide)
- Agent-specific documentation (agent-documentation workpack)

## Acceptance Criteria

- [ ] AC1: `docs/CONCEPTS.md` exists and covers meta/state split, DAG, prompt lifecycle, commit tracking, integration gates.
- [ ] AC2: `docs/CONCEPTS.md` includes at least two Mermaid diagrams.
- [ ] AC9: All docs cross-reference each other via relative links.
- [ ] AC11: No broken links across documentation.
- [ ] AC12: Language level: accessible to developers without prior workpack knowledge.

## Verification

```bash
# File exists
test -f docs/CONCEPTS.md && echo "OK"

# Contains Mermaid diagrams (at least 2)
grep -c '```mermaid' docs/CONCEPTS.md

# Contains cross-references to sibling docs
grep -c "QUICKSTART\|INTEGRATION\|TROUBLESHOOTING" docs/CONCEPTS.md
```

## Handoff Output (JSON)

Write `outputs/A1_concepts_guide.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "03_workpack-protocol_human-documentation",
  "prompt": "A1_concepts_guide",
  "component": "human-docs",
  "delivery_mode": "pr",
  "branch": {
    "base": "main",
    "work": "feature/human-documentation",
    "merge_target": "main"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": ["<COMMIT_SHA>"],
    "branch_verified": false
  },
  "changes": {
    "files_modified": [],
    "files_created": ["docs/CONCEPTS.md"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "test -f docs/CONCEPTS.md && echo OK", "result": "pass", "notes": "" },
      { "cmd": "grep -c '```mermaid' docs/CONCEPTS.md", "result": "pass", "notes": "≥2 diagrams" }
    ],
    "regression_added": false,
    "regression_notes": "Documentation file, no code tests"
  },
  "handoff": {
    "summary": "CONCEPTS.md created with architecture overview, two Mermaid diagrams, and cross-references.",
    "next_steps": ["Proceed to A3_integration_guide and A4_troubleshooting_guide (parallel)"],
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

- [ ] `docs/CONCEPTS.md` created
- [ ] At least two Mermaid diagrams included
- [ ] Cross-references to sibling docs present
- [ ] `outputs/A1_concepts_guide.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
