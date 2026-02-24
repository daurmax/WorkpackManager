#!/usr/bin/env python3
"""
verify_md_json_sync.py - Markdown/JSON synchronization checker.

Detects synchronization drift between:
- 01_plan.md WBS table and workpack.meta.json prompts[]
- 99_status.md completion checkboxes and workpack.state.json prompt_status
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


PROMPT_STEM_RE = re.compile(r"[A-Z][A-Za-z0-9]*(?:_[A-Za-z0-9][A-Za-z0-9_]*)+")
STATUS_STEM_RE = re.compile(r"\b([ABVR]\d+(?:_[A-Za-z0-9][A-Za-z0-9_]*)?)\b")
SEPARATOR_CELL_RE = re.compile(r"^:?-{3,}:?$")


@dataclass(frozen=True)
class PlanRow:
    row_number: int
    stem: str
    depends_raw: str
    line_number: int


def _result(check_id: str, severity: str, message: str, details: Any | None = None) -> dict[str, Any]:
    return {
        "check_id": check_id,
        "severity": severity,
        "message": message,
        "details": details if details is not None else {},
    }


def _normalize_stem(raw: str) -> str:
    text = raw.strip().strip("`")
    if not text:
        return ""
    if "/" in text or "\\" in text or text.endswith(".md"):
        text = Path(text).stem
    return text


def _parse_table_cells(line: str) -> list[str]:
    trimmed = line.strip()
    if not trimmed.startswith("|"):
        return []
    return [cell.strip() for cell in trimmed.strip("|").split("|")]


def _is_separator_row(cells: list[str]) -> bool:
    if not cells:
        return False
    return all(SEPARATOR_CELL_RE.match(cell.replace(" ", "")) for cell in cells)


def _read_text(path: Path) -> tuple[str | None, dict[str, Any] | None]:
    if not path.exists():
        return None, _result(
            "file.missing",
            "warning",
            f"File not found: {path}",
            {"path": str(path)},
        )
    try:
        return path.read_text(encoding="utf-8"), None
    except OSError as exc:
        return None, _result(
            "file.read_error",
            "error",
            f"Could not read file: {path}",
            {"path": str(path), "error": str(exc)},
        )


def _load_json(path: Path) -> tuple[Any | None, dict[str, Any] | None]:
    content, read_issue = _read_text(path)
    if read_issue:
        return None, read_issue
    assert content is not None
    try:
        return json.loads(content), None
    except json.JSONDecodeError as exc:
        return None, _result(
            "file.invalid_json",
            "error",
            f"Invalid JSON in {path}",
            {"path": str(path), "error": str(exc)},
        )


def _parse_wbs_rows(plan_markdown: str) -> tuple[list[PlanRow], list[dict[str, Any]]]:
    findings: list[dict[str, Any]] = []
    rows: list[PlanRow] = []
    lines = plan_markdown.splitlines()

    header_index: int | None = None
    header_cells: list[str] = []
    for index, line in enumerate(lines):
        cells = _parse_table_cells(line)
        if not cells:
            continue
        normalized = [re.sub(r"\s+", " ", cell.strip().lower()) for cell in cells]
        if "#" in normalized and "agent prompt" in normalized and "depends on" in normalized:
            header_index = index
            header_cells = normalized
            break

    if header_index is None:
        findings.append(
            _result(
                "plan_meta.wbs_table_missing",
                "warning",
                "Could not find WBS table header in plan markdown.",
            )
        )
        return rows, findings

    column_index = {name: idx for idx, name in enumerate(header_cells)}
    stem_col = column_index.get("agent prompt")
    row_col = column_index.get("#")
    depends_col = column_index.get("depends on")
    assert stem_col is not None and row_col is not None and depends_col is not None

    for line_number in range(header_index + 2, len(lines)):
        cells = _parse_table_cells(lines[line_number])
        if not cells:
            if rows:
                break
            continue
        if _is_separator_row(cells):
            continue
        max_index = max(row_col, stem_col, depends_col)
        if len(cells) <= max_index:
            findings.append(
                _result(
                    "plan_meta.wbs_row_malformed",
                    "warning",
                    "Malformed WBS row (missing required columns).",
                    {"line": line_number + 1, "row": lines[line_number].strip()},
                )
            )
            continue

        raw_row = cells[row_col]
        raw_stem = cells[stem_col]
        raw_depends = cells[depends_col]
        if not raw_row.isdigit():
            findings.append(
                _result(
                    "plan_meta.wbs_row_number_invalid",
                    "warning",
                    "WBS row number is not numeric.",
                    {"line": line_number + 1, "value": raw_row},
                )
            )
            continue
        stem = _normalize_stem(raw_stem)
        if not stem:
            findings.append(
                _result(
                    "plan_meta.wbs_stem_missing",
                    "warning",
                    "WBS row has empty Agent Prompt stem.",
                    {"line": line_number + 1, "row_number": int(raw_row)},
                )
            )
            continue
        rows.append(
            PlanRow(
                row_number=int(raw_row),
                stem=stem,
                depends_raw=raw_depends.strip(),
                line_number=line_number + 1,
            )
        )

    if not rows:
        findings.append(
            _result(
                "plan_meta.wbs_rows_missing",
                "warning",
                "No prompt rows found in WBS table.",
            )
        )

    return rows, findings


def _parse_meta_prompts(meta_payload: Any) -> tuple[list[str], dict[str, list[str]], list[dict[str, Any]]]:
    findings: list[dict[str, Any]] = []
    stems: list[str] = []
    depends_map: dict[str, list[str]] = {}

    if not isinstance(meta_payload, dict):
        findings.append(
            _result(
                "plan_meta.meta_invalid_shape",
                "error",
                "workpack.meta.json must be a JSON object.",
            )
        )
        return stems, depends_map, findings

    prompts = meta_payload.get("prompts")
    if not isinstance(prompts, list):
        findings.append(
            _result(
                "plan_meta.meta_prompts_missing",
                "error",
                "workpack.meta.json prompts must be an array.",
            )
        )
        return stems, depends_map, findings

    for idx, item in enumerate(prompts, start=1):
        if not isinstance(item, dict):
            findings.append(
                _result(
                    "plan_meta.meta_prompt_invalid",
                    "warning",
                    "meta.prompts entry is not an object.",
                    {"index": idx},
                )
            )
            continue
        raw_stem = item.get("stem")
        if not isinstance(raw_stem, str):
            findings.append(
                _result(
                    "plan_meta.meta_prompt_stem_invalid",
                    "warning",
                    "meta.prompts entry has non-string stem.",
                    {"index": idx},
                )
            )
            continue
        stem = _normalize_stem(raw_stem)
        stems.append(stem)

        raw_depends = item.get("depends_on")
        depends: list[str] = []
        if isinstance(raw_depends, list):
            for dep in raw_depends:
                if isinstance(dep, str):
                    normalized = _normalize_stem(dep)
                    if normalized:
                        depends.append(normalized)
        depends_map[stem] = sorted(set(depends))

    duplicate_stems = sorted({stem for stem in stems if stems.count(stem) > 1})
    if duplicate_stems:
        findings.append(
            _result(
                "plan_meta.meta_duplicate_stems",
                "warning",
                "Duplicate prompt stems found in workpack.meta.json prompts[].",
                {"stems": duplicate_stems},
            )
        )

    return stems, depends_map, findings


def _resolve_plan_dependencies(rows: list[PlanRow]) -> tuple[dict[str, list[str]], list[dict[str, Any]]]:
    findings: list[dict[str, Any]] = []
    row_to_stem: dict[int, str] = {}
    stems_in_order: list[str] = []
    for row in rows:
        row_to_stem[row.row_number] = row.stem
        stems_in_order.append(row.stem)

    duplicate_stems = sorted({stem for stem in stems_in_order if stems_in_order.count(stem) > 1})
    if duplicate_stems:
        findings.append(
            _result(
                "plan_meta.plan_duplicate_stems",
                "warning",
                "Duplicate Agent Prompt stems found in WBS table.",
                {"stems": duplicate_stems},
            )
        )

    depends_map: dict[str, list[str]] = {}
    empty_markers = {"", "-", "[]", "none", "n/a"}

    for row in rows:
        raw = row.depends_raw.strip()
        lowered = raw.lower()
        dependencies: list[str] = []

        if lowered in empty_markers:
            depends_map[row.stem] = []
            continue

        numeric_refs = [int(value) for value in re.findall(r"\d+", raw)]
        stem_refs = PROMPT_STEM_RE.findall(raw)

        if numeric_refs:
            for dep_row in numeric_refs:
                dep_stem = row_to_stem.get(dep_row)
                if dep_stem is None:
                    findings.append(
                        _result(
                            "plan_meta.plan_depends_row_missing",
                            "warning",
                            "WBS dependency references unknown row number.",
                            {
                                "prompt": row.stem,
                                "depends_on_row": dep_row,
                                "line": row.line_number,
                            },
                        )
                    )
                    continue
                dependencies.append(dep_stem)
                if dep_row >= row.row_number:
                    findings.append(
                        _result(
                            "plan_meta.plan_dependency_order",
                            "error",
                            "WBS dependency ordering is invalid (depends on same or future row).",
                            {
                                "prompt": row.stem,
                                "row_number": row.row_number,
                                "depends_on_row": dep_row,
                            },
                        )
                    )
        elif stem_refs:
            for dep_stem in stem_refs:
                normalized_dep = _normalize_stem(dep_stem)
                if normalized_dep:
                    dependencies.append(normalized_dep)
        else:
            findings.append(
                _result(
                    "plan_meta.plan_depends_unparseable",
                    "warning",
                    "Could not parse Depends On value in WBS row.",
                    {"prompt": row.stem, "value": raw, "line": row.line_number},
                )
            )

        depends_map[row.stem] = sorted(set(dependencies))

    return depends_map, findings


def check_plan_meta_sync(plan_md_path: str | Path, meta_json_path: str | Path) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    plan_path = Path(plan_md_path)
    meta_path = Path(meta_json_path)

    plan_markdown, plan_issue = _read_text(plan_path)
    if plan_issue:
        plan_issue["check_id"] = "plan_meta.plan_missing" if plan_issue["check_id"] == "file.missing" else "plan_meta.plan_read_error"
        findings.append(plan_issue)
        return findings

    meta_payload, meta_issue = _load_json(meta_path)
    if meta_issue:
        if meta_issue["check_id"] == "file.missing":
            meta_issue["check_id"] = "plan_meta.meta_missing"
            meta_issue["severity"] = "warning"
        elif meta_issue["check_id"] == "file.invalid_json":
            meta_issue["check_id"] = "plan_meta.meta_invalid_json"
        else:
            meta_issue["check_id"] = "plan_meta.meta_read_error"
        findings.append(meta_issue)
        return findings

    assert plan_markdown is not None
    plan_rows, plan_parse_findings = _parse_wbs_rows(plan_markdown)
    findings.extend(plan_parse_findings)
    plan_depends_map, plan_dep_findings = _resolve_plan_dependencies(plan_rows)
    findings.extend(plan_dep_findings)

    meta_stems, meta_depends_map, meta_findings = _parse_meta_prompts(meta_payload)
    findings.extend(meta_findings)

    plan_stems = [row.stem for row in plan_rows]
    missing_in_meta = sorted(set(plan_stems) - set(meta_stems))
    if missing_in_meta:
        findings.append(
            _result(
                "plan_meta.missing_in_meta",
                "error",
                "Prompt stems present in 01_plan.md WBS but missing in workpack.meta.json prompts[].",
                {"stems": missing_in_meta},
            )
        )

    extra_in_meta = sorted(set(meta_stems) - set(plan_stems))
    if extra_in_meta:
        findings.append(
            _result(
                "plan_meta.extra_in_meta",
                "error",
                "Prompt stems present in workpack.meta.json prompts[] but missing in 01_plan.md WBS.",
                {"stems": extra_in_meta},
            )
        )

    shared_stem_set = set(plan_stems).intersection(meta_stems)
    plan_shared_order = [stem for stem in plan_stems if stem in shared_stem_set]
    meta_shared_order = [stem for stem in meta_stems if stem in shared_stem_set]
    if plan_shared_order and plan_shared_order != meta_shared_order:
        findings.append(
            _result(
                "plan_meta.order_mismatch",
                "error",
                "Prompt ordering mismatch between 01_plan.md WBS and workpack.meta.json prompts[].",
                {
                    "plan_order": plan_stems,
                    "meta_order": meta_stems,
                    "plan_shared_order": plan_shared_order,
                    "meta_shared_order": meta_shared_order,
                },
            )
        )

    depends_mismatch_details: list[dict[str, Any]] = []
    shared_stems = sorted(shared_stem_set)
    for stem in shared_stems:
        plan_deps = sorted(set(plan_depends_map.get(stem, [])))
        meta_deps = sorted(set(meta_depends_map.get(stem, [])))
        if plan_deps != meta_deps:
            depends_mismatch_details.append(
                {
                    "stem": stem,
                    "plan_depends_on": plan_deps,
                    "meta_depends_on": meta_deps,
                }
            )

    if depends_mismatch_details:
        findings.append(
            _result(
                "plan_meta.depends_on_mismatch",
                "error",
                "Dependency drift detected between WBS Depends On and meta.prompts[].depends_on.",
                {"mismatches": depends_mismatch_details},
            )
        )

    return findings


def _parse_status_markers(status_markdown: str) -> tuple[dict[str, bool], list[dict[str, Any]]]:
    findings: list[dict[str, Any]] = []
    markers: dict[str, bool] = {}

    checkbox_line_re = re.compile(r"^\s*[-*]\s*\[(x|X| )\]\s*(.+?)\s*$")
    for line_number, line in enumerate(status_markdown.splitlines(), start=1):
        match = checkbox_line_re.match(line)
        if not match:
            continue
        checked = match.group(1).lower() == "x"
        body = match.group(2)
        if "if b-series appears" in body.lower():
            # Template placeholder line, not an actual prompt completion claim.
            continue
        stem_match = STATUS_STEM_RE.search(body)
        if not stem_match:
            continue
        stem = _normalize_stem(stem_match.group(1))
        previous = markers.get(stem)
        if previous is not None and previous != checked:
            findings.append(
                _result(
                    "status_state.status_duplicate_marker",
                    "warning",
                    "Prompt has conflicting checkbox markers in 99_status.md.",
                    {"stem": stem, "line": line_number},
                )
            )
        markers[stem] = checked

    return markers, findings


def _parse_state_statuses(state_payload: Any) -> tuple[dict[str, str], list[dict[str, Any]]]:
    findings: list[dict[str, Any]] = []
    statuses: dict[str, str] = {}

    if not isinstance(state_payload, dict):
        findings.append(
            _result(
                "status_state.state_invalid_shape",
                "error",
                "workpack.state.json must be a JSON object.",
            )
        )
        return statuses, findings

    prompt_status = state_payload.get("prompt_status")
    if not isinstance(prompt_status, dict):
        findings.append(
            _result(
                "status_state.prompt_status_missing",
                "error",
                "workpack.state.json prompt_status must be an object.",
            )
        )
        return statuses, findings

    for stem, payload in prompt_status.items():
        if not isinstance(stem, str):
            continue
        if not isinstance(payload, dict):
            findings.append(
                _result(
                    "status_state.prompt_status_entry_invalid",
                    "warning",
                    "prompt_status entry is not an object.",
                    {"stem": stem},
                )
            )
            continue
        raw_status = payload.get("status")
        if not isinstance(raw_status, str):
            findings.append(
                _result(
                    "status_state.prompt_status_value_invalid",
                    "warning",
                    "prompt_status entry has non-string status.",
                    {"stem": stem},
                )
            )
            continue
        statuses[_normalize_stem(stem)] = raw_status

    return statuses, findings


def _is_completed_in_state(status: str) -> bool:
    return status in {"complete", "skipped"}


def check_status_state_sync(status_md_path: str | Path, state_json_path: str | Path) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    status_path = Path(status_md_path)
    state_path = Path(state_json_path)

    status_markdown, status_issue = _read_text(status_path)
    if status_issue:
        status_issue["check_id"] = "status_state.status_missing" if status_issue["check_id"] == "file.missing" else "status_state.status_read_error"
        findings.append(status_issue)
        return findings

    state_payload, state_issue = _load_json(state_path)
    if state_issue:
        if state_issue["check_id"] == "file.missing":
            state_issue["check_id"] = "status_state.state_missing"
            state_issue["severity"] = "warning"
        elif state_issue["check_id"] == "file.invalid_json":
            state_issue["check_id"] = "status_state.state_invalid_json"
        else:
            state_issue["check_id"] = "status_state.state_read_error"
        findings.append(state_issue)
        return findings

    assert status_markdown is not None
    status_markers, marker_findings = _parse_status_markers(status_markdown)
    findings.extend(marker_findings)

    state_statuses, state_findings = _parse_state_statuses(state_payload)
    findings.extend(state_findings)

    all_stems = sorted(set(status_markers).union(state_statuses))
    for stem in all_stems:
        in_markdown = stem in status_markers
        in_state = stem in state_statuses
        if not in_markdown:
            findings.append(
                _result(
                    "status_state.missing_in_markdown",
                    "warning",
                    "Prompt present in state.prompt_status but not found as checkbox marker in 99_status.md.",
                    {"stem": stem, "state_status": state_statuses[stem]},
                )
            )
            continue
        if not in_state:
            findings.append(
                _result(
                    "status_state.missing_in_state",
                    "warning",
                    "Prompt checkbox present in 99_status.md but missing in state.prompt_status.",
                    {"stem": stem, "markdown_completed": status_markers[stem]},
                )
            )
            continue

        markdown_complete = status_markers[stem]
        state_status = state_statuses[stem]
        state_complete = _is_completed_in_state(state_status)

        if markdown_complete and not state_complete:
            findings.append(
                _result(
                    "status_state.markdown_complete_state_incomplete",
                    "error",
                    "Prompt is checked as complete in markdown but not complete/skipped in state JSON.",
                    {"stem": stem, "state_status": state_status},
                )
            )
        elif not markdown_complete and state_complete:
            findings.append(
                _result(
                    "status_state.markdown_incomplete_state_complete",
                    "error",
                    "Prompt is unchecked in markdown but marked complete/skipped in state JSON.",
                    {"stem": stem, "state_status": state_status},
                )
            )

    return findings


def run_sync_checks(
    plan_md_path: str | Path,
    meta_json_path: str | Path,
    status_md_path: str | Path,
    state_json_path: str | Path,
) -> list[dict[str, Any]]:
    findings = check_plan_meta_sync(plan_md_path, meta_json_path)
    findings.extend(check_status_state_sync(status_md_path, state_json_path))
    return findings


def _render_human(findings: list[dict[str, Any]]) -> str:
    if not findings:
        return "No markdown-json synchronization drift detected."

    lines: list[str] = []
    for finding in findings:
        lines.append(
            f"[{finding['severity']}] {finding['check_id']}: {finding['message']}"
        )
        details = finding.get("details")
        if details:
            lines.append(f"  details: {json.dumps(details, ensure_ascii=True)}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify synchronization between markdown and JSON workpack files.",
    )
    parser.add_argument("--plan-md", default="01_plan.md", help="Path to 01_plan.md")
    parser.add_argument("--meta-json", default="workpack.meta.json", help="Path to workpack.meta.json")
    parser.add_argument("--status-md", default="99_status.md", help="Path to 99_status.md")
    parser.add_argument("--state-json", default="workpack.state.json", help="Path to workpack.state.json")
    parser.add_argument("--json", action="store_true", help="Print findings as JSON")
    args = parser.parse_args(argv)

    findings = run_sync_checks(
        plan_md_path=args.plan_md,
        meta_json_path=args.meta_json,
        status_md_path=args.status_md,
        state_json_path=args.state_json,
    )

    if args.json:
        print(json.dumps(findings, indent=2, ensure_ascii=True))
    else:
        print(_render_human(findings))

    return 1 if any(item.get("severity") == "error" for item in findings) else 0


if __name__ == "__main__":
    sys.exit(main())
