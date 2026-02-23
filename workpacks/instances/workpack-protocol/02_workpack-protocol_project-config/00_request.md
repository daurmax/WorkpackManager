# Request

## Workpack Protocol Version

Workpack Protocol Version: 2.2.0

## Original Request

Request Type: `NEW_FEATURE`
Short Slug: `project-config`

Define and implement a `workpack.config.json` project configuration file that allows each repository adopting workpacks to declare project-specific settings: workpack directory location, verification commands, protocol version policy, strict mode, and discovery settings for multi-root workspaces.

Update all Python tools (`workpack_lint.py`, `workpack_scaffold.py`, `validate_workpack_files.py`, `validate_templates.py`) to discover and respect this configuration. Enhance the discovery logic to support multi-root workspaces and non-standard workpack directory locations as declared in the config.

Constraints and notes:

- Depends on completed protocol 2.2.0 (prompt-lifecycle workpack).
- Configuration is optional: tools must keep working without `workpack.config.json` (backward compatible).
- JSON Schema for the config file must be provided.
- Primary repo: `WorkpackManager`.

Preferred Delivery Mode: `PR`
Target Base Branch: `main`

## Acceptance Criteria

- [ ] AC1: `WORKPACK_CONFIG_SCHEMA.json` exists and is valid JSON Schema.
- [ ] AC2: Config supports `workpackDir` (string, default `"workpacks"`).
- [ ] AC3: Config supports `verifyCommands` (object with fields: `build`, `test`, `lint`, each a string command).
- [ ] AC4: Config supports `protocolVersion` (string, minimum protocol version to enforce).
- [ ] AC5: Config supports `strictMode` (boolean, default `false`).
- [ ] AC6: Config supports `discovery.roots` (string array, additional scan roots for multi-root workspaces).
- [ ] AC7: Config supports `discovery.exclude` (string array, glob patterns to exclude from scanning).
- [ ] AC8: `workpack_lint.py` reads config and uses `workpackDir` for discovery.
- [ ] AC9: `workpack_lint.py` respects `strictMode` and `protocolVersion` from config.
- [ ] AC10: `workpack_scaffold.py` uses `workpackDir` from config for output location.
- [ ] AC11: `validate_workpack_files.py` uses config settings.
- [ ] AC12: Multi-root workspace discovery correctly scans `discovery.roots` paths.
- [ ] AC13: Discovery correctly excludes paths matching `discovery.exclude` patterns.
- [ ] AC14: Tools produce a clear message when config is found vs. using defaults.
- [ ] AC15: Unit tests cover config loading, default fallback, and discovery with config.

## Constraints

- Config file location: repository root (adjacent to `workpacks/` or at workspace root).
- The config file is optional — tools must operate correctly without it.
- No new Python dependencies.
- Config changes must not require modifying existing workpack instances.

## Acceptance Criteria → Verification Mapping

| AC ID | Criterion | How to Verify |
|-------|-----------|---------------|
| AC1 | Config schema valid | `validate_templates.py` extended to check config schema |
| AC2-AC7 | Config fields | Schema validation + unit tests |
| AC8-AC11 | Tool integration | Unit tests with config fixtures |
| AC12 | Multi-root discovery | Unit test with multiple root paths |
| AC13 | Exclude patterns | Unit test with glob exclusions |
| AC14 | Config detection message | Output inspection in tests |
| AC15 | Unit tests | `python -m pytest workpacks/tools/tests/ -v` |

## Delivery Mode

- [x] PR-based (default)
- [ ] Direct push

## Scope

### In Scope

- `WORKPACK_CONFIG_SCHEMA.json` with full field definitions
- Config loading utility in Python tools
- Integration of config into all four Python tools
- Multi-root workspace discovery via config
- Exclude-pattern support
- Unit tests

### Out of Scope

- VS Code extension settings integration (extension workpack scope)
- Config migration tooling (not needed, config is new)
- GUI config editor
