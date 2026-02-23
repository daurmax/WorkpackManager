---
depends_on: [A1_data_models]
repos: [WorkpackManager]
---
# Parser/Indexer Agent Prompt

> Implement workpack discovery, parsing, and indexing with meta.json primary path and markdown fallback for v5 workpacks.

---

## READ FIRST

1. `src/models/` (all type files from A1)
2. `workpacks/WORKPACK_META_SCHEMA.json`
3. `workpacks/WORKPACK_STATE_SCHEMA.json`
4. `workpacks/instances/02_workpack-manager_core-architecture/00_request.md`
5. Sample workpack instances in `workpacks/instances/`

## Context

Workpack: `02_workpack-manager_core-architecture`
This prompt implements the filesystem-level discovery and parsing of workpack instances.

## Delivery Mode

- PR-based.

## Objective

Implement a workpack parser/indexer that discovers workpack folders in the filesystem, reads their metadata and state, and produces `WorkpackInstance` objects. The parser must support two paths: (1) primary path reading `workpack.meta.json` for Protocol v6 workpacks, and (2) fallback path parsing `00_request.md` and `01_plan.md` for Protocol v5 workpacks. Discovery must work across multi-root VS Code workspaces and support manual registration of additional workpack folders.

## Reference Points

- **WorkpackInstance model**: Defined in `src/models/workpack-instance.ts` (from A1).
- **Workpack folder naming**: standalone `<slug>` or grouped `<NN>_<group-id>_<slug>` pattern from protocol. Groups contain a `group.meta.json` with the execution DAG.
- **VS Code workspace API**: Use `vscode.workspace.workspaceFolders` for multi-root support.
- **FileSystemWatcher**: Use `vscode.workspace.createFileSystemWatcher` for change detection.

## Implementation Requirements

- Create `src/parser/workpack-parser.ts`:
  - `parseWorkpackMeta(folderPath: string): Promise<WorkpackMeta | null>` — reads and validates `workpack.meta.json`.
  - `parseWorkpackState(folderPath: string): Promise<WorkpackState | null>` — reads `workpack.state.json`.
  - `parseWorkpackMarkdownFallback(folderPath: string): Promise<Partial<WorkpackMeta>>` — extracts metadata from `00_request.md` (protocol version, delivery mode) and `01_plan.md` (prompts, DAG).
  - `parseWorkpackInstance(folderPath: string): Promise<WorkpackInstance>` — orchestrates meta + state + fallback.
- Create `src/parser/workpack-discoverer.ts`:
  - `discoverWorkpacks(workspaceFolders: string[]): Promise<WorkpackInstance[]>` — scans `workpacks/instances/` in each folder.
  - `isWorkpackFolder(path: string): boolean` — validates folder name pattern.
  - Support for manual folder registration (maintain a list of additional paths).
- Create `src/parser/workpack-watcher.ts`:
  - File system watcher for workpack folder changes (add/remove/modify).
  - Debounced re-indexing on changes.
- Handle errors gracefully: missing files, malformed JSON, invalid markdown. Log warnings; never crash.

## Subagent Strategy

- Subagent 1: Implement `workpack-parser.ts` (meta.json + markdown fallback).
- Subagent 2: Implement `workpack-discoverer.ts` (filesystem scanning + registration).
- Subagent 3: Implement `workpack-watcher.ts` (file system change detection).

## Scope

### In Scope
- Parser for meta.json and state.json
- Markdown fallback parser for v5
- Multi-root discovery
- Manual registration
- File watcher for change detection
- Unit tests with fixtures

### Out of Scope
- UI rendering (WP03)
- Agent integration (WP02)
- Status reconciliation logic (A3 — this prompt only reads raw state)

## Acceptance Criteria

- [ ] Parser correctly reads v6 workpacks with meta.json.
- [ ] Parser falls back to markdown for v5 workpacks.
- [ ] Discovery finds workpacks in multiple workspace folders.
- [ ] Manual registration adds custom paths.
- [ ] Malformed files produce warnings, not crashes.
- [ ] Unit tests cover happy path and error scenarios.

## Verification

```bash
npm test -- --grep "parser"
npx tsc --noEmit
```

## Deliverables

- [ ] `src/parser/*.ts` files created
- [ ] Unit tests in `src/test/parser/`
- [ ] `outputs/A2_parser_indexer.json` written
- [ ] `99_status.md` updated
