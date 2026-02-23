# Execution Plan

## Summary

Implement comprehensive protocol invariant enforcement in Python tooling. Adds state transition validation, markdown-JSON sync checking, output artifact verification, commit SHA audit, prompt style linting, git hooks/CI templates, and a unified `workpack verify` command. All checks integrate with the existing `workpack_lint.py` infrastructure and follow the same virtual-environment bootstrap pattern.

requires_workpack: [01_workpack-protocol_prompt-lifecycle]

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Branch setup and baseline verification | A0_bootstrap | - | XS |
| 2 | Legal state transition validation for workpack and prompt levels | A1_state_transition_checks | 1 | M |
| 3 | Drift detection between 01_plan.md WBS and meta.prompts, 99_status.md and state.prompt_status | A2_markdown_json_sync | 1 | M |
| 4 | Validate output JSON existence, schema conformance, and declared files on disk | A3_output_artifact_checks | 1 | S |
| 5 | Verify commit SHAs exist on branch and cross-reference change_details with git show | A4_commit_verification_tool | 1 | M |
| 6 | Automated prompt section structure and YAML front-matter checking | A5_prompt_style_lint | 1 | S |
| 7 | Pre-commit hook template and GitHub Actions CI workflow template | A6_git_hooks_ci_templates | 2, 3, 4, 5, 6 | S |
| 8 | Unified workpack verify command wrapping all checks with category filtering | A7_unified_verify_command | 2, 3, 4, 5, 6 | M |
| 9 | V1 integration gate and merge readiness review | V1_integration_meta | 7, 8 | S |
| 10 | Post-merge retrospective | R1_retrospective | 9 | S |

## DAG Dependencies

| Prompt Stem | depends_on | repos |
|-------------|------------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_state_transition_checks | [A0_bootstrap] | [WorkpackManager] |
| A2_markdown_json_sync | [A0_bootstrap] | [WorkpackManager] |
| A3_output_artifact_checks | [A0_bootstrap] | [WorkpackManager] |
| A4_commit_verification_tool | [A0_bootstrap] | [WorkpackManager] |
| A5_prompt_style_lint | [A0_bootstrap] | [WorkpackManager] |
| A6_git_hooks_ci_templates | [A1_state_transition_checks, A2_markdown_json_sync, A3_output_artifact_checks, A4_commit_verification_tool, A5_prompt_style_lint] | [WorkpackManager] |
| A7_unified_verify_command | [A1_state_transition_checks, A2_markdown_json_sync, A3_output_artifact_checks, A4_commit_verification_tool, A5_prompt_style_lint] | [WorkpackManager] |
| V1_integration_meta | [A6_git_hooks_ci_templates, A7_unified_verify_command] | [WorkpackManager] |
| R1_retrospective | [V1_integration_meta] | [WorkpackManager] |

## Parallelization Map

| Phase | Prompts | Mode |
|-------|---------|------|
| 1 | A0_bootstrap | Serial |
| 2 | A1_state_transition_checks, A2_markdown_json_sync, A3_output_artifact_checks, A4_commit_verification_tool, A5_prompt_style_lint | Parallel |
| 3 | A6_git_hooks_ci_templates, A7_unified_verify_command | Parallel |
| 4 | V1_integration_meta | Serial |
| 5 | R1_retrospective | Serial |

## Branch Strategy

- Work branch: `feature/verification-hardening`
- Base branch: `main`
- Merge target: `main`
