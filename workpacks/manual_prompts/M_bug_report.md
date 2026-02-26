# Manual Prompt - Workpack Bug Report

Use this prompt to report a bug on a specific workpack with enough structure for B-series planning.

## Fill Before Running

- Target workpack path: `<workpacks/instances/<group>/<workpack-id>>`
- Target workpack id: `<workpack-id>`
- Bug slug: `<short-bug-slug>`
- Discovered in prompt: `<A#_...|B#_...|V#_...>`
- Severity: `<blocker|major|minor>`
- Context/environment: `<branch, runtime, tool versions, etc.>`
- Reproduction steps: `<ordered steps>`
- Expected behavior: `<expected result>`
- Actual behavior: `<actual result and error messages>`
- Impacted prompts/files: `<list>`
- Repositories: `[<REPO_NAME>]`

## Prompt To Run

---
repos: [<REPO_NAME>]
---
# Workpack Bug Report Task

Capture a structured bug report for workpack `<workpack-id>` at `<workpack-path>`.

## Required Inputs

- Workpack path: `<workpack-path>`
- Workpack id: `<workpack-id>`
- Bug slug: `<short-bug-slug>`
- Discovered in prompt: `<A#_...|B#_...|V#_...>`
- Severity: `<blocker|major|minor>`
- Context: `<context/environment>`
- Reproduction steps: `<ordered steps>`
- Expected behavior: `<expected result>`
- Actual behavior: `<actual result>`
- Impacted prompts/files: `<list>`

## Required Actions

1. Validate completeness of all bug intake fields.
2. Ensure reproduction steps are executable and deterministic.
3. Propose B-series seeds (`B1_*`, `B2_*`, ...) with draft `depends_on`.
4. Update status/state if this bug changes workpack flow.
5. Write output artifact:
   - `<workpack-path>/outputs/B_bug_report.json`

## Verification Commands

```bash
python workpacks/tools/workpack_lint.py
```

## Deliverables

- Structured bug record with severity and evidence
- Proposed B-series prompts and dependencies
- Updated workpack status/state when needed
- `outputs/B_bug_report.json`
