# Workpack Adoption Guide

This guide explains how to introduce the workpack system into any existing Git repository, regardless of language or framework.

The protocol is defined in `workpacks/PROTOCOL_SPEC.md`. This document focuses on practical adoption.

## Quick Start (Experienced Teams, <30 Minutes)

1. Copy the `workpacks/` framework into your repository (see Step 1).
2. Create your first instance by copying `_template/` to `workpacks/instances/<workpack-id>/`.
3. Replace placeholders in `00_request.md`, `01_plan.md`, `workpack.meta.json`, and `workpack.state.json`.
4. Rename/add prompt files under `prompts/`, keeping YAML front-matter (`depends_on`, `repos`) accurate.
5. Ensure `workpack.meta.json.prompts[]` matches the real prompt files and dependencies.
6. Run `python workpacks/tools/workpack_lint.py` (or fallback checks in Step 4).
7. Commit and open a PR.

If your team already has branch/PR standards and verification commands ready, these steps are typically under 30 minutes.

## Prerequisites

- Git repository with an active default branch.
- Python 3.10+ available on developer and CI machines.
- Ability to run repository checks (build/test/lint) from command line.
- Optional: VS Code workpack extension support in your environment.

Recommended:

- `jsonschema` available in your Python environment for schema checks.
- A branch naming convention such as `feature/<workpack-id>`.

## Step 1 - Copy the workpack framework

Copy the framework into the target repository root as `workpacks/`.

### Minimal adoption setup

Use this when you want to start quickly with manual execution.

```text
workpacks/
  PROTOCOL_SPEC.md
  WORKPACK_META_SCHEMA.json
  WORKPACK_STATE_SCHEMA.json
  WORKPACK_OUTPUT_SCHEMA.json
  _template/
    00_request.md
    01_plan.md
    99_status.md
    workpack.meta.json
    workpack.state.json
    prompts/
    outputs/
  instances/
```

### Full adoption setup

Use this when you want complete lifecycle support (groups, scaffolding, linting, validation, CI).

```text
workpacks/
  CHANGELOG.md
  README.md
  PROTOCOL_SPEC.md
  WORKPACK_META_SCHEMA.json
  WORKPACK_STATE_SCHEMA.json
  WORKPACK_OUTPUT_SCHEMA.json
  WORKPACK_GROUP_SCHEMA.json
  _template/
  manual_prompts/
  tools/
    workpack_lint.py
    workpack_scaffold.py
    validate_templates.py
    validate_workpack_files.py
  instances/
```

### Copy commands

Bash:

```bash
cp -R /path/to/workpack-framework/workpacks /path/to/target-repo/
```

PowerShell:

```powershell
Copy-Item -Recurse C:\path\to\workpack-framework\workpacks C:\path\to\target-repo\
```

## Step 2 - Configure for your project

Update the copied templates and conventions before creating real workpacks.

1. Choose naming mode:
- Standalone workpack folder: `<slug>`
- Grouped workpack folder: `<NN>_<group-id>_<slug>`

2. Set project defaults in template files:
- `workpacks/_template/workpack.meta.json`: repo name(s), delivery mode, branch target, prompt list.
- `workpacks/_template/workpack.state.json`: baseline status and timestamps.
- `workpacks/_template/prompts/*.md`: default `repos` and verification command placeholders.

3. Define agent roles:
- Keep the prompt stem naming consistent (for example `A1_feature_slice`).
- Rewrite `agent_role` in `workpack.meta.json.prompts[]` to match your team structure.

4. Replace verification placeholders:
- Replace `<build_or_sanity_command>`, `<lint_or_static_check_command>`, and similar placeholders with real commands from your project.
- Keep verification command sets in prompts and CI aligned.

5. Confirm metadata/state alignment rules from protocol:
- `workpack.state.json.workpack_id` must equal `workpack.meta.json.id`.
- `workpack.meta.json.prompts[].stem` should align with `workpack.state.json.prompt_status` keys.
- Update `last_updated` on every state mutation.

## Step 3 - Create your first workpack

For a guided step-by-step prompt, use `workpacks/manual_prompts/M_new_workpack.md`. Fill in the placeholders and paste it into your coding agent.

Alternatively, follow the manual steps below.

Example: create a standalone workpack named `repo-onboarding`.

### 3.1 Create instance folder from template

Bash:

```bash
mkdir -p workpacks/instances
cp -R workpacks/_template workpacks/instances/repo-onboarding
```

PowerShell:

```powershell
New-Item -ItemType Directory -Force workpacks\instances | Out-Null
Copy-Item -Recurse workpacks\_template workpacks\instances\repo-onboarding
```

### 3.2 Fill required instance files

Edit:

- `workpacks/instances/repo-onboarding/00_request.md`
- `workpacks/instances/repo-onboarding/01_plan.md`
- `workpacks/instances/repo-onboarding/workpack.meta.json`
- `workpacks/instances/repo-onboarding/workpack.state.json`
- `workpacks/instances/repo-onboarding/99_status.md`

At minimum:

- Define clear acceptance criteria in `00_request.md`.
- Define prompt DAG in `01_plan.md`.
- Mirror that DAG in `workpack.meta.json.prompts[]`.
- Initialize prompt entries in `workpack.state.json.prompt_status`.

### 3.3 Prepare prompt files

Start with:

- `A0_bootstrap.md`
- One or more implementation prompts (`A1_...`, `A2_...`)
- `A5_integration_meta.md`

Keep each prompt's YAML front-matter accurate:

```yaml
---
depends_on: [A0_bootstrap]
repos: [YourRepo]
---
```

### 3.4 Commit the first workpack

```bash
git checkout -b feature/repo-onboarding
git add workpacks/
git commit -m "chore(workpacks): add first workpack"
```

## Step 4 - Run validation tools

Run the protocol linter and file completeness validator before opening a PR.

```bash
python workpacks/tools/workpack_lint.py
python workpacks/tools/workpack_lint.py --strict
python workpacks/tools/validate_workpack_files.py
```

What `workpack_lint.py` catches:

- Missing required files (`workpack.meta.json`, `workpack.state.json`) in 2.0.0+ workpacks.
- Metadata mismatches (for example folder name vs `meta.id`).
- Prompt drift (`prompts/` files not matching `meta.prompts[]`).
- State drift (`overall_status` inconsistent with per-prompt statuses).

What `validate_workpack_files.py` catches:

- Missing protocol-required files and directories (version-gated).
- Empty prompts directory.
- Missing output JSON for completed prompts.

Note: `workpack_scaffold.py` automatically runs file completeness validation after scaffolding.

If linter tooling is not available yet, run fallback checks:

```bash
python workpacks/tools/validate_templates.py
```

And manually verify:

- `outputs/<PROMPT>.json` exists for every completed prompt.
- `99_status.md` matches `workpack.state.json`.

## Step 5 - Integrate with your workflow

### PR workflow integration

1. One active workpack branch at a time per workstream.
2. Every completed prompt writes `outputs/<PROMPT>.json`.
3. `A5_integration_meta` acts as merge gate.
4. Merge only when acceptance criteria have evidence in outputs and verification commands pass.

### CI pipeline integration

Add a workpack validation stage to CI:

```bash
python workpacks/tools/workpack_lint.py --strict
python workpacks/tools/validate_workpack_files.py --strict
```

Optionally add project checks:

```bash
<project_build_command>
<project_test_command>
<project_lint_command>
```

### Agent-driven development integration

- Assign one prompt per agent at a time to avoid file ownership conflicts.
- Keep `workpack.state.json` current so orchestration tools can route work correctly.
- Require output JSON artifacts as handoff contracts between agents and reviewers.

### Team onboarding checklist

- Run a 30-minute onboarding session using one small real change.
- Provide a short role map (request owner, implementer, verifier, reviewer).
- Enforce output JSON and status/state updates in code review templates.

### Common pitfalls and fixes

- Pitfall: Prompt file renamed, but `meta.prompts[]` not updated.
  Fix: Re-sync `workpack.meta.json.prompts[]` and `workpack.state.json.prompt_status`.
- Pitfall: Prompt marked complete with no output JSON.
  Fix: Require `outputs/<PROMPT>.json` in PR checks.
- Pitfall: `overall_status` stays `in_progress` when blocked.
  Fix: Update `blocked_by` and move state to `blocked`.
- Pitfall: Project-specific jargon leaks into templates.
  Fix: Keep `_template/` generic and move project specifics into instance files only.

## What to customize vs. what to keep standard

| Area | Keep Standard (Required) | Customize (Convention) |
|------|---------------------------|-------------------------|
| Core layout | `workpacks/instances/<workpack>/` with request, plan, prompts, outputs; 2.0.0+ workpacks include meta/state JSON | Folder naming strategy across teams (standalone vs grouped) |
| Metadata/state | `workpack.meta.json` and `workpack.state.json` schema compliance; `meta.id == state.workpack_id` | Optional metadata fields (`tags`, `owners`, `repos`) |
| Prompt contracts | YAML front-matter with `depends_on` and `repos`; output JSON schema compliance | Prompt decomposition, naming slugs, agent role wording |
| Lifecycle | Status transitions and append-only execution log semantics | Exact team gates and reviewer roles |
| Verification | Evidence for each acceptance criterion before merge | Choice of build/test/lint/security command set |
| Delivery | Output artifact per completed prompt | Branch naming, PR template wording, review cadence |

## FAQ

**Do we need to migrate all existing work at once?**  
No. Protocol 2.0.0 is additive. You can adopt it for new workpacks first and migrate older workpacks gradually.

**Can we use workpacks without grouped execution?**  
Yes. Group metadata is optional. Standalone workpacks are valid and simpler for initial adoption.

**Can we rename A/B/V/R prompt series?**  
Yes, if you keep prompt stems, dependency links, and metadata/state mappings internally consistent.

**Do we have to use PR-based delivery?**  
No. `delivery_mode` supports `pr` and `direct_push`. Choose based on repository policy.

**What is the minimum required to mark a prompt complete?**  
Implementation changes, `outputs/<PROMPT>.json`, and synchronized status/state updates.

**How do we onboard non-agent contributors?**  
Use the same files. Humans can author prompts and outputs directly; the protocol is tool-agnostic.

**How should we treat templates during adoption?**  
Keep `_template/` generic. Put team- or domain-specific details only in concrete instance files under `instances/`.

**How do we know this is portable to non-framework-specific repos?**  
The protocol and templates are explicitly framework-neutral and have been ported across multiple repositories (see `workpacks/CHANGELOG.md`).
