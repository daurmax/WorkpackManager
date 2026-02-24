#!/usr/bin/env python3
"""Unified workpack verification command."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Callable

import verify_commits
import verify_md_json_sync
import verify_output_artifacts
import verify_prompt_style
import verify_state_transitions


SCRIPT_WORKPACKS_DIR = Path(__file__).resolve().parents[1]
DEFAULT_INSTANCES_ROOT = SCRIPT_WORKPACKS_DIR / "instances"
REQUEST_FILE_NAME = "00_request.md"
STATE_FILE_NAME = "workpack.state.json"

CheckResult = dict[str, Any]
CategoryRunner = Callable[[Path, Path], list[CheckResult]]


def _result(
    check_id: str,
    severity: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> CheckResult:
    return {
        "check_id": check_id,
        "severity": severity,
        "message": message,
        "details": details or {},
    }


def _normalize_result(raw: Any, default_check_id: str) -> CheckResult:
    if not isinstance(raw, dict):
        return _result(
            default_check_id,
            "error",
            "Verifier returned a non-object result entry.",
            {"entry_type": type(raw).__name__},
        )

    check_id = raw.get("check_id")
    if not isinstance(check_id, str) or not check_id.strip():
        check_id = default_check_id

    severity_raw = raw.get("severity")
    severity = str(severity_raw).casefold() if severity_raw is not None else "info"
    if severity not in {"error", "warning", "info", "pass"}:
        severity = "info"

    message = raw.get("message")
    if not isinstance(message, str) or not message.strip():
        message = "No message provided by verifier."

    details = raw.get("details")
    if not isinstance(details, dict):
        details = {"value": details}

    return _result(check_id, severity, message, details)


def _load_json(path: Path) -> tuple[Any | None, str | None]:
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except json.JSONDecodeError as exc:
        return None, f"invalid JSON ({exc})"
    except OSError as exc:
        return None, str(exc)


def _run_state_checks(workpack_dir: Path, _: Path) -> list[CheckResult]:
    state_path = workpack_dir / STATE_FILE_NAME
    if not state_path.is_file():
        return [
            _result(
                "state.file_missing",
                "error",
                f"Missing {STATE_FILE_NAME}; state transition checks cannot run.",
                {"state_path": str(state_path)},
            )
        ]

    payload, error = _load_json(state_path)
    if error:
        return [
            _result(
                "state.invalid_json",
                "error",
                f"Could not parse {STATE_FILE_NAME}: {error}",
                {"state_path": str(state_path)},
            )
        ]
    if not isinstance(payload, dict):
        return [
            _result(
                "state.invalid_shape",
                "error",
                f"{STATE_FILE_NAME} must be a JSON object.",
                {"state_path": str(state_path), "payload_type": type(payload).__name__},
            )
        ]

    findings = verify_state_transitions.validate_state_payload(payload)
    return [_normalize_result(item, "state.unknown") for item in findings]


def _run_sync_checks(workpack_dir: Path, _: Path) -> list[CheckResult]:
    findings = verify_md_json_sync.run_sync_checks(
        plan_md_path=workpack_dir / "01_plan.md",
        meta_json_path=workpack_dir / "workpack.meta.json",
        status_md_path=workpack_dir / "99_status.md",
        state_json_path=workpack_dir / STATE_FILE_NAME,
    )
    return [_normalize_result(item, "sync.unknown") for item in findings]


def _run_output_checks(workpack_dir: Path, repo_root: Path) -> list[CheckResult]:
    findings = verify_output_artifacts.run_all_checks(workpack_dir, repo_root=repo_root)
    return [_normalize_result(item, "output.unknown") for item in findings]


def _run_commit_checks(workpack_dir: Path, _: Path) -> list[CheckResult]:
    work_branch = verify_commits._detect_current_branch(workpack_dir) or "HEAD"  # noqa: SLF001
    findings = verify_commits.verify_workpack(workpack_dir=workpack_dir, work_branch=work_branch)
    return [_normalize_result(item, "commits.unknown") for item in findings]


def _run_style_checks(workpack_dir: Path, _: Path) -> list[CheckResult]:
    findings = verify_prompt_style.lint_prompt_directory(workpack_dir / "prompts")
    return [_normalize_result(item, "style.unknown") for item in findings]


CATEGORY_ORDER = ["state", "sync", "output", "commits", "style"]
CATEGORY_RUNNERS: dict[str, CategoryRunner] = {
    "state": _run_state_checks,
    "sync": _run_sync_checks,
    "output": _run_output_checks,
    "commits": _run_commit_checks,
    "style": _run_style_checks,
}


def _discover_workpacks(instances_root: Path) -> list[Path]:
    if not instances_root.is_dir():
        return []
    discovered = {item.parent.resolve() for item in instances_root.rglob(REQUEST_FILE_NAME)}
    return sorted(discovered, key=lambda item: str(item).lower())


def _workpack_id(workpack_dir: Path, instances_root: Path) -> str:
    try:
        return workpack_dir.resolve().relative_to(instances_root.resolve()).as_posix()
    except ValueError:
        return workpack_dir.name


def _resolve_workpack_filter(workpack_filter: str, workpacks: list[Path], instances_root: Path) -> list[Path]:
    normalized = workpack_filter.strip().replace("\\", "/").strip("/")
    if not normalized:
        return []

    direct_matches = []
    for workpack in workpacks:
        candidate_id = _workpack_id(workpack, instances_root)
        if candidate_id == normalized or workpack.name == normalized:
            direct_matches.append(workpack)
    if direct_matches:
        return direct_matches

    as_path = Path(workpack_filter)
    if not as_path.is_absolute():
        as_path = (instances_root / workpack_filter).resolve()
    if as_path.is_dir() and (as_path / REQUEST_FILE_NAME).is_file():
        return [as_path.resolve()]

    return []


def _categories_from_args(raw_categories: list[str] | None) -> list[str]:
    if not raw_categories:
        return list(CATEGORY_ORDER)
    ordered: list[str] = []
    for category in raw_categories:
        if category not in ordered:
            ordered.append(category)
    return ordered


def _summarize(results: list[CheckResult]) -> dict[str, int]:
    return {
        "passed": sum(1 for entry in results if str(entry.get("severity", "")).casefold() == "pass"),
        "warnings": sum(1 for entry in results if str(entry.get("severity", "")).casefold() == "warning"),
        "errors": sum(1 for entry in results if str(entry.get("severity", "")).casefold() == "error"),
    }


def _run_workpack(
    workpack_dir: Path,
    instances_root: Path,
    categories: list[str],
    repo_root: Path,
) -> dict[str, Any]:
    results: list[CheckResult] = []

    for category in categories:
        runner = CATEGORY_RUNNERS[category]
        try:
            category_results = runner(workpack_dir, repo_root)
        except Exception as exc:  # noqa: BLE001
            category_results = [
                _result(
                    f"{category}.runner_exception",
                    "error",
                    "Verifier category raised an exception.",
                    {"category": category, "error": str(exc)},
                )
            ]

        if not category_results:
            category_results = []

        has_warning_or_error = any(
            str(item.get("severity", "")).casefold() in {"warning", "error"}
            for item in category_results
        )
        if not has_warning_or_error:
            category_results.append(
                _result(
                    f"{category}.passed",
                    "pass",
                    f"Category '{category}' passed.",
                    {"category": category},
                )
            )

        results.extend(_normalize_result(item, f"{category}.unknown") for item in category_results)

    summary = _summarize(results)
    return {
        "workpack_id": _workpack_id(workpack_dir, instances_root),
        "categories_run": categories,
        "results": results,
        "summary": summary,
    }


def _render_human(report_payload: dict[str, Any], strict: bool) -> str:
    lines: list[str] = []
    lines.append("Workpack Verify")
    lines.append("=" * 40)
    lines.append(f"Workpacks checked: {report_payload['summary']['workpacks']}")
    lines.append(
        "Summary: "
        f"passed={report_payload['summary']['passed']}, "
        f"warnings={report_payload['summary']['warnings']}, "
        f"errors={report_payload['summary']['errors']}"
    )
    if strict:
        lines.append("Mode: strict")
    lines.append("")

    for report in report_payload["workpacks"]:
        lines.append(f"[{report['workpack_id']}]")
        lines.append(f"  categories: {', '.join(report['categories_run'])}")
        for item in report["results"]:
            severity = str(item["severity"]).casefold()
            marker = "X" if severity == "error" else "!" if severity == "warning" else "-" if severity == "pass" else "i"
            lines.append(f"  {marker} {item['check_id']}: {item['message']}")
        lines.append(
            "  summary: "
            f"passed={report['summary']['passed']}, "
            f"warnings={report['summary']['warnings']}, "
            f"errors={report['summary']['errors']}"
        )
        lines.append("")

    return "\n".join(lines).rstrip()


def _resolve_repo_root(instances_root: Path) -> Path:
    resolved = instances_root.resolve()
    for candidate in [resolved, *resolved.parents]:
        if (candidate / "workpacks").is_dir() and (candidate / "workpacks" / "tools").is_dir():
            return candidate
    return Path(__file__).resolve().parents[2]


def _json_payload(reports: list[dict[str, Any]], summary: dict[str, int]) -> dict[str, Any] | list[dict[str, Any]]:
    if len(reports) == 1:
        return reports[0]
    return {"workpacks": reports, "summary": summary}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run unified verification checks for workpack instances.",
    )
    parser.add_argument(
        "--category",
        action="append",
        choices=CATEGORY_ORDER,
        help="Verifier category to run. Repeat to run multiple categories.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as failures (exit code 2 when warnings exist and no errors).",
    )
    parser.add_argument(
        "--json",
        dest="json_output",
        action="store_true",
        help="Emit machine-readable JSON report.",
    )
    parser.add_argument(
        "--workpack",
        help="Verify only one workpack by id, folder name, or path.",
    )
    parser.add_argument(
        "--instances-root",
        default=str(DEFAULT_INSTANCES_ROOT),
        help=argparse.SUPPRESS,
    )
    args = parser.parse_args(argv)

    instances_root = Path(args.instances_root).resolve()
    categories = _categories_from_args(args.category)
    discovered = _discover_workpacks(instances_root)
    if not discovered:
        no_workpack_payload = {
            "workpacks": [],
            "summary": {"workpacks": 0, "passed": 0, "warnings": 0, "errors": 1},
        }
        if args.json_output:
            print(json.dumps(no_workpack_payload, indent=2, ensure_ascii=True))
        else:
            print(f"ERROR: No workpacks discovered under {instances_root}.")
        return 1

    if args.workpack:
        filtered = _resolve_workpack_filter(args.workpack, discovered, instances_root)
        if not filtered:
            if args.json_output:
                print(
                    json.dumps(
                        {
                            "workpacks": [],
                            "summary": {"workpacks": 0, "passed": 0, "warnings": 0, "errors": 1},
                            "error": f"workpack filter '{args.workpack}' matched no discovered workpack.",
                        },
                        indent=2,
                        ensure_ascii=True,
                    )
                )
            else:
                print(f"ERROR: --workpack '{args.workpack}' matched no discovered workpack.")
            return 1
        target_workpacks = filtered
    else:
        target_workpacks = discovered

    repo_root = _resolve_repo_root(instances_root)
    reports = [
        _run_workpack(
            workpack_dir=workpack_dir,
            instances_root=instances_root,
            categories=categories,
            repo_root=repo_root,
        )
        for workpack_dir in target_workpacks
    ]

    summary = {
        "workpacks": len(reports),
        "passed": sum(item["summary"]["passed"] for item in reports),
        "warnings": sum(item["summary"]["warnings"] for item in reports),
        "errors": sum(item["summary"]["errors"] for item in reports),
    }
    aggregate_payload = {"workpacks": reports, "summary": summary}
    payload = _json_payload(reports, summary)

    if args.json_output:
        print(json.dumps(payload, indent=2, ensure_ascii=True))
    else:
        print(_render_human(aggregate_payload, strict=args.strict))

    if summary["errors"] > 0:
        return 1
    if args.strict and summary["warnings"] > 0:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
