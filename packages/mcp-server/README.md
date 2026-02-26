# workpack-mcp-server

Read-only [Model Context Protocol](https://modelcontextprotocol.io/) server for the **Workpack Protocol**.

Exposes workpack instances discovered on disk as MCP **resources** and provides a DAG-aware **tool** for resolving executable next-prompts.

## Resources

| URI pattern | Description |
|---|---|
| `workpack://list` | JSON array of all discovered workpack IDs with summary info |
| `workpack://{id}/meta` | Full `workpack.meta.json` for a workpack |
| `workpack://{id}/state` | Full `workpack.state.json` for a workpack |
| `workpack://{id}/next-prompts` | Prompt stems whose `depends_on` are satisfied and status is `pending` |

## Tools

| Tool | Description |
|---|---|
| `list_workpacks` | Discover and list all workpacks with status summary |
| `get_workpack_detail` | Retrieve full meta + state for a specific workpack |
| `get_next_prompts` | DAG-resolved list of prompts ready for execution |

## Quick start

```bash
# Install
pip install -e packages/mcp-server

# Run (stdio transport — compatible with Claude Desktop, VS Code, etc.)
workpack-mcp --workpacks-dir workpacks
```

### Claude Desktop configuration

```json
{
  "mcpServers": {
    "workpack": {
      "command": "workpack-mcp",
      "args": ["--workpacks-dir", "/path/to/workpacks"]
    }
  }
}
```

## Design

- **Read-only**: the server never mutates workpack files.
- **Discovery**: reuses the same `workpack.config.json` / `workpacks/instances/` discovery logic as the existing Python tooling.
- **DAG resolution**: `next-prompts` computes the frontier of executable prompts by checking `depends_on` edges against `prompt_status` in `workpack.state.json`.
