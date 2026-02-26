"""Workpack discovery and data loading.

Discovers workpack instances on disk, parses their meta/state JSON files,
and provides DAG-resolution logic for next-prompt computation.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


REQUEST_FILE = "00_request.md"
META_FILE = "workpack.meta.json"
STATE_FILE = "workpack.state.json"


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PromptMeta:
    """Single prompt entry from workpack.meta.json prompts[]."""

    stem: str
    agent_role: str
    depends_on: list[str] = field(default_factory=list)
    repos: list[str] = field(default_factory=list)
    estimated_effort: str | None = None


@dataclass(frozen=True)
class WorkpackMeta:
    """Parsed workpack.meta.json."""

    id: str
    title: str
    summary: str
    protocol_version: str
    workpack_version: str
    category: str
    created_at: str
    prompts: list[PromptMeta] = field(default_factory=list)
    requires_workpack: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    owners: list[str] = field(default_factory=list)
    repos: list[str] = field(default_factory=list)
    delivery_mode: str = "pr"
    target_branch: str = "main"
    group: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class PromptState:
    """Single prompt runtime state from workpack.state.json prompt_status."""

    status: str
    assigned_agent: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    output_validated: bool = False
    blocked_reason: str | None = None


@dataclass(frozen=True)
class WorkpackState:
    """Parsed workpack.state.json."""

    workpack_id: str
    overall_status: str
    last_updated: str
    prompt_status: dict[str, PromptState] = field(default_factory=dict)
    blocked_by: list[str] = field(default_factory=list)
    notes: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class WorkpackInstance:
    """A fully resolved workpack instance with meta, state, and disk path."""

    path: Path
    meta: WorkpackMeta | None = None
    state: WorkpackState | None = None


# ---------------------------------------------------------------------------
# JSON parsing helpers
# ---------------------------------------------------------------------------


def _load_json(path: Path) -> dict[str, Any] | None:
    """Load a JSON file; return None if missing or unparseable."""
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _parse_prompt_meta(raw: dict[str, Any]) -> PromptMeta:
    return PromptMeta(
        stem=raw.get("stem", ""),
        agent_role=raw.get("agent_role", ""),
        depends_on=raw.get("depends_on", []),
        repos=raw.get("repos", []),
        estimated_effort=raw.get("estimated_effort"),
    )


def _parse_meta(raw: dict[str, Any]) -> WorkpackMeta:
    prompts = [_parse_prompt_meta(p) for p in raw.get("prompts", []) if isinstance(p, dict)]
    return WorkpackMeta(
        id=raw.get("id", ""),
        title=raw.get("title", ""),
        summary=raw.get("summary", ""),
        protocol_version=raw.get("protocol_version", ""),
        workpack_version=raw.get("workpack_version", ""),
        category=raw.get("category", ""),
        created_at=raw.get("created_at", ""),
        prompts=prompts,
        requires_workpack=raw.get("requires_workpack", []),
        tags=raw.get("tags", []),
        owners=raw.get("owners", []),
        repos=raw.get("repos", []),
        delivery_mode=raw.get("delivery_mode", "pr"),
        target_branch=raw.get("target_branch", "main"),
        group=raw.get("group"),
        raw=raw,
    )


def _parse_prompt_state(raw: dict[str, Any]) -> PromptState:
    return PromptState(
        status=raw.get("status", "pending"),
        assigned_agent=raw.get("assigned_agent"),
        started_at=raw.get("started_at"),
        completed_at=raw.get("completed_at"),
        output_validated=raw.get("output_validated", False),
        blocked_reason=raw.get("blocked_reason"),
    )


def _parse_state(raw: dict[str, Any]) -> WorkpackState:
    prompt_status_raw = raw.get("prompt_status", {})
    prompt_status = {
        stem: _parse_prompt_state(ps)
        for stem, ps in prompt_status_raw.items()
        if isinstance(ps, dict)
    }
    return WorkpackState(
        workpack_id=raw.get("workpack_id", ""),
        overall_status=raw.get("overall_status", "not_started"),
        last_updated=raw.get("last_updated", ""),
        prompt_status=prompt_status,
        blocked_by=raw.get("blocked_by", []),
        notes=raw.get("notes"),
        raw=raw,
    )


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


def _is_workpack_dir(path: Path) -> bool:
    """Check if a directory looks like a workpack instance."""
    return (path / REQUEST_FILE).is_file() or (path / META_FILE).is_file()


def discover_workpacks(workpacks_dir: Path) -> list[WorkpackInstance]:
    """Discover all workpack instances under a workpacks directory.

    Scans ``instances/`` (if present) and the top-level directory.
    Skips directories starting with ``_`` or ``.``.
    """
    if not workpacks_dir.is_dir():
        return []

    instances: dict[str, WorkpackInstance] = {}

    def _scan(root: Path) -> None:
        if not root.is_dir():
            return
        for child in sorted(root.iterdir()):
            if not child.is_dir():
                continue
            if child.name.startswith("_") or child.name.startswith("."):
                continue

            if _is_workpack_dir(child):
                inst = _load_instance(child)
                key = str(child.resolve())
                instances[key] = inst
            else:
                # Might be a group directory — scan one level deeper
                for grandchild in sorted(child.iterdir()):
                    if not grandchild.is_dir():
                        continue
                    if grandchild.name.startswith("_") or grandchild.name.startswith("."):
                        continue
                    if _is_workpack_dir(grandchild):
                        inst = _load_instance(grandchild)
                        key = str(grandchild.resolve())
                        instances[key] = inst

    # Prefer instances/ subdirectory
    instances_dir = workpacks_dir / "instances"
    if instances_dir.is_dir():
        _scan(instances_dir)

    # Also scan top-level (for flat layouts)
    _scan(workpacks_dir)

    return sorted(instances.values(), key=lambda i: (i.meta.id if i.meta else i.path.name))


def _load_instance(path: Path) -> WorkpackInstance:
    """Load a single workpack instance from disk."""
    meta_raw = _load_json(path / META_FILE)
    state_raw = _load_json(path / STATE_FILE)
    return WorkpackInstance(
        path=path,
        meta=_parse_meta(meta_raw) if meta_raw else None,
        state=_parse_state(state_raw) if state_raw else None,
    )


# ---------------------------------------------------------------------------
# DAG resolution — next-prompts
# ---------------------------------------------------------------------------


def resolve_next_prompts(instance: WorkpackInstance) -> list[dict[str, Any]]:
    """Compute prompts whose dependencies are satisfied and status is pending.

    A prompt is *executable* when:
    1. Its status in ``workpack.state.json`` is ``pending`` (or absent — treated as pending).
    2. All stems listed in ``depends_on`` have status ``complete`` or ``skipped``.

    Returns a list of dicts with ``stem``, ``agent_role``, ``estimated_effort``,
    and ``depends_on`` for each executable prompt.
    """
    if not instance.meta:
        return []

    prompt_statuses: dict[str, str] = {}
    if instance.state:
        prompt_statuses = {stem: ps.status for stem, ps in instance.state.prompt_status.items()}

    completed_stems: set[str] = {
        stem for stem, status in prompt_statuses.items() if status in ("complete", "skipped")
    }

    executable: list[dict[str, Any]] = []
    for prompt in instance.meta.prompts:
        current_status = prompt_statuses.get(prompt.stem, "pending")
        if current_status != "pending":
            continue
        if all(dep in completed_stems for dep in prompt.depends_on):
            executable.append({
                "stem": prompt.stem,
                "agent_role": prompt.agent_role,
                "estimated_effort": prompt.estimated_effort,
                "depends_on": prompt.depends_on,
            })

    return executable


def get_instance_by_id(
    instances: list[WorkpackInstance], workpack_id: str
) -> WorkpackInstance | None:
    """Find a workpack instance by its meta ID or folder name."""
    for inst in instances:
        if inst.meta and inst.meta.id == workpack_id:
            return inst
        if inst.path.name == workpack_id:
            return inst
    return None
