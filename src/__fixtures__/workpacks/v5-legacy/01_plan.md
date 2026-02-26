# Plan

## DAG Dependencies (v5)

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_legacy_migration | [A0_bootstrap] | [WorkpackManager] |

## Cross-Workpack References (v5)

requires_workpack: [valid-v6]
