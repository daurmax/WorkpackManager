"""Workpack MCP Server — read-only Model Context Protocol server.

Exposes workpack instances discovered on disk as MCP resources and tools.
Designed for stdio transport (compatible with Claude Desktop, VS Code, etc.).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    Resource,
    ResourceTemplate,
    TextContent,
    Tool,
)

from workpack_mcp.discovery import (
    WorkpackInstance,
    discover_workpacks,
    get_instance_by_id,
    resolve_next_prompts,
)

logger = logging.getLogger("workpack-mcp")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_json(obj: Any) -> str:
    """Serialize to indented JSON."""
    return json.dumps(obj, indent=2, ensure_ascii=False, default=str)


def _instance_summary(inst: WorkpackInstance) -> dict[str, Any]:
    """Build a compact summary dict for a workpack instance."""
    result: dict[str, Any] = {"folder": inst.path.name}
    if inst.meta:
        result.update({
            "id": inst.meta.id,
            "title": inst.meta.title,
            "category": inst.meta.category,
            "protocol_version": inst.meta.protocol_version,
            "prompt_count": len(inst.meta.prompts),
        })
    if inst.state:
        result.update({
            "overall_status": inst.state.overall_status,
            "last_updated": inst.state.last_updated,
        })
    return result


# ---------------------------------------------------------------------------
# Server factory
# ---------------------------------------------------------------------------


def create_server(workpacks_dir: Path) -> Server:
    """Create and configure the Workpack MCP server."""
    server = Server("workpack-mcp")

    def _discover() -> list[WorkpackInstance]:
        return discover_workpacks(workpacks_dir)

    # -- Resources -----------------------------------------------------------

    @server.list_resources()
    async def list_resources() -> list[Resource]:
        return [
            Resource(
                uri="workpack://list",
                name="All Workpacks",
                description="JSON array of all discovered workpack instances with summary info",
                mimeType="application/json",
            ),
        ]

    @server.list_resource_templates()
    async def list_resource_templates() -> list[ResourceTemplate]:
        return [
            ResourceTemplate(
                uriTemplate="workpack://{id}/meta",
                name="Workpack Metadata",
                description="Full workpack.meta.json for a specific workpack",
                mimeType="application/json",
            ),
            ResourceTemplate(
                uriTemplate="workpack://{id}/state",
                name="Workpack State",
                description="Full workpack.state.json for a specific workpack",
                mimeType="application/json",
            ),
            ResourceTemplate(
                uriTemplate="workpack://{id}/next-prompts",
                name="Next Executable Prompts",
                description="DAG-resolved prompt stems whose dependencies are satisfied",
                mimeType="application/json",
            ),
        ]

    @server.read_resource()
    async def read_resource(uri: str) -> str:
        instances = _discover()

        if uri == "workpack://list":
            summaries = [_instance_summary(inst) for inst in instances]
            return _to_json(summaries)

        # Parse workpack://<id>/<aspect>
        if not uri.startswith("workpack://"):
            raise ValueError(f"Unknown resource URI: {uri}")

        path_part = uri[len("workpack://"):]
        parts = path_part.split("/", 1)
        if len(parts) != 2:
            raise ValueError(f"Invalid resource URI format: {uri}")

        workpack_id, aspect = parts[0], parts[1]
        inst = get_instance_by_id(instances, workpack_id)
        if inst is None:
            raise ValueError(f"Workpack not found: {workpack_id}")

        if aspect == "meta":
            if inst.meta is None:
                return _to_json({"error": "No workpack.meta.json found", "workpack_id": workpack_id})
            return _to_json(inst.meta.raw)

        if aspect == "state":
            if inst.state is None:
                return _to_json({"error": "No workpack.state.json found", "workpack_id": workpack_id})
            return _to_json(inst.state.raw)

        if aspect == "next-prompts":
            prompts = resolve_next_prompts(inst)
            return _to_json({
                "workpack_id": workpack_id,
                "overall_status": inst.state.overall_status if inst.state else "unknown",
                "executable_prompts": prompts,
                "count": len(prompts),
            })

        raise ValueError(f"Unknown resource aspect: {aspect}")

    # -- Tools ---------------------------------------------------------------

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        return [
            Tool(
                name="list_workpacks",
                description="Discover and list all workpack instances with their status summary",
                inputSchema={
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
            ),
            Tool(
                name="get_workpack_detail",
                description="Retrieve full metadata and state for a specific workpack by ID",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "workpack_id": {
                            "type": "string",
                            "description": "Workpack identifier (meta ID or folder name)",
                        },
                    },
                    "required": ["workpack_id"],
                    "additionalProperties": False,
                },
            ),
            Tool(
                name="get_next_prompts",
                description=(
                    "Compute DAG-resolved prompts ready for execution. "
                    "Returns prompt stems whose depends_on are all complete/skipped "
                    "and whose own status is pending."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "workpack_id": {
                            "type": "string",
                            "description": "Workpack identifier (meta ID or folder name)",
                        },
                    },
                    "required": ["workpack_id"],
                    "additionalProperties": False,
                },
            ),
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        instances = _discover()

        if name == "list_workpacks":
            summaries = [_instance_summary(inst) for inst in instances]
            return [TextContent(type="text", text=_to_json(summaries))]

        if name == "get_workpack_detail":
            wid = arguments.get("workpack_id", "")
            inst = get_instance_by_id(instances, wid)
            if inst is None:
                return [TextContent(type="text", text=_to_json({"error": f"Workpack not found: {wid}"}))]
            detail: dict[str, Any] = {
                "folder": inst.path.name,
                "path": str(inst.path),
            }
            if inst.meta:
                detail["meta"] = inst.meta.raw
            if inst.state:
                detail["state"] = inst.state.raw
            detail["next_prompts"] = resolve_next_prompts(inst)
            return [TextContent(type="text", text=_to_json(detail))]

        if name == "get_next_prompts":
            wid = arguments.get("workpack_id", "")
            inst = get_instance_by_id(instances, wid)
            if inst is None:
                return [TextContent(type="text", text=_to_json({"error": f"Workpack not found: {wid}"}))]
            prompts = resolve_next_prompts(inst)
            result = {
                "workpack_id": wid,
                "overall_status": inst.state.overall_status if inst.state else "unknown",
                "executable_prompts": prompts,
                "count": len(prompts),
            }
            return [TextContent(type="text", text=_to_json(result))]

        return [TextContent(type="text", text=_to_json({"error": f"Unknown tool: {name}"}))]

    return server


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="workpack-mcp",
        description="Read-only MCP server for the Workpack Protocol",
    )
    parser.add_argument(
        "--workpacks-dir",
        type=Path,
        default=Path("workpacks"),
        help="Path to the workpacks directory (default: ./workpacks)",
    )
    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="WARNING",
        help="Logging level (default: WARNING)",
    )
    return parser.parse_args(argv)


async def _run(workpacks_dir: Path) -> None:
    server = create_server(workpacks_dir.resolve())
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def main(argv: list[str] | None = None) -> None:
    """CLI entry point."""
    import asyncio

    args = _parse_args(argv)
    logging.basicConfig(level=getattr(logging, args.log_level), stream=sys.stderr)
    logger.info("Starting workpack-mcp server, workpacks_dir=%s", args.workpacks_dir)
    asyncio.run(_run(args.workpacks_dir))


if __name__ == "__main__":
    main()
