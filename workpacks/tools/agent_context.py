#!/usr/bin/env python3
"""Generate structured agent context from workpack metadata and runtime state."""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


META_FILE_NAME = "workpack.meta.json"
STATE_FILE_NAME = "workpack.state.json"


class AgentContextError(ValueError):
    """Raised when agent-context input is invalid."""


def _load_json_object(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise AgentContextError(f"Missing required file: {path}")

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise AgentContextError(
            f"Malformed JSON in {path}: {exc.msg} (line {exc.lineno}, column {exc.colno})"
        ) from exc
    except OSError as exc:
        raise AgentContextError(f"Could not read {path}: {exc}") from exc

    if not isinstance(payload, dict):
        raise AgentContextError(f"{path.name} must contain a JSON object.")

    return payload


def _parse_meta_prompts(meta_payload: dict[str, Any]) -> tuple[list[str], dict[str, list[str]]]:
    prompts = meta_payload.get("prompts")
    if not isinstance(prompts, list):
        raise AgentContextError("workpack.meta.json must include a 'prompts' array.")

    prompt_order: list[str] = []
    depends_map: dict[str, list[str]] = {}
    seen_stems: set[str] = set()

    for index, prompt in enumerate(prompts):
        if not isinstance(prompt, dict):
            raise AgentContextError(f"meta.prompts[{index}] must be an object.")

        stem = prompt.get("stem")
        if not isinstance(stem, str) or not stem.strip():
            raise AgentContextError(f"meta.prompts[{index}].stem must be a non-empty string.")
        stem = stem.strip()

        if stem in seen_stems:
            raise AgentContextError(f"Duplicate prompt stem in meta.prompts: '{stem}'.")
        seen_stems.add(stem)

        depends_on = prompt.get("depends_on", [])
        if depends_on is None:
            depends_on = []
        if not isinstance(depends_on, list):
            raise AgentContextError(f"meta.prompts[{index}].depends_on must be an array.")

        normalized_deps: list[str] = []
        dedupe_guard: set[str] = set()
        for dep in depends_on:
            if not isinstance(dep, str) or not dep.strip():
                raise AgentContextError(
                    f"meta.prompts[{index}].depends_on contains an invalid dependency value."
                )
            dep = dep.strip()
            if dep == stem:
                raise AgentContextError(f"Prompt '{stem}' cannot depend on itself.")
            if dep not in dedupe_guard:
                dedupe_guard.add(dep)
                normalized_deps.append(dep)

        prompt_order.append(stem)
        depends_map[stem] = normalized_deps

    for stem, deps in depends_map.items():
        unknown = [dep for dep in deps if dep not in seen_stems]
        if unknown:
            unresolved = ", ".join(unknown)
            raise AgentContextError(
                f"Prompt '{stem}' declares unknown dependency reference(s): {unresolved}."
            )

    return prompt_order, depends_map


def _topological_order(prompt_order: list[str], depends_map: dict[str, list[str]]) -> list[str]:
    order_index = {stem: index for index, stem in enumerate(prompt_order)}
    indegree = {stem: len(depends_map.get(stem, [])) for stem in prompt_order}
    dependents: dict[str, list[str]] = defaultdict(list)

    for stem, dependencies in depends_map.items():
        for dep in dependencies:
            dependents[dep].append(stem)

    ready = sorted((stem for stem, degree in indegree.items() if degree == 0), key=order_index.__getitem__)
    topo: list[str] = []

    while ready:
        current = ready.pop(0)
        topo.append(current)

        new_ready: list[str] = []
        for dependent in dependents.get(current, []):
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                new_ready.append(dependent)

        if new_ready:
            ready.extend(new_ready)
            ready.sort(key=order_index.__getitem__)

    if len(topo) != len(prompt_order):
        cycle_nodes = [stem for stem in prompt_order if indegree.get(stem, 0) > 0]
        raise AgentContextError(
            "Circular dependency detected in prompt DAG: " + ", ".join(cycle_nodes)
        )

    return topo


def _extract_state_status_map(state_payload: dict[str, Any]) -> dict[str, str]:
    prompt_status = state_payload.get("prompt_status")
    if isinstance(prompt_status, dict):
        statuses: dict[str, str] = {}
        for stem, details in prompt_status.items():
            if not isinstance(stem, str):
                continue
            if not isinstance(details, dict):
                continue
            status = details.get("status")
            if isinstance(status, str) and status:
                statuses[stem] = status
        return statuses

    prompts = state_payload.get("prompts")
    if isinstance(prompts, list):
        statuses = {}
        for index, prompt in enumerate(prompts):
            if not isinstance(prompt, dict):
                raise AgentContextError(f"state.prompts[{index}] must be an object.")
            stem = prompt.get("stem")
            status = prompt.get("status")
            if isinstance(stem, str) and stem and isinstance(status, str) and status:
                statuses[stem] = status
        return statuses

    raise AgentContextError("workpack.state.json must include 'prompt_status' or 'prompts'.")


def generate_agent_context(workpack_dir: Path) -> dict[str, Any]:
    if not workpack_dir.exists() or not workpack_dir.is_dir():
        raise AgentContextError(f"Invalid workpack directory: {workpack_dir}")

    meta_payload = _load_json_object(workpack_dir / META_FILE_NAME)
    state_payload = _load_json_object(workpack_dir / STATE_FILE_NAME)

    prompt_order, depends_map = _parse_meta_prompts(meta_payload)
    topo_order = _topological_order(prompt_order, depends_map)
    state_status_map = _extract_state_status_map(state_payload)

    for stem in prompt_order:
        state_status_map.setdefault(stem, "pending")

    available_prompts: list[str] = []
    blocked_prompts: list[dict[str, Any]] = []
    completed_prompts: list[str] = []
    in_progress_prompts: list[str] = []
    failed_prompts: list[str] = []
    skipped_prompts: list[str] = []

    for stem in topo_order:
        status = state_status_map.get(stem, "pending")
        waiting_on = [dep for dep in depends_map.get(stem, []) if state_status_map.get(dep) != "complete"]

        if status == "complete":
            completed_prompts.append(stem)
        elif status == "in_progress":
            in_progress_prompts.append(stem)
        elif status == "failed":
            failed_prompts.append(stem)
        elif status == "skipped":
            skipped_prompts.append(stem)
        elif status == "blocked":
            blocked_prompts.append({"prompt": stem, "waiting_on": waiting_on})
        elif status == "pending":
            if waiting_on:
                blocked_prompts.append({"prompt": stem, "waiting_on": waiting_on})
            else:
                available_prompts.append(stem)
        else:
            raise AgentContextError(f"Unsupported prompt status '{status}' for '{stem}'.")

    blockers: list[str] = []
    for blocked in blocked_prompts:
        prompt = blocked["prompt"]
        waiting_on = blocked["waiting_on"]
        if waiting_on:
            blockers.append(f"{prompt} waiting on {', '.join(waiting_on)}")
        else:
            blockers.append(f"{prompt} is blocked")

    workpack_id = state_payload.get("workpack_id")
    if not isinstance(workpack_id, str) or not workpack_id:
        fallback_id = meta_payload.get("id")
        workpack_id = fallback_id if isinstance(fallback_id, str) and fallback_id else ""

    overall_status = state_payload.get("overall_status")
    if not isinstance(overall_status, str):
        overall_status = "unknown"

    return {
        "workpack_id": workpack_id,
        "overall_status": overall_status,
        "available_prompts": available_prompts,
        "blocked_prompts": blocked_prompts,
        "completed_prompts": completed_prompts,
        "in_progress_prompts": in_progress_prompts,
        "blockers": blockers,
        "next_actions": list(available_prompts),
    }


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate agent context JSON from workpack.meta.json and workpack.state.json.",
    )
    parser.add_argument(
        "--workpack",
        required=True,
        help="Path to the workpack directory containing workpack.meta.json and workpack.state.json.",
    )
    parser.add_argument(
        "--output",
        help="Optional file path. If omitted, JSON is written to stdout.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    workpack_dir = Path(args.workpack).resolve()

    try:
        context = generate_agent_context(workpack_dir)
    except AgentContextError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    rendered = json.dumps(context, indent=2)

    if args.output:
        output_path = Path(args.output).resolve()
        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(rendered + "\n", encoding="utf-8")
        except OSError as exc:
            print(f"ERROR: Could not write output file '{output_path}': {exc}", file=sys.stderr)
            return 1
    else:
        print(rendered)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
