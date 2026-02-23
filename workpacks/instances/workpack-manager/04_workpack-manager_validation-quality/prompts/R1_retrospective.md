---
prompt_id: R1_retrospective
workpack: 04_workpack-manager_validation-quality
agent_role: Retrospective reviewer
depends_on:
  - A6_integration_meta
repos:
  - WorkpackManager
estimated_effort: S
---

# R1 – Retrospective: Validation & Quality

## Objective

Post-merge retrospective for the validation and quality workpack.

## Retrospective Template

### 1. Summary

- **Workpack**: `04_workpack-manager_validation-quality`
- **Duration**: _start date_ → _end date_
- **Agents Used**: _list of agents_
- **Total Prompts**: 8 (A0–A6 + R1)
- **Status**: Complete / Partial / Abandoned

### 2. What Went Well

- _List items_

### 3. What Could Be Improved

- _List items_

### 4. Quality Observations

- Did the linter catch real issues?
- Was drift detection useful?
- Did the migration tool handle all v5 edge cases?
- Are the coverage thresholds appropriate?

### 5. Project-Wide Retrospective

Since this is the final workpack, include a project-wide retrospective:

- Review the overall workpack protocol v6 experience.
- How well did the dependency graph work across workpacks?
- Were the workpack boundaries appropriate?
- Recommendations for future multi-workpack initiatives.

### 6. Metrics

| Metric | Value |
|--------|-------|
| Total prompts | 8 |
| Completed on first try | _n_ |
| Required rework | _n_ |
| Average prompt duration | _time_ |
| Overall test coverage | _percentage_ |
| Workpack lint issues found | _n_ |
| Drift issues found | _n_ |

### 7. Action Items

| Action | Owner | Priority | Target |
|--------|-------|----------|--------|
| _improvement_ | _who_ | _P1/P2/P3_ | _when_ |

## Output

Write `outputs/R1_retrospective.json`.
