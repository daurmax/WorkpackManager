#!/usr/bin/env python3
"""
verify_output_artifacts.py - Output artifact validation for workpacks.

Checks:
1. Every prompt marked `complete` in workpack.state.json has outputs/<stem>.json.
2. Every output JSON in outputs/ conforms to WORKPACK_OUTPUT_SCHEMA.json.
3. Every file declared in changes.files_created/files_modified exists on disk.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Sequence


CheckResult = dict[str, Any]
_JSONSCHEMA: Any | None = None


def ensure_jsonschema() -> Any:
    """Import jsonschema lazily."""
    global _JSONSCHEMA
    if _JSONSCHEMA is None:
        import jsonschema as _jsonschema  # type: ignore

        _JSONSCHEMA = _jsonschema
    return _JSONSCHEMA


def _result(check_id: str, severity: str, message: str, details: dict[str, Any]) -> CheckResult:
    return {
        "check_id": check_id,
        "severity": severity,
        "message": message,
        "details": details,
    }


def _load_json(path: Path) -> tuple[Any | None, str | None]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle), None
    except json.JSONDecodeError as exc:
        return None, f"is not valid JSON: {exc}"
    except OSError as exc:
        return None, f"could not be read: {exc}"


def _display_path(path: Path) -> str:
    return path.as_posix()


def _find_repo_root(start: Path) -> Path | None:
    resolved = start.resolve()
    for candidate in [resolved, *resolved.parents]:
        if (candidate / "workpacks" / "WORKPACK_OUTPUT_SCHEMA.json").is_file():
            return candidate
    return None


def _iter_output_files(workpack_dir: Path) -> list[Path]:
    outputs_dir = workpack_dir / "outputs"
    if not outputs_dir.is_dir():
        return []
    return sorted(outputs_dir.glob("*.json"))


def check_output_existence(workpack_dir: str | Path) -> list[CheckResult]:
    """Validate that every complete prompt has outputs/<prompt_stem>.json."""
    workpack_path = Path(workpack_dir).resolve()
    state_path = workpack_path / "workpack.state.json"
    outputs_dir = workpack_path / "outputs"
    results: list[CheckResult] = []

    if not state_path.exists():
        results.append(
            _result(
                "ERR_STATE_FILE_MISSING",
                "error",
                "Missing workpack.state.json; cannot validate completed prompts.",
                {"workpack_dir": _display_path(workpack_path)},
            )
        )
        return results
    if not state_path.is_file():
        results.append(
            _result(
                "ERR_STATE_JSON_INVALID",
                "error",
                "workpack.state.json could not be read: not a regular file.",
                {
                    "workpack_dir": _display_path(workpack_path),
                    "state_path": _display_path(state_path),
                },
            )
        )
        return results

    state_payload, state_error = _load_json(state_path)
    if state_error:
        results.append(
            _result(
                "ERR_STATE_JSON_INVALID",
                "error",
                f"workpack.state.json {state_error}",
                {
                    "workpack_dir": _display_path(workpack_path),
                    "state_path": _display_path(state_path),
                },
            )
        )
        return results

    if not isinstance(state_payload, dict):
        results.append(
            _result(
                "ERR_STATE_JSON_INVALID",
                "error",
                "workpack.state.json must be a JSON object.",
                {"state_path": _display_path(state_path)},
            )
        )
        return results

    prompt_status = state_payload.get("prompt_status")
    if not isinstance(prompt_status, dict):
        results.append(
            _result(
                "ERR_STATE_PROMPT_STATUS_INVALID",
                "error",
                "workpack.state.json.prompt_status must be a JSON object.",
                {"state_path": _display_path(state_path)},
            )
        )
        return results

    if not outputs_dir.is_dir():
        results.append(
            _result(
                "ERR_OUTPUTS_DIR_MISSING",
                "error",
                "Missing outputs/ directory.",
                {"outputs_dir": _display_path(outputs_dir)},
            )
        )

    for prompt_stem, prompt_info in sorted(prompt_status.items()):
        if not isinstance(prompt_stem, str) or not prompt_stem:
            continue
        if not isinstance(prompt_info, dict):
            continue
        if prompt_info.get("status") != "complete":
            continue

        output_path = outputs_dir / f"{prompt_stem}.json"
        if not output_path.is_file():
            results.append(
                _result(
                    "ERR_OUTPUT_MISSING",
                    "error",
                    f"Prompt '{prompt_stem}' is complete but output JSON is missing.",
                    {
                        "prompt": prompt_stem,
                        "expected_output": _display_path(output_path),
                    },
                )
            )

    return results


def check_output_schema(workpack_dir: str | Path) -> list[CheckResult]:
    """Validate every output JSON in outputs/ against WORKPACK_OUTPUT_SCHEMA.json."""
    workpack_path = Path(workpack_dir).resolve()
    outputs_dir = workpack_path / "outputs"
    results: list[CheckResult] = []

    repo_root = _find_repo_root(workpack_path)
    if repo_root is None:
        results.append(
            _result(
                "ERR_SCHEMA_FILE_MISSING",
                "error",
                "Could not locate repository root containing workpacks/WORKPACK_OUTPUT_SCHEMA.json.",
                {"workpack_dir": _display_path(workpack_path)},
            )
        )
        return results

    schema_path = repo_root / "workpacks" / "WORKPACK_OUTPUT_SCHEMA.json"
    if not schema_path.is_file():
        results.append(
            _result(
                "ERR_SCHEMA_FILE_MISSING",
                "error",
                "Missing WORKPACK_OUTPUT_SCHEMA.json.",
                {"schema_path": _display_path(schema_path)},
            )
        )
        return results

    schema_payload, schema_error = _load_json(schema_path)
    if schema_error:
        results.append(
            _result(
                "ERR_SCHEMA_JSON_INVALID",
                "error",
                f"WORKPACK_OUTPUT_SCHEMA.json {schema_error}",
                {"schema_path": _display_path(schema_path)},
            )
        )
        return results

    if not isinstance(schema_payload, dict):
        results.append(
            _result(
                "ERR_SCHEMA_JSON_INVALID",
                "error",
                "WORKPACK_OUTPUT_SCHEMA.json must be a JSON object.",
                {"schema_path": _display_path(schema_path)},
            )
        )
        return results

    jsonschema = ensure_jsonschema()
    try:
        jsonschema.Draft202012Validator.check_schema(schema_payload)
    except Exception as exc:  # noqa: BLE001
        results.append(
            _result(
                "ERR_SCHEMA_INVALID",
                "error",
                f"WORKPACK_OUTPUT_SCHEMA.json is not a valid JSON schema: {exc}",
                {"schema_path": _display_path(schema_path)},
            )
        )
        return results

    if not outputs_dir.is_dir():
        results.append(
            _result(
                "ERR_OUTPUTS_DIR_MISSING",
                "error",
                "Missing outputs/ directory.",
                {"outputs_dir": _display_path(outputs_dir)},
            )
        )
        return results

    validator = jsonschema.Draft202012Validator(schema_payload)
    for output_path in _iter_output_files(workpack_path):
        output_payload, output_error = _load_json(output_path)
        if output_error:
            results.append(
                _result(
                    "ERR_OUTPUT_JSON_INVALID",
                    "error",
                    f"{output_path.name} {output_error}",
                    {"output_path": _display_path(output_path)},
                )
            )
            continue

        if not isinstance(output_payload, dict):
            results.append(
                _result(
                    "ERR_OUTPUT_NOT_OBJECT",
                    "error",
                    f"{output_path.name} must be a JSON object.",
                    {"output_path": _display_path(output_path)},
                )
            )
            continue

        first_error = next(validator.iter_errors(output_payload), None)
        if first_error is not None:
            json_path = "/".join(str(segment) for segment in first_error.absolute_path) or "$"
            schema_error_path = "/".join(str(segment) for segment in first_error.absolute_schema_path) or "$"
            results.append(
                _result(
                    "WARN_SCHEMA_MISMATCH",
                    "warning",
                    f"{output_path.name} does not match WORKPACK_OUTPUT_SCHEMA.json: {first_error.message}",
                    {
                        "output_path": _display_path(output_path),
                        "json_path": json_path,
                        "schema_path": schema_error_path,
                    },
                )
            )

    return results


def check_declared_files(workpack_dir: str | Path, repo_root: str | Path) -> list[CheckResult]:
    """Validate that files declared in changes.files_created/files_modified exist."""
    workpack_path = Path(workpack_dir).resolve()
    repo_root_path = Path(repo_root).resolve()
    outputs_dir = workpack_path / "outputs"
    results: list[CheckResult] = []

    if not repo_root_path.is_dir():
        results.append(
            _result(
                "ERR_REPO_ROOT_INVALID",
                "error",
                "Repository root path does not exist or is not a directory.",
                {"repo_root": _display_path(repo_root_path)},
            )
        )
        return results

    if not outputs_dir.is_dir():
        results.append(
            _result(
                "ERR_OUTPUTS_DIR_MISSING",
                "error",
                "Missing outputs/ directory.",
                {"outputs_dir": _display_path(outputs_dir)},
            )
        )
        return results

    for output_path in _iter_output_files(workpack_path):
        output_payload, output_error = _load_json(output_path)
        if output_error:
            results.append(
                _result(
                    "ERR_OUTPUT_JSON_INVALID",
                    "error",
                    f"{output_path.name} {output_error}",
                    {"output_path": _display_path(output_path)},
                )
            )
            continue

        if not isinstance(output_payload, dict):
            results.append(
                _result(
                    "ERR_OUTPUT_NOT_OBJECT",
                    "error",
                    f"{output_path.name} must be a JSON object.",
                    {"output_path": _display_path(output_path)},
                )
            )
            continue

        prompt = output_payload.get("prompt")
        prompt_stem = prompt if isinstance(prompt, str) and prompt else output_path.stem
        changes = output_payload.get("changes")
        if not isinstance(changes, dict):
            continue

        for field_name in ("files_created", "files_modified"):
            declared_files = changes.get(field_name)
            if not isinstance(declared_files, list):
                continue

            for declared_file in declared_files:
                if not isinstance(declared_file, str) or not declared_file.strip():
                    continue

                absolute_path = (repo_root_path / declared_file).resolve()
                try:
                    absolute_path.relative_to(repo_root_path)
                except ValueError:
                    results.append(
                        _result(
                            "ERR_DECLARED_FILE_OUTSIDE_REPO",
                            "error",
                            (
                                f"Output '{output_path.name}' declares '{declared_file}' in "
                                f"changes.{field_name}, but it resolves outside repo root."
                            ),
                            {
                                "prompt": prompt_stem,
                                "declared_file": declared_file,
                                "field": field_name,
                                "repo_root": _display_path(repo_root_path),
                            },
                        )
                    )
                    continue

                if not absolute_path.exists():
                    results.append(
                        _result(
                            "ERR_DECLARED_FILE_MISSING",
                            "error",
                            (
                                f"Output '{output_path.name}' declares missing file "
                                f"'{declared_file}' in changes.{field_name}."
                            ),
                            {
                                "prompt": prompt_stem,
                                "declared_file": declared_file,
                                "field": field_name,
                                "expected_path": _display_path(absolute_path),
                            },
                        )
                    )

    return results


def run_all_checks(workpack_dir: str | Path, repo_root: str | Path | None = None) -> list[CheckResult]:
    """Run existence, schema, and declared-file checks for a workpack."""
    workpack_path = Path(workpack_dir).resolve()
    results: list[CheckResult] = []

    results.extend(check_output_existence(workpack_path))
    results.extend(check_output_schema(workpack_path))

    resolved_repo_root: Path | None
    if repo_root is None:
        resolved_repo_root = _find_repo_root(workpack_path)
    else:
        resolved_repo_root = Path(repo_root).resolve()

    if resolved_repo_root is None:
        results.append(
            _result(
                "ERR_REPO_ROOT_NOT_FOUND",
                "error",
                "Could not determine repository root for declared file checks.",
                {"workpack_dir": _display_path(workpack_path)},
            )
        )
    else:
        results.extend(check_declared_files(workpack_path, resolved_repo_root))

    return results


def _discover_workpacks(repo_root: Path) -> list[Path]:
    instances_dir = repo_root / "workpacks" / "instances"
    if not instances_dir.is_dir():
        return []
    return sorted({state_path.parent for state_path in instances_dir.rglob("workpack.state.json")})


def _summarize(results: list[CheckResult]) -> dict[str, int]:
    error_count = sum(1 for entry in results if entry.get("severity") == "error")
    warning_count = sum(1 for entry in results if entry.get("severity") == "warning")
    return {
        "errors": error_count,
        "warnings": warning_count,
        "total": len(results),
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate workpack output artifacts (existence, schema, declared files).",
    )
    parser.add_argument(
        "workpack_dir",
        nargs="?",
        help="Path to a single workpack directory. If omitted, validates all discovered workpacks.",
    )
    parser.add_argument(
        "--repo-root",
        help="Explicit repository root (defaults to script-based auto-detection).",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as failures (exit code 2).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON output.",
    )
    args = parser.parse_args(argv)

    default_repo_root = Path(__file__).resolve().parents[2]
    repo_root = Path(args.repo_root).resolve() if args.repo_root else default_repo_root

    if args.workpack_dir:
        target_workpacks = [Path(args.workpack_dir).resolve()]
    else:
        target_workpacks = _discover_workpacks(repo_root)
        if not target_workpacks:
            payload = {
                "repo_root": _display_path(repo_root),
                "results": [],
                "summary": {"errors": 1, "warnings": 0, "total": 1},
            }
            if args.json:
                print(json.dumps(payload, indent=2))
            else:
                print("ERROR: No workpacks found under workpacks/instances.")
            return 1

    all_results: list[CheckResult] = []
    per_workpack: list[dict[str, Any]] = []
    for workpack in target_workpacks:
        workpack_results = run_all_checks(workpack, repo_root=repo_root)
        all_results.extend(workpack_results)
        per_workpack.append(
            {
                "workpack_dir": _display_path(workpack),
                "results": workpack_results,
                "summary": _summarize(workpack_results),
            }
        )

    summary = _summarize(all_results)
    output_payload = {
        "repo_root": _display_path(repo_root),
        "workpacks": per_workpack,
        "summary": summary,
    }

    if args.json:
        print(json.dumps(output_payload, indent=2))
    else:
        print("Output Artifact Validator")
        print("=" * 40)
        print(f"Repo root: {_display_path(repo_root)}")
        print(f"Workpacks checked: {len(target_workpacks)}")
        print()
        for entry in per_workpack:
            print(f"- {entry['workpack_dir']}")
            if not entry["results"]:
                print("  OK: no issues")
                continue
            for result in entry["results"]:
                severity = str(result["severity"]).upper()
                print(f"  {severity} {result['check_id']}: {result['message']}")
        print()
        print(
            f"Summary: total={summary['total']}, warnings={summary['warnings']}, errors={summary['errors']}"
        )

    if summary["errors"] > 0:
        return 1
    if args.strict and summary["warnings"] > 0:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
