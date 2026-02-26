# Plan

## DAG Dependencies (v5)

| Prompt | depends_on | repos |
|--------|-----------|-------|
| A0_bootstrap | [] | [WorkpackManager] |
| A1_parser_indexer | [A0_bootstrap] | [WorkpackManager] |

## Cross-Workpack References (v5)

requires_workpack: [01_sample-group_parser-v6]