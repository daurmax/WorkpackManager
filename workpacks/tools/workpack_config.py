#!/usr/bin/env python3
"""Shared optional workpack.config.json discovery and validation."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


CONFIG_FILE_NAME = "workpack.config.json"
DEFAULT_WORKPACK_DIR = "workpacks"
CONFIG_SCHEMA_FILE_NAME = "WORKPACK_CONFIG_SCHEMA.json"


class WorkpackConfigError(RuntimeError):
    """Raised when workpack.config.json exists but cannot be loaded/validated."""


@dataclass(frozen=True)
class LoadedWorkpackConfig:
    """Resolved project configuration consumed by tooling scripts."""

    config_path: Path | None
    workpack_dir_value: str
    workpacks_dir: Path
    strict_mode: bool
    protocol_version: str | None
    protocol_version_internal: int | None
    verify_commands: dict[str, str]
    discovery_roots: list[str]
    discovery_exclude: list[str]

    @property
    def has_config(self) -> bool:
        return self.config_path is not None


def semver_to_internal(version: str) -> int | None:
    """Convert semver protocol version into internal ordinal used by tooling."""
    normalized = version.strip()
    if not normalized:
        return None

    core = normalized.split("+", 1)[0].split("-", 1)[0]
    parts = core.split(".")
    if len(parts) != 3:
        return None

    try:
        major = int(parts[0])
        minor = int(parts[1])
    except ValueError:
        return None

    if major == 1:
        return 1 + minor
    if major == 2:
        return 6 + minor
    return major * 3 + minor


def _find_default_workpacks_dir(start_dir: Path, script_workpacks_dir: Path | None) -> Path:
    if script_workpacks_dir is not None:
        resolved_script_workpacks = script_workpacks_dir.resolve()
        if resolved_script_workpacks.exists():
            return resolved_script_workpacks

    for parent in [start_dir] + list(start_dir.parents):
        candidate = parent / DEFAULT_WORKPACK_DIR
        if candidate.exists():
            return candidate.resolve()

    raise FileNotFoundError("Could not find workpacks directory")


def _resolve_workspace_root(start_dir: Path, workspace_root: Path | None) -> Path | None:
    if workspace_root is None:
        return None
    resolved_root = workspace_root.resolve()
    if resolved_root == start_dir or resolved_root in start_dir.parents:
        return resolved_root
    return None


def _find_project_config(start_dir: Path, workspace_root: Path | None) -> Path | None:
    stop_dir = _resolve_workspace_root(start_dir, workspace_root)

    current = start_dir
    while True:
        candidate = current / CONFIG_FILE_NAME
        if candidate.is_file():
            return candidate.resolve()

        if stop_dir is not None and current == stop_dir:
            return None
        if current.parent == current:
            return None
        current = current.parent


def _load_jsonschema() -> Any:
    try:
        import jsonschema  # type: ignore
    except ImportError as exc:
        raise WorkpackConfigError(
            "jsonschema is required to validate workpack.config.json; install jsonschema>=4,<5."
        ) from exc
    return jsonschema


def _load_json_file(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise WorkpackConfigError(f"Invalid JSON in {path}: {exc}") from exc
    except OSError as exc:
        raise WorkpackConfigError(f"Could not read {path}: {exc}") from exc


def load_tool_config(
    *,
    start_dir: Path | None = None,
    workspace_root: Path | None = None,
    script_workpacks_dir: Path | None = None,
    schema_path: Path | None = None,
) -> LoadedWorkpackConfig:
    """Load optional workpack.config.json and resolve tool runtime defaults."""
    resolved_start_dir = (start_dir or Path.cwd()).resolve()
    resolved_script_workpacks = script_workpacks_dir.resolve() if script_workpacks_dir else None

    config_path = _find_project_config(resolved_start_dir, workspace_root)
    if config_path is None:
        workpacks_dir = _find_default_workpacks_dir(resolved_start_dir, resolved_script_workpacks)
        return LoadedWorkpackConfig(
            config_path=None,
            workpack_dir_value=DEFAULT_WORKPACK_DIR,
            workpacks_dir=workpacks_dir,
            strict_mode=False,
            protocol_version=None,
            protocol_version_internal=None,
            verify_commands={},
            discovery_roots=[],
            discovery_exclude=[],
        )

    resolved_schema_path = schema_path
    if resolved_schema_path is None and resolved_script_workpacks is not None:
        resolved_schema_path = resolved_script_workpacks / CONFIG_SCHEMA_FILE_NAME
    if resolved_schema_path is None:
        raise WorkpackConfigError("Config schema path is not configured for this tool.")
    resolved_schema_path = resolved_schema_path.resolve()
    if not resolved_schema_path.is_file():
        raise WorkpackConfigError(f"Config schema not found: {resolved_schema_path}")

    config_payload = _load_json_file(config_path)
    if not isinstance(config_payload, dict):
        raise WorkpackConfigError(f"{config_path} must be a JSON object.")

    schema_payload = _load_json_file(resolved_schema_path)
    if not isinstance(schema_payload, dict):
        raise WorkpackConfigError(f"{resolved_schema_path} must be a JSON object.")

    jsonschema = _load_jsonschema()
    try:
        jsonschema.Draft202012Validator.check_schema(schema_payload)
        jsonschema.validate(config_payload, schema_payload)
    except Exception as exc:  # noqa: BLE001
        raise WorkpackConfigError(
            f"Config validation failed for {config_path} against {resolved_schema_path}: {exc}"
        ) from exc

    workpack_dir_value = config_payload.get("workpackDir", DEFAULT_WORKPACK_DIR)
    strict_mode = bool(config_payload.get("strictMode", False))
    protocol_version = config_payload.get("protocolVersion")
    protocol_internal = semver_to_internal(protocol_version) if isinstance(protocol_version, str) else None

    verify_commands_raw = config_payload.get("verifyCommands") or {}
    verify_commands = dict(verify_commands_raw) if isinstance(verify_commands_raw, dict) else {}

    discovery_raw = config_payload.get("discovery") or {}
    discovery_roots = []
    discovery_exclude = []
    if isinstance(discovery_raw, dict):
        roots_raw = discovery_raw.get("roots") or []
        exclude_raw = discovery_raw.get("exclude") or []
        discovery_roots = [item for item in roots_raw if isinstance(item, str)]
        discovery_exclude = [item for item in exclude_raw if isinstance(item, str)]

    config_base_dir = config_path.parent
    raw_workpack_dir_path = Path(workpack_dir_value)
    if raw_workpack_dir_path.is_absolute():
        workpacks_dir = raw_workpack_dir_path.resolve()
    else:
        workpacks_dir = (config_base_dir / raw_workpack_dir_path).resolve()

    return LoadedWorkpackConfig(
        config_path=config_path,
        workpack_dir_value=workpack_dir_value,
        workpacks_dir=workpacks_dir,
        strict_mode=strict_mode,
        protocol_version=protocol_version if isinstance(protocol_version, str) else None,
        protocol_version_internal=protocol_internal,
        verify_commands=verify_commands,
        discovery_roots=discovery_roots,
        discovery_exclude=discovery_exclude,
    )


def render_config_message(config: LoadedWorkpackConfig) -> str:
    """Return user-visible message describing config resolution."""
    if config.has_config:
        verify_keys = ", ".join(sorted(config.verify_commands.keys())) if config.verify_commands else "none"
        protocol_value = config.protocol_version if config.protocol_version else "none"
        return (
            f"Config found: {config.config_path} | "
            f"workpackDir='{config.workpack_dir_value}' -> {config.workpacks_dir} | "
            f"strictMode={str(config.strict_mode).lower()} | "
            f"protocolVersion={protocol_value} | "
            f"verifyCommands={verify_keys}"
        )

    return (
        f"Config not found: {CONFIG_FILE_NAME}; using defaults "
        f"(workpackDir='{DEFAULT_WORKPACK_DIR}', strictMode=false) -> {config.workpacks_dir}"
    )
