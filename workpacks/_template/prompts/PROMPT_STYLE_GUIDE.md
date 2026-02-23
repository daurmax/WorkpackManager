# Prompt Style Guide - Workpack Protocol v6

## Core Rules

- Write prompts in imperative style and focus on outcomes.
- Specify what must be delivered and how completion is verified.
- Keep prompts project-agnostic: no framework-specific assumptions.
- Use semantic references (file/class/function names), not fragile line numbers.

## Naming Convention

Prompt filenames follow `<SERIES><NUMBER>_<slug>.md` when numbered, for example:

- `A0_bootstrap.md`
- `A1_feature_slice.md`
- `A5_integration_meta.md`
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
- `changes`
- `verification`
- `handoff`
- `repos`
- `execution`
- `change_details`

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
- [ ] No domain-specific references
- [ ] All placeholders are explicit and easy to replace
