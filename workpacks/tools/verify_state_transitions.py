#!/usr/bin/env python3
"""Validate workpack/prompt lifecycle transitions and execution log integrity."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any


SCRIPT_WORKPACKS_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SCAN_ROOT = SCRIPT_WORKPACKS_DIR / "instances"
STATE_FILE_NAME = "workpack.state.json"

WORKPACK_TRANSITIONS: dict[str, set[str]] = {
    "not_started": {"not_started", "in_progress", "blocked", "abandoned"},
    "in_progress": {"in_progress", "blocked", "review", "complete", "abandoned"},
    "blocked": {"blocked", "in_progress", "abandoned"},
    "review": {"review", "in_progress", "complete", "abandoned"},
    "complete": {"complete"},
    "abandoned": {"abandoned"},
}

PROMPT_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"pending", "in_progress", "blocked", "skipped"},
    "in_progress": {"in_progress", "blocked", "complete"},
    "blocked": {"blocked", "in_progress", "skipped"},
    "complete": {"complete"},
    "skipped": {"skipped"},
}

TERMINAL_WORKPACK_EVENTS = {"completed", "abandoned"}
PROMPT_START_EVENTS = {"prompt_started", "blocked", "unblocked"}


def _result(
    check_id: str,
    severity: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "check_id": check_id,
        "severity": severity,
        "message": message,
        "details": details or {},
    }


def _parse_iso_timestamp(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _extract_prompt_events(execution_log: list[Any]) -> dict[str, list[tuple[int, dict[str, Any]]]]:
    events: dict[str, list[tuple[int, dict[str, Any]]]] = {}
    for index, entry in enumerate(execution_log):
        if not isinstance(entry, dict):
            continue
        prompt_stem = entry.get("prompt_stem")
        if isinstance(prompt_stem, str) and prompt_stem:
            events.setdefault(prompt_stem, []).append((index, entry))
    return events


def _has_modern_prompt_lifecycle(execution_log: list[Any]) -> bool:
    for entry in execution_log:
        if not isinstance(entry, dict):
            continue
        if entry.get("event") == "prompt_started":
            return True
    return False


def _workpack_next_state(entry: dict[str, Any], current_state: str) -> str | None:
    event = entry.get("event")
    prompt_stem = entry.get("prompt_stem")

    if event == "created":
        return current_state
    if event in {"started", "prompt_started", "prompt_completed"}:
        return "in_progress"
    if event == "blocked" and prompt_stem is None:
        return "blocked"
    if event == "unblocked" and prompt_stem is None:
        return "in_progress"
    if event == "review" and prompt_stem is None:
        return "review"
    if event == "completed" and prompt_stem is None:
        return "complete"
    if event == "abandoned" and prompt_stem is None:
        return "abandoned"
    return None


def _prompt_next_state(entry: dict[str, Any]) -> str | None:
    event = entry.get("event")
    if event == "prompt_started":
        return "in_progress"
    if event == "prompt_completed":
        return "complete"
    if event == "blocked":
        return "blocked"
    if event == "unblocked":
        return "in_progress"
    return None


def validate_workpack_transitions(state_json: dict[str, Any]) -> list[dict[str, Any]]:
    """Validate workpack lifecycle transitions against legal transition rules."""
    results: list[dict[str, Any]] = []

    overall_status = state_json.get("overall_status")
    if not isinstance(overall_status, str) or overall_status not in WORKPACK_TRANSITIONS:
        results.append(
            _result(
                "WP_STATUS_INVALID",
                "error",
                "overall_status is missing or not a recognized lifecycle state.",
                {"overall_status": overall_status},
            )
        )
        return results

    execution_log = state_json.get("execution_log")
    if not isinstance(execution_log, list):
        results.append(
            _result(
                "WP_EXEC_LOG_INVALID",
                "error",
                "execution_log must be a list to validate transitions.",
                {"execution_log_type": type(execution_log).__name__},
            )
        )
        return results

    current_state = "not_started"
    for index, entry in enumerate(execution_log):
        if not isinstance(entry, dict):
            results.append(
                _result(
                    "WP_EXEC_LOG_ENTRY_INVALID",
                    "warning",
                    "Ignoring non-object execution log entry while validating workpack transitions.",
                    {"index": index, "entry_type": type(entry).__name__},
                )
            )
            continue

        next_state = _workpack_next_state(entry, current_state)
        if next_state is None:
            continue

        allowed_next = WORKPACK_TRANSITIONS.get(current_state, set())
        if next_state not in allowed_next:
            results.append(
                _result(
                    "WP_TRANSITION_INVALID",
                    "error",
                    "Illegal workpack lifecycle transition detected.",
                    {
                        "index": index,
                        "event": entry.get("event"),
                        "from_state": current_state,
                        "to_state": next_state,
                    },
                )
            )
        current_state = next_state

    if overall_status != current_state:
        allowed_from_log_state = WORKPACK_TRANSITIONS.get(current_state, set())
        if overall_status in allowed_from_log_state:
            results.append(
                _result(
                    "WP_STATUS_LOG_GAP",
                    "warning",
                    "overall_status requires a transition not present in execution_log.",
                    {
                        "inferred_state": current_state,
                        "overall_status": overall_status,
                    },
                )
            )
        else:
            results.append(
                _result(
                    "WP_STATUS_MISMATCH",
                    "error",
                    "overall_status is inconsistent with the transition history in execution_log.",
                    {
                        "inferred_state": current_state,
                        "overall_status": overall_status,
                    },
                )
            )

    return results


def validate_prompt_transitions(state_json: dict[str, Any]) -> list[dict[str, Any]]:
    """Validate prompt lifecycle transitions against legal transition rules."""
    results: list[dict[str, Any]] = []

    prompt_status = state_json.get("prompt_status")
    if not isinstance(prompt_status, dict):
        results.append(
            _result(
                "PROMPT_STATUS_INVALID",
                "error",
                "prompt_status must be an object keyed by prompt stem.",
                {"prompt_status_type": type(prompt_status).__name__},
            )
        )
        return results

    execution_log = state_json.get("execution_log")
    if not isinstance(execution_log, list):
        results.append(
            _result(
                "PROMPT_EXEC_LOG_INVALID",
                "error",
                "execution_log must be a list to validate prompt transitions.",
                {"execution_log_type": type(execution_log).__name__},
            )
        )
        return results

    prompt_events = _extract_prompt_events(execution_log)
    modern_prompt_lifecycle = _has_modern_prompt_lifecycle(execution_log)

    for prompt_stem in sorted(prompt_events):
        if prompt_stem not in prompt_status:
            results.append(
                _result(
                    "PROMPT_EVENT_UNKNOWN_STEM",
                    "warning",
                    "execution_log contains prompt events for a stem missing from prompt_status.",
                    {"prompt_stem": prompt_stem},
                )
            )

    for prompt_stem, payload in prompt_status.items():
        status_value = payload.get("status") if isinstance(payload, dict) else None
        if not isinstance(status_value, str) or status_value not in PROMPT_TRANSITIONS:
            results.append(
                _result(
                    "PROMPT_STATUS_VALUE_INVALID",
                    "error",
                    "Prompt status must be one of the legal prompt lifecycle states.",
                    {"prompt_stem": prompt_stem, "status": status_value},
                )
            )
            continue

        stem_events = prompt_events.get(prompt_stem, [])
        current_state = "pending"
        saw_start_semantic = False

        if not stem_events and status_value == "complete":
            results.append(
                _result(
                    "PROMPT_TRANSITION_LEGACY_GAP",
                    "warning",
                    "Prompt is complete but execution_log has no per-prompt lifecycle events; strict transition checks skipped for compatibility.",
                    {"prompt_stem": prompt_stem},
                )
            )
            continue

        for index, entry in stem_events:
            event = entry.get("event")
            next_state = _prompt_next_state(entry)
            if next_state is None:
                continue

            if event in PROMPT_START_EVENTS:
                saw_start_semantic = True

            allowed_next = PROMPT_TRANSITIONS.get(current_state, set())
            if next_state not in allowed_next:
                is_legacy_complete_jump = (
                    current_state == "pending"
                    and next_state == "complete"
                    and not saw_start_semantic
                    and not modern_prompt_lifecycle
                )
                if is_legacy_complete_jump:
                    results.append(
                        _result(
                            "PROMPT_TRANSITION_LEGACY_GAP",
                            "warning",
                            "Prompt completion appears without an in_progress event; treated as legacy-compatible history.",
                            {"prompt_stem": prompt_stem, "index": index, "event": event},
                        )
                    )
                else:
                    results.append(
                        _result(
                            "PROMPT_TRANSITION_INVALID",
                            "error",
                            "Illegal prompt lifecycle transition detected.",
                            {
                                "prompt_stem": prompt_stem,
                                "index": index,
                                "event": event,
                                "from_state": current_state,
                                "to_state": next_state,
                            },
                        )
                    )
            current_state = next_state

        if status_value != current_state:
            allowed_from_log_state = PROMPT_TRANSITIONS.get(current_state, set())
            if status_value in allowed_from_log_state:
                results.append(
                    _result(
                        "PROMPT_STATUS_LOG_GAP",
                        "warning",
                        "prompt_status requires a transition not present in execution_log.",
                        {
                            "prompt_stem": prompt_stem,
                            "inferred_state": current_state,
                            "status": status_value,
                        },
                    )
                )
            else:
                is_legacy_mismatch = (
                    current_state == "pending"
                    and status_value == "complete"
                    and not modern_prompt_lifecycle
                )
                results.append(
                    _result(
                        "PROMPT_TRANSITION_LEGACY_GAP" if is_legacy_mismatch else "PROMPT_STATUS_MISMATCH",
                        "warning" if is_legacy_mismatch else "error",
                        (
                            "Prompt is complete without sufficient history for strict validation."
                            if is_legacy_mismatch
                            else "prompt_status is inconsistent with the transition history in execution_log."
                        ),
                        {
                            "prompt_stem": prompt_stem,
                            "inferred_state": current_state,
                            "status": status_value,
                        },
                    )
                )

    return results


def validate_execution_log(state_json: dict[str, Any]) -> list[dict[str, Any]]:
    """Validate execution_log timestamp, required-event, and append-only invariants."""
    results: list[dict[str, Any]] = []

    execution_log = state_json.get("execution_log")
    if not isinstance(execution_log, list):
        results.append(
            _result(
                "EXEC_LOG_INVALID",
                "error",
                "execution_log must be a list.",
                {"execution_log_type": type(execution_log).__name__},
            )
        )
        return results

    if not execution_log:
        results.append(
            _result(
                "EXEC_LOG_EMPTY",
                "warning",
                "execution_log is empty; required event checks cannot be fully enforced.",
            )
        )
        return results

    modern_prompt_lifecycle = _has_modern_prompt_lifecycle(execution_log)
    created_indexes: list[int] = []

    previous_timestamp_raw: str | None = None
    previous_timestamp: datetime | None = None

    prompt_started_count: dict[str, int] = {}
    prompt_completed_count: dict[str, int] = {}
    prompt_blocked: set[str] = set()
    workpack_blocked = False
    terminal_index: int | None = None

    for index, entry in enumerate(execution_log):
        if not isinstance(entry, dict):
            results.append(
                _result(
                    "EXEC_LOG_ENTRY_INVALID",
                    "error",
                    "execution_log entries must be objects.",
                    {"index": index, "entry_type": type(entry).__name__},
                )
            )
            continue

        event = entry.get("event")
        timestamp_raw = entry.get("timestamp")
        prompt_stem = entry.get("prompt_stem")

        if event == "created":
            created_indexes.append(index)

        if not isinstance(timestamp_raw, str):
            results.append(
                _result(
                    "EXEC_LOG_BAD_TIMESTAMP",
                    "error",
                    "Execution log entry timestamp must be an ISO-8601 string.",
                    {"index": index, "timestamp": timestamp_raw},
                )
            )
        else:
            parsed = _parse_iso_timestamp(timestamp_raw)
            if parsed is None:
                results.append(
                    _result(
                        "EXEC_LOG_BAD_TIMESTAMP",
                        "error",
                        "Execution log entry timestamp must be ISO-8601 compliant.",
                        {"index": index, "timestamp": timestamp_raw},
                    )
                )
            elif previous_timestamp is not None and parsed < previous_timestamp:
                results.append(
                    _result(
                        "EXEC_LOG_NON_MONOTONIC",
                        "error",
                        "Execution log timestamps must be monotonically non-decreasing.",
                        {
                            "index": index,
                            "timestamp": timestamp_raw,
                            "previous_timestamp": previous_timestamp_raw,
                        },
                    )
                )
                previous_timestamp = parsed
                previous_timestamp_raw = timestamp_raw
            else:
                previous_timestamp = parsed
                previous_timestamp_raw = timestamp_raw

        if terminal_index is not None:
            results.append(
                _result(
                    "EXEC_LOG_APPEND_ONLY_TERMINAL",
                    "error",
                    "No events may be appended after a terminal workpack event.",
                    {"terminal_index": terminal_index, "index": index, "event": event},
                )
            )
        if event in TERMINAL_WORKPACK_EVENTS and prompt_stem is None:
            terminal_index = index

        if event == "blocked" and prompt_stem is None:
            workpack_blocked = True
        elif event == "unblocked" and prompt_stem is None:
            if not workpack_blocked:
                results.append(
                    _result(
                        "EXEC_LOG_UNBLOCKED_WITHOUT_BLOCK",
                        "error",
                        "Workpack was unblocked without a prior blocked event.",
                        {"index": index},
                    )
                )
            workpack_blocked = False
        elif isinstance(prompt_stem, str) and prompt_stem:
            if event == "blocked":
                prompt_blocked.add(prompt_stem)
            elif event == "unblocked":
                if prompt_stem not in prompt_blocked:
                    results.append(
                        _result(
                            "EXEC_LOG_PROMPT_UNBLOCKED_WITHOUT_BLOCK",
                            "error",
                            "Prompt was unblocked without a prior blocked event.",
                            {"index": index, "prompt_stem": prompt_stem},
                        )
                    )
                prompt_blocked.discard(prompt_stem)
            elif event == "prompt_started":
                started_count = prompt_started_count.get(prompt_stem, 0)
                completed_count = prompt_completed_count.get(prompt_stem, 0)
                if started_count > completed_count:
                    results.append(
                        _result(
                            "EXEC_LOG_PROMPT_DOUBLE_START",
                            "error",
                            "Prompt started multiple times without an intervening completion.",
                            {"index": index, "prompt_stem": prompt_stem},
                        )
                    )
                prompt_started_count[prompt_stem] = started_count + 1
            elif event == "prompt_completed":
                started_count = prompt_started_count.get(prompt_stem, 0)
                completed_count = prompt_completed_count.get(prompt_stem, 0)
                if started_count <= completed_count:
                    results.append(
                        _result(
                            "EXEC_LOG_PROMPT_COMPLETE_WITHOUT_START",
                            "warning" if not modern_prompt_lifecycle else "error",
                            (
                                "Prompt completed without a recorded prompt_started event; treated as legacy-compatible history."
                                if not modern_prompt_lifecycle
                                else "Prompt completed without a matching prompt_started event."
                            ),
                            {"index": index, "prompt_stem": prompt_stem},
                        )
                    )
                prompt_completed_count[prompt_stem] = completed_count + 1

    if not created_indexes:
        results.append(
            _result(
                "EXEC_LOG_MISSING_CREATED",
                "error",
                "execution_log must include a 'created' event.",
            )
        )
    else:
        if created_indexes[0] != 0:
            results.append(
                _result(
                    "EXEC_LOG_CREATED_NOT_FIRST",
                    "error",
                    "The first execution_log entry must be the 'created' event.",
                    {"index": created_indexes[0]},
                )
            )
        if len(created_indexes) > 1:
            results.append(
                _result(
                    "EXEC_LOG_CREATED_DUPLICATE",
                    "error",
                    "execution_log must contain exactly one 'created' event.",
                    {"indexes": created_indexes},
                )
            )

    return results


def validate_state_payload(state_json: dict[str, Any]) -> list[dict[str, Any]]:
    """Run all state-transition validators against a single state payload."""
    results: list[dict[str, Any]] = []
    results.extend(validate_workpack_transitions(state_json))
    results.extend(validate_prompt_transitions(state_json))
    results.extend(validate_execution_log(state_json))
    return results


def _discover_state_files(scan_paths: list[str]) -> list[Path]:
    roots = [Path(raw).resolve() for raw in scan_paths] if scan_paths else [DEFAULT_SCAN_ROOT.resolve()]
    discovered: set[Path] = set()

    for root in roots:
        if root.is_file() and root.name == STATE_FILE_NAME:
            discovered.add(root)
            continue
        if root.is_dir():
            direct_state = root / STATE_FILE_NAME
            if direct_state.is_file():
                discovered.add(direct_state.resolve())
            for candidate in root.rglob(STATE_FILE_NAME):
                discovered.add(candidate.resolve())

    return sorted(discovered)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate workpack and prompt state transitions from workpack.state.json files.",
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="Optional file/dir scan targets. Defaults to workpacks/instances.",
    )
    args = parser.parse_args(argv)

    state_files = _discover_state_files(args.paths)
    if not state_files:
        print("No workpack.state.json files found.")
        return 1

    all_errors = 0
    all_warnings = 0

    for state_file in state_files:
        try:
            payload = json.loads(state_file.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            print(f"X [{state_file}] STATE_JSON_INVALID: {exc}")
            all_errors += 1
            continue

        if not isinstance(payload, dict):
            print(f"X [{state_file}] STATE_JSON_INVALID: payload must be a JSON object.")
            all_errors += 1
            continue

        findings = validate_state_payload(payload)
        if not findings:
            continue

        print(f"[{state_file}]")
        for finding in findings:
            marker = "X" if finding["severity"] == "error" else "!"
            print(f"  {marker} {finding['check_id']}: {finding['message']}")
            if finding["severity"] == "error":
                all_errors += 1
            else:
                all_warnings += 1

    print()
    print(f"Summary: files={len(state_files)} errors={all_errors} warnings={all_warnings}")
    if all_errors:
        return 1

    print("State transition checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
