# Workpack Protocol Specification

This document is the normative specification for the Workpack Protocol in this repository.
It defines file structure, field semantics, lifecycle rules, tooling contracts, and backward compatibility expectations for workpack consumers (CLI, CI, editor extensions, and agents).

---

## 1. Protocol Overview

### 1.1 Purpose

A workpack is a durable, version-controlled unit of work that captures:

- Request intent (`00_request.md`)
- Execution plan (`01_plan.md`)
- Agent prompts (`prompts/*.md`)
- Runtime status (`99_status.md`, `workpack.state.json`)
- Structured handoffs (`outputs/*.json`)

Protocol 2.0.0 formalizes machine-readable metadata and runtime state so tooling can consume workpacks without parsing markdown as the only source of truth.

### 1.2 Version History Summary

- 1.4.0 introduced `workpacks/instances/`, DAG front-matter (`depends_on`, `repos`), execution metrics in outputs, R-series retrospective prompts, and cross-workpack references.
- 2.0.0 introduced `workpack.meta.json` (static metadata) and `workpack.state.json` (mutable runtime state), including prompt indexing, assignments, and execution log.
- 2.1.0 added workpack groups (`group.meta.json`, `GROUP.md`) and updated naming conventions.

See `CHANGELOG.md` for the complete version history from 1.0.0 onwards.

### 1.3 Design Philosophy

- Separate static contract from mutable execution data.
- Keep markdown readable for humans, JSON parseable for tools.
- Preserve backward compatibility with 1.x workpacks (additive evolution).
- Prefer explicit DAG declarations over inferred sequencing.
- Maintain auditability via append-only state events and per-prompt outputs.

---

## 2. File Layout

### 2.1 Repository-Level Files

The `workpacks/` directory should include:

- `WORKPACK_META_SCHEMA.json`
- `WORKPACK_STATE_SCHEMA.json`
- `WORKPACK_OUTPUT_SCHEMA.json`
- `CHANGELOG.md`
- `README.md`
- `PROTOCOL_SPEC.md` (this document)
- `_template/`
- `instances/`

### 2.2 Per-Workpack Instance Layout (2.0.0+)

```text
workpacks/instances/<workpack-id>/
  00_request.md                 # required
  01_plan.md                    # required
  prompts/                      # required
  outputs/                      # required by protocol 1.1.0+
  99_status.md                  # recommended human status surface
  workpack.meta.json            # required for native 2.0.0+
  workpack.state.json           # required for native 2.0.0+ runtime tracking
```

### 2.3 Grouped Layout (2.1.0+)

```text
workpacks/instances/<group-id>/
  group.meta.json
  GROUP.md
  <NN>_<group-id>_<slug>/...
```

Grouped workpacks use the same per-instance contract; `workpack.meta.json.group` links child workpacks to the parent group ID.

---

## 3. Metadata/State Split

### 3.1 Rationale

`workpack.meta.json` and `workpack.state.json` exist as separate files to avoid mixing stable planning metadata with high-frequency runtime updates.

- Metadata changes infrequently and is review-oriented.
- Runtime state changes often and is execution-oriented.
- Tooling can cache metadata while polling state.
- CI and extensions can reason deterministically about DAG and ownership without scraping markdown.

### 3.2 Ownership Rules

- `workpack.meta.json`:
  - Primary writers: scaffold tools and humans during planning/replanning.
  - Treated as versioned contract.
  - Changes should be intentional and reviewable.
- `workpack.state.json`:
  - Primary writers: agents and runtime tooling.
  - Updated during execution (status changes, assignment changes, log events).
  - `execution_log` is append-only.

### 3.3 Consistency Expectations

- `workpack.state.json.workpack_id` MUST equal `workpack.meta.json.id`.
- Prompt stems in `workpack.meta.json.prompts[].stem` SHOULD align with keys in `workpack.state.json.prompt_status`.
- `overall_status` SHOULD be derivable from prompt states and blockers.
- `last_updated` MUST be refreshed on every state mutation.

---

## 4. `workpack.meta.json` Reference

Schema: `workpacks/WORKPACK_META_SCHEMA.json`

### 4.1 Required Top-Level Fields

| Field | Type | Semantics |
|---|---|---|
| `id` | string | Workpack identifier; must match folder name and pattern `^[a-z0-9][a-z0-9_-]+$`. |
| `title` | string | Display title for humans/tools. |
| `summary` | string | Concise 1–3 sentence description of scope and outcome. |
| `protocol_version` | string | Protocol version implemented by this workpack (example: `"2.0.0"`). |
| `workpack_version` | string | Semantic version of the workpack content itself (plan/prompt evolution). |
| `category` | enum | One of: `feature`, `refactor`, `bugfix`, `hotfix`, `debug`, `docs`, `perf`, `security`. |
| `created_at` | date | Creation date (`YYYY-MM-DD`). |

### 4.2 Optional Top-Level Fields

| Field | Type | Semantics |
|---|---|---|
| `group` | string | Parent group ID for grouped workpacks. |
| `requires_workpack` | string[] | Cross-workpack dependencies that must complete first. |
| `tags` | string[] | Free-form indexing tags. |
| `owners` | string[] | Responsible people/teams/handles. |
| `repos` | string[] | Repositories touched by this workpack. |
| `delivery_mode` | enum | `pr` or `direct_push`; default `pr`. |
| `target_branch` | string | Merge target branch; default `main`. |
| `prompts` | object[] | Machine-readable prompt index mirroring the execution DAG in `01_plan.md`. |

### 4.3 `prompts[]` Item Contract

Required item fields:

- `stem` (string): prompt basename without extension (for example `A1_protocol_spec`)
- `agent_role` (string): role summary for assignment/orchestration

Optional item fields:

- `depends_on` (string[])
- `repos` (string[])
- `estimated_effort` (`XS` | `S` | `M` | `L` | `XL`)

### 4.4 How `prompts[]` Mirrors the DAG

`prompts[]` is the parseable DAG projection of `01_plan.md`:

- `stem` maps to `prompts/<stem>.md`
- `depends_on` edges define prompt-level dependencies
- `repos` scopes impact by repository
- `estimated_effort` supports planning and scheduling

Tools should treat markdown and JSON as two synchronized views of the same graph; drift should be surfaced.

### 4.5 Example

```json
{
  "id": "02_platform_refactor",
  "title": "Platform Refactor",
  "summary": "Refactor the platform module layout and update tooling hooks.",
  "protocol_version": "2.0.0",
  "workpack_version": "1.0.0",
  "category": "refactor",
  "created_at": "2026-02-23",
  "requires_workpack": [],
  "repos": ["MyRepo"],
  "delivery_mode": "pr",
  "target_branch": "main",
  "prompts": [
    {
      "stem": "A0_bootstrap",
      "agent_role": "Prepare branch and baseline checks"
    },
    {
      "stem": "A1_module_split",
      "agent_role": "Split platform modules",
      "depends_on": ["A0_bootstrap"],
      "repos": ["MyRepo"],
      "estimated_effort": "M"
    }
  ]
}
```

---

## 5. `workpack.state.json` Reference

Schema: `workpacks/WORKPACK_STATE_SCHEMA.json`

### 5.1 Required Top-Level Fields

| Field | Type | Semantics |
|---|---|---|
| `workpack_id` | string | Must match `workpack.meta.json.id`. |
| `overall_status` | enum | Lifecycle state: `not_started`, `in_progress`, `blocked`, `review`, `complete`, `abandoned`. |
| `last_updated` | date-time | Timestamp of the latest runtime mutation. |

### 5.2 Optional Top-Level Fields

| Field | Type | Semantics |
|---|---|---|
| `prompt_status` | object | Per-prompt state keyed by prompt stem. |
| `agent_assignments` | object | Default assignment map (`stem -> agent id`). |
| `blocked_by` | string[] | Unresolved cross-workpack blockers (`requires_workpack` not complete). |
| `execution_log` | object[] | Append-only transition log for auditability. |
| `notes` | string or null | Free-form runtime notes. |

### 5.3 `prompt_status.<stem>` Contract

Required field:

- `status`: `pending` | `in_progress` | `complete` | `blocked` | `skipped`

Optional fields:

- `assigned_agent` (string)
- `started_at` (date-time or null)
- `completed_at` (date-time or null)
- `output_validated` (boolean, default `false`)
- `blocked_reason` (string or null)

### 5.4 Status Transition Semantics

Typical transitions:

- `not_started` -> `in_progress` when first prompt starts
- `in_progress` -> `blocked` when dependencies block continuation
- `blocked` -> `in_progress` when blockers clear
- `in_progress` -> `review` when implementation is complete and awaiting gate/review
- `review` -> `complete` when verification passes
- Any active state -> `abandoned` when workpack is intentionally discontinued

Prompt-level transitions usually follow:

- `pending` -> `in_progress` -> `complete`
- `pending`/`in_progress` -> `blocked` -> `in_progress`
- `pending` -> `skipped` for intentionally omitted prompts

### 5.5 Execution Log Semantics

`execution_log` is append-only and each entry contains at least:

- `timestamp`
- `event` (`created`, `started`, `prompt_started`, `prompt_completed`, `blocked`, `unblocked`, `review`, `completed`, `abandoned`)

Optional context:

- `prompt_stem`
- `agent`
- `notes`

Log entries provide a durable audit trail and should never be rewritten to hide prior transitions.

### 5.6 Agent Assignment Tracking

- `agent_assignments` sets defaults by prompt.
- `prompt_status.<stem>.assigned_agent` can override defaults at runtime.
- Tooling should resolve effective assignment as:
  1. per-prompt override, else
  2. default assignment map, else
  3. unassigned.

### 5.7 Example

```json
{
  "workpack_id": "02_platform_refactor",
  "overall_status": "in_progress",
  "last_updated": "2026-02-23T18:30:00Z",
  "prompt_status": {
    "A0_bootstrap": {
      "status": "complete",
      "assigned_agent": "codex",
      "started_at": "2026-02-23T17:00:00Z",
      "completed_at": "2026-02-23T17:10:00Z",
      "output_validated": true
    },
    "A1_module_split": {
      "status": "in_progress",
      "assigned_agent": "copilot",
      "started_at": "2026-02-23T17:15:00Z",
      "completed_at": null
    }
  },
  "agent_assignments": {
    "A1_module_split": "copilot"
  },
  "blocked_by": [],
  "execution_log": [
    {
      "timestamp": "2026-02-23T17:00:00Z",
      "event": "started",
      "prompt_stem": null,
      "agent": "codex",
      "notes": "Workpack execution started"
    }
  ],
  "notes": null
}
```

---

## 6. Relationship to Markdown Files

### 6.1 `00_request.md`

- Canonical narrative for request, constraints, and acceptance criteria.
- `protocol_version` in metadata should align with declared version intent.

### 6.2 `01_plan.md`

- Human-readable WBS and DAG rationale.
- Must align with `workpack.meta.json.prompts` (same stems and dependency intent).

### 6.3 `99_status.md`

- Human-readable operational status and notes.
- Complements but does not replace `workpack.state.json`.
- Prompt completion claims should match both:
  - `workpack.state.json.prompt_status`
  - `outputs/<PROMPT>.json` presence

### 6.4 Consistency Rules

- JSON is authoritative for machine interpretation.
- Markdown is authoritative for human context and rationale.
- Tooling should report drift rather than silently choosing one side.

---

## 7. Backward Compatibility

### 7.1 1.x Workpacks in a 2.0.0 Repository

Protocol 2.0.0 is additive. 1.x workpacks remain valid when they follow 1.x structure and conventions.

### 7.2 When `workpack.meta.json` Is Absent

Treat the workpack as legacy (1.x-style) unless repository policy explicitly requires 2.0.0 metadata.

Compatibility behavior:

- Do not assume `prompts[]` index exists.
- Derive prompt graph from markdown/front-matter as fallback.
- Avoid hard failure solely due to absent 2.0.0 files in legacy mode.

### 7.3 Mixed Fleets

Repositories may contain both 1.x and 2.x workpacks during migration.
Tooling should:

- detect mode per workpack,
- apply matching validation profile,
- emit explicit diagnostics for mismatches.

---

## 8. Tooling Contract

This section defines expected behavior for protocol-aware tooling.

### 8.1 Linter Expectations

The linter should validate:

- schema conformance for `workpack.meta.json` and `workpack.state.json` when present/applicable,
- ID/folder consistency,
- prompt index drift (`workpack.meta.json.prompts` vs `prompts/*.md` and DAG declarations),
- state drift (`overall_status` vs prompt-level states),
- cross-workpack dependency references,
- output/status coherence (completed prompts should have output JSON).

### 8.2 Scaffold Expectations

Scaffolding should generate:

- markdown skeleton (`00_request.md`, `01_plan.md`, `99_status.md`, prompts, outputs dir),
- `workpack.meta.json` prefilled with required fields,
- `workpack.state.json` initialized with baseline runtime fields.

### 8.3 Extension / Runtime Consumer Expectations

Editor and runtime tooling should:

- index workpacks by metadata fields (ID, category, owners, repos, tags),
- read prompt DAG from `prompts[]` where available,
- reflect live progress from `workpack.state.json`,
- treat `execution_log` as audit timeline,
- support blocker visualization through `blocked_by`.

---

## 9. Cross-Workpack Dependencies

### 9.1 Definition

`workpack.meta.json.requires_workpack` declares dependencies on other workpack IDs.

### 9.2 Resolution Semantics

- Resolution key is workpack ID (folder name).
- Dependencies may reference standalone or grouped workpacks.
- A dependency is resolved when the referenced workpack reaches terminal completed state.

### 9.3 Blocked State Mapping

When unresolved dependencies exist:

- unresolved IDs should be reflected in `workpack.state.json.blocked_by`,
- `overall_status` should move to `blocked` (or remain blocked),
- resume to `in_progress` once `blocked_by` is empty and work can continue.

---

## 10. Agent Interaction Patterns

### 10.1 Start-of-Prompt Flow

1. Read `00_request.md`, `01_plan.md`, `workpack.meta.json`, and current `workpack.state.json`.
2. Confirm upstream prompt/workpack dependencies are satisfied.
3. Set prompt status to `in_progress`, set `started_at`, update `assigned_agent` if needed.
4. Append `prompt_started` event.
5. Update `last_updated`.

### 10.2 Completion Flow

1. Apply file changes for the prompt scope.
2. Write/update `outputs/<PROMPT>.json` to satisfy `WORKPACK_OUTPUT_SCHEMA.json`.
3. Update `99_status.md`.
4. Set prompt status to `complete`, set `completed_at`, optionally set `output_validated`.
5. Append `prompt_completed` event and update `last_updated`.

### 10.3 Output JSON Expectations

Per-prompt output JSON must include:

- prompt identity (`workpack`, `prompt`)
- delivery metadata (`delivery_mode`, `branch`)
- change summary (`changes`)
- verification evidence (`verification.commands`)
- handoff content (`handoff.summary`, `handoff.next_steps`, `handoff.known_issues`)

Recommended additions:

- `repos`, `execution`, `change_details`, `notes`

### 10.4 Safety Rules

- Never include secrets in prompts, state, or outputs.
- Do not mark prompts complete without corresponding output artifacts.
- Keep state mutations minimal, explicit, and timestamped.

---

## 11. Practical Notes for Implementers

- Prefer JSON schemas as enforcement boundary; markdown parsing is a fallback for compatibility.
- Keep metadata stable to minimize noisy diffs.
- Treat `workpack.state.json` as operational data and preserve log history.
- During migration from 1.x, introduce `workpack.meta.json` first, then add runtime orchestration via `workpack.state.json`.

