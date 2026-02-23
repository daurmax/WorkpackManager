---
prompt_id: A0_bootstrap
workpack: <WORKPACK_ID>
agent_role: Bootstrap
depends_on: []
repos:
  - <REPO_NAME>
estimated_effort: XS
---

# A0 – Bootstrap: <Workpack Title>

## Objective

Prepare the development environment for this workpack: create the feature branch, verify pre-conditions, and scaffold the module directory structure.

## Pre-Conditions

1. All `requires_workpack` dependencies listed in `workpack.meta.json` are merged.
2. Repository builds successfully (`npx tsc --noEmit` or equivalent).

## Tasks

### Task 1: Create Feature Branch

```bash
cd <repo-root>
git checkout main && git pull
git checkout -b feature/<short-slug>
```

### Task 2: Verify Prerequisites

Confirm that required upstream deliverables exist and compile.

_List specific modules, files, or interfaces that must be available._

### Task 3: Scaffold Module

Create the module directory structure:

```
src/
  <module>/
    index.ts
    ...
```

_Add stub files that compile._

### Task 4: Verify Build

```bash
npx tsc --noEmit
```

## Output

Write `outputs/A0_bootstrap.json` per WORKPACK_OUTPUT_SCHEMA.json:

```json
{
  "workpack_id": "<WORKPACK_ID>",
  "prompt_id": "A0_bootstrap",
  "status": "complete",
  "summary": "Feature branch created, prerequisites verified, module scaffolded.",
  "files_changed": [],
  "commands_run": []
}
```

## Gate

- [ ] Feature branch exists.
- [ ] Prerequisites are available and compile.
- [ ] Module directory structure created.
- [ ] `npx tsc --noEmit` — 0 errors.
