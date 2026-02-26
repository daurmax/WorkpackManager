# Prompt Style Guide - Workpack Protocol 2.2.0

This guide applies to scaffold templates under `workpacks/_template/prompts/`.
For user-filled operational prompts on existing workpacks, use `workpacks/manual_prompts/`.

## Core Rules

- Write prompts in imperative style and focus on outcomes.
- Specify what must be delivered and how completion is verified.
- Keep prompts project-agnostic: no framework-specific assumptions.
- Use semantic references (file/class/function names), not fragile line numbers.
- For protocol 2.2.0+, require per-prompt commit tracking in output artifacts.

## Naming Convention

Prompt filenames follow `<SERIES><NUMBER>_<slug>.md` when numbered, for example:

- `A0_bootstrap.md`
- `A1_feature_slice.md`
- `V1_integration_meta.md`
- `B1_fix_edge_case.md`
- `R1_retrospective.md`

For reusable templates (not concrete instances), non-numbered stems such as `B_template.md` and `V_bugfix_verify.md` are acceptable.

## Required YAML Front-Matter

Every prompt template must start with:

```yaml
---
depends_on: [A0_bootstrap]
repos: [<REPO_NAME>]
---
```

Rules:

- `depends_on` contains prompt stems only (no `.md`).
- B-series prompts should use `depends_on` to reference B-series stems when fix ordering is required (for example `depends_on: [B1_shared_fix]`).
- `repos` contains repository names touched by that prompt.
- `A0_bootstrap` uses `depends_on: []`.

## Required Prompt Sections

1. Title and one-line objective
2. `READ FIRST`
3. `Objective`
4. `Implementation Requirements`
5. `Verification`
6. `Handoff Output (JSON)`
7. `Deliverables`

## Output JSON Contract

Prompt outputs must conform to `workpacks/WORKPACK_OUTPUT_SCHEMA.json`.

Required top-level keys:

- `schema_version`
- `workpack`
- `prompt`
- `component`
- `delivery_mode`
- `branch`
- `artifacts`
- `changes`
- `verification`
- `handoff`
- `repos`
- `execution`
- `change_details`

For schema version 1.2+:

- `artifacts.commit_shas` is required and should include the prompt commit SHA(s).
- `artifacts.branch_verified` is set by integration verification after SHA checks.

## Commit Tracking (Protocol 2.2.0+)

- If a prompt modifies files, it must create commit(s) before writing output JSON.
- Use commit message format: `<type>(<workpack-slug>/<prompt-stem>): <summary>`.
- Record all created commit SHA(s) in `artifacts.commit_shas`.
- Keep `branch.work` aligned with the branch where those commits were made.

## Integration Prompt Responsibilities (A5 / V-series)

Integration templates must include explicit verification steps for both commit tracking and B-series consistency.

- For each prior prompt output, extract `artifacts.commit_shas`.
- Verify each SHA exists on the work branch (`git log --oneline <branch> | grep <sha>`).
- Inspect each commit (`git show --stat <sha>`) and cross-check changed files against `change_details[].file`.
- Report both discrepancy types: undeclared files in commit and declared files missing from commit.
- Set `artifacts.branch_verified` to `true` only when all commit checks pass.
- If B-series prompts exist, verify DAG acyclicity, dependency-respecting execution order, and output JSON presence for all DAG-referenced prompts.

## Maintenance Prompt Templates

Scaffold templates for maintenance operations were intentionally moved out of `_template/prompts`.
Use user-filled operational prompts in `workpacks/manual_prompts/`:

- `M_workpack_migration.md`
- `M_bug_report.md`
- `M_task_change.md`

## Writing Guidance

- Prefer concrete acceptance criteria over narrative text.
- Include placeholders only where instance-specific values are required.
- Keep code blocks limited to commands, schemas, and short contract examples.
- Avoid embedding full implementations in prompt files.

## Anti-Patterns

- Full production code pasted into prompts.
- Tooling references tied to one ecosystem without placeholders.
- Missing verification commands.
- Output examples that do not match the output schema.

## Pre-Commit Checklist

- [ ] YAML front-matter includes `depends_on` and `repos`
- [ ] Prompt sections are complete
- [ ] Output JSON example matches `WORKPACK_OUTPUT_SCHEMA.json`
- [ ] Commit message follows `<type>(<workpack-slug>/<prompt-stem>): <summary>`
- [ ] Output captures commit SHA(s) in `artifacts.commit_shas` (or explicitly `[]` for no-change verification prompts)
- [ ] Integration templates include commit and B-series DAG verification procedures
- [ ] No domain-specific references
- [ ] All placeholders are explicit and easy to replace
