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
- `WORKPACK_EVENT_SCHEMA.json` *(2.3.0+)*
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
- `model_preference` (string): preferred model or model class for this prompt (e.g. `gpt-4o`, `claude-sonnet`, `codex`). Informational — orchestrators MAY use this to route prompt execution.

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

## 6. Event Stream

### 6.1 Purpose

`workpack.events.jsonl` is an optional append-only event log stored alongside `workpack.state.json`. While `execution_log` inside the state file captures transitions for a single workpack, the event stream provides a richer, JSONL-formatted log designed for cross-workpack coordination, real-time monitoring, and integration with external systems.

Schema: `workpacks/WORKPACK_EVENT_SCHEMA.json`

### 6.2 File Format

Each line in `workpack.events.jsonl` is a self-contained JSON object conforming to `WORKPACK_EVENT_SCHEMA.json`. Lines are appended atomically and must never be rewritten or deleted (append-only semantics).

### 6.3 Event Types

| Event Type | Scope | Emitted When |
|---|---|---|
| `workpack.created` | workpack | Workpack instance is scaffolded. |
| `workpack.started` | workpack | First prompt transitions to `in_progress`. |
| `workpack.blocked` | workpack | `overall_status` moves to `blocked`. |
| `workpack.unblocked` | workpack | `overall_status` returns from `blocked`. |
| `workpack.review` | workpack | Workpack enters `review` state. |
| `workpack.completed` | workpack | All prompts are `complete`/`skipped` and verification passes. |
| `workpack.abandoned` | workpack | Workpack is intentionally discontinued. |
| `prompt.started` | prompt | Prompt status moves to `in_progress`. |
| `prompt.completed` | prompt | Prompt status moves to `complete`. |
| `prompt.blocked` | prompt | Prompt status moves to `blocked`. |
| `prompt.unblocked` | prompt | Prompt status returns from `blocked`. |
| `prompt.skipped` | prompt | Prompt status moves to `skipped`. |
| `agent.assigned` | prompt | An agent is assigned to a prompt. |
| `agent.unassigned` | prompt | An agent is removed from a prompt. |
| `output.written` | prompt | `outputs/<PROMPT>.json` is created or updated. |
| `output.validated` | prompt | Output artifact passes validation. |
| `dependency.resolved` | workpack | A cross-workpack dependency is satisfied. |
| `dependency.blocked` | workpack | A cross-workpack dependency blocks progress. |

### 6.4 Required Fields

Every event must include:

- `event_id`: unique identifier (UUID v4 recommended).
- `timestamp`: ISO 8601 date-time of occurrence.
- `workpack_id`: identifies the workpack context.
- `event_type`: one of the enumerated event types.

### 6.5 Optional Fields

- `prompt_stem`: relevant prompt (null for workpack-level events).
- `agent_id`: agent that triggered the event.
- `previous_status` / `new_status`: state transition context.
- `metadata`: arbitrary JSON object for event-specific data.
- `notes`: human-readable annotation.

### 6.6 Coordination Semantics

External orchestrators or monitoring tools can tail `workpack.events.jsonl` across multiple workpacks to:

- Detect when cross-workpack dependencies resolve (`dependency.resolved`).
- Trigger downstream workpack starts when upstream completes (`workpack.completed`).
- Aggregate execution metrics and timelines.
- Feed real-time dashboards or notification systems.

### 6.7 Relationship to `execution_log`

`workpack.state.json.execution_log` remains the authoritative in-file audit trail. The event stream is a superset — it includes the same lifecycle transitions plus coordination, assignment, and output events. Tooling that only reads `workpack.state.json` should continue to work without the event stream.

---

## 7. Relationship to Markdown Files

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

## 8. Backward Compatibility

### 8.1 1.x Workpacks in a 2.0.0 Repository

Protocol 2.0.0 is additive. 1.x workpacks remain valid when they follow 1.x structure and conventions.

### 8.2 When `workpack.meta.json` Is Absent

Treat the workpack as legacy (1.x-style) unless repository policy explicitly requires 2.0.0 metadata.

Compatibility behavior:

- Do not assume `prompts[]` index exists.
- Derive prompt graph from markdown/front-matter as fallback.
- Avoid hard failure solely due to absent 2.0.0 files in legacy mode.

### 8.3 Mixed Fleets

Repositories may contain both 1.x and 2.x workpacks during migration.
Tooling should:

- detect mode per workpack,
- apply matching validation profile,
- emit explicit diagnostics for mismatches.

### 8.4 Legacy-to-Modern Migration Method (2.0.0/2.1.0 -> 2.2.0+)

This section defines the standard modernization workflow for existing 2.x workpacks.

#### 7.4.1 Supported Source and Target Versions

- Supported source versions: `2.0.0`, `2.1.0`.
- Supported target versions: `2.2.0` and higher minor/patch releases in the 2.x line.
- 1.x workpacks should first complete the 1.x -> 2.0.0 upgrade path before applying this 2.x modernization checklist.

#### 7.4.2 Ordered Migration Checklist

1. Update `00_request.md`:
   - Confirm the request states modernization intent and target protocol `2.2.0+`.
   - Ensure acceptance criteria include commit tracking and maintenance prompt expectations where applicable.
2. Update `01_plan.md`:
   - Confirm prompt DAG still reflects current execution order after modernization tasks are introduced.
   - Ensure the post-verification B-series DAG section exists for bug-fix ordering.
3. Update `workpack.meta.json`:
   - Set `protocol_version` to `2.2.0` or higher.
   - Keep `prompts[]` synchronized with `prompts/*.md` stems and `depends_on` edges.
   - Preserve existing IDs/slugs; do not rename workpack identity fields solely for modernization.
4. Update `workpack.state.json`:
   - Add missing prompt status entries for newly introduced prompts.
   - Preserve historical `execution_log` entries (append-only); do not rewrite prior events.
   - Refresh `last_updated` and keep `workpack_id` aligned with `workpack.meta.json.id`.
5. Update prompt front-matter and output contracts:
   - Ensure each prompt uses required YAML front-matter (`depends_on`, `repos`).
   - For output payloads using schema `1.2+`, ensure `artifacts.commit_shas` is present and non-empty when files changed.
   - Ensure integration verification prompts set `artifacts.branch_verified` after commit/branch checks.

#### 7.4.3 Backward Compatibility Guardrails

- Migration must be additive and non-destructive: keep legacy outputs and history unless intentionally superseded.
- Mixed fleets remain valid: non-modernized `2.0.0`/`2.1.0` workpacks continue to lint under their original profile.
- Commit-tracking strictness applies when the workpack is modernized to protocol `2.2.0+` (or outputs adopt schema `1.2+`).
- Avoid introducing required-field changes to `workpack.meta.json`/`workpack.state.json` that would break older workpacks.

#### 7.4.4 Required Post-Migration Verification

Run all of the following after modernization updates:

```bash
python workpacks/tools/validate_templates.py
python workpacks/tools/workpack_lint.py
```

If protocol tooling or lint rules were changed during migration, also run:

```bash
python -m pytest workpacks/tools/tests/ -v
```

---

## 9. Tooling Contract

This section defines expected behavior for protocol-aware tooling.

### 9.1 Linter Expectations

The linter should validate:

- schema conformance for `workpack.meta.json` and `workpack.state.json` when present/applicable,
- ID/folder consistency,
- prompt index drift (`workpack.meta.json.prompts` vs `prompts/*.md` and DAG declarations),
- state drift (`overall_status` vs prompt-level states),
- cross-workpack dependency references,
- output/status coherence (completed prompts should have output JSON).

### 9.2 Scaffold Expectations

Scaffolding should generate:

- markdown skeleton (`00_request.md`, `01_plan.md`, `99_status.md`, prompts, outputs dir),
- `workpack.meta.json` prefilled with required fields,
- `workpack.state.json` initialized with baseline runtime fields.

### 9.3 Extension / Runtime Consumer Expectations

Editor and runtime tooling should:

- index workpacks by metadata fields (ID, category, owners, repos, tags),
- read prompt DAG from `prompts[]` where available,
- reflect live progress from `workpack.state.json`,
- treat `execution_log` as audit timeline,
- support blocker visualization through `blocked_by`.

---

## 10. Cross-Workpack Dependencies

### 10.1 Definition

`workpack.meta.json.requires_workpack` declares dependencies on other workpack IDs.

### 10.2 Resolution Semantics

- Resolution key is workpack ID (folder name).
- Dependencies may reference standalone or grouped workpacks.
- A dependency is resolved when the referenced workpack reaches terminal completed state.

### 10.3 Blocked State Mapping

When unresolved dependencies exist:

- unresolved IDs should be reflected in `workpack.state.json.blocked_by`,
- `overall_status` should move to `blocked` (or remain blocked),
- resume to `in_progress` once `blocked_by` is empty and work can continue.

---

## 11. Agent Interaction Patterns

### 11.1 Start-of-Prompt Flow

1. Read `00_request.md`, `01_plan.md`, `workpack.meta.json`, and current `workpack.state.json`.
2. Confirm upstream prompt/workpack dependencies are satisfied.
3. Set prompt status to `in_progress`, set `started_at`, update `assigned_agent` if needed.
4. Append `prompt_started` event.
5. Update `last_updated`.

### 11.2 Completion Flow

1. Apply file changes for the prompt scope.
2. Commit prompt changes on the work branch.
3. Write/update `outputs/<PROMPT>.json` to satisfy `WORKPACK_OUTPUT_SCHEMA.json`.
4. Update `99_status.md`.
5. Set prompt status to `complete`, set `completed_at`, optionally set `output_validated`.
6. Append `prompt_completed` event and update `last_updated`.

### 11.3 Output JSON Expectations

Per-prompt output JSON must include:

- prompt identity (`workpack`, `prompt`)
- delivery metadata (`delivery_mode`, `branch`)
- change summary (`changes`)
- verification evidence (`verification.commands`)
- handoff content (`handoff.summary`, `handoff.next_steps`, `handoff.known_issues`)

Recommended additions:

- `repos`, `execution`, `change_details`, `notes`

### 11.4 Safety Rules

- Never include secrets in prompts, state, or outputs.
- Do not mark prompts complete without corresponding output artifacts.
- Keep state mutations minimal, explicit, and timestamped.

### 11.5 B-series Dependency DAG (Post-Verification)

When a verification/integration gate (`V1_*`) identifies bugs and emits B-series prompts:

- Each B-series prompt MAY declare `depends_on` in YAML front-matter (example: `depends_on: [B1_shared_refactor]`).
- `workpack.meta.json.prompts[]` MAY include dynamically-added B-series entries with matching `depends_on`.
- B-series prompts at the same DAG depth (no dependency edges between them) MAY run in parallel.
- The integration prompt that generates B-series prompts MUST also produce a B-series dependency plan that makes ordering/parallelization explicit.
- `01_plan.md` SHOULD include a post-verification B-series DAG section that captures dependency ordering once bugs are known.

### 11.6 Commit Tracking

For protocol version 2.2.0+:

- Every prompt that modifies files MUST commit changes before writing `outputs/<PROMPT>.json`.
- Commit message format MUST follow `<type>(<workpack-slug>/<prompt-stem>): <summary>`.
- Commit SHA values MUST be recorded in `output.json` under `artifacts.commit_shas`.
- `branch.work` in output payloads MUST match the actual branch where those commits exist.
- Pure verification/integration prompts that do not modify source files MAY set `artifacts.commit_shas` to `[]` only when no files were changed.

### 11.7 Integration Prompt Verification Responsibilities (V-series)

Integration prompts (`V*_...`) MUST verify upstream output integrity before authorizing merge readiness.

#### 11.7.1 Commit Verification

For each prior prompt output JSON:

1. Extract `artifacts.commit_shas`.
2. Verify each SHA exists on the work branch with `git log --oneline <branch> | grep <sha>`.
3. For each commit, inspect changed files with `git show --stat <sha>`.
4. Cross-reference diffed files against `change_details[].file` in that output JSON.
5. Report discrepancies:
   - files present in commit but not declared in `change_details`, and
   - files declared in `change_details` but absent from commit.
6. Set `artifacts.branch_verified` to `true` in the integration prompt's own output only when all checks pass.

#### 11.7.2 B-series DAG Verification

If B-series prompts exist, integration prompts MUST:

1. Verify the B-series DAG is acyclic.
2. Verify B-series execution order respected declared dependencies.
3. Verify every B-series prompt referenced in the DAG has a corresponding `outputs/<PROMPT>.json`.

---

## 12. MCP Server Integration

### 12.1 Purpose

The Workpack MCP Server (`packages/mcp-server/`) exposes workpack data through the [Model Context Protocol](https://modelcontextprotocol.io/), allowing AI agents and tools to discover and inspect workpacks via a standardized read-only interface without parsing files directly.

### 12.2 Resources

| URI | Description |
|---|---|
| `workpack://list` | JSON array of all discovered workpack instances with summary fields (id, title, category, status). |
| `workpack://{id}/meta` | Full `workpack.meta.json` for the specified workpack. |
| `workpack://{id}/state` | Full `workpack.state.json` for the specified workpack. |
| `workpack://{id}/next-prompts` | DAG-resolved list of prompt stems whose `depends_on` are satisfied and whose status is `pending`. |

### 12.3 Tools

| Tool | Description |
|---|---|
| `list_workpacks` | Discover and list all workpack instances with status summary. |
| `get_workpack_detail` | Retrieve full meta + state for a specific workpack by ID. |
| `get_next_prompts` | Compute DAG-resolved prompts ready for execution. |

### 12.4 Design Constraints

- The server is **read-only** — it never mutates workpack files.
- Discovery follows the same rules as the CLI tooling: scan `workpacks/instances/` (and optionally `workpack.config.json` discovery roots), skip directories starting with `_` or `.`.
- DAG resolution for `next-prompts` checks `depends_on` edges against `prompt_status` in `workpack.state.json`. A prompt is executable when all upstream stems have status `complete` or `skipped` and the prompt's own status is `pending`.

### 12.5 Transport

The server uses **stdio** transport by default, compatible with Claude Desktop, VS Code MCP clients, and other MCP-aware tools.

---

## 13. Practical Notes for Implementers

- Prefer JSON schemas as enforcement boundary; markdown parsing is a fallback for compatibility.
- Keep metadata stable to minimize noisy diffs.
- Treat `workpack.state.json` as operational data and preserve log history.
- During migration from 1.x, introduce `workpack.meta.json` first, then add runtime orchestration via `workpack.state.json`.

