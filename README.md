# Workpack Manager

[![CI](https://github.com/daurmax/WorkpackManager/actions/workflows/ci.yml/badge.svg)](https://github.com/daurmax/WorkpackManager/actions/workflows/ci.yml)
[![Workpack Verify](https://github.com/daurmax/WorkpackManager/actions/workflows/workpack-verify.yml/badge.svg)](https://github.com/daurmax/WorkpackManager/actions/workflows/workpack-verify.yml)
[![Publish Protocol](https://github.com/daurmax/WorkpackManager/actions/workflows/publish-protocol.yml/badge.svg)](https://github.com/daurmax/WorkpackManager/actions/workflows/publish-protocol.yml)

Workpack Manager is a VS Code extension for discovering, planning, and executing workpacks with dependency-aware prompt orchestration.

## Features

- Workpack discovery across workspace folders with automatic tree refresh.
- Prompt DAG visibility with ready/blocked/completed status tracking.
- Agent assignment and execution flows for Codex and Copilot providers.
- One-click prompt actions: open request/plan/status/details, lint, execute one, execute all.
- Integrated execution output channel with progress and per-prompt summaries.
- Protocol-first repository support with schemas, templates, and tooling in `workpacks/`.

## Quick Start

1. Install the extension from the VS Code Marketplace.
2. Open a repository containing `workpacks/instances/...`.
3. Open the `Workpacks` view in Explorer.
4. Run `Workpack: Create New` (or `Workpack: Scaffold from Template`) to create a workpack.
5. Assign an agent to a prompt, then run `Workpack: Execute Prompt` or `Workpack: Execute All Ready Prompts`.

Manual pre-release install from VSIX:

```bash
npm install
npm run package:vsix
code --install-extension workpack-manager-0.0.1.vsix
```

## Commands

| Command Palette Title | Command ID | Purpose |
| --- | --- | --- |
| Workpack: Create New | `workpackManager.createWorkpack` | Create and scaffold a new workpack instance. |
| Workpack: Scaffold from Template | `workpackManager.scaffoldFromTemplate` | Alias for workpack scaffolding flow. |
| Workpack: Lint | `workpackManager.lintWorkpack` | Run workpack lint diagnostics and linter script. |
| Workpack: Open Request | `workpackManager.openRequest` | Open `00_request.md`. |
| Workpack: Open Plan | `workpackManager.openPlan` | Open `01_plan.md`. |
| Workpack: Open Status | `workpackManager.openStatus` | Open `99_status.md`. |
| Workpack: View Details | `workpackManager.viewDetails` | Open `workpack.meta.json`. |
| Workpack: Assign Agent | `workpackManager.assignAgent` | Assign an available provider to a prompt. |
| Workpack: Execute Prompt | `workpackManager.executePrompt` | Execute one selected prompt. |
| Workpack: Execute All Ready Prompts | `workpackManager.executeAll` | Execute all ready prompts with dependency checks. |
| Workpack: Refresh | `workpackManager.refreshTree` | Refresh the Workpacks tree view. |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `workpackManager.autoDiscovery` | `true` | Automatically scan workspace folders for workpacks. |
| `workpackManager.codex.baseUrl` | `https://api.openai.com/v1` | Base URL for Codex-compatible APIs. |
| `workpackManager.codex.model` | `gpt-4o` | Model identifier used by the Codex provider. |
| `workpackManager.codex.maxResponseTokens` | `4096` | Maximum completion tokens for Codex responses. |
| `workpackManager.copilot.maxPromptTokens` | `8192` | Maximum prompt tokens for Copilot requests. |

## Contributing

1. Fork and clone the repository.
2. Install dependencies with `npm install`.
3. Validate changes locally:

```bash
npm run build
npm run lint
npm test
python workpacks/tools/workpack_lint.py
```

4. Open a pull request against `master`.

## Repository Layout

```text
.
├── src/            # VS Code extension source
├── packages/
│   ├── protocol/   # npm package: @workpack/protocol
│   └── mcp-server/ # MCP server package
├── workpacks/      # protocol assets, templates, tools, and instances
└── docs/           # protocol and integration guides
```

## License

MIT
