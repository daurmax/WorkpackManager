# Workpack Integration Guide

This guide shows how to adopt the Workpack Protocol in an existing repository or across multiple repositories.

Use this guide for implementation patterns. For protocol rules, use [PROTOCOL_SPEC.md](../workpacks/PROTOCOL_SPEC.md). For onboarding basics, start with [CONCEPTS.md](./CONCEPTS.md) and [QUICKSTART.md](./QUICKSTART.md).

## Overview

Audience:
- Engineering teams integrating workpacks into an established repository.
- Tech leads defining team workflow, review gates, and CI checks.
- Platform teams coordinating multi-repo adoption.

Outcomes in this guide:
- Practical setup patterns for single-repo and multi-repo adoption.
- CI and pre-commit verification examples.
- Team-role conventions for human requester and AI executor collaboration.
- A reference for `workpack.config.json` and its schema contract.

## Scenario 1: Single-Repo Setup

When to choose this scenario:
- You are introducing workpacks to one repository.
- One team owns both the code and the workpack workflow.

### Target layout

```text
<repo-root>/
  src/
  workpack.config.json
  workpacks/
    PROTOCOL_SPEC.md
    WORKPACK_META_SCHEMA.json
    WORKPACK_STATE_SCHEMA.json
    WORKPACK_OUTPUT_SCHEMA.json
    WORKPACK_CONFIG_SCHEMA.json
    WORKPACK_GROUP_SCHEMA.json
    _template/
    tools/
    instances/
      <workpack-id>/
        00_request.md
        01_plan.md
        99_status.md
        workpack.meta.json
        workpack.state.json
        prompts/
        outputs/
```

### Initial `workpack.config.json`

`workpack.config.json` is optional, but adding it early keeps local and CI behavior consistent.

```json
{
  "workpackDir": "workpacks",
  "protocolVersion": "3.0.0",
  "strictMode": true,
  "verifyCommands": {
    "build": "npm run build",
    "test": "npm test",
    "lint": "npm run lint"
  }
}
```

### First workpack flow

1. Scaffold or copy `_template/` into `workpacks/instances/<workpack-id>/`.
2. Fill `00_request.md` and `01_plan.md`.
3. Ensure prompt front-matter declares `depends_on` and `repos`.
4. Execute prompts and write one output JSON per completed prompt in `outputs/`.
5. Keep `workpack.state.json` and `99_status.md` synchronized after every prompt.
6. Run verification:

```bash
python workpacks/tools/workpack_lint.py --strict
python workpacks/tools/validate_workpack_files.py --strict
```

## Scenario 2: Multi-Repo Setup

When to choose this scenario:
- Multiple repositories are changed by the same initiative.
- You need consistent schemas, validation, and prompt conventions across repos.

### Example topology

```text
<org-root>/
  protocol-foundation/
    workpacks/
      PROTOCOL_SPEC.md
      WORKPACK_*_SCHEMA.json
  service-api/
    workpack.config.json
    workpacks/
      instances/
        01_api-auth-hardening/
  service-web/
    workpack.config.json
    workpacks/
      instances/
        01_web-auth-hardening/
  platform-rollout/
    workpacks/
      instances/
        auth-rollout/
          group.meta.json
          GROUP.md
```

### Cross-repo prompt references

Use `repos` in prompt front-matter and metadata to make repository impact explicit.

```yaml
---
depends_on: [A1_contract_changes]
repos: [service-api, service-web]
---
```

In `workpack.meta.json`, keep `repos` aligned with the repositories that the prompt touches.

### Shared schema strategy

- Pin schema files from one source of truth (for example `protocol-foundation/workpacks/`).
- Keep each repo's `WORKPACK_*_SCHEMA.json` in sync during upgrades.
- Use group metadata (`group.meta.json`) validated by [WORKPACK_GROUP_SCHEMA.json](../workpacks/WORKPACK_GROUP_SCHEMA.json) for multi-workpack orchestration.

## Scenario 3: CI Integration

When to choose this scenario:
- You want merge gates to enforce protocol health automatically.
- You need repeatable validation for every pull request.

### GitHub Actions example

Create `.github/workflows/workpack-verify.yml`:

```yaml
name: Workpack Verify

on:
  pull_request:
    paths:
      - "workpacks/**"
      - "docs/**"
      - "workpack.config.json"

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Protocol validation
        run: |
          python workpacks/tools/validate_templates.py
          python workpacks/tools/workpack_lint.py --strict
          python workpacks/tools/validate_workpack_files.py --strict

      - name: Run configured project checks
        run: |
          python - <<'PY'
          import json
          import subprocess
          from pathlib import Path

          cfg_path = Path("workpack.config.json")
          if not cfg_path.exists():
              raise SystemExit(0)

          cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
          commands = cfg.get("verifyCommands", {})
          for key in ("build", "test", "lint"):
              cmd = commands.get(key)
              if cmd:
                  print(f"[verifyCommands.{key}] {cmd}")
                  subprocess.run(cmd, shell=True, check=True)
          PY
```

### Pre-commit hook example

Create `.githooks/pre-commit` (or `.git/hooks/pre-commit`):

```bash
#!/usr/bin/env bash
set -euo pipefail

changed_files="$(git diff --cached --name-only)"
if echo "$changed_files" | grep -Eq "^(workpacks/|docs/)"; then
  python workpacks/tools/workpack_lint.py
  python workpacks/tools/validate_workpack_files.py
fi
```

## Scenario 4: Team Workflow

When to choose this scenario:
- You need clear ownership across request, implementation, and verification.
- Multiple agents or engineers execute prompts in parallel.

### Role model

| Role | Responsibility | Primary files |
|---|---|---|
| Human requester | Defines scope and acceptance criteria | `00_request.md` |
| AI agent executor | Implements one prompt at a time and writes output evidence | `prompts/*.md`, `outputs/*.json` |
| Verifier/reviewer | Runs gate checks and validates evidence quality | `V1_*`, CI logs, PR review |
| Workpack owner | Maintains plan/state integrity and merge readiness | `01_plan.md`, `workpack.meta.json`, `workpack.state.json`, `99_status.md` |

### PR conventions

- Branch naming: `feature/<workpack-slug>`.
- Commit format: `<type>(<workpack-slug>/<prompt-stem>): <summary>`.
- One prompt completion requires:
  - implementation changes (if needed),
  - `outputs/<PROMPT>.json`,
  - synced `workpack.state.json` and `99_status.md`.
- `V1_integration_meta` is the merge gate for acceptance criteria and artifact integrity.

### Assignment example

| Prompt | Owner | Parallelizable |
|---|---|---|
| `A1_concepts_guide` | Agent A | Yes (after `A0`) |
| `A2_quickstart_guide` | Agent B | Yes (after `A0`) |
| `A3_integration_guide` | Agent A | No (`depends_on: [A1]`) |
| `A4_troubleshooting_guide` | Agent B | No (`depends_on: [A1]`) |
| `V1_integration_meta` | Reviewer | No (waits for A2/A3/A4) |

## Configuration Reference (`workpack.config.json`)

Schema source:
- [WORKPACK_CONFIG_SCHEMA.json](../workpacks/WORKPACK_CONFIG_SCHEMA.json)
- Introduced by workpack `02_workpack-protocol_project-config`

Location:
- Place `workpack.config.json` at repository root.
- The file is optional; tooling falls back to defaults when absent.

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `workpackDir` | string | No | Relative path to workpack root. Default: `"workpacks"`. |
| `verifyCommands.build` | string | No | Build command used by verification tooling. |
| `verifyCommands.test` | string | No | Test command used by verification tooling. |
| `verifyCommands.lint` | string | No | Lint command used by verification tooling. |
| `protocolVersion` | string (semver) | No | Repository policy for protocol version compatibility. |
| `strictMode` | boolean | No | Enables stricter validation behavior. Default: `false`. |
| `discovery.roots` | string[] | No | Additional roots for multi-root workpack discovery. |
| `discovery.exclude` | string[] | No | Glob patterns excluded from discovery scans. |
| `executionEnvironment.sandbox` | enum | No | Sandbox mode: `"none"`, `"container"`, `"vm"`, `"nsjail"`. Default: `"none"`. |
| `executionEnvironment.networkAccess` | boolean | No | Whether agents may access the network. Default: `true`. |
| `executionEnvironment.maxConcurrentAgents` | integer | No | Max concurrent agent executions. Default: `1`. |
| `executionEnvironment.timeoutSeconds` | integer | No | Wall-clock timeout per prompt execution (0 = unlimited). Default: `0`. |
| `executionEnvironment.allowedCommands` | string[] | No | Allowlist of shell commands agents may execute (empty = unrestricted). |
| `executionEnvironment.deniedPaths` | string[] | No | Glob patterns for filesystem paths agents must not access. |

### Full example

```json
{
  "workpackDir": "workpacks",
  "protocolVersion": "3.0.0",
  "strictMode": true,
  "verifyCommands": {
    "build": "npm run build",
    "test": "npm test",
    "lint": "npm run lint"
  },
  "discovery": {
    "roots": ["../shared-workpacks", "../platform-workpacks"],
    "exclude": ["**/node_modules/**", "**/.git/**", "**/archive/**"]
  },
  "executionEnvironment": {
    "sandbox": "container",
    "networkAccess": false,
    "maxConcurrentAgents": 2,
    "timeoutSeconds": 600,
    "allowedCommands": ["npm", "node", "python", "git"],
    "deniedPaths": ["**/.env", "**/secrets/**"]
  }
}
```

## Related Documentation

- [CONCEPTS.md](./CONCEPTS.md)
- [QUICKSTART.md](./QUICKSTART.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [PROTOCOL_SPEC.md](../workpacks/PROTOCOL_SPEC.md)
