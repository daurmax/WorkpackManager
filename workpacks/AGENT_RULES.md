# AGENT_RULES
Protocol Version: 2.2.0+
Purpose: Execute any workpack prompt with invariant-safe, schema-valid, auditable behavior.

| Rule Category | Section |
|---|---|
| Pre-Prompt Checklist | §1 |
| Execution Flow | §2 |
| Output Requirements | §3 |
| Commit Tracking | §4 |
| State Updates | §5 |
| Post-Prompt Checklist | §6 |

## §1 Pre-Prompt Checklist
§1.1 READ `00_request.md`, `01_plan.md`, `workpack.meta.json`, `workpack.state.json`, and `prompts/<PROMPT>.md` before editing.
§1.2 VERIFY `workpack.state.json.workpack_id` equals `workpack.meta.json.id`.
§1.3 VERIFY the target prompt stem exists in `workpack.meta.json.prompts[].stem` and `workpack.state.json.prompt_status`.
§1.4 VERIFY prompt front-matter declares both `depends_on` and `repos`.
§1.5 VERIFY all prompt dependencies in `depends_on` are `complete` or `skipped` before starting.
§1.6 VERIFY every `requires_workpack` dependency is complete before starting.
§1.7 IF cross-workpack dependencies are unresolved, SET `blocked_by`, SET `overall_status` to `blocked`, and STOP implementation.
§1.8 VERIFY current branch matches planned work branch and delivery mode matches `workpack.meta.json.delivery_mode`.
§1.9 VERIFY `outputs/` exists and is writable.
§1.10 VERIFY uncommitted changes included in this prompt are intentional and in scope.

## §2 Execution Flow
§2.1 EXECUTE only the requested prompt scope; DO NOT implement other prompts.
§2.2 FOLLOW prompt `Implementation Requirements`, `Constraints`, and acceptance criteria exactly.
§2.3 SET `prompt_status.<PROMPT>.status` to `in_progress` and SET `started_at` before substantive edits.
§2.4 SET `prompt_status.<PROMPT>.assigned_agent` when agent identity is known.
§2.5 APPEND `execution_log` event `prompt_started` when work begins.
§2.6 SET `overall_status` to `in_progress` when active work starts.
§2.7 KEEP edits additive and non-destructive; DO NOT delete legacy outputs or rewrite historical log entries.
§2.8 KEEP JSON/markdown views synchronized; DO NOT allow prompt-index, DAG, or status drift.
§2.9 NEVER include secrets in prompts, state files, outputs, commit messages, or notes.
§2.10 IF blocked mid-execution, SET prompt/workpack status to `blocked`, SET `blocked_reason`, APPEND `blocked`, and STOP.
§2.11 RESUME blocked work only after blockers clear; APPEND `unblocked` and return status to `in_progress`.

## §3 Output Requirements
§3.1 WRITE handoff payload to `outputs/<PROMPT>.json`.
§3.2 POPULATE all required output schema fields for the selected `schema_version`.
§3.3 SET `workpack` to `workpack.meta.json.id` and `prompt` to the exact prompt stem.
§3.4 SET `delivery_mode` and `branch.{base,work,merge_target}` to actual delivery values.
§3.5 RECORD every file action in both `changes` and `change_details[]`, and KEEP them consistent.
§3.6 RECORD only commands actually run in `verification.commands`; DO NOT mark unrun checks as `pass`.
§3.7 USE `verification.commands[].result` from enum `pass|fail|not_run` and include concise `notes` for exceptions.
§3.8 POPULATE `handoff.summary`, `handoff.next_steps`, and `handoff.known_issues` with prompt-specific content.
§3.9 SET `repos` to the affected repositories and KEEP values consistent with prompt scope.
§3.10 POPULATE `execution.model`, `tokens_in`, `tokens_out`, and `duration_ms` with non-negative values.
§3.11 VALIDATE output against `WORKPACK_OUTPUT_SCHEMA.json` before completion.

## §4 Commit Tracking
§4.1 FOR protocol `2.2.0+`, COMMIT prompt changes before writing `outputs/<PROMPT>.json`.
§4.2 FORMAT commit messages as `<type>(<workpack-slug>/<prompt-stem>): <summary>`.
§4.3 RECORD commit SHA values in `artifacts.commit_shas`.
§4.4 FOR schema `1.2+`, KEEP `artifacts.commit_shas` non-empty when files changed.
§4.5 ALLOW `artifacts.commit_shas: []` only for no-change verification/integration prompts when permitted by active policy.
§4.6 VERIFY each recorded SHA exists on `branch.work`.
§4.7 VERIFY files in each recorded commit match declared `change_details[].file`.
§4.8 SET `artifacts.branch_verified` to `true` only after branch/commit verification passes.

## §5 State Updates
§5.1 TREAT `workpack.meta.json` as stable contract and `workpack.state.json` as mutable runtime state.
§5.2 REFRESH `last_updated` on every state mutation.
§5.3 KEEP `execution_log` append-only; NEVER rewrite or remove prior events.
§5.4 USE only allowed `overall_status`: `not_started`, `in_progress`, `blocked`, `review`, `complete`, `abandoned`.
§5.5 USE only allowed prompt `status`: `pending`, `in_progress`, `complete`, `blocked`, `skipped`.
§5.6 WHEN prompt status is `in_progress`, ENSURE `started_at` is present.
§5.7 WHEN prompt status is `complete`, ENSURE `completed_at` is present and output artifact exists.
§5.8 WHEN prompt status is `blocked`, ENSURE `blocked_reason` is present.
§5.9 APPEND `prompt_completed` event when prompt work finishes and output is written.
§5.10 KEEP `blocked_by` synchronized with unresolved `requires_workpack` dependencies.
§5.11 MOVE `overall_status` to `review` only when implementation is done and verification gate is pending.
§5.12 MOVE `overall_status` to `complete` only when required verification passes.

## §6 Post-Prompt Checklist
§6.1 RUN every verification command required by the prompt before finalizing output/state/status.
§6.2 UPDATE `99_status.md` so completion checkboxes and output table match actual runtime artifacts.
§6.3 CONFIRM each `complete` prompt has a corresponding `outputs/<PROMPT>.json`.
§6.4 CONFIRM `workpack.state.json.prompt_status` aligns with `workpack.meta.json.prompts[]`.
§6.5 FOR `V*_...` prompts, VERIFY upstream `artifacts.commit_shas` exist and match `change_details`.
§6.6 FOR `V*_...` prompts with B-series prompts, VERIFY DAG is acyclic, dependency order is respected, and outputs exist.
§6.7 IF verification fails, DO NOT mark prompt/workpack `complete`; record failures explicitly.
§6.8 PRESERVE compatibility by using additive, non-destructive updates in mixed legacy/modern repositories.
§6.9 FINALIZE with synchronized updates to output JSON, `workpack.state.json`, and `99_status.md`.
