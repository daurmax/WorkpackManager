# Workpack Memory — Knowledge Base

This directory stores structured lessons learned from completed workpack retrospectives.

## Purpose

The memory system captures reusable patterns, anti-patterns, estimation insights,
and process improvements discovered during workpack execution. Future workpacks
can reference these entries via the `lessons_from` field in `workpack.meta.json`.

## Structure

```text
workpacks/memory/
  README.md           # this file
  entries.jsonl       # append-only JSONL file, one memory entry per line
```

Each line in `entries.jsonl` conforms to `WORKPACK_MEMORY_SCHEMA.json`.

## How Entries Are Created

1. **Automatic extraction** — run `python workpacks/tools/workpack_memory.py extract <workpack-id>`
   after a workpack reaches `complete` status. The tool scans `99_status.md`
   retrospective sections and `execution_log` for patterns.

2. **Manual entry** — append a JSON object to `entries.jsonl` following the schema.

## How Entries Are Consumed

- **`lessons_from`** — when `workpack.meta.json.lessons_from` lists a workpack ID,
  tooling can surface relevant memory entries to the agent before execution begins.
- **Agent context** — the MCP server can expose a `workpack://memory/search` resource
  to query entries by category, tags, or source workpack.
- **Retrospective reports** — `workpack_memory.py report` generates a summary of all entries.

## Schema

See [`WORKPACK_MEMORY_SCHEMA.json`](../WORKPACK_MEMORY_SCHEMA.json) for the full field reference.

## Categories

| Category | Description |
|---|---|
| `pattern` | Reusable positive practice worth repeating. |
| `anti-pattern` | Approach that caused problems and should be avoided. |
| `tooling` | Insight about tooling setup, configuration, or limitations. |
| `estimation` | Lesson about effort estimation accuracy. |
| `dependency` | Insight about cross-workpack or external dependencies. |
| `process` | Workflow or process improvement. |
| `architecture` | Architectural decision or trade-off. |
| `testing` | Testing strategy insight. |
