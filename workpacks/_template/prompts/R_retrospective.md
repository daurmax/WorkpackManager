---
prompt_id: R1_retrospective
workpack: <WORKPACK_ID>
agent_role: Retrospective reviewer
depends_on:
  - <FINAL_A_SERIES_PROMPT>
repos:
  - <REPO_NAME>
estimated_effort: S
---

# R1 – Retrospective: <Workpack Title>

## Objective

Conduct a post-merge retrospective for this workpack. Evaluate what worked, what didn't, and capture lessons learned.

## Retrospective Template

### 1. Summary

- **Workpack**: `<WORKPACK_ID>`
- **Duration**: _start date_ → _end date_
- **Agents Used**: _list of agent providers used_
- **Total Prompts**: _N_ (A-series + B-series + R-series)
- **Status**: Complete / Partial / Abandoned

### 2. What Went Well

- _List items that worked smoothly_

### 3. What Could Be Improved

- _List items that caused friction or delays_

### 4. Protocol Observations

- Did `workpack.meta.json` and `workpack.state.json` add value?
- Was the prompt DAG respected and useful?
- Were the execution boundaries clear?
- Any suggestions for protocol improvements?

### 5. Agent Feedback

For each provider used:
- **Provider**: _name_
- **Prompts handled**: _list_
- **Quality**: _1-5 rating_
- **Strengths**: _summary_
- **Weaknesses**: _summary_

### 6. Metrics

| Metric | Value |
|--------|-------|
| Total prompts | _N_ |
| Completed on first try | _n_ |
| Required rework | _n_ |
| Blocked prompts | _n_ |
| Average prompt duration | _time_ |
| Total workpack duration | _time_ |

### 7. Action Items

| Action | Owner | Priority | Target |
|--------|-------|----------|--------|
| _improvement_ | _who_ | _P1/P2/P3_ | _when_ |

## Output

Write `outputs/R1_retrospective.json`:

```json
{
  "workpack_id": "<WORKPACK_ID>",
  "prompt_id": "R1_retrospective",
  "status": "complete",
  "summary": "Retrospective completed with N action items.",
  "metrics": {},
  "action_items": []
}
```
