# WorkpackManager

A VS Code extension for managing **workpacks** (discovery, status, assignment, UI) and a **reusable workpack framework** (protocol, templates, tooling, schemas) that can be adopted in any project.

## What This Repository Contains

### 1. VS Code Extension (`src/`)

A VS Code extension that provides:

- **Discovery**: Automatic and manual detection of workpack folders across workspace projects
- **Status tracking**: Real-time status reconciliation between declared metadata and filesystem artifacts
- **Agent integration**: Assignment of AI agents (Copilot, Codex, extensible) to workpack prompts
- **UX**: Tree view, detail panels, commands, filtering, and status visualization
- **Dependency awareness**: Cross-workpack and intra-workpack dependency graph handling

### 2. Reusable Workpack Framework (`workpacks/`)

A protocol specification and toolkit for structured AI-agent-driven development:

- **Protocol specification**: Workpack Protocol v6 (extends v5 with `workpack.meta.json`)
- **Templates**: Ready-to-copy workpack scaffolds
- **Schemas**: JSON Schema for metadata, runtime state, and agent output validation
- **Tooling**: Linter, scaffolder, and validation tools
- **Adoption guide**: Instructions for integrating workpacks into external projects

## Project Status

This project is bootstrapped via workpacks. See `workpacks/instances/` for the implementation plan.

## Workpack Protocol v6 — Key Improvements

### Metadata/State Split

Protocol v6 introduces **`workpack.meta.json`** — a machine-readable metadata file for each workpack instance — and **`workpack.state.json`** for runtime state. This separates stable metadata from mutable execution state, enabling tooling (like this extension) to index, filter, and orchestrate workpacks without parsing markdown.

### Workpack Groups

Workpacks can be organized into **groups** inside `instances/`. A group is a directory containing related workpacks together with:

- **`group.meta.json`** — formal execution DAG with phases (parallel/serial), directed edges, and workpack inventory.
- **`GROUP.md`** — human-readable companion with dependency graph, phase plan, and rationale.

### Naming Convention

- **Standalone workpacks**: `<slug>` (e.g., `my-feature`)
- **Grouped workpacks**: `<NN>_<group-id>_<slug>` (e.g., `02_workpack-manager_core-architecture`), where `NN` is the two-digit execution phase number. Workpacks sharing the same `NN` can run in parallel.

See `workpacks/WORKPACK_META_SCHEMA.json`, `workpacks/WORKPACK_STATE_SCHEMA.json`, and `workpacks/WORKPACK_GROUP_SCHEMA.json` for the schemas.

## Getting Started

```bash
# Clone the repo
git clone <repo-url> WorkpackManager
cd WorkpackManager

# Install extension dependencies (when extension scaffold exists)
npm install

# Run workpack linter
python workpacks/tools/workpack_lint.py
```

## License

TBD
