# Workpacks

Workpacks provide a structured, git-tracked workflow for multi-step engineering tasks handled by humans and/or agents.

Protocol 2.0.0 separates static metadata from runtime state so tooling can index and orchestrate work without relying only on markdown parsing.

For the full normative contract, read `workpacks/PROTOCOL_SPEC.md`.

---

## Core Concepts

- **Instance**: One work request under `workpacks/instances/<workpack-id>/`.
- **Metadata (`workpack.meta.json`)**: Stable identity, ownership, dependencies, prompt DAG index.
- **State (`workpack.state.json`)**: Mutable runtime progress, assignments, blockers, audit log.
- **Markdown artifacts**: Human-readable request (`00_request.md`), plan (`01_plan.md`), and status (`99_status.md`).
- **Outputs (`outputs/*.json`)**: Per-prompt machine-readable handoffs.

---

## Directory Layout

```text
workpacks/
  CHANGELOG.md
  PROTOCOL_SPEC.md
  README.md
  WORKPACK_META_SCHEMA.json
  WORKPACK_STATE_SCHEMA.json
  WORKPACK_OUTPUT_SCHEMA.json
  WORKPACK_GROUP_SCHEMA.json
  _template/
  manual_prompts/
  instances/
```

Workpack instance (2.0.0+):

```text
workpacks/instances/<workpack-id>/
  00_request.md
  01_plan.md
  99_status.md
  workpack.meta.json
  workpack.state.json
  prompts/
  outputs/
```

Grouped execution (optional, 2.1.0+):

```text
workpacks/instances/<group-id>/
  group.meta.json
  GROUP.md
  <NN>_<group-id>_<slug>/...
```

---

## Lifecycle (Typical)

```text
A0 -> A1..A4 (parallel, DAG-ordered) -> A5/V1 -> [B-series] -> V2 loop -> merge -> R1
```

Prompt dependencies are declared in YAML front-matter and mirrored in `workpack.meta.json.prompts`.

---

## Authoring and Execution Rules

- Keep `workpack.meta.json` and `01_plan.md` aligned.
- Keep `workpack.state.json` and `99_status.md` aligned.
- Do not mark a prompt complete unless `outputs/<PROMPT>.json` exists.
- Update `last_updated` and append an `execution_log` event for each runtime transition.
- Never include secrets in workpack files.

---

## Backward Compatibility

Protocol 2.0.0 is additive over 1.4.0:

- Legacy 1.x workpacks can coexist with 2.x workpacks.
- If `workpack.meta.json` is absent, tooling may operate in compatibility mode.
- New workpacks should use 2.0.0 files by default.

---

## Quick Start

### Bash

```bash
cp -r workpacks/_template workpacks/instances/<workpack-id>
```

### PowerShell

```powershell
Copy-Item -Recurse workpacks/_template workpacks/instances/<workpack-id>
```

Then fill request/plan/prompts, update metadata/state, and commit.

## Manual Operations On Existing Workpacks

Use `workpacks/manual_prompts/` when you need an operational prompt for an existing workpack (for example migration, bug intake, task add/modify) without creating a new scaffold.

- `workpacks/_template/` -> scaffold for new workpacks.
- `workpacks/manual_prompts/` -> user-filled operational prompts for existing workpacks.

---

## See Also

- `workpacks/PROTOCOL_SPEC.md` (authoritative specification)
- `workpacks/CHANGELOG.md` (versioned protocol history)
- `workpacks/WORKPACK_META_SCHEMA.json`
- `workpacks/WORKPACK_STATE_SCHEMA.json`
- `workpacks/WORKPACK_OUTPUT_SCHEMA.json`
- `workpacks/WORKPACK_GROUP_SCHEMA.json`

