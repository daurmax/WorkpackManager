# @workpack/protocol

Protocol distribution package for Workpack projects.

It includes:

- JSON schemas (`schemas/`)
- Template workpack scaffold (`templates/`)
- Agent documentation (`agent-docs/`)
- Python tooling scripts as distributable assets (`tools/`)
- CLI entrypoint (`workpack-init`)

## Installation

```bash
npm install @workpack/protocol
```

## Usage

Access schemas directly from package exports:

```js
import metaSchema from "@workpack/protocol/schemas/WORKPACK_META_SCHEMA";
import stateSchema from "@workpack/protocol/schemas/WORKPACK_STATE_SCHEMA";
import outputSchema from "@workpack/protocol/schemas/WORKPACK_OUTPUT_SCHEMA";
import groupSchema from "@workpack/protocol/schemas/WORKPACK_GROUP_SCHEMA";
import configSchema from "@workpack/protocol/schemas/WORKPACK_CONFIG_SCHEMA";
```

Copy template and documentation assets from:

- `@workpack/protocol/templates/*`
- `@workpack/protocol/agent-docs/*`
- `@workpack/protocol/tools/*`

## CLI

Initialize protocol assets in a repository:

```bash
npx @workpack/protocol init --dir workpacks
```

Or use the installed bin directly:

```bash
workpack-init --dir workpacks
```

## Publish Verification

Before publishing, run:

```bash
npm pack --dry-run
```

The tarball should include `schemas/`, `templates/`, `agent-docs/`, `bin/`, and `tools/`.
