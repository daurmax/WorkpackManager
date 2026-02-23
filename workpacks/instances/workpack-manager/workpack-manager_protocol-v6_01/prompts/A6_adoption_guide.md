---
depends_on: [A1_protocol_spec]
repos: [WorkpackManager]
---
# Adoption Guide Agent Prompt

> Write a step-by-step guide for integrating the workpack system into an existing project.

---

## READ FIRST

1. `workpacks/PROTOCOL_SPEC.md` (created by A1)
2. `workpacks/CHANGELOG.md`
3. `workpacks/_template/` (all files)
4. `workpacks/instances/workpack-manager_protocol-v6_01/00_request.md`

## Context

Workpack: `workpack-manager_protocol-v6_01`
This prompt produces the adoption guide that enables external projects to adopt the workpack system.

## Delivery Mode

- PR-based.

## Objective

Create `workpacks/ADOPTION_GUIDE.md` — a comprehensive, step-by-step guide for adding the workpack system to any existing Git repository. The guide must be practical and concrete, covering initial setup, first workpack creation, tooling integration, team onboarding, and common pitfalls. It should work for projects in any language or framework.

## Reference Points

- **Protocol specification**: Reference `PROTOCOL_SPEC.md` for definitive field semantics.
- **Template files**: Reference `_template/` for the scaffold starting point.
- **Reference adoption**: How workpacks were adopted in `FurlanPronunciationService` (originally from another project per the CHANGELOG).

## Implementation Requirements

- Create `workpacks/ADOPTION_GUIDE.md` with sections:
  - **Prerequisites**: What the target project needs (Git, Python for tooling, optional VS Code extension).
  - **Step 1 — Copy the workpack framework**: Which files/folders to copy into the target project.
  - **Step 2 — Configure for your project**: How to adapt templates, agent roles, and verification commands.
  - **Step 3 — Create your first workpack**: Walk through creating a workpack from template to commit.
  - **Step 4 — Run the linter**: How to validate workpack structure.
  - **Step 5 — Integrate with your workflow**: How workpacks fit into PR workflows, CI pipelines, and agent-driven development.
  - **FAQ**: Common questions and answers.
  - **What to customize vs. what to keep standard**: Guide on which parts of the protocol are conventions (customizable) vs. requirements (must keep).
- Include concrete file listings showing minimal and full adoption setups.
- Include a "Quick Start" section at the top for experienced users.

## Scope

### In Scope
- Adoption guide document
- Concrete examples and file listings
- FAQ section

### Out of Scope
- Protocol specification content (A1)
- Tooling implementation (A3, A4)
- VS Code extension docs

## Acceptance Criteria

- [ ] `ADOPTION_GUIDE.md` exists with all listed sections.
- [ ] Guide is project-agnostic (no domain-specific references).
- [ ] Quick start section allows experienced users to adopt in <30 minutes.
- [ ] Step-by-step instructions are concrete and actionable.

## Verification

```bash
test -f workpacks/ADOPTION_GUIDE.md
grep -i "quick start" workpacks/ADOPTION_GUIDE.md && echo "PASS" || echo "FAIL"
grep -ri "FurlanPronunciation" workpacks/ADOPTION_GUIDE.md && echo "FAIL: domain leak" || echo "PASS"
```

## Deliverables

- [ ] `workpacks/ADOPTION_GUIDE.md` created
- [ ] `outputs/A6_adoption_guide.json` written
- [ ] `99_status.md` updated
