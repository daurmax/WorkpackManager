#!/usr/bin/env python3
"""Commit SHA verification utility for workpack output artifacts."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class CompletedOutput:
    """Loaded output payload for a completed prompt."""

    prompt_stem: str
    path: Path
    payload: dict[str, Any]


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


def _load_json(path: Path) -> tuple[Any | None, str | None]:
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except json.JSONDecodeError as exc:
        return None, f"invalid JSON ({exc})"
    except OSError as exc:
        return None, str(exc)


def _parse_semver(raw: Any) -> tuple[int, int, int] | None:
    if not isinstance(raw, str):
        return None
    match = re.match(r"^\s*(\d+)\.(\d+)(?:\.(\d+))?(?:[-+].*)?\s*$", raw)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2)), int(match.group(3) or 0)


def _supports_commit_checks(workpack_dir: Path) -> tuple[bool, list[dict[str, Any]]]:
    meta_path = workpack_dir / "workpack.meta.json"
    payload, error = _load_json(meta_path)
    if error or not isinstance(payload, dict):
        return False, [
            _result(
                "INFO_PROTOCOL_NOT_APPLICABLE",
                "info",
                "Commit checks require a readable workpack.meta.json with protocol_version >= 2.2.0.",
                {"meta_path": str(meta_path), "error": error or "meta is not a JSON object"},
            )
        ]

    protocol_version = payload.get("protocol_version")
    parsed = _parse_semver(protocol_version)
    if parsed is None or parsed < (2, 2, 0):
        return False, [
            _result(
                "INFO_PROTOCOL_NOT_APPLICABLE",
                "info",
                "Commit checks apply only to protocol_version 2.2.0+ workpacks; skipping.",
                {
                    "workpack_dir": str(workpack_dir),
                    "protocol_version": protocol_version,
                },
            )
        ]

    return True, []


def _find_git_root(start: Path) -> Path | None:
    for candidate in [start, *start.parents]:
        if (candidate / ".git").exists():
            return candidate
    return None


def _run_git(repo_root: Path, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=str(repo_root),
        text=True,
        capture_output=True,
        check=False,
    )


def _normalize_file_path(raw: str) -> str:
    return raw.strip().replace("\\", "/")


def _collect_completed_stems(workpack_dir: Path) -> set[str] | None:
    state_path = workpack_dir / "workpack.state.json"
    if not state_path.is_file():
        return None

    payload, error = _load_json(state_path)
    if error or not isinstance(payload, dict):
        return None

    prompt_status = payload.get("prompt_status")
    if not isinstance(prompt_status, dict):
        return set()

    completed: set[str] = set()
    for stem, status_payload in prompt_status.items():
        if not isinstance(stem, str):
            continue
        if isinstance(status_payload, dict) and status_payload.get("status") == "complete":
            completed.add(stem)
    return completed


def _collect_completed_outputs(workpack_dir: Path) -> tuple[list[CompletedOutput], list[dict[str, Any]]]:
    findings: list[dict[str, Any]] = []
    outputs_dir = workpack_dir / "outputs"
    if not outputs_dir.is_dir():
        findings.append(
            _result(
                "INFO_OUTPUTS_MISSING",
                "info",
                "outputs directory is missing; commit checks skipped for this workpack.",
                {"outputs_dir": str(outputs_dir)},
            )
        )
        return [], findings

    completed_stems = _collect_completed_stems(workpack_dir)
    loaded: list[CompletedOutput] = []

    for output_path in sorted(outputs_dir.glob("*.json")):
        stem = output_path.stem
        if completed_stems is not None and stem not in completed_stems:
            continue

        payload, error = _load_json(output_path)
        if error:
            findings.append(
                _result(
                    "ERR_OUTPUT_JSON_INVALID",
                    "error",
                    f"Failed to parse output '{output_path.name}'.",
                    {"output_file": str(output_path), "error": error},
                )
            )
            continue
        if not isinstance(payload, dict):
            findings.append(
                _result(
                    "ERR_OUTPUT_JSON_INVALID",
                    "error",
                    f"Output '{output_path.name}' must be a JSON object.",
                    {"output_file": str(output_path)},
                )
            )
            continue

        loaded.append(CompletedOutput(prompt_stem=stem, path=output_path, payload=payload))

    if not loaded:
        findings.append(
            _result(
                "INFO_NO_COMPLETED_OUTPUTS",
                "info",
                "No completed output JSON files were found for commit verification.",
                {"workpack_dir": str(workpack_dir)},
            )
        )

    return loaded, findings


def _extract_commit_shas(payload: dict[str, Any]) -> list[str]:
    artifacts = payload.get("artifacts")
    if not isinstance(artifacts, dict):
        return []

    raw = artifacts.get("commit_shas")
    if not isinstance(raw, list):
        return []

    values: list[str] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, str):
            continue
        normalized = item.strip()
        if not normalized:
            continue
        key = normalized.casefold()
        if key in seen:
            continue
        seen.add(key)
        values.append(normalized)
    return values


def _extract_declared_files(payload: dict[str, Any]) -> set[str]:
    raw = payload.get("change_details")
    if not isinstance(raw, list):
        return set()

    declared: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        file_path = item.get("file")
        if isinstance(file_path, str) and file_path.strip():
            declared.add(_normalize_file_path(file_path))
    return declared


def _parse_branch_shas(git_log_output: str) -> set[str]:
    values: set[str] = set()
    for line in git_log_output.splitlines():
        token = line.strip().split(maxsplit=1)[0] if line.strip() else ""
        if token and re.fullmatch(r"[0-9a-fA-F]+", token):
            values.add(token.lower())
    return values


def _sha_exists_on_branch(sha: str, branch_shas: set[str]) -> bool:
    candidate = sha.strip().lower()
    if not candidate:
        return False
    for branch_sha in branch_shas:
        if branch_sha.startswith(candidate) or candidate.startswith(branch_sha):
            return True
    return False


def _parse_changed_files_from_stat(git_show_output: str) -> set[str]:
    changed: set[str] = set()
    for line in git_show_output.splitlines():
        if "|" not in line:
            continue
        stat_file = line.split("|", maxsplit=1)[0].strip()
        if stat_file:
            changed.add(_normalize_file_path(stat_file))
    return changed


def check_commit_shas_exist(workpack_dir: str | Path, work_branch: str) -> list[dict[str, Any]]:
    """
    Verify each SHA in artifacts.commit_shas exists on the provided work branch.

    Uses git log --oneline <branch> for existence checks.
    """
    workpack_path = Path(workpack_dir).resolve()
    findings: list[dict[str, Any]] = []

    supports_checks, support_findings = _supports_commit_checks(workpack_path)
    findings.extend(support_findings)
    if not supports_checks:
        return findings

    git_root = _find_git_root(workpack_path)
    if git_root is None:
        findings.append(
            _result(
                "INFO_GIT_UNAVAILABLE",
                "info",
                "No .git directory found; SHA existence checks skipped.",
                {"workpack_dir": str(workpack_path)},
            )
        )
        return findings

    outputs, output_findings = _collect_completed_outputs(workpack_path)
    findings.extend(output_findings)
    if not outputs:
        return findings

    git_log = _run_git(git_root, ["log", "--oneline", work_branch])
    if git_log.returncode != 0:
        findings.append(
            _result(
                "ERR_GIT_LOG_FAILED",
                "error",
                f"Failed to load git log for branch '{work_branch}'.",
                {
                    "repo_root": str(git_root),
                    "work_branch": work_branch,
                    "stderr": git_log.stderr.strip(),
                },
            )
        )
        return findings

    branch_shas = _parse_branch_shas(git_log.stdout)
    for output in outputs:
        commit_shas = _extract_commit_shas(output.payload)
        if not commit_shas:
            findings.append(
                _result(
                    "WARN_MISSING_COMMIT_SHAS",
                    "warning",
                    f"Output '{output.path.name}' has no artifacts.commit_shas entries to verify.",
                    {"prompt": output.prompt_stem, "output_file": str(output.path)},
                )
            )
            continue

        for sha in commit_shas:
            if _sha_exists_on_branch(sha, branch_shas):
                continue
            findings.append(
                _result(
                    "ERR_SHA_NOT_ON_BRANCH",
                    "error",
                    f"Commit SHA '{sha}' from '{output.path.name}' was not found on branch '{work_branch}'.",
                    {
                        "prompt": output.prompt_stem,
                        "sha": sha,
                        "work_branch": work_branch,
                        "output_file": str(output.path),
                    },
                )
            )

    return findings


def cross_reference_change_details(workpack_dir: str | Path) -> list[dict[str, Any]]:
    """
    Cross-reference change_details[].file values against git show --stat for each commit SHA.

    Reports:
    - files present in commit stats but missing in change_details
    - files declared in change_details but absent from commit stats
    """
    workpack_path = Path(workpack_dir).resolve()
    findings: list[dict[str, Any]] = []

    supports_checks, support_findings = _supports_commit_checks(workpack_path)
    findings.extend(support_findings)
    if not supports_checks:
        return findings

    git_root = _find_git_root(workpack_path)
    if git_root is None:
        findings.append(
            _result(
                "INFO_GIT_UNAVAILABLE",
                "info",
                "No .git directory found; change_details cross-reference checks skipped.",
                {"workpack_dir": str(workpack_path)},
            )
        )
        return findings

    outputs, output_findings = _collect_completed_outputs(workpack_path)
    findings.extend(output_findings)
    if not outputs:
        return findings

    for output in outputs:
        commit_shas = _extract_commit_shas(output.payload)
        if not commit_shas:
            findings.append(
                _result(
                    "WARN_MISSING_COMMIT_SHAS",
                    "warning",
                    f"Output '{output.path.name}' has no commit SHAs; change_details cross-reference skipped.",
                    {"prompt": output.prompt_stem, "output_file": str(output.path)},
                )
            )
            continue

        declared_files = _extract_declared_files(output.payload)
        all_commit_files: set[str] = set()

        for sha in commit_shas:
            git_show = _run_git(git_root, ["show", "--stat", sha])
            if git_show.returncode != 0:
                findings.append(
                    _result(
                        "ERR_GIT_SHOW_FAILED",
                        "error",
                        f"Failed to inspect commit '{sha}' with git show --stat.",
                        {
                            "prompt": output.prompt_stem,
                            "sha": sha,
                            "repo_root": str(git_root),
                            "stderr": git_show.stderr.strip(),
                        },
                    )
                )
                continue

            commit_files = _parse_changed_files_from_stat(git_show.stdout)
            all_commit_files.update(commit_files)
            undeclared = sorted(commit_files - declared_files)
            if undeclared:
                findings.append(
                    _result(
                        "WARN_COMMIT_FILES_NOT_DECLARED",
                        "warning",
                        f"Commit '{sha}' contains files not declared in change_details.",
                        {
                            "prompt": output.prompt_stem,
                            "sha": sha,
                            "files_in_commit_not_declared": undeclared,
                        },
                    )
                )

        declared_missing = sorted(declared_files - all_commit_files)
        if declared_missing:
            findings.append(
                _result(
                    "WARN_DECLARED_FILES_NOT_IN_COMMITS",
                    "warning",
                    "change_details contains files not found in git show --stat for declared commits.",
                    {
                        "prompt": output.prompt_stem,
                        "commit_shas": commit_shas,
                        "files_declared_not_in_commit": declared_missing,
                    },
                )
            )

    return findings


def _dedupe_findings(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for finding in findings:
        signature = json.dumps(
            {
                "check_id": finding.get("check_id"),
                "severity": finding.get("severity"),
                "message": finding.get("message"),
                "details": finding.get("details"),
            },
            sort_keys=True,
        )
        if signature in seen:
            continue
        seen.add(signature)
        deduped.append(finding)
    return deduped


def verify_workpack(workpack_dir: str | Path, work_branch: str) -> list[dict[str, Any]]:
    """Run both commit SHA existence and change_details cross-reference checks."""
    findings = []
    findings.extend(check_commit_shas_exist(workpack_dir=workpack_dir, work_branch=work_branch))
    findings.extend(cross_reference_change_details(workpack_dir=workpack_dir))
    return _dedupe_findings(findings)


def _detect_current_branch(workpack_dir: Path) -> str | None:
    git_root = _find_git_root(workpack_dir)
    if git_root is None:
        return None
    proc = _run_git(git_root, ["rev-parse", "--abbrev-ref", "HEAD"])
    if proc.returncode != 0:
        return None
    branch = proc.stdout.strip()
    return branch or None


def _discover_workpacks(target: Path) -> list[Path]:
    resolved = target.resolve()
    if resolved.is_file() and resolved.name == "00_request.md":
        return [resolved.parent]
    if resolved.is_dir() and (resolved / "00_request.md").is_file():
        return [resolved]
    if not resolved.is_dir():
        return []

    discovered = {request.parent.resolve() for request in resolved.rglob("00_request.md")}
    return sorted(discovered, key=lambda path: str(path).lower())


def _default_scan_target() -> Path:
    cwd = Path.cwd().resolve()
    if (cwd / "00_request.md").is_file():
        return cwd

    from_repo_root = cwd / "workpacks" / "instances"
    if from_repo_root.is_dir():
        return from_repo_root

    script_instances = Path(__file__).resolve().parents[1] / "instances"
    if script_instances.is_dir():
        return script_instances

    return cwd


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify commit SHA integrity for completed workpack output artifacts.",
    )
    parser.add_argument(
        "target",
        nargs="?",
        default=None,
        help="Workpack directory or discovery root (defaults to workpacks/instances).",
    )
    parser.add_argument(
        "--work-branch",
        default=None,
        help="Work branch to verify against (defaults to current git branch).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON output.",
    )
    args = parser.parse_args()

    target = Path(args.target).resolve() if args.target else _default_scan_target()
    workpacks = _discover_workpacks(target)
    if not workpacks:
        print(f"No workpacks discovered from target: {target}")
        return 1

    report: list[dict[str, Any]] = []
    for workpack_dir in workpacks:
        work_branch = args.work_branch or _detect_current_branch(workpack_dir) or "HEAD"
        findings = verify_workpack(workpack_dir, work_branch=work_branch)
        report.append(
            {
                "workpack_dir": str(workpack_dir),
                "work_branch": work_branch,
                "findings": findings,
            }
        )

    has_errors = any(
        finding.get("severity") == "error"
        for entry in report
        for finding in entry["findings"]
    )

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for entry in report:
            print(f"Workpack: {entry['workpack_dir']}")
            print(f"Branch:   {entry['work_branch']}")
            findings = entry["findings"]
            if not findings:
                print("  OK: no commit verification findings.")
            else:
                for finding in findings:
                    print(
                        f"  - {finding['severity'].upper()} {finding['check_id']}: "
                        f"{finding['message']}"
                    )
            print()

    return 1 if has_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
