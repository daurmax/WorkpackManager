# Prompt Style Guide — Protocol v6

## File Naming

Prompt files follow the pattern: `<PREFIX><NUMBER>_<slug>.md`

| Prefix | Series | Purpose |
|--------|--------|---------|
| `A0` | Bootstrap | Branch setup, prerequisites, scaffolding |
| `A1`–`A4` | Implementation | Core deliverables (one per WBS task) |
| `A5` | Integration meta | V1 verification gate (or `A6` if more implementation prompts exist) |
| `B1`–`B9` | Bug fix | Reactive fixes discovered during execution |
| `V1`–`V9` | Verification | Bug-fix verification (paired with B-series) |
| `R1` | Retrospective | Post-merge review |

## YAML Front-Matter

Every prompt file begins with YAML front-matter:

```yaml
---
prompt_id: A1_slug_name
workpack: 2026-MM-DD_category_short-slug
agent_role: Brief description of agent's role
depends_on:
  - A0_bootstrap
repos:
  - RepoName
estimated_effort: M
---
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `prompt_id` | string | Must match filename stem |
| `workpack` | string | Parent workpack ID |
| `agent_role` | string | What this agent does |
| `depends_on` | string[] | Prompt stems this depends on |
| `repos` | string[] | Repositories this prompt touches |
| `estimated_effort` | enum | `XS` (<30m), `S` (30m-2h), `M` (2h-4h), `L` (4h-8h), `XL` (>8h) |

## Prompt Structure

### Required Sections

1. **Title** — `# <PREFIX> – <Descriptive Title>`
2. **Objective** — What the agent must accomplish.
3. **Deliverables** — Concrete artifacts (code, config, docs).
4. **Constraints** — Boundaries the agent must respect.
5. **Output** — Output JSON specification per `WORKPACK_OUTPUT_SCHEMA.json`.
6. **Gate** — Checklist of conditions that must be true when done.

### Optional Sections

- **Background** — Context or rationale.
- **Pre-Conditions** — What must be true before starting.
- **Implementation Requirements** — Detailed tables of approach per concern.
- **Unit Tests** — Test specifications.

## Writing Style

- **Imperative mood**: "Implement X", "Create Y", "Verify Z".
- **Specific over vague**: Include file paths, function signatures, type names.
- **Code blocks**: Use fenced code blocks with language tags.
- **Tables**: Use for structured data (requirements, mappings, checklists).
- **No prose padding**: Every sentence should convey information.

## Gate Checklist Convention

Use markdown task lists:

```markdown
## Gate

- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Unit tests pass.
- [ ] No secrets in source code.
```

## Output JSON Convention

Every prompt produces an output JSON file in `outputs/`:

```json
{
  "workpack_id": "<WORKPACK_ID>",
  "prompt_id": "<PROMPT_STEM>",
  "status": "complete",
  "summary": "Brief description of what was done.",
  "files_changed": ["path/to/file1", "path/to/file2"]
}
```

## Cross-References

- Reference other prompts: `A1_slug_name`.
- Reference other workpacks: `2026-MM-DD_category_slug`.
- Reference schema files: `WORKPACK_META_SCHEMA.json`.

## Effort Estimation

| Level | Duration | Example |
|-------|----------|---------|
| XS | <30 minutes | Branch creation, stub files |
| S | 30 min – 2 hours | Single function, config file |
| M | 2 – 4 hours | Module implementation with tests |
| L | 4 – 8 hours | Complex module, multiple files |
| XL | >8 hours | Large subsystem, integration work |
