# Plan

## Work Breakdown Structure (WBS)

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Bootstrap | A0_bootstrap | - | XS |
| 2 | Legacy parser work | A1_legacy_parser | 1 | M |

## DAG Dependencies (v5)

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_legacy_parser | [A0_bootstrap] | [WorkpackManager] |