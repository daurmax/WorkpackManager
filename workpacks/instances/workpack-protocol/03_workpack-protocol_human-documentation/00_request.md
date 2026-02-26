# Request

## Workpack Protocol Version

Workpack Protocol Version: 2.2.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `human-documentation`

Create comprehensive human-readable documentation that replaces the current hybrid style with a clear documentation hierarchy aimed at different audiences: newcomers, integrators, and operators.

Deliverables:

1. **docs/CONCEPTS.md** — explains the workpack mental model: metadata/state split, DAG-based prompt orchestration, prompt lifecycle, commit tracking, and integration gates. Uses diagrams and examples.
2. **docs/QUICKSTART.md** — a 5-minute guide to creating and executing a first workpack. Minimal prerequisites, step-by-step flow with copy-paste commands.
3. **docs/INTEGRATION.md** — comprehensive integration guide for teams adopting the protocol in existing repos. Consolidates legacy adoption guidance into a richer, scenario-based document.
4. **docs/TROUBLESHOOTING.md** — common problems, symptoms, and solutions. Organized by category (schema errors, DAG issues, state drift, tooling failures).

Constraints and notes:

- Depends on verification-hardening and project-config for referencing the new verification commands and config format.
- Remove legacy `workpacks/ADOPTION_GUIDE.md` and update references to `docs/INTEGRATION.md`.
- Primary repo: `WorkpackManager`.

Preferred Delivery Mode: `PR`
Target Base Branch: `main`

## Acceptance Criteria

- [ ] AC1: `docs/CONCEPTS.md` exists and covers meta/state split, DAG, prompt lifecycle, commit tracking, integration gates.
- [ ] AC2: `docs/CONCEPTS.md` includes at least two Mermaid diagrams.
- [ ] AC3: `docs/QUICKSTART.md` exists and covers prerequisites, scaffold, execute prompt, verify, complete flow.
- [ ] AC4: `docs/QUICKSTART.md` is completable in under 5 minutes by a developer familiar with Git.
- [ ] AC5: `docs/INTEGRATION.md` exists and covers: single-repo setup, multi-repo setup, CI integration, team workflow.
- [ ] AC6: `docs/INTEGRATION.md` references `workpack.config.json` configuration.
- [ ] AC7: `docs/TROUBLESHOOTING.md` exists with at least 10 documented problems.
- [ ] AC8: Each troubleshooting entry has: problem description, symptoms, likely cause, resolution steps.
- [ ] AC9: All docs cross-reference each other via relative links.
- [ ] AC10: Legacy `workpacks/ADOPTION_GUIDE.md` is removed and no active docs reference it.
- [ ] AC11: No broken links across documentation.
- [ ] AC12: Language level: accessible to developers without prior workpack knowledge.

## Constraints

- Documentation is descriptive, not normative (PROTOCOL_SPEC.md remains the normative source).
- No framework-specific content (keep language/tool agnostic).
- Diagrams must be text-based (Mermaid) for version control.

## Acceptance Criteria → Verification Mapping

| AC ID | Criterion | How to Verify |
|-------|-----------|---------------|
| AC1-AC2 | CONCEPTS.md | Content review + mermaid render test |
| AC3-AC4 | QUICKSTART.md | Walkthrough by naive user |
| AC5-AC6 | INTEGRATION.md | Content review + config references |
| AC7-AC8 | TROUBLESHOOTING.md | Item count + structure check |
| AC9-AC11 | Cross-references | Link checker script |
| AC10 | Legacy guide removal | file absence + reference scan |
| AC12 | Accessibility | Review by non-expert |

## Delivery Mode

- [x] PR-based (default)
- [ ] Direct push

## Scope

### In Scope

- `docs/CONCEPTS.md` — mental model and architecture
- `docs/QUICKSTART.md` — first workpack in 5 minutes
- `docs/INTEGRATION.md` — team adoption scenarios
- `docs/TROUBLESHOOTING.md` — problem/solution catalog
- Removal of legacy `workpacks/ADOPTION_GUIDE.md` and reference cleanup
- Cross-document linking

### Out of Scope

- Agent-specific documentation (handled by agent-documentation workpack)
- Protocol changes or spec rewrites
- Video or interactive tutorials
