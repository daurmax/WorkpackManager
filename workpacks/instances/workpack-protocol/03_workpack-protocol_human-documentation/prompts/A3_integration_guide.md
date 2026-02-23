---
depends_on: [A1_concepts_guide]
repos: [WorkpackManager]
---
# Integration Guide Agent Prompt

> Write `docs/INTEGRATION.md` — a comprehensive scenario-based guide for teams adopting the workpack protocol in existing repos, superseding `ADOPTION_GUIDE.md`.

---

## READ FIRST

1. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/00_request.md`
2. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/01_plan.md`
3. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/workpack.meta.json`
4. `workpacks/instances/workpack-protocol/03_workpack-protocol_human-documentation/workpack.state.json`
5. `workpacks/ADOPTION_GUIDE.md` — current adoption doc (to be superseded)
6. `workpacks/PROTOCOL_SPEC.md` — normative reference for configuration details

## Context

Workpack: `workpack-protocol/03_workpack-protocol_human-documentation`

## Delivery Mode

- PR-based

## Objective

Create `docs/INTEGRATION.md` — a rich, scenario-based integration guide that replaces the current `ADOPTION_GUIDE.md`. This document must:

1. Cover multiple adoption scenarios: single-repo, multi-repo, CI-integrated, team workflow.
2. Reference `workpack.config.json` configuration format.
3. Provide concrete directory structures, configuration snippets, and workflow examples.
4. Mark `ADOPTION_GUIDE.md` as deprecated with a pointer to this new guide.

## Reference Points

- `workpacks/ADOPTION_GUIDE.md` — content to evolve and supersede
- `workpacks/PROTOCOL_SPEC.md` — configuration and workflow rules
- `docs/CONCEPTS.md` (from A1) — link for concept background
- `docs/QUICKSTART.md` (from A2) — link for getting-started
- `workpacks/WORKPACK_GROUP_SCHEMA.json` — group configuration

## Implementation Requirements

1. Create `docs/INTEGRATION.md` with the following sections:
   - **Overview**: Purpose and audience (teams adopting the protocol).
   - **Scenario 1: Single-Repo Setup**: Adding `workpacks/` to an existing project. Directory structure, initial config, first workpack.
   - **Scenario 2: Multi-Repo Setup**: Coordinating workpacks across multiple repositories. Cross-repo references, shared schemas.
   - **Scenario 3: CI Integration**: Adding workpack verification to CI pipelines. Example GitHub Actions workflow, pre-commit hooks.
   - **Scenario 4: Team Workflow**: Roles (human requester, AI agent executor), review process, PR conventions, workpack assignment.
   - **Configuration Reference**: `workpack.config.json` structure and fields. Reference the JSON schema from the project-config workpack.
   - **Migration from ADOPTION_GUIDE.md**: Mapping of old sections to new content.
2. Add a deprecation header to `workpacks/ADOPTION_GUIDE.md`:
   ```markdown
   > **⚠️ DEPRECATED**: This document has been superseded by [docs/INTEGRATION.md](../docs/INTEGRATION.md). Please refer to the new integration guide.
   ```
3. Cross-reference `CONCEPTS.md`, `QUICKSTART.md`, `TROUBLESHOOTING.md` (AC9).
4. Reference `workpack.config.json` explicitly (AC6).
5. Place file at `docs/INTEGRATION.md`.

## Scope

### In Scope
- `docs/INTEGRATION.md` creation (AC5, AC6)
- Four adoption scenarios
- Deprecation notice on `ADOPTION_GUIDE.md` (AC10)
- Cross-references (AC9)

### Out of Scope
- Concept explanations (A1_concepts_guide)
- Getting-started steps (A2_quickstart_guide)
- Troubleshooting (A4_troubleshooting_guide)
- Agent documentation (agent-documentation workpack)

## Acceptance Criteria

- [ ] AC5: `docs/INTEGRATION.md` exists and covers: single-repo setup, multi-repo setup, CI integration, team workflow.
- [ ] AC6: `docs/INTEGRATION.md` references `workpack.config.json` configuration.
- [ ] AC9: All docs cross-reference each other via relative links.
- [ ] AC10: `ADOPTION_GUIDE.md` has a deprecation header pointing to `docs/INTEGRATION.md`.
- [ ] AC11: No broken links across documentation.
- [ ] AC12: Language level: accessible to developers without prior workpack knowledge.

## Verification

```bash
# File exists
test -f docs/INTEGRATION.md && echo "OK"

# Covers four scenarios
grep -c "^## Scenario\|^### Scenario" docs/INTEGRATION.md

# References workpack.config.json
grep -c "workpack.config.json" docs/INTEGRATION.md

# Deprecation notice in ADOPTION_GUIDE.md
grep -c "DEPRECATED\|deprecated" workpacks/ADOPTION_GUIDE.md

# Cross-references present
grep -c "CONCEPTS\|QUICKSTART\|TROUBLESHOOTING" docs/INTEGRATION.md
```

## Handoff Output (JSON)

Write `outputs/A3_integration_guide.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "03_workpack-protocol_human-documentation",
  "prompt": "A3_integration_guide",
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
    "files_modified": ["workpacks/ADOPTION_GUIDE.md"],
    "files_created": ["docs/INTEGRATION.md"],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "test -f docs/INTEGRATION.md && echo OK", "result": "pass", "notes": "" },
      { "cmd": "grep -c DEPRECATED workpacks/ADOPTION_GUIDE.md", "result": "pass", "notes": "Deprecation header present" }
    ],
    "regression_added": false,
    "regression_notes": "Documentation file, no code tests"
  },
  "handoff": {
    "summary": "INTEGRATION.md created with four adoption scenarios; ADOPTION_GUIDE.md marked deprecated.",
    "next_steps": ["Proceed to V1_integration_meta (after A2, A4 complete)"],
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

- [ ] `docs/INTEGRATION.md` created
- [ ] Four adoption scenarios documented
- [ ] `workpack.config.json` referenced (AC6)
- [ ] `ADOPTION_GUIDE.md` deprecation header added
- [ ] Cross-references to sibling docs
- [ ] `outputs/A3_integration_guide.json` written
- [ ] `workpack.state.json` updated
- [ ] `99_status.md` updated
