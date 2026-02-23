# Request

## Workpack Protocol Version

Workpack Protocol Version: 2.2.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `npm-distribution`

Set up a monorepo structure and publish the workpack protocol as an npm package (`@workpack/protocol`) for easy distribution and versioning. The npm package contains protocol assets (JSON schemas, templates, agent docs) and provides an `init` command to bootstrap workpack infrastructure in any project.

Deliverables:

1. **Monorepo restructure** — organize the repo into `packages/protocol/` (npm package) and `packages/extension/` (VS Code extension scaffold), with `workpacks/` remaining at root for self-hosting.
2. **`@workpack/protocol` npm package** — contains JSON schemas, template files, agent documentation, and `workpack.config.json` schema. Published to npm with proper `exports` map.
3. **`npx @workpack/protocol init`** — CLI command that copies schemas, templates, and config scaffold into a target project's `workpacks/` directory. Configurable via flags.
4. **Extension scaffold** — basic `package.json`, activation, and Python tool integration stub under `packages/extension/`.

Constraints and notes:

- Depends on all Phase 2-3 workpacks for stable protocol artifacts to package.
- Python tools are NOT included in the npm package (they stay in `workpacks/tools/`). The npm package distributes only declarative assets.
- The npm package includes the Python tool files as assets, but does not require Node.js to run them.
- The extension scaffold is just a skeleton — full extension development is handled by the `workpack-manager` group workpacks.
- Primary repo: `WorkpackManager`.

Preferred Delivery Mode: `PR`
Target Base Branch: `main`

## Acceptance Criteria

- [ ] AC1: Monorepo root has `packages/protocol/` and `packages/extension/` directories.
- [ ] AC2: Root `package.json` (or `pnpm-workspace.yaml`) declares workspaces.
- [ ] AC3: `packages/protocol/package.json` has correct name (`@workpack/protocol`), version, `exports`, and `files` fields.
- [ ] AC4: Protocol package includes: all JSON schemas, `_template/` directory, `AGENT_RULES.md`, `AGENT_STATE_MACHINE.md`.
- [ ] AC5: Protocol package includes `workpack.config.json` JSON Schema.
- [ ] AC6: `npx @workpack/protocol init` creates a `workpacks/` directory structure in the current project.
- [ ] AC7: Init command copies schemas, templates, tool scripts, and creates starter `workpack.config.json`.
- [ ] AC8: Init command supports `--dir <path>` flag for custom workpack directory.
- [ ] AC9: Init command supports `--protocol-version <version>` flag.
- [ ] AC10: `packages/extension/package.json` exists with proper VS Code extension metadata.
- [ ] AC11: Extension scaffold has activation entry point and Python tool execution stub.
- [ ] AC12: All existing workpack instances, tests, and tools work without modification after restructure.
- [ ] AC13: README.md updated with monorepo structure overview and distribution instructions.
- [ ] AC14: `.github/workflows/` includes publish workflow for the npm package (manual trigger).

## Constraints

- No breaking changes to existing file paths referenced by tools or workpacks.
- Python tools remain in `workpacks/tools/` (no move to packages/).
- npm package must work with Node.js 18+.
- Extension scaffold is TypeScript-based.

## Acceptance Criteria → Verification Mapping

| AC ID | Criterion | How to Verify |
|-------|-----------|---------------|
| AC1-AC2 | Monorepo structure | Directory listing + workspace config |
| AC3-AC5 | Package.json correctness | `npm pack --dry-run` |
| AC6-AC9 | Init command | Integration test: run init in temp dir |
| AC10-AC11 | Extension scaffold | File existence + TypeScript compile |
| AC12 | No regressions | Full test suite + lint |
| AC13 | README | Content review |
| AC14 | Publish workflow | GitHub Actions YAML validation |

## Delivery Mode

- [x] PR-based (default)
- [ ] Direct push

## Scope

### In Scope

- Monorepo structure with workspaces
- `@workpack/protocol` npm package definition
- `init` CLI command
- Extension directory scaffold
- Publish workflow
- README updates

### Out of Scope

- Full VS Code extension implementation (workpack-manager group scope)
- Python tool packaging (pip/PyPI)
- Automated npm publishing (manual trigger only for now)
- Registry hosting or CDN distribution
