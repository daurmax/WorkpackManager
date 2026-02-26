---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Quickstart Guide Agent Prompt

> Write `docs/QUICKSTART.md` — a 5-minute step-by-step guide for creating and executing a first workpack, with copy-paste commands.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/00_request.md`
2. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/01_plan.md`
3. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/workpack.state.json`
5. `workpacks/_template/` — canonical workpack template (the structure the user will scaffold)
6. `workpacks/tools/workpack_scaffold.py` — scaffolding tool to reference

## Context

Workpack: `workpack-protocol/03_workpack-protocol_human-documentation`

## Delivery Mode

- PR-based

## Objective

Create `docs/QUICKSTART.md` — a concise, step-by-step guide that takes a developer from zero to a completed first workpack in under 5 minutes. The guide must:

1. List minimal prerequisites (Git, Python 3.x).
2. Walk through: scaffold a workpack, fill `00_request.md`, generate the plan, execute a prompt, run verification, mark complete.
3. Use copy-paste shell commands wherever possible.
4. Target audience: developer who has never seen the workpack protocol before.

## Reference Points

- `workpacks/_template/` — file structure to scaffold
- `workpacks/tools/workpack_scaffold.py` — CLI scaffolding tool
- `workpacks/tools/workpack_lint.py` — verification tool
- `docs/CONCEPTS.md` (from A1) — link for deeper understanding
- `docs/INTEGRATION.md` (from A3) — link for team adoption

## Implementation Requirements

1. Create `docs/QUICKSTART.md` with the following sections:
   - **Prerequisites**: Git, Python 3.10+, repo cloned. 3 lines max.
   - **Step 1: Scaffold a Workpack**: `python workpacks/tools/workpack_scaffold.py --group my-project --slug my-feature`. Show expected output.
   - **Step 2: Write the Request**: Fill `00_request.md` with a short example request. Show a minimal but complete example.
   - **Step 3: Create the Plan**: Fill `01_plan.md` with a WBS and DAG. Show a minimal example.
   - **Step 4: Execute a Prompt**: Open `prompts/A0_bootstrap.md`, follow instructions. Brief walkthrough.
   - **Step 5: Run Verification**: `python workpacks/tools/workpack_lint.py`. Explain expected clean output.
   - **Step 6: Complete the Workpack**: Update `workpack.state.json`, write `99_status.md`. Show final structure.
   - **Next Steps**: Links to `CONCEPTS.md`, `INTEGRATION.md`, `TROUBLESHOOTING.md`.
2. Every step must have a runable shell command or a clearly marked "edit this file" instruction.
3. The entire guide should be completable in ≤ 5 minutes by a developer who can type commands.
4. Cross-reference `CONCEPTS.md` for "why" explanations (AC9).
5. Place file at `docs/QUICKSTART.md`.

## Scope

### In Scope
- `docs/QUICKSTART.md` creation (AC3, AC4)
- Copy-paste commands
- Cross-references to sibling docs (AC9)
- Accessible to non-experts (AC12)

### Out of Scope
- Detailed concept explanations (A1_concepts_guide)
- Team adoption scenarios (A3_integration_guide)
- Troubleshooting (A4_troubleshooting_guide)

## Acceptance Criteria

- [ ] AC3: `docs/QUICKSTART.md` exists and covers prerequisites, scaffold, execute prompt, verify, complete flow.
- [ ] AC4: `docs/QUICKSTART.md` is completable in under 5 minutes by a developer familiar with Git.
- [ ] AC9: All docs cross-reference each other via relative links.
- [ ] AC11: No broken links across documentation.
- [ ] AC12: Language level: accessible to developers without prior workpack knowledge.

## Verification

```bash
# File exists
test -f docs/QUICKSTART.md && echo "OK"

# Contains step-by-step sections
grep -c "^## Step" docs/QUICKSTART.md

# Contains shell commands
grep -c '```bash\|```shell' docs/QUICKSTART.md

# Cross-references present
grep -c "CONCEPTS\|INTEGRATION\|TROUBLESHOOTING" docs/QUICKSTART.md
```

## Handoff Output (JSON)

Write `outputs/A2_quickstart_guide.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "03_workpack-protocol_human-documentation",
  "prompt": "A2_quickstart_guide",
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
    "files_created": ["docs/QUICKSTART.md"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "test -f docs/QUICKSTART.md && echo OK", "result": "pass", "notes": "" }
    ],
    "regression_added": false,
    "regression_notes": "Documentation file, no code tests"
  },
  "handoff": {
    "summary": "QUICKSTART.md created with 6-step guide and copy-paste commands.",
    "next_steps": ["Proceed to V1_integration_meta (after A3, A4 complete)"],
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

- [ ] `docs/QUICKSTART.md` created
- [ ] 6 step-by-step sections with shell commands
- [ ] Cross-references to sibling docs
- [ ] `outputs/A2_quickstart_guide.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
