#!/usr/bin/env python3
"""
verify_prompt_style.py - Prompt style linter for Workpack prompts.

Checks:
1. Required prompt sections and title/one-line objective.
2. YAML front-matter structure (`depends_on`, `repos`).

The module is importable and runnable as a standalone CLI.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Sequence


LintFinding = dict[str, Any]

REQUIRED_SECTION_HEADINGS = (
    "READ FIRST",
    "Objective",
    "Implementation Requirements",
    "Verification",
    "Handoff Output (JSON)",
    "Deliverables",
)

SCRIPT_WORKPACKS_DIR = Path(__file__).resolve().parents[1]
NUMBERED_PROMPT_STEM = re.compile(r"^[ABVR]\d+_[a-z0-9][a-z0-9_]*$")
HEADING_LINE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
FRONT_MATTER_KEY = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*$")
FRONT_MATTER_LIST_ITEM = re.compile(r"^\s*-\s*(.*?)\s*$")


def _result(
    check_id: str,
    severity: str,
    message: str,
    prompt_path: Path | None = None,
    **details: Any,
) -> LintFinding:
    payload_details = dict(details)
    if prompt_path is not None:
        payload_details["prompt_path"] = str(prompt_path)
    return {
        "check_id": check_id,
        "severity": severity,
        "message": message,
        "details": payload_details,
    }


def _normalize_heading(value: str) -> str:
    cleaned = value.strip().strip("#").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.casefold()


def _is_template_prompt(prompt_path: Path) -> bool:
    stem = prompt_path.stem
    if "template" in stem.casefold():
        return True
    return not bool(NUMBERED_PROMPT_STEM.match(stem))


def _split_front_matter(text: str) -> tuple[list[str] | None, list[str]]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, lines

    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            return lines[1:index], lines[index + 1 :]

    return None, lines


def _extract_headings(lines: list[str]) -> list[tuple[int, str, int]]:
    headings: list[tuple[int, str, int]] = []
    in_code_fence = False
    for line_no, line in enumerate(lines, start=1):
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code_fence = not in_code_fence
            continue
        if in_code_fence:
            continue
        match = HEADING_LINE.match(line)
        if not match:
            continue
        level = len(match.group(1))
        heading_text = match.group(2).strip()
        headings.append((level, heading_text, line_no))
    return headings


def _has_one_line_objective(lines: list[str], headings: list[tuple[int, str, int]]) -> bool:
    if not headings:
        return False

    _, _, first_heading_line = headings[0]
    next_heading_line = len(lines) + 1
    for _, _, line_no in headings[1:]:
        if line_no > first_heading_line:
            next_heading_line = line_no
            break

    for index in range(first_heading_line, next_heading_line - 1):
        text = lines[index].strip()
        if not text:
            continue
        if text.startswith(">"):
            return True
        if text.startswith("<!--") and text.endswith("-->"):
            continue
        if text == "---":
            continue
        return False

    return False


def check_required_sections(prompt_path: str | Path) -> list[LintFinding]:
    """
    Parse markdown and validate required sections.

    Required:
    - Title and one-line objective
    - `READ FIRST`
    - `Objective`
    - `Implementation Requirements`
    - `Verification`
    - `Handoff Output (JSON)`
    - `Deliverables`
    """
    path = Path(prompt_path)
    findings: list[LintFinding] = []
    template_prompt = _is_template_prompt(path)
    section_severity = "warning" if template_prompt else "error"

    try:
        text = path.read_text(encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        return [
            _result(
                "PROMPT_READ_ERROR",
                "error",
                f"Prompt file could not be read: {exc}",
                prompt_path=path,
            )
        ]

    _, body_lines = _split_front_matter(text)
    headings = _extract_headings(body_lines)

    has_title = bool(headings and headings[0][0] == 1)
    has_objective_line = _has_one_line_objective(body_lines, headings)
    missing_title_objective: list[str] = []
    if not has_title:
        missing_title_objective.append("title")
    if not has_objective_line:
        missing_title_objective.append("one_line_objective")

    if missing_title_objective:
        findings.append(
            _result(
                "PROMPT_TITLE_OBJECTIVE",
                section_severity,
                "Prompt must include a top-level title and one-line objective.",
                prompt_path=path,
                missing=missing_title_objective,
                template_tolerance_applied=template_prompt,
            )
        )

    heading_set = {_normalize_heading(heading) for _, heading, _ in headings}
    missing_sections = [
        section for section in REQUIRED_SECTION_HEADINGS if _normalize_heading(section) not in heading_set
    ]
    if missing_sections:
        findings.append(
            _result(
                "PROMPT_REQUIRED_SECTIONS",
                section_severity,
                "Prompt is missing one or more required section headings.",
                prompt_path=path,
                missing_sections=missing_sections,
                template_tolerance_applied=template_prompt,
            )
        )

    return findings


def _parse_scalar(value: str) -> str:
    raw = value.strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in {"'", '"'}:
        return raw[1:-1]
    return raw


def _parse_inline_list(raw: str) -> list[str]:
    inner = raw[1:-1].strip()
    if not inner:
        return []
    return [_parse_scalar(part) for part in inner.split(",") if part.strip()]


def _parse_front_matter_map(front_matter_lines: list[str]) -> tuple[dict[str, Any], list[str]]:
    parsed: dict[str, Any] = {}
    errors: list[str] = []
    current_list_key: str | None = None

    for line_no, line in enumerate(front_matter_lines, start=2):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        key_match = FRONT_MATTER_KEY.match(line)
        if key_match:
            key = key_match.group(1)
            raw_value = key_match.group(2).strip()
            if raw_value == "":
                parsed[key] = []
                current_list_key = key
            elif raw_value.startswith("[") and raw_value.endswith("]"):
                parsed[key] = _parse_inline_list(raw_value)
                current_list_key = None
            else:
                parsed[key] = _parse_scalar(raw_value)
                current_list_key = None
            continue

        list_item_match = FRONT_MATTER_LIST_ITEM.match(line)
        if list_item_match and current_list_key is not None:
            parsed[current_list_key].append(_parse_scalar(list_item_match.group(1)))
            continue

        errors.append(f"line {line_no}: unrecognized front-matter line '{line.rstrip()}'")

    return parsed, errors


def check_yaml_frontmatter(prompt_path: str | Path) -> list[LintFinding]:
    """
    Validate YAML front-matter structure.

    Requirements:
    - Block must exist and be delimited by `---`.
    - `depends_on` must be a list[str] using prompt stems (no `.md` suffix).
    - `repos` must be a list[str].
    """
    path = Path(prompt_path)
    findings: list[LintFinding] = []

    try:
        text = path.read_text(encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        return [
            _result(
                "PROMPT_READ_ERROR",
                "error",
                f"Prompt file could not be read: {exc}",
                prompt_path=path,
            )
        ]

    raw_lines = text.splitlines()
    if not raw_lines or raw_lines[0].strip() != "---":
        return [
            _result(
                "PROMPT_FRONTMATTER_MISSING",
                "error",
                "Prompt is missing YAML front-matter at the top of the file.",
                prompt_path=path,
            )
        ]

    front_matter_lines, _ = _split_front_matter(text)
    if front_matter_lines is None:
        return [
            _result(
                "PROMPT_FRONTMATTER_PARSE",
                "error",
                "YAML front-matter is missing a closing '---' delimiter.",
                prompt_path=path,
            )
        ]

    front_matter, parse_errors = _parse_front_matter_map(front_matter_lines)
    if parse_errors:
        findings.append(
            _result(
                "PROMPT_FRONTMATTER_PARSE",
                "error",
                "YAML front-matter contains unsupported or malformed lines.",
                prompt_path=path,
                parse_errors=parse_errors,
            )
        )

    depends_on = front_matter.get("depends_on")
    if depends_on is None:
        findings.append(
            _result(
                "PROMPT_FRONTMATTER_DEPENDS_ON",
                "error",
                "YAML front-matter must define `depends_on`.",
                prompt_path=path,
            )
        )
    elif not isinstance(depends_on, list):
        findings.append(
            _result(
                "PROMPT_FRONTMATTER_DEPENDS_ON",
                "error",
                "`depends_on` must be an array of prompt stems.",
                prompt_path=path,
                actual_type=type(depends_on).__name__,
            )
        )
    else:
        invalid_items: list[dict[str, Any]] = []
        for index, item in enumerate(depends_on):
            if not isinstance(item, str) or not item.strip():
                invalid_items.append({"index": index, "value": item, "reason": "must be a non-empty string"})
                continue
            if item.strip().endswith(".md"):
                invalid_items.append({"index": index, "value": item, "reason": "must not include .md suffix"})
        if invalid_items:
            findings.append(
                _result(
                    "PROMPT_FRONTMATTER_DEPENDS_ON",
                    "error",
                    "`depends_on` contains invalid values.",
                    prompt_path=path,
                    invalid_items=invalid_items,
                )
            )

    repos = front_matter.get("repos")
    if repos is None:
        findings.append(
            _result(
                "PROMPT_FRONTMATTER_REPOS",
                "error",
                "YAML front-matter must define `repos`.",
                prompt_path=path,
            )
        )
    elif not isinstance(repos, list):
        findings.append(
            _result(
                "PROMPT_FRONTMATTER_REPOS",
                "error",
                "`repos` must be an array of repository names.",
                prompt_path=path,
                actual_type=type(repos).__name__,
            )
        )
    else:
        invalid_repos: list[dict[str, Any]] = []
        for index, repo in enumerate(repos):
            if not isinstance(repo, str) or not repo.strip():
                invalid_repos.append({"index": index, "value": repo, "reason": "must be a non-empty string"})
        if invalid_repos:
            findings.append(
                _result(
                    "PROMPT_FRONTMATTER_REPOS",
                    "error",
                    "`repos` contains invalid values.",
                    prompt_path=path,
                    invalid_items=invalid_repos,
                )
            )

    return findings


def lint_prompt_directory(prompts_dir: str | Path) -> list[LintFinding]:
    """Lint all `.md` prompt files in a directory."""
    directory = Path(prompts_dir)
    if not directory.exists() or not directory.is_dir():
        return [
            _result(
                "PROMPT_DIRECTORY_NOT_FOUND",
                "error",
                "Prompt directory not found or is not a directory.",
                directory=str(directory),
            )
        ]

    findings: list[LintFinding] = []
    for prompt_path in sorted(directory.glob("*.md")):
        findings.extend(check_required_sections(prompt_path))
        findings.extend(check_yaml_frontmatter(prompt_path))
    return findings


def _discover_default_prompt_dirs() -> list[Path]:
    workpacks_dir = SCRIPT_WORKPACKS_DIR
    discovered: list[Path] = []

    template_prompts = workpacks_dir / "_template" / "prompts"
    if template_prompts.is_dir():
        discovered.append(template_prompts)

    instances_dir = workpacks_dir / "instances"
    if instances_dir.is_dir():
        discovered.extend(sorted(path for path in instances_dir.rglob("prompts") if path.is_dir()))

    # Preserve order while dropping duplicates.
    deduped: list[Path] = []
    seen: set[Path] = set()
    for item in discovered:
        resolved = item.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        deduped.append(resolved)
    return deduped


def _count_by_severity(findings: list[LintFinding]) -> dict[str, int]:
    counts: dict[str, int] = {"error": 0, "warning": 0, "info": 0}
    for finding in findings:
        severity = str(finding.get("severity", "info")).casefold()
        if severity not in counts:
            counts[severity] = 0
        counts[severity] += 1
    return counts


def run(paths: list[Path]) -> list[LintFinding]:
    findings: list[LintFinding] = []
    for directory in paths:
        findings.extend(lint_prompt_directory(directory))
    return findings


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Lint prompt markdown files for style and YAML front-matter requirements.",
    )
    strict_group = parser.add_mutually_exclusive_group()
    strict_group.add_argument(
        "--strict",
        dest="strict",
        action="store_true",
        help="Treat warnings as failures (exit code 2).",
    )
    strict_group.add_argument(
        "--no-strict",
        dest="strict",
        action="store_false",
        help="Warnings do not fail the run (default).",
    )
    parser.set_defaults(strict=False)
    parser.add_argument(
        "--json",
        dest="json_output",
        action="store_true",
        help="Print findings as JSON.",
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="Prompt directories to lint. Defaults to template and instance prompt directories.",
    )
    args = parser.parse_args(argv)

    if args.paths:
        prompt_dirs = [Path(raw).resolve() for raw in args.paths]
    else:
        prompt_dirs = _discover_default_prompt_dirs()

    if not prompt_dirs:
        print("No prompt directories found.")
        return 1

    findings = run(prompt_dirs)
    counts = _count_by_severity(findings)

    if args.json_output:
        print(json.dumps(findings, indent=2))
    else:
        print("Prompt Style Linter")
        print("=" * 40)
        print(f"Scanned directories: {len(prompt_dirs)}")
        for directory in prompt_dirs:
            print(f"  - {directory}")
        print()
        if findings:
            for finding in findings:
                severity = str(finding["severity"]).upper()
                print(f"[{severity}] {finding['check_id']}: {finding['message']}")
                details = finding.get("details", {})
                prompt_path = details.get("prompt_path")
                if prompt_path:
                    print(f"  prompt: {prompt_path}")
            print()
            print(
                "Summary: "
                f"errors={counts.get('error', 0)}, "
                f"warnings={counts.get('warning', 0)}, "
                f"info={counts.get('info', 0)}"
            )
        else:
            print("No style issues found.")

    if counts.get("error", 0) > 0:
        return 1
    if args.strict and counts.get("warning", 0) > 0:
        return 2
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
