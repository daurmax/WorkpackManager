# @workpack/protocol

Protocol distribution package for Workpack projects.

It includes:

- JSON schemas (`schemas/`)
- Template workpack scaffold (`templates/`)
- Agent documentation (`agent-docs/`)
- Python tooling scripts as distributable assets (`tools/`)

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

The package reserves `workpack-init` as a CLI entrypoint. The full implementation is completed in prompt `A3_init_command`.
