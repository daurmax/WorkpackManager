# Workpack Quickstart (5 Minutes)

This guide takes you from zero to a completed first workpack in about five minutes.
For the "why" behind the protocol decisions, read [CONCEPTS.md](./CONCEPTS.md).

## Prerequisites

- Git installed.
- Python 3.10+ available (`python --version`).
- This repository cloned locally.

## Step 1: Scaffold a Workpack

Run:

```bash
# Requested shorthand command
python workpacks/tools/workpack_scaffold.py --group my-project --slug my-feature

# Compatible with the current CLI in this repository
mkdir -p workpacks/instances/my-project
cp -R workpacks/_template workpacks/instances/my-project/01_my-project_my-feature
python workpacks/tools/workpack_scaffold.py workpacks/instances/my-project/01_my-project_my-feature
```

Expected output (example):

```text
Workpack: my-project/01_my-project_my-feature
Prompt count: 4
CREATE prompt: A0_bootstrap.md
[create] workpack.meta.json
[create] workpack.state.json

Done: prompts(created=4, overwritten=0, skipped=0), meta=created, state=created

Running file completeness validation ...
  ✓ [2.0.0] 01_my-project_my-feature — all required files present
```

## Step 2: Write the Request

Edit this file:

`workpacks/instances/my-project/01_my-project_my-feature/00_request.md`

Minimal complete example:

```markdown
# Request

## Workpack Protocol Version
Workpack Protocol Version: 2.2.0

## Original Request
Request Type: `NEW_FEATURE`
Short Slug: `my-feature`
Add a new CLI command `hello-workpack` and test coverage.

## Acceptance Criteria
- [ ] Command exists and prints "hello workpack".
- [ ] Unit test passes in CI.

## Delivery Mode
- [x] PR-based
- [ ] Direct push
```

## Step 3: Create the Plan

Edit this file:

`workpacks/instances/my-project/01_my-project_my-feature/01_plan.md`

Minimal WBS + DAG example:

```markdown
## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Bootstrap | A0_bootstrap | - | XS |
| 2 | Implement command | A1_hello_command | 1 | S |
| 3 | Integration gate | V1_integration_meta | 2 | S |
| 4 | Retrospective | R1_retrospective | 3 | S |

## DAG Dependencies

| Prompt Stem | depends_on | repos |
|-------------|------------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_hello_command | [A0_bootstrap] | [WorkpackManager] |
| V1_integration_meta | [A1_hello_command] | [WorkpackManager] |
| R1_retrospective | [V1_integration_meta] | [WorkpackManager] |
```

## Step 4: Execute a Prompt

Open this file and follow its instructions:

`workpacks/instances/my-project/01_my-project_my-feature/prompts/A0_bootstrap.md`

Quick walkthrough:

1. Read the files listed under `READ FIRST`.
2. Execute the objective and verification commands in the prompt.
3. Write `outputs/A0_bootstrap.json`.
4. Update `workpack.state.json` and `99_status.md`.

## Step 5: Run Verification

Run the protocol linter:

```bash
python workpacks/tools/workpack_lint.py
```

Expected clean ending:

```text
Summary: validated=<N> (...), skipped=<M>
All workpacks pass validation
```

If you only want to lint the workpack you just created:

```bash
python workpacks/tools/workpack_lint.py workpacks/instances/my-project/01_my-project_my-feature
```

## Step 6: Complete the Workpack

After A/V/R prompts are done, mark completion.

Edit these files:

- `workpacks/instances/my-project/01_my-project_my-feature/workpack.state.json`
- `workpacks/instances/my-project/01_my-project_my-feature/99_status.md`

Set:

- `workpack.state.json.overall_status` to `complete`
- each finished prompt status to `complete`
- `99_status.md` checklist/output rows to done

Final structure should look like:

```text
workpacks/instances/my-project/01_my-project_my-feature/
  00_request.md
  01_plan.md
  99_status.md
  workpack.meta.json
  workpack.state.json
  prompts/
    A0_bootstrap.md
    A1_hello_command.md
    V1_integration_meta.md
    R1_retrospective.md
  outputs/
    A0_bootstrap.json
    A1_hello_command.json
    V1_integration_meta.json
    R1_retrospective.json
```

## Next Steps

- Read [CONCEPTS.md](./CONCEPTS.md) for architecture and lifecycle details.
- Read [INTEGRATION.md](./INTEGRATION.md) for team/repo adoption patterns.
- Read [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common failures and fixes.
