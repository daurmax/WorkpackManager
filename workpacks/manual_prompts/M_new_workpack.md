# Manual Prompt - Create New Workpack

Use this prompt to create a new workpack instance from scratch, including request, plan, scaffolded prompts, metadata, and state.

## Fill Before Running

- Group id (optional): `<group-id or leave empty for standalone>`
- Workpack slug: `<short-descriptive-slug>`
- Phase number (if grouped): `<NN, e.g. 01>`
- Category: `<feature|refactor|bugfix|hotfix|debug|docs|perf|security>`
- Title: `<human-readable title>`
- Summary: `<one paragraph describing the work>`
- Repositories: `[<REPO_NAME>]`
- Delivery mode: `<pr|direct_push>`
- Target branch: `<main or custom>`
- Owners: `[<owner1>, <owner2>]`
- Tags: `[<tag1>, <tag2>]`
- Acceptance criteria: `<numbered list>`
- Prompt tasks (WBS): `<numbered list with stem, depends_on, effort>`
- Cross-workpack dependencies: `[<workpack-id> or empty]`
- Additional context/constraints: `<optional>`

## Prompt To Run

---
repos: [<REPO_NAME>]
---
# Create New Workpack

Create a new workpack instance for `<workpack-slug>`.

## Required Inputs

- Group id: `<group-id or empty>`
- Workpack slug: `<workpack-slug>`
- Phase number: `<NN or empty>`
- Category: `<category>`
- Title: `<title>`
- Summary: `<summary>`
- Repositories: `[<REPO_NAME>]`
- Delivery mode: `<pr|direct_push>`
- Target branch: `<target-branch>`
- Owners: `[<owners>]`
- Tags: `[<tags>]`

## Acceptance Criteria

<paste acceptance criteria here>

## Work Breakdown Structure

| # | Task | Agent Prompt | Depends On | Estimated Effort |
|---|------|--------------|------------|------------------|
| 1 | Bootstrap | A0_bootstrap | - | XS |
<add rows>

## Required Actions

1. **Determine instance folder name and path:**
   - Standalone: `workpacks/instances/<workpack-slug>/`
   - Grouped: `workpacks/instances/<group-id>/<NN>_<group-id>_<workpack-slug>/`
   - If a group is used and `group.meta.json` / `GROUP.md` do not exist yet, create them.

2. **Copy template:**
   ```bash
   cp -r workpacks/_template workpacks/instances/<path>
   ```

3. **Fill `00_request.md`:**
   - Set `Workpack Protocol Version: 2.2.0`.
   - Paste the original request, acceptance criteria, constraints, scope, and delivery mode.
   - Fill the `Acceptance Criteria → Verification Mapping` table.

4. **Fill `01_plan.md`:**
   - Write the Summary section.
   - Fill WBS, DAG Dependencies, Parallelization Map, and Branch Strategy tables.
   - Define B-series DAG section (leave placeholder if not yet needed).

5. **Run the scaffolder** to generate prompts, meta, and state from the plan:
   ```bash
   python workpacks/tools/workpack_scaffold.py workpacks/instances/<path>
   ```
   The scaffolder automatically runs file completeness validation after generation.

6. **Review and refine generated files:**
   - `workpack.meta.json`: verify `id`, `group`, `title`, `summary`, `repos`, `owners`, `tags`, `prompts[]`.
   - `workpack.state.json`: verify `workpack_id`, `prompt_status` entries.
   - `prompts/*.md`: fill objectives, implementation requirements, acceptance criteria in each prompt.
   - `99_status.md`: update the progress table.

7. **Run verification tools:**
   ```bash
   python workpacks/tools/workpack_lint.py
   python workpacks/tools/validate_workpack_files.py workpacks/instances/<path>
   python workpacks/tools/validate_templates.py
   ```

8. **Commit:**
   ```bash
   git checkout -b feature/<workpack-slug>
   git add workpacks/
   git commit -m "chore(workpacks): scaffold <workpack-slug>"
   ```

## Verification Commands

```bash
python workpacks/tools/workpack_lint.py
python workpacks/tools/validate_workpack_files.py
python workpacks/tools/validate_templates.py
```

## Deliverables

- [ ] Workpack instance folder with all required files
- [ ] `00_request.md` with acceptance criteria and verification mapping
- [ ] `01_plan.md` with WBS, DAG, parallelization map
- [ ] `workpack.meta.json` with full prompt index
- [ ] `workpack.state.json` initialized
- [ ] `99_status.md` with initial progress table
- [ ] Prompt files under `prompts/` with YAML front-matter
- [ ] `outputs/` directory created
- [ ] Linter and file validator pass with 0 errors
