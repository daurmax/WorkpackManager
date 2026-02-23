#!/usr/bin/env python3
"""
validate_workpack_files.py - Workpack File Completeness Validator

Checks that each discovered workpack instance contains all files and
directories required by the Workpack Protocol spec (section 2.2).

Requirements by protocol version:
  All versions : 00_request.md, 01_plan.md, prompts/
  1.1.0+       : outputs/
  2.0.0+       : workpack.meta.json, workpack.state.json
  Recommended  : 99_status.md (warning only)

Exit codes:
  0 = all workpacks complete
  1 = missing required files detected
  2 = warnings only (with --strict)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Virtual-environment bootstrap (shared pattern with other workpack tools)
# ---------------------------------------------------------------------------
def _ensure_venv() -> None:
    if sys.prefix != sys.base_prefix:
        return
    venv_dir = Path(__file__).resolve().parent / ".venv"
    if not venv_dir.exists():
        import venv as _venv

        print(f"[validate_files] Creating virtual environment at {venv_dir} ...")
        _venv.create(str(venv_dir), with_pip=True)
    if os.name == "nt":
        python = venv_dir / "Scripts" / "python.exe"
    else:
        python = venv_dir / "bin" / "python"
    if not python.exists():
        print(f"ERROR: venv Python not found at {python}", file=sys.stderr)
        sys.exit(1)
    print(f"[validate_files] Re-running inside venv: {venv_dir}")
    os.execv(str(python), [str(python)] + sys.argv)


_ensure_venv()


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
REQUEST_FILE = "00_request.md"


# ---------------------------------------------------------------------------
# Protocol version parsing (mirrors workpack_lint.py)
# ---------------------------------------------------------------------------
def _semver_to_internal(raw: str) -> int:
    """Map version string to internal ordinal."""
    parts = raw.strip().split(".")
    if len(parts) == 1:
        try:
            return int(parts[0])
        except ValueError:
            return 0
    try:
        major, minor = int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        return 0
    if major == 1:
        return 1 + minor
    elif major == 2:
        return 6 + minor
    else:
        return major * 3 + minor


_INTERNAL_TO_DISPLAY = {
    1: "1.0.0", 2: "1.1.0", 3: "1.2.0", 4: "1.3.0", 5: "1.4.0",
    6: "2.0.0", 7: "2.1.0", 8: "2.2.0",
}


def display_version(internal: int) -> str:
    return _INTERNAL_TO_DISPLAY.get(internal, str(internal))


def parse_protocol_version(request_content: str) -> int:
    explicit = re.search(
        r"Workpack\s+Protocol\s+Version:\s*([0-9]+(?:\.[0-9]+(?:\.[0-9]+)?)?)",
        request_content, re.IGNORECASE,
    )
    if explicit:
        return _semver_to_internal(explicit.group(1))

    legacy = re.search(r"Protocol\s+v([0-9]+)", request_content, re.IGNORECASE)
    if legacy:
        try:
            return int(legacy.group(1))
        except ValueError:
            return 0
    return 0


def get_workpack_version(workpack_path: Path) -> int:
    request = workpack_path / REQUEST_FILE
    if not request.exists():
        return 0
    try:
        return parse_protocol_version(request.read_text(encoding="utf-8"))
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Discovery (same logic as workpack_lint.py)
# ---------------------------------------------------------------------------
def get_workpacks_dir() -> Path:
    script_workpacks = Path(__file__).resolve().parents[1]
    if script_workpacks.name == "workpacks" and script_workpacks.exists():
        return script_workpacks

    cwd = Path.cwd()
    for parent in [cwd] + list(cwd.parents):
        candidate = parent / "workpacks"
        if candidate.exists():
            return candidate

    raise FileNotFoundError("Could not find workpacks directory")


def discover_workpack_paths(scan_targets: list[Path]) -> list[Path]:
    found: dict[str, Path] = {}

    def should_skip(path: Path) -> bool:
        return any(part.startswith("_") or part.startswith(".") for part in path.parts)

    def register(path: Path) -> None:
        resolved = path.resolve()
        if not should_skip(resolved):
            found[str(resolved).lower()] = resolved

    for target in scan_targets:
        if not target.exists():
            continue
        if target.is_file():
            if target.name == REQUEST_FILE:
                register(target.parent)
            continue
        if (target / REQUEST_FILE).exists():
            register(target)
        for req in target.rglob(REQUEST_FILE):
            register(req.parent)

    return sorted(found.values(), key=lambda p: str(p).lower())


# ---------------------------------------------------------------------------
# File completeness rules
# ---------------------------------------------------------------------------
class FileRequirement:
    """A single required or recommended file/directory."""

    def __init__(
        self,
        relative_path: str,
        *,
        is_dir: bool = False,
        min_version: int = 1,
        required: bool = True,
        description: str = "",
    ) -> None:
        self.relative_path = relative_path
        self.is_dir = is_dir
        self.min_version = min_version
        self.required = required
        self.description = description

    def applies_to(self, version: int) -> bool:
        return version >= self.min_version

    def check(self, workpack_path: Path) -> bool:
        target = workpack_path / self.relative_path
        if self.is_dir:
            return target.is_dir()
        return target.is_file()


# Protocol-mandated layout from PROTOCOL_SPEC.md §2.2
FILE_RULES: list[FileRequirement] = [
    FileRequirement("00_request.md", description="request document"),
    FileRequirement("01_plan.md", description="execution plan"),
    FileRequirement("prompts", is_dir=True, description="prompt directory"),
    FileRequirement("outputs", is_dir=True, min_version=2, description="outputs directory (1.1.0+)"),
    FileRequirement("99_status.md", required=False, description="human status surface (recommended)"),
    FileRequirement("workpack.meta.json", min_version=6, description="metadata file (2.0.0+)"),
    FileRequirement("workpack.state.json", min_version=6, description="runtime state file (2.0.0+)"),
]


def validate_workpack_files(
    workpack_path: Path,
    version: int,
) -> tuple[list[str], list[str]]:
    """
    Check that a workpack directory contains all required files/dirs.

    Returns (errors, warnings).
    """
    errors: list[str] = []
    warnings: list[str] = []
    name = workpack_path.name

    for rule in FILE_RULES:
        if not rule.applies_to(version):
            continue
        if rule.check(workpack_path):
            continue

        kind = "directory" if rule.is_dir else "file"
        msg = (
            f"[{name}] {'WARN' if not rule.required else 'ERR'}_MISSING_FILE: "
            f"{rule.relative_path} ({kind}) — {rule.description}"
        )
        if rule.required:
            errors.append(msg)
        else:
            warnings.append(msg)

    # Extra: if prompts/ exists, it should contain at least one .md file
    prompts_dir = workpack_path / "prompts"
    if prompts_dir.is_dir():
        md_files = list(prompts_dir.glob("*.md"))
        if not md_files:
            warnings.append(
                f"[{name}] WARN_EMPTY_PROMPTS: prompts/ directory exists but contains no .md files"
            )

    # Extra: if outputs/ exists and state shows completed prompts, cross-check
    outputs_dir = workpack_path / "outputs"
    state_file = workpack_path / "workpack.state.json"
    if version >= 6 and outputs_dir.is_dir() and state_file.is_file():
        try:
            state: dict[str, Any] = json.loads(state_file.read_text(encoding="utf-8"))
            prompt_status = state.get("prompt_status", {})
            for stem, info in prompt_status.items():
                if not isinstance(info, dict):
                    continue
                status = info.get("status", "")
                if status == "complete":
                    output_file = outputs_dir / f"{stem}.json"
                    if not output_file.is_file():
                        warnings.append(
                            f"[{name}] WARN_MISSING_OUTPUT: prompt '{stem}' is marked complete "
                            f"in workpack.state.json but outputs/{stem}.json does not exist"
                        )
        except Exception:
            pass  # state parsing errors are handled by the linter

    # Extra: lifecycle completeness — expect R-series (retrospective) prompt
    if prompts_dir.is_dir():
        md_files = [f.stem for f in prompts_dir.glob("*.md")]
        has_r_series = any(stem.startswith("R") and "_" in stem for stem in md_files)
        if not has_r_series and md_files:
            warnings.append(
                f"[{name}] WARN_MISSING_RETROSPECTIVE: no R-series prompt found in prompts/. "
                "The standard lifecycle expects an R1_retrospective prompt."
            )

    return errors, warnings


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate that workpack instances contain all protocol-required files.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as errors (exit code 2).",
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="Optional scan targets (workpack dir, instances dir, group dir, or 00_request.md).",
    )
    args = parser.parse_args()

    print("Workpack File Completeness Validator")
    print("=" * 40)

    try:
        workpacks_dir = get_workpacks_dir()
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}")
        return 1

    print(f"Detected workpacks dir: {workpacks_dir}")

    if args.paths:
        scan_targets = [Path(p).resolve() for p in args.paths]
    else:
        instances_dir = workpacks_dir / "instances"
        if instances_dir.exists():
            scan_targets = [instances_dir, workpacks_dir]
        else:
            scan_targets = [workpacks_dir]

    workpack_paths = discover_workpack_paths(scan_targets)
    if not workpack_paths:
        print("ERROR: No workpack directories found.")
        return 1

    print(f"Discovered workpacks: {len(workpack_paths)}")
    print()

    all_errors: list[str] = []
    all_warnings: list[str] = []
    version_counts: dict[int, int] = {}

    for wp in workpack_paths:
        version = get_workpack_version(wp)
        if version < 1:
            print(f"  - Skipping (no protocol version): {wp}")
            continue

        version_counts[version] = version_counts.get(version, 0) + 1
        errors, warnings = validate_workpack_files(wp, version)
        all_errors.extend(errors)
        all_warnings.extend(warnings)

        status = "OK" if not errors else "FAIL"
        warn_suffix = f" ({len(warnings)} warning(s))" if warnings else ""
        print(f"  {'✓' if not errors else '✗'} [{display_version(version)}] {wp.name} — {status}{warn_suffix}")

    print()

    if all_warnings:
        print("WARNINGS:")
        print("-" * 40)
        for w in all_warnings:
            print(f"  ! {w}")
        print(f"Total warnings: {len(all_warnings)}")
        print()

    if all_errors:
        print("ERRORS:")
        print("-" * 40)
        for e in all_errors:
            print(f"  ✗ {e}")
        print(f"Total errors: {len(all_errors)}")
        return 1

    if all_warnings and args.strict:
        print("Warnings found and --strict mode is enabled.")
        return 2

    print("All workpacks contain required files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
