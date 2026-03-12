# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Pixel Office Lobby — a main hub panel (`Workpack: Open Pixel Lobby` command) that shows all discovered workpacks as room doors, grouped by their `group` field.
- Inline settings editor in the Lobby for configuring Codex API key, base URL, model, and Copilot max prompt tokens, persisted directly to VS Code settings.

### Fixed

- Hover preview no longer disappears when moving the cursor over the desk overlay.
- Assign agent no longer errors when the provider in the state file is unknown.
- Workpack status no longer shows UNKNOWN when `completed_at` is missing from the state file.
- Codex provider is now hidden from the desk assignment menu when no API key is configured.

## [0.0.2] - 2026-03-10

### Added

- Live runtime prompt status overlays in the main Workpacks tree.
- Dedicated Active Agents view for currently running prompts.
- Direct prompt controls from the extension UI for stop, retry, and human-input submission.
- Detail panel actions for stopping and retrying prompts.

### Changed

- Context menus now react to prompt runtime state so only relevant actions are shown.
- Local VSIX builds now surface a distinct extension version for install/test cycles.

## [0.0.1] - 2026-03-05

### Added

- Initial Workpack Manager VS Code extension with workpack tree view and command suite.
- Agent assignment and prompt execution orchestration for workpack prompt DAGs.
- Workpack protocol assets, schemas, templates, and tooling in the `workpacks/` directory.

[Unreleased]: https://github.com/daurmax/WorkpackManager/compare/v0.0.2...HEAD
[0.0.2]: https://github.com/daurmax/WorkpackManager/releases/tag/v0.0.2
[0.0.1]: https://github.com/daurmax/WorkpackManager/releases/tag/v0.0.1
