#!/usr/bin/env python3
"""
workpack_lint.py - Workpack Protocol Linter

Validates workpacks in a repository workpacks/ directory.
Supports all protocol versions from 1.0.0 onwards (and legacy integer versions).

Version capability map:
- 1.1.0+: completed prompt -> output artifact checks.
- 1.2.0+: code-block detection in prompts (warning).
- 1.3.0+: code-blocks become errors + verification/severity checks.
- 1.4.0+: DAG checks, dependency checks, execution warnings.
- 2.0.0+: workpack.meta.json/workpack.state.json checks + schema validation.
- 2.2.0+: commit-tracking warnings (artifacts/commit_shas/branch.work).

Exit codes:
  0 - pass
  1 - one or more validation errors
  2 - warnings found and --strict is set
"""

import os
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Virtual-environment bootstrap — runs BEFORE any other imports
# ---------------------------------------------------------------------------
def _ensure_venv() -> None:
    """Ensure the script runs inside a virtual environment.

    If called outside a venv the function:
    1. Creates ``<script_dir>/.venv/`` (if absent).
    2. Re-executes the current script with the venv's Python interpreter.
    """
    if os.environ.get("WORKPACK_LINT_SKIP_VENV_BOOTSTRAP") == "1":
        return

    # Already inside a venv - nothing to do.
    if sys.prefix != sys.base_prefix:
        return

    venv_dir = Path(__file__).resolve().parent / ".venv"

    if not venv_dir.exists():
        import venv as _venv  # noqa: delayed import - only needed once

        print(f"[lint] Creating virtual environment at {venv_dir} ...")
        _venv.create(str(venv_dir), with_pip=True)

    # Determine the venv Python path.
    if os.name == "nt":
        python = venv_dir / "Scripts" / "python.exe"
    else:
        python = venv_dir / "bin" / "python"

    if not python.exists():
        print(f"ERROR: venv Python not found at {python}", file=sys.stderr)
        sys.exit(1)

    print(f"[lint] Re-running inside venv: {venv_dir}")
    os.execv(str(python), [str(python)] + sys.argv)


_ensure_venv()
# ---------------------------------------------------------------------------
# From here on we are guaranteed to run inside the venv.
# ---------------------------------------------------------------------------

import argparse
import json
import re
import subprocess
from dataclasses import dataclass
from typing import Any
from workpack_config import (
    LoadedWorkpackConfig,
    WorkpackConfigError,
    build_discovery_scan_targets,
    discover_workpack_paths_in_targets,
    load_tool_config,
    normalize_discovery_excludes,
    render_config_message,
)


_JSONSCHEMA: Any | None = None


def ensure_jsonschema() -> Any:
    """Import jsonschema, auto-installing it in the venv if missing."""
    global _JSONSCHEMA
    if _JSONSCHEMA is not None:
        return _JSONSCHEMA

    try:
        import jsonschema as _jsonschema  # type: ignore
    except ImportError:
        print("[lint] Installing dependency: jsonschema ...")
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "--version"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except subprocess.CalledProcessError:
            subprocess.check_call([sys.executable, "-m", "ensurepip", "--upgrade"])
        except FileNotFoundError:
            subprocess.check_call([sys.executable, "-m", "ensurepip", "--upgrade"])
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "jsonschema>=4,<5"])
        except subprocess.CalledProcessError as exc:
            print(f"ERROR: failed to install jsonschema ({exc})", file=sys.stderr)
            sys.exit(1)
        import jsonschema as _jsonschema  # type: ignore

    _JSONSCHEMA = _jsonschema
    return _JSONSCHEMA


@dataclass(frozen=True)
class SchemaBundle:
    """Protocol schema container."""

    output: dict[str, Any] | None
    meta: dict[str, Any] | None
    state: dict[str, Any] | None


# Languages that trigger code-block warnings in 1.2.0+ prompts
CODE_BLOCK_LANGUAGES = {
    # C# / .NET
    "csharp", "cs", "c#",
    # Python
    "python", "py",
    # JavaScript / TypeScript
    "javascript", "js", "typescript", "ts", "jsx", "tsx",
    # Other common languages
    "java", "kotlin", "swift", "go", "rust", "ruby", "php",
    "sql", "xml", "html", "css", "scss", "sass",
    # Config formats (allowed in some contexts but flagged)
    "json", "yaml", "yml", "toml",
}

# Marker to suppress code-block warning for a specific block
LINT_IGNORE_MARKER = "<!-- lint-ignore-code-block -->"
PROMPT_STEM_PATTERN = re.compile(r"^[ABVR]\d+")
REQUEST_FILE_NAME = "00_request.md"
SCRIPT_WORKPACKS_DIR = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = SCRIPT_WORKPACKS_DIR.parent


def get_workpacks_dir(config: LoadedWorkpackConfig | None = None) -> Path:
    """Get the resolved workpacks directory from config or legacy defaults."""
    if config is not None:
        return config.workpacks_dir

    script_workpacks = SCRIPT_WORKPACKS_DIR
    if script_workpacks.name == "workpacks" and script_workpacks.exists():
        return script_workpacks.resolve()

    cwd = Path.cwd()
    cwd_workpacks = cwd / "workpacks"
    if cwd_workpacks.exists():
        return cwd_workpacks

    for parent in [cwd] + list(cwd.parents):
        candidate = parent / "workpacks"
        if candidate.exists():
            return candidate

    raise FileNotFoundError("Could not find workpacks directory")


def _semver_to_internal(raw: str) -> int:
    """Map a version string (legacy integer or semver) to an internal ordinal.

    Mapping:
        Legacy 1-6  ->  1-6 (direct)
        1.0.0       ->  1
        1.1.0       ->  2
        1.2.0       ->  3
        1.3.0       ->  4
        1.4.0       ->  5
        2.0.0       ->  6
        2.1.0       ->  7
        2.2.0       ->  8
        future 2.N  ->  6+N
        future 3.0  ->  9+  (heuristic)
    """
    parts = raw.strip().split(".")
    if len(parts) == 1:
        # Legacy integer version ("1" through "6")
        try:
            return int(parts[0])
        except ValueError:
            return 0
    try:
        major = int(parts[0])
        minor = int(parts[1])
    except (ValueError, IndexError):
        return 0
    if major == 1:
        return 1 + minor  # 1.0->1, 1.1->2, 1.2->3, 1.3->4, 1.4->5
    elif major == 2:
        return 6 + minor   # 2.0->6, 2.1->7
    elif major == 3:
        return 9 + minor   # 3.0->9, 3.1->10
    else:
        return major * 3 + minor  # rough heuristic for future majors


_INTERNAL_TO_DISPLAY = {
    1: "1.0.0", 2: "1.1.0", 3: "1.2.0", 4: "1.3.0", 5: "1.4.0",
    6: "2.0.0", 7: "2.1.0", 8: "2.2.0",
    9: "3.0.0",
}


def _display_version(internal: int) -> str:
    """Return a human-readable version string from an internal ordinal."""
    return _INTERNAL_TO_DISPLAY.get(internal, str(internal))


def _parse_output_schema_version(schema_version: Any) -> tuple[int, int] | None:
    """Parse output schema version string like '1.2' into (major, minor)."""
    if not isinstance(schema_version, str):
        return None

    match = re.match(r"^(\d+)\.(\d+)$", schema_version.strip())
    if not match:
        return None

    return int(match.group(1)), int(match.group(2))


def _is_output_schema_at_least(data: dict[str, Any], major: int, minor: int) -> bool:
    """Return True when output schema_version is >= major.minor."""
    parsed = _parse_output_schema_version(data.get("schema_version"))
    if parsed is None:
        return False
    parsed_major, parsed_minor = parsed
    return (parsed_major, parsed_minor) >= (major, minor)


def _requires_commit_tracking(protocol_version: int, output_payload: dict[str, Any]) -> bool:
    """Protocol 2.2.0+ OR output schema 1.2+ requires commit tracking fields."""
    if protocol_version >= 8:
        return True
    return _is_output_schema_at_least(output_payload, 1, 2)


def parse_protocol_version(request_content: str) -> int:
    """Parse protocol version from request markdown and return internal ordinal.

    Handles both semver ("2.0.0") and legacy integer ("6") formats.
    """
    # Try semver first: "Workpack Protocol Version: 2.0.0" or "2.1.0" or legacy "6"
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
    """Get protocol version from 00_request.md."""
    request_file = workpack_path / REQUEST_FILE_NAME
    if not request_file.exists():
        return 0

    try:
        return parse_protocol_version(request_file.read_text(encoding="utf-8"))
    except Exception:
        return 0


def discover_workpack_paths(
    scan_targets: list[Path],
    exclude_patterns: list[str] | None = None,
    workspace_root: Path | None = None,
) -> list[Path]:
    """Discover workpack directories by locating 00_request.md files."""
    return discover_workpack_paths_in_targets(
        scan_targets,
        request_file_name=REQUEST_FILE_NAME,
        exclude_patterns=exclude_patterns,
        workspace_root=workspace_root,
    )


def load_json(path: Path) -> tuple[Any | None, str | None]:
    """Load JSON from file and return (payload, error)."""
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle), None
    except json.JSONDecodeError as exc:
        return None, f"is not valid JSON: {exc}"
    except Exception as exc:  # noqa: BLE001
        return None, f"could not be read: {exc}"


def _format_schema_error(exc: Exception) -> str:
    """Return compact schema error text."""
    first_line = str(exc).splitlines()[0].strip()
    return first_line or str(exc)


def load_and_validate_schema(schema_path: Path, label: str) -> tuple[dict[str, Any] | None, str | None]:
    """Load a schema file and validate schema structure."""
    if not schema_path.exists():
        return None, f"Schema file not found: {schema_path}"

    payload, error = load_json(schema_path)
    if error:
        return None, f"{label} {error}"
    if not isinstance(payload, dict):
        return None, f"{label} must be a JSON object"

    jsonschema = ensure_jsonschema()
    try:
        jsonschema.Draft202012Validator.check_schema(payload)
    except Exception as exc:  # noqa: BLE001
        return None, f"{label} is not a valid JSON schema: {_format_schema_error(exc)}"
    return payload, None


def validate_against_schema(
    payload: Any,
    schema: dict[str, Any] | None,
    label: str,
    source_path: Path,
) -> str | None:
    """Validate payload against schema and return a formatted error on failure."""
    if schema is None:
        return None

    jsonschema = ensure_jsonschema()
    try:
        jsonschema.validate(payload, schema)
    except Exception as exc:  # noqa: BLE001
        return f"{label} validation failed for {source_path.name}: {_format_schema_error(exc)}"
    return None


def get_completed_prompts(workpack_path: Path) -> set[str]:
    """
    Parse 99_status.md to find completed prompts.
    
    Accepted completion markers:
    A-series: 🟢 Complete, 🟢 Done, ✅ Applied, ✅ Done, ✅ Completed
    B-series: ✅ Fixed, ✅ Resolved, ✅ Done, ✅ Applied
    
    Returns a set of prompt basenames (e.g., {"A1_api", "B1_asr_whisper_timeout"})
    """
    status_file = workpack_path / "99_status.md"
    if not status_file.exists():
        return set()
    
    completed = set()
    try:
        content = status_file.read_text(encoding="utf-8")
        
        # A-series accepted markers
        a_markers = r"(🟢\s*Complete|🟢\s*Done|✅\s*Applied|✅\s*Done|✅\s*Completed)"
        
        # B-series accepted markers (including ✅ Applied)
        b_markers = r"(✅\s*Fixed|✅\s*Resolved|✅\s*Done|✅\s*Applied)"
        
        # Look for A-series completions in table format: "| A1_api | ... | 🟢 Complete |"
        a_table_pattern = rf"\|\s*(A\d+_[\w_]+)\s*\|[^|]*{a_markers}"
        for match in re.finditer(a_table_pattern, content, re.IGNORECASE):
            completed.add(match.group(1))
        
        # Also match simpler patterns: "A1_api ... 🟢 Complete" on same line
        a_simple_pattern = rf"(A\d+_[\w_]+)[^\n]*{a_markers}"
        for match in re.finditer(a_simple_pattern, content, re.IGNORECASE):
            completed.add(match.group(1))
        
        # Look for B-series completions in table format: "| B1_xxx | ... | ✅ Fixed |"
        b_table_pattern = rf"\|\s*(B\d+_[\w_]+)\s*\|[^|]*{b_markers}"
        for match in re.finditer(b_table_pattern, content, re.IGNORECASE):
            completed.add(match.group(1))
        
        # Also match simpler patterns: "B1_xxx ... ✅ Fixed" on same line
        b_simple_pattern = rf"(B\d+_[\w_]+)[^\n]*{b_markers}"
        for match in re.finditer(b_simple_pattern, content, re.IGNORECASE):
            completed.add(match.group(1))

        # V-series completion markers
        v_markers = r"(✅\s*Passed|✅\s*Done|🟢\s*Complete|🟢\s*Done)"
        v_table_pattern = rf"\|\s*(V\d+_[\w_]+)\s*\|[^|]*{v_markers}"
        for match in re.finditer(v_table_pattern, content, re.IGNORECASE):
            completed.add(match.group(1))
        v_simple_pattern = rf"(V\d+_[\w_]+)[^\n]*{v_markers}"
        for match in re.finditer(v_simple_pattern, content, re.IGNORECASE):
            completed.add(match.group(1))

    except Exception:
        pass
    
    return completed


def detect_code_blocks_in_prompt(prompt_path: Path) -> list[tuple[int, str, bool]]:
    """
    Detect code blocks in a prompt file that shouldn't contain code.
    
    Returns a list of (line_number, language, is_suppressed) tuples for each code block found.
    """
    code_blocks: list[tuple[int, str, bool]] = []
    
    try:
        content = prompt_path.read_text(encoding="utf-8")
        lines = content.split('\n')
        
        # Pattern to match code block start: ```language
        code_block_pattern = re.compile(r"^```([^\s`]*)?\s*$")
        
        prev_line_has_ignore = False
        
        for i, line in enumerate(lines, 1):
            # Check if previous line has the ignore marker
            if i > 1:
                prev_line = lines[i - 2]  # -2 because enumerate is 1-indexed
                prev_line_has_ignore = LINT_IGNORE_MARKER in prev_line
            
            match = code_block_pattern.match(line.strip())
            if match:
                language = match.group(1) or ""
                language_lower = language.lower()
                
                # Check if this is a flagged language
                if language_lower in CODE_BLOCK_LANGUAGES:
                    is_suppressed = prev_line_has_ignore
                    code_blocks.append((i, language, is_suppressed))
    
    except Exception:
        pass
    
    return code_blocks


def validate_v3_prompts(workpack_path: Path, version: int = 3) -> tuple[list[str], list[str]]:
    """
    Validate 1.2.0+/1.3.0+ prompts for code-block violations.
    
    In 1.2.0: code blocks are warnings.
    In 1.3.0+: code blocks are errors.
    
    Returns (errors, warnings) tuple.
    """
    # TODO checklist:
    # [x] detect flagged code fence languages
    # [x] 1.2.0 warning behavior
    # [x] 1.3.0+ error behavior
    errors: list[str] = []
    warnings: list[str] = []
    workpack_name = workpack_path.name
    
    prompts_dir = workpack_path / "prompts"
    if not prompts_dir.exists():
        return errors, warnings
    
    for prompt_file in prompts_dir.glob("*.md"):
        # Only check A*.md, B*.md, V*.md, and R*.md files
        if not PROMPT_STEM_PATTERN.match(prompt_file.stem):
            continue
        
        code_blocks = detect_code_blocks_in_prompt(prompt_file)
        
        for line_num, language, is_suppressed in code_blocks:
            if is_suppressed:
                continue  # Skip suppressed warnings
            
            msg = (
                f"[{workpack_name}] Prompt '{prompt_file.stem}' line {line_num}: "
                f"Code block ```{language}``` found. "
                f"Protocol {_display_version(version)} discourages code in prompts. "
                f"Use semantic references instead, or add '{LINT_IGNORE_MARKER}' above to suppress."
            )
            
            if version >= 4:
                # In 1.3.0+, code blocks are errors
                errors.append(msg)
            else:
                # In 1.2.0, code blocks are warnings
                warnings.append(msg)
    
    return errors, warnings


def validate_v4_checks(workpack_path: Path) -> tuple[list[str], list[str]]:
    """
    Validate 1.3.0-specific rules:
    - ERR_NO_VERIFICATION: No V#_* prompt exists
    - WARN_BUGFIX_NO_VERIFY: B-series present but no V#_* prompt
    - WARN_B_SERIES_BUDGET: >5 B-series prompts
    - WARN_B_SERIES_RESCOPE: >8 B-series prompts
    - ERR_SEVERITY_MISSING: B-series prompt without ## Severity section
    - WARN_VERSION_MISMATCH: Protocol version inconsistency in prompts
    
    Returns (errors, warnings) tuple.
    """
    # TODO checklist:
    # [x] verification gate checks
    # [x] B-series budget/severity checks
    # [x] protocol reference mismatch checks
    errors: list[str] = []
    warnings: list[str] = []
    workpack_name = workpack_path.name
    
    prompts_dir = workpack_path / "prompts"
    if not prompts_dir.exists():
        return errors, warnings
    
    # Collect prompt types
    a_series = []
    b_series = []
    v_series = []
    
    for prompt_file in prompts_dir.glob("*.md"):
        stem = prompt_file.stem
        if re.match(r"^A\d+", stem):
            a_series.append(prompt_file)
        elif re.match(r"^B\d+", stem):
            b_series.append(prompt_file)
        elif re.match(r"^V\d+", stem):
            v_series.append(prompt_file)
    
    # ERR_NO_VERIFICATION: No V-series prompt
    if not v_series:
        errors.append(
            f"[{workpack_name}] ERR_NO_VERIFICATION: No V#_* verification prompt found. "
            f"Protocol requires at least one V-series verification gate."
        )
    
    # WARN_BUGFIX_NO_VERIFY: B-series present but no V-series prompt
    if b_series and not v_series:
        warnings.append(
            f"[{workpack_name}] WARN_BUGFIX_NO_VERIFY: {len(b_series)} B-series prompt(s) found "
            f"but no V#_* verification prompt. Consider adding V2_bugfix_verify.md for V-loop."
        )
    
    # B-Series budget checks
    b_count = len(b_series)
    if b_count > 8:
        warnings.append(
            f"[{workpack_name}] WARN_B_SERIES_RESCOPE: {b_count} B-series prompts (>8). "
            f"Consider re-scoping this workpack — it may be too large."
        )
    elif b_count > 5:
        warnings.append(
            f"[{workpack_name}] WARN_B_SERIES_BUDGET: {b_count} B-series prompts (>5). "
            f"Bug count is elevated — monitor closely."
        )
    
    # ERR_SEVERITY_MISSING: B-series prompt without ## Severity
    for b_file in b_series:
        try:
            content = b_file.read_text(encoding="utf-8")
            if not re.search(r"^##\s+Severity", content, re.MULTILINE):
                errors.append(
                    f"[{workpack_name}] ERR_SEVERITY_MISSING: B-series prompt '{b_file.stem}' "
                    f"is missing a '## Severity' section. Required in Protocol 1.3.0+."
                )
        except Exception:
            pass
    
    # WARN_VERSION_MISMATCH: Check prompts reference correct protocol version
    for prompt_file in prompts_dir.glob("*.md"):
        if not re.match(r"^[ABVR]", prompt_file.stem):
            continue
        try:
            content = prompt_file.read_text(encoding="utf-8")
            # Check for explicit old version references that should be updated
            if re.search(r"Protocol v3", content, re.IGNORECASE):
                warnings.append(
                    f"[{workpack_name}] WARN_VERSION_MISMATCH: Prompt '{prompt_file.stem}' "
                    f"references 'Protocol v3' but workpack is 1.3.0+. Update references."
                )
        except Exception:
            pass
    
    return errors, warnings


def _parse_yaml_front_matter(prompt_path: Path) -> dict[str, Any]:
    """Extract YAML front-matter (between --- markers) from a prompt file.

    Returns a dict with parsed keys, or empty dict if none found.
    Simple parser — handles ``key: value`` and ``key: [item, ...]`` lines.
    """
    try:
        lines = prompt_path.read_text(encoding="utf-8").splitlines()
    except Exception:
        return {}

    if not lines or lines[0].strip() != "---":
        return {}

    fm_lines: list[str] = []
    for line in lines[1:]:
        if line.strip() == "---":
            break
        fm_lines.append(line)
    else:
        return {}  # no closing ---

    result: dict[str, Any] = {}
    for line in fm_lines:
        m = re.match(r"^(\w[\w_]*):\s*(.*)$", line)
        if not m:
            continue
        key, raw = m.group(1), m.group(2).strip()
        # Parse inline list: [a, b, c]
        if raw.startswith("[") and raw.endswith("]"):
            items = [s.strip().strip("'\"") for s in raw[1:-1].split(",") if s.strip()]
            result[key] = items
        else:
            result[key] = raw
    return result


def validate_v5_checks(workpack_path: Path, protocol_version: int) -> tuple[list[str], list[str]]:
    """
    Validate 1.4.0-specific rules:
    - ERR_DAG_CYCLE: Circular dependency in depends_on graph
    - WARN_DAG_UNKNOWN_DEP: depends_on references a prompt that doesn't exist
    - WARN_NO_RETROSPECTIVE: Merged workpack has no R-series prompt
    - WARN_MISSING_REPOS: Prompt front-matter has no repos field
    - WARN_MISSING_EXECUTION: Completed output JSON has no execution block
    - WARN_MISSING_ARTIFACTS: Completed output missing artifacts block (2.2.0+/1.2+)
    - WARN_MISSING_COMMIT_SHAS: Completed output has missing/empty artifacts.commit_shas (2.2.0+/1.2+)
    - WARN_EMPTY_BRANCH_WORK: Completed output has empty branch.work (2.2.0+/1.2+)

    Returns (errors, warnings) tuple.
    """
    # TODO checklist:
    # [x] DAG unknown dependency check
    # [x] DAG cycle detection
    # [x] execution warning on outputs
    # [x] commit tracking warnings for protocol 2.2.0+/schema 1.2+
    errors: list[str] = []
    warnings: list[str] = []
    workpack_name = workpack_path.name

    prompts_dir = workpack_path / "prompts"
    if not prompts_dir.exists():
        return errors, warnings

    # Collect all prompt stems and their depends_on
    prompt_stems: set[str] = set()
    dag: dict[str, list[str]] = {}

    for pf in prompts_dir.glob("*.md"):
        stem = pf.stem
        if not PROMPT_STEM_PATTERN.match(stem):
            continue
        prompt_stems.add(stem)
        fm = _parse_yaml_front_matter(pf)
        deps = fm.get("depends_on", [])
        if isinstance(deps, list):
            dag[stem] = deps
        else:
            dag[stem] = []

        # WARN_MISSING_REPOS — only for A/B series
        if stem[0] in ("A", "B") and not stem.startswith("A0"):
            repos = fm.get("repos")
            if repos is not None and isinstance(repos, list) and len(repos) == 0:
                warnings.append(
                    f"[{workpack_name}] WARN_MISSING_REPOS: Prompt '{stem}' has empty "
                    f"'repos' in front-matter. Declare which repos it touches."
                )

    # DAG validation — unknown deps
    for stem, deps in dag.items():
        for dep in deps:
            if dep and dep not in prompt_stems:
                warnings.append(
                    f"[{workpack_name}] WARN_DAG_UNKNOWN_DEP: Prompt '{stem}' depends on "
                    f"'{dep}' which does not exist in prompts/."
                )

    # DAG validation — cycle detection (simple DFS)
    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {s: WHITE for s in dag}

    def _dfs(node: str) -> str | None:
        color[node] = GRAY
        for dep in dag.get(node, []):
            if dep not in color:
                continue
            if color[dep] == GRAY:
                return f"{dep} ↔ {node}"
            if color[dep] == WHITE:
                cycle = _dfs(dep)
                if cycle:
                    return cycle
        color[node] = BLACK
        return None

    for stem in dag:
        if color.get(stem) == WHITE:
            cycle = _dfs(stem)
            if cycle:
                errors.append(
                    f"[{workpack_name}] ERR_DAG_CYCLE: Circular dependency detected: {cycle}. "
                    f"Fix the depends_on fields to remove the cycle."
                )
                break  # one error is enough

    # WARN_MISSING_EXECUTION — check completed output JSONs for execution field
    outputs_dir = workpack_path / "outputs"
    if outputs_dir.exists():
        for out_file in outputs_dir.glob("*.json"):
            try:
                data = json.load(out_file.open(encoding="utf-8"))
                if "execution" not in data:
                    warnings.append(
                        f"[{workpack_name}] WARN_MISSING_EXECUTION: Output '{out_file.stem}.json' "
                        f"has no 'execution' block. Protocol 1.4.0+ recommends tracking cost metrics."
                    )
            except Exception:
                pass  # JSON parse errors handled by validate_workpack

    completed_prompts = get_completed_prompts(workpack_path)
    if outputs_dir.exists():
        for prompt_stem in completed_prompts:
            output_path = outputs_dir / f"{prompt_stem}.json"
            if not output_path.exists():
                continue

            data, json_error = load_json(output_path)
            if json_error or not isinstance(data, dict):
                continue

            if not _requires_commit_tracking(protocol_version, data):
                continue

            artifacts = data.get("artifacts")
            if not isinstance(artifacts, dict):
                warnings.append(
                    f"[{workpack_name}] WARN_MISSING_ARTIFACTS: Output '{prompt_stem}.json' "
                    f"is missing 'artifacts'. Protocol 2.2.0+/schema 1.2+ expects commit tracking metadata."
                )
                warnings.append(
                    f"[{workpack_name}] WARN_MISSING_COMMIT_SHAS: Output '{prompt_stem}.json' "
                    f"is missing 'artifacts.commit_shas'. Record commit SHA(s) for this prompt."
                )
            else:
                commit_shas = artifacts.get("commit_shas")
                valid_sha_list = (
                    isinstance(commit_shas, list)
                    and any(isinstance(sha, str) and sha.strip() for sha in commit_shas)
                )
                if not valid_sha_list:
                    warnings.append(
                        f"[{workpack_name}] WARN_MISSING_COMMIT_SHAS: Output '{prompt_stem}.json' "
                        f"has empty or missing 'artifacts.commit_shas'. Record commit SHA(s) for this prompt."
                    )

            branch = data.get("branch")
            branch_work = branch.get("work") if isinstance(branch, dict) else None
            if not isinstance(branch_work, str) or not branch_work.strip():
                warnings.append(
                    f"[{workpack_name}] WARN_EMPTY_BRANCH_WORK: Output '{prompt_stem}.json' "
                    f"has empty 'branch.work'. Set it to the branch where the prompt commits were made."
                )

    return errors, warnings


def validate_workpack(workpack_path: Path, schema_path: Path) -> list[str]:
    """
    Validate a v2+ (1.1.0+) workpack.
    
    Returns a list of error messages (empty if valid).
    """
    # TODO checklist:
    # [x] output folder and prompt folder checks
    # [x] completed prompt -> output JSON existence checks
    # [x] output identity/required field checks
    errors: list[str] = []
    workpack_name = workpack_path.name
    
    # Check outputs/ directory exists
    outputs_dir = workpack_path / "outputs"
    if not outputs_dir.exists():
        errors.append(f"[{workpack_name}] Missing outputs/ directory (required for Protocol 1.1.0+)")
    
    # Check prompts/ directory exists
    prompts_dir = workpack_path / "prompts"
    if not prompts_dir.exists():
        errors.append(f"[{workpack_name}] Missing prompts/ directory")
        return errors  # Can't continue without prompts
    
    # Check schema exists
    if not schema_path.exists():
        errors.append(f"[{workpack_name}] Schema file not found: {schema_path}")
    
    # Get completed prompts from status
    completed_prompts = get_completed_prompts(workpack_path)
    
    # Check each completed prompt has a corresponding output JSON
    for prompt_file in prompts_dir.glob("*.md"):
        # Only check A*.md, B*.md, V*.md, R*.md files
        if not PROMPT_STEM_PATTERN.match(prompt_file.stem):
            continue
        
        prompt_basename = prompt_file.stem
        
        # Only validate if the prompt is marked complete
        if prompt_basename in completed_prompts:
            output_file = outputs_dir / f"{prompt_basename}.json"
            if not output_file.exists():
                errors.append(
                    f"[{workpack_name}] Prompt '{prompt_basename}' is marked complete but "
                    f"output JSON is missing: outputs/{prompt_basename}.json"
                )
            else:
                # Validate JSON is parseable
                try:
                    data, json_error = load_json(output_file)
                    if json_error:
                        errors.append(f"[{workpack_name}] Output '{prompt_basename}.json' {json_error}")
                        continue
                    if not isinstance(data, dict):
                        errors.append(f"[{workpack_name}] Output '{prompt_basename}.json' must be a JSON object")
                        continue
                    
                    # Basic schema validation (check required fields)
                    required_fields = [
                        "schema_version", "workpack", "prompt", "component",
                        "delivery_mode", "branch", "changes", "verification", "handoff"
                    ]
                    for field in required_fields:
                        if field not in data:
                            errors.append(
                                f"[{workpack_name}] Output '{prompt_basename}.json' "
                                f"missing required field: {field}"
                            )
                    
                    # Validate workpack and prompt field values match actual names
                    if "workpack" in data and data["workpack"] != workpack_name:
                        errors.append(
                            f"[{workpack_name}] Output '{prompt_basename}.json' "
                            f"has workpack='{data['workpack']}' but should be '{workpack_name}'"
                        )
                    
                    if "prompt" in data and data["prompt"] != prompt_basename:
                        errors.append(
                            f"[{workpack_name}] Output '{prompt_basename}.json' "
                            f"has prompt='{data['prompt']}' but should be '{prompt_basename}'"
                        )
                    
                    # Check nested required fields
                    if "branch" in data:
                        for bf in ["base", "work", "merge_target"]:
                            if bf not in data["branch"]:
                                errors.append(
                                    f"[{workpack_name}] Output '{prompt_basename}.json' "
                                    f"missing branch.{bf}"
                                )
                    
                    if "changes" in data:
                        for cf in ["files_modified", "files_created", "contracts_changed", "breaking_change"]:
                            if cf not in data["changes"]:
                                errors.append(
                                    f"[{workpack_name}] Output '{prompt_basename}.json' "
                                    f"missing changes.{cf}"
                                )
                    
                    if "verification" in data:
                        if "commands" not in data["verification"]:
                            errors.append(
                                f"[{workpack_name}] Output '{prompt_basename}.json' "
                                f"missing verification.commands"
                            )
                    
                    if "handoff" in data:
                        for hf in ["summary", "next_steps", "known_issues"]:
                            if hf not in data["handoff"]:
                                errors.append(
                                    f"[{workpack_name}] Output '{prompt_basename}.json' "
                                    f"missing handoff.{hf}"
                                )
                
                except Exception as e:  # noqa: BLE001
                    errors.append(
                        f"[{workpack_name}] Output '{prompt_basename}.json' "
                        f"could not be validated: {e}"
                    )
    
    return errors


def _collect_prompt_stems(workpack_path: Path) -> set[str]:
    """Collect A/B/V/R prompt stems from prompts/ directory."""
    prompts_dir = workpack_path / "prompts"
    if not prompts_dir.exists():
        return set()

    stems: set[str] = set()
    for prompt_file in prompts_dir.glob("*.md"):
        if PROMPT_STEM_PATTERN.match(prompt_file.stem):
            stems.add(prompt_file.stem)
    return stems


def _extract_meta_prompt_stems(meta_payload: dict[str, Any]) -> set[str]:
    """Extract prompt stems from workpack.meta.json prompts array."""
    stems: set[str] = set()
    prompts = meta_payload.get("prompts")
    if not isinstance(prompts, list):
        return stems

    for prompt in prompts:
        if not isinstance(prompt, dict):
            continue
        stem = prompt.get("stem")
        if isinstance(stem, str) and stem:
            stems.add(stem)
    return stems


def _normalize_depends_on(raw_value: Any) -> list[str]:
    """Normalize depends_on payloads into a sorted unique list of stems."""
    if not isinstance(raw_value, list):
        return []

    deps: set[str] = set()
    for item in raw_value:
        if isinstance(item, str):
            normalized = item.strip()
            if normalized:
                deps.add(normalized)
    return sorted(deps)


def _extract_front_matter_depends_map(workpack_path: Path) -> dict[str, list[str]]:
    """Collect depends_on declarations from prompt YAML front-matter."""
    prompts_dir = workpack_path / "prompts"
    if not prompts_dir.exists():
        return {}

    depends_map: dict[str, list[str]] = {}
    for prompt_file in prompts_dir.glob("*.md"):
        stem = prompt_file.stem
        if not PROMPT_STEM_PATTERN.match(stem):
            continue
        front_matter = _parse_yaml_front_matter(prompt_file)
        depends_map[stem] = _normalize_depends_on(front_matter.get("depends_on"))
    return depends_map


def _extract_meta_depends_map(meta_payload: dict[str, Any]) -> dict[str, list[str]]:
    """Collect depends_on declarations from workpack.meta.json prompts[] entries."""
    prompts = meta_payload.get("prompts")
    if not isinstance(prompts, list):
        return {}

    depends_map: dict[str, list[str]] = {}
    for prompt in prompts:
        if not isinstance(prompt, dict):
            continue
        stem = prompt.get("stem")
        if not isinstance(stem, str) or not stem:
            continue
        depends_map[stem] = _normalize_depends_on(prompt.get("depends_on"))
    return depends_map


def _format_depends_for_warning(depends_on: list[str]) -> str:
    """Render depends_on list for drift diagnostics."""
    if not depends_on:
        return "[]"
    return "[" + ", ".join(depends_on) + "]"


def _b_series_depends_drift_details(
    front_matter_depends: dict[str, list[str]],
    meta_depends: dict[str, list[str]],
) -> list[str]:
    """Return detail rows for B-series depends_on mismatches."""
    details: list[str] = []
    shared_b_stems = sorted(
        stem
        for stem in set(front_matter_depends).intersection(meta_depends)
        if stem.startswith("B")
    )

    for stem in shared_b_stems:
        front_deps = front_matter_depends.get(stem, [])
        meta_deps = meta_depends.get(stem, [])
        if front_deps != meta_deps:
            details.append(
                f"{stem} (front-matter: {_format_depends_for_warning(front_deps)}; "
                f"meta: {_format_depends_for_warning(meta_deps)})"
            )
    return details


def _state_drift_reason(state_payload: dict[str, Any]) -> str | None:
    """Explain why overall_status is inconsistent with prompt_status."""
    overall_status = state_payload.get("overall_status")
    prompt_status = state_payload.get("prompt_status")
    if not isinstance(prompt_status, dict) or not prompt_status:
        return None

    statuses: list[str] = []
    for prompt_data in prompt_status.values():
        if not isinstance(prompt_data, dict):
            continue
        status = prompt_data.get("status")
        if isinstance(status, str):
            statuses.append(status)

    if not statuses:
        return None

    blocked_by = state_payload.get("blocked_by")
    has_blockers = isinstance(blocked_by, list) and len(blocked_by) > 0
    all_pending = all(status == "pending" for status in statuses)
    all_complete = all(status in {"complete", "skipped"} for status in statuses)
    any_in_progress = any(status == "in_progress" for status in statuses)
    any_blocked = any(status == "blocked" for status in statuses)

    if overall_status == "not_started":
        if not all_pending:
            return "overall_status is 'not_started' but one or more prompts already started."
        return None

    if overall_status == "in_progress":
        if all_pending:
            return "overall_status is 'in_progress' but all prompts are pending."
        if all_complete:
            return "overall_status is 'in_progress' but all prompts are complete/skipped."
        return None

    if overall_status == "blocked":
        if not any_blocked and not has_blockers:
            return "overall_status is 'blocked' but no prompt is blocked and blocked_by is empty."
        return None

    if overall_status == "review":
        if any_in_progress or any_blocked:
            return "overall_status is 'review' but prompts remain in_progress/blocked."
        if all_pending:
            return "overall_status is 'review' but no prompt has started."
        return None

    if overall_status == "complete":
        if not all_complete:
            return "overall_status is 'complete' but not all prompts are complete/skipped."
        if has_blockers:
            return "overall_status is 'complete' but blocked_by is not empty."
        return None

    if overall_status == "abandoned":
        return None

    return None


def validate_v6_checks(workpack_path: Path, schemas: SchemaBundle) -> tuple[list[str], list[str]]:
    """
    Validate 2.0.0-specific rules.

    - ERR_MISSING_META
    - WARN_META_ID_MISMATCH
    - WARN_META_PROMPTS_DRIFT (prompt stem or B-series depends_on drift)
    - WARN_STATE_DRIFT
    - Schema checks for workpack.meta.json/workpack.state.json
    """
    # TODO checklist:
    # [x] ERR_MISSING_META
    # [x] WARN_META_ID_MISMATCH
    # [x] WARN_META_PROMPTS_DRIFT
    # [x] WARN_STATE_DRIFT
    # [x] schema validation for meta/state files
    errors: list[str] = []
    warnings: list[str] = []
    workpack_name = workpack_path.name

    meta_path = workpack_path / "workpack.meta.json"
    state_path = workpack_path / "workpack.state.json"

    meta_payload: dict[str, Any] | None = None

    if not meta_path.exists():
        errors.append(
            f"[{workpack_name}] ERR_MISSING_META: missing workpack.meta.json (required for Protocol 2.0.0+)."
        )
    else:
        raw_meta, meta_error = load_json(meta_path)
        if meta_error:
            errors.append(f"[{workpack_name}] ERR_META_JSON_INVALID: {meta_path.name} {meta_error}")
        elif not isinstance(raw_meta, dict):
            errors.append(f"[{workpack_name}] ERR_META_JSON_INVALID: {meta_path.name} must be a JSON object.")
        else:
            meta_payload = raw_meta
            schema_error = validate_against_schema(meta_payload, schemas.meta, "WORKPACK_META_SCHEMA.json", meta_path)
            if schema_error:
                errors.append(f"[{workpack_name}] ERR_META_SCHEMA_INVALID: {schema_error}")

            meta_id = meta_payload.get("id")
            if isinstance(meta_id, str) and meta_id != workpack_name:
                warnings.append(
                    f"[{workpack_name}] WARN_META_ID_MISMATCH: workpack.meta.json id '{meta_id}' "
                    f"does not match folder name '{workpack_name}'."
                )

            prompt_files = _collect_prompt_stems(workpack_path)
            meta_prompts = _extract_meta_prompt_stems(meta_payload)
            if meta_prompts != prompt_files:
                missing_in_meta = sorted(prompt_files - meta_prompts)
                missing_in_prompts = sorted(meta_prompts - prompt_files)
                drift_parts: list[str] = []
                if missing_in_meta:
                    drift_parts.append(f"missing in meta: {', '.join(missing_in_meta)}")
                if missing_in_prompts:
                    drift_parts.append(f"missing in prompts/: {', '.join(missing_in_prompts)}")
                drift_text = "; ".join(drift_parts) if drift_parts else "prompt sets differ"
                warnings.append(
                    f"[{workpack_name}] WARN_META_PROMPTS_DRIFT: workpack.meta.json prompts[] differs from "
                    f"prompts/*.md ({drift_text})."
                )

            front_matter_depends = _extract_front_matter_depends_map(workpack_path)
            meta_depends = _extract_meta_depends_map(meta_payload)
            b_depends_drift = _b_series_depends_drift_details(front_matter_depends, meta_depends)
            if b_depends_drift:
                warnings.append(
                    f"[{workpack_name}] WARN_META_PROMPTS_DRIFT: B-series depends_on mismatch between "
                    f"prompts/*.md and workpack.meta.json ({'; '.join(b_depends_drift)})."
                )

    if not state_path.exists():
        warnings.append(
            f"[{workpack_name}] WARN_STATE_DRIFT: workpack.state.json missing; state consistency checks skipped."
        )
        return errors, warnings

    raw_state, state_error = load_json(state_path)
    if state_error:
        errors.append(f"[{workpack_name}] ERR_STATE_JSON_INVALID: {state_path.name} {state_error}")
        return errors, warnings
    if not isinstance(raw_state, dict):
        errors.append(f"[{workpack_name}] ERR_STATE_JSON_INVALID: {state_path.name} must be a JSON object.")
        return errors, warnings

    schema_error = validate_against_schema(raw_state, schemas.state, "WORKPACK_STATE_SCHEMA.json", state_path)
    if schema_error:
        errors.append(f"[{workpack_name}] ERR_STATE_SCHEMA_INVALID: {schema_error}")

    if meta_payload is not None:
        meta_id = meta_payload.get("id")
        state_id = raw_state.get("workpack_id")
        if isinstance(meta_id, str) and isinstance(state_id, str) and meta_id != state_id:
            warnings.append(
                f"[{workpack_name}] WARN_STATE_DRIFT: workpack.state.json workpack_id '{state_id}' "
                f"does not match workpack.meta.json id '{meta_id}'."
            )

    state_drift = _state_drift_reason(raw_state)
    if state_drift:
        warnings.append(f"[{workpack_name}] WARN_STATE_DRIFT: {state_drift}")

    return errors, warnings


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Workpack Protocol Linter",
        epilog="Validates workpacks for protocol compliance.",
    )
    strict_group = parser.add_mutually_exclusive_group()
    strict_group.add_argument(
        "--strict",
        dest="strict",
        action="store_true",
        help="Treat warnings as errors (exit code 2 if warnings found).",
    )
    strict_group.add_argument(
        "--no-strict",
        dest="strict",
        action="store_false",
        help="Disable strict warnings mode even when strictMode=true in config.",
    )
    parser.set_defaults(strict=None)
    parser.add_argument(
        "paths",
        nargs="*",
        help="Optional scan paths (workpacks dir, instances dir, group dir, workpack dir, or 00_request.md).",
    )
    args = parser.parse_args()

    print("Workpack Protocol Linter")
    print("=" * 40)

    try:
        tool_config = load_tool_config(
            start_dir=Path.cwd(),
            workspace_root=WORKSPACE_ROOT,
            script_workpacks_dir=SCRIPT_WORKPACKS_DIR,
            schema_path=SCRIPT_WORKPACKS_DIR / "WORKPACK_CONFIG_SCHEMA.json",
        )
        workpacks_dir = get_workpacks_dir(tool_config)
    except (FileNotFoundError, WorkpackConfigError) as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)

    print(render_config_message(tool_config))
    print(f"Detected workpacks dir: {workpacks_dir}")

    strict_mode = bool(args.strict) if args.strict is not None else tool_config.strict_mode
    if args.strict is True:
        print("Mode: --strict (warnings treated as errors)")
    elif args.strict is False:
        print("Mode: --no-strict (warnings do not fail the run)")
    elif strict_mode:
        print("Mode: strictMode=true from workpack.config.json (warnings treated as errors)")

    if tool_config.protocol_version is not None:
        print(f"Protocol policy: minimum {tool_config.protocol_version}")

    output_schema_path = workpacks_dir / "WORKPACK_OUTPUT_SCHEMA.json"
    meta_schema_path = workpacks_dir / "WORKPACK_META_SCHEMA.json"
    state_schema_path = workpacks_dir / "WORKPACK_STATE_SCHEMA.json"

    meta_schema, meta_schema_error = load_and_validate_schema(meta_schema_path, "WORKPACK_META_SCHEMA.json")
    state_schema, state_schema_error = load_and_validate_schema(state_schema_path, "WORKPACK_STATE_SCHEMA.json")

    if meta_schema_error:
        print(f"ERROR: {meta_schema_error}")
    if state_schema_error:
        print(f"ERROR: {state_schema_error}")
    if meta_schema_error or state_schema_error:
        sys.exit(1)

    schema_bundle = SchemaBundle(output=None, meta=meta_schema, state=state_schema)

    explicit_targets = [Path(raw_path).resolve() for raw_path in args.paths] if args.paths else None
    scan_targets, scan_target_warnings = build_discovery_scan_targets(
        tool_config,
        explicit_paths=explicit_targets,
        workspace_root=WORKSPACE_ROOT,
        current_dir=Path.cwd(),
    )
    for warning in scan_target_warnings:
        print(f"WARNING: {warning}")

    if args.paths:
        missing_targets = [target for target in scan_targets if not target.exists()]
        if missing_targets:
            print("ERROR: One or more scan targets do not exist:")
            for target in missing_targets:
                print(f"  - {target}")
            sys.exit(1)

    if not scan_targets:
        print("ERROR: No valid scan targets resolved.")
        sys.exit(1)

    discovery_excludes = normalize_discovery_excludes(tool_config.discovery_exclude)
    workpack_paths = discover_workpack_paths_in_targets(
        scan_targets,
        request_file_name=REQUEST_FILE_NAME,
        exclude_patterns=discovery_excludes,
        workspace_root=WORKSPACE_ROOT,
    )
    if not workpack_paths:
        print("ERROR: No workpack directories found.")
        sys.exit(1)

    print(f"Scan targets: {', '.join(str(target) for target in scan_targets)}")
    print(
        "Discovery excludes: "
        + (", ".join(discovery_excludes) if discovery_excludes else "none")
    )
    print(f"Discovered workpacks: {len(workpack_paths)}")

    all_errors: list[str] = []
    all_warnings: list[str] = []
    version_counts: dict[int, int] = {}
    skipped_count = 0

    for workpack in workpack_paths:
        version = get_workpack_version(workpack)

        if tool_config.protocol_version_internal is not None:
            if version <= 0:
                all_errors.append(
                    f"[{workpack.name}] ERR_PROTOCOL_VERSION_POLICY: could not parse Workpack Protocol Version "
                    f"(configured minimum is {tool_config.protocol_version})."
                )
                continue
            if version < tool_config.protocol_version_internal:
                all_errors.append(
                    f"[{workpack.name}] ERR_PROTOCOL_VERSION_POLICY: protocol {_display_version(version)} is below "
                    f"configured minimum {tool_config.protocol_version}."
                )
                continue

        if version < 2:
            skipped_count += 1
            print(f"  - Skipping (not 1.1.0+): {workpack}")
            continue

        version_counts[version] = version_counts.get(version, 0) + 1
        print(f"  * Validating {_display_version(version)} workpack: {workpack}")

        all_errors.extend(validate_workpack(workpack, output_schema_path))

        if 3 <= version <= 5:
            v3_errors, v3_warnings = validate_v3_prompts(workpack, version=version)
            all_errors.extend(v3_errors)
            all_warnings.extend(v3_warnings)

        if version >= 4:
            v4_errors, v4_warnings = validate_v4_checks(workpack)
            all_errors.extend(v4_errors)
            all_warnings.extend(v4_warnings)

        if version >= 5:
            v5_errors, v5_warnings = validate_v5_checks(workpack, version)
            all_errors.extend(v5_errors)
            all_warnings.extend(v5_warnings)

        if version >= 6:
            v6_errors, v6_warnings = validate_v6_checks(workpack, schema_bundle)
            all_errors.extend(v6_errors)
            all_warnings.extend(v6_warnings)

    print()
    rendered_counts = ", ".join(
        f"{_display_version(version)}:{count}" for version, count in sorted(version_counts.items(), key=lambda item: item[0], reverse=True)
    )
    if not rendered_counts:
        rendered_counts = "none"
    print(f"Summary: validated={sum(version_counts.values())} ({rendered_counts}), skipped={skipped_count}")

    if all_warnings:
        print()
        print("WARNINGS:")
        print("-" * 40)
        for warning in all_warnings:
            print(f"  ! {warning}")
        print(f"Total warnings: {len(all_warnings)}")

    if all_errors:
        print()
        print("ERRORS FOUND:")
        print("-" * 40)
        for error in all_errors:
            print(f"  X {error}")
        print(f"Total errors: {len(all_errors)}")
        sys.exit(1)

    if all_warnings and strict_mode:
        print()
        if args.strict is None:
            print("Warnings found and strictMode=true from workpack.config.json")
        else:
            print("Warnings found and --strict mode is enabled")
        sys.exit(2)

    print()
    print("All workpacks pass validation")
    sys.exit(0)


if __name__ == "__main__":
    main()
