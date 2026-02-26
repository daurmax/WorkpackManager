import json
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch


TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import verify_commits as vc  # noqa: E402


_MISSING = object()


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _cp(returncode: int = 0, stdout: str = "", stderr: str = "") -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(args=["git"], returncode=returncode, stdout=stdout, stderr=stderr)


def _output_payload(
    workpack_id: str,
    prompt_stem: str,
    *,
    commit_shas: object = _MISSING,
    change_files: list[str] | None = None,
    include_artifacts: bool = True,
) -> dict:
    payload = {
        "schema_version": "1.2",
        "workpack": workpack_id,
        "prompt": prompt_stem,
        "component": "tests",
        "delivery_mode": "pr",
        "branch": {"base": "main", "work": "feature/test", "merge_target": "main"},
        "changes": {
            "files_modified": [],
            "files_created": [],
            "contracts_changed": [],
            "breaking_change": False,
        },
        "verification": {"commands": []},
        "handoff": {"summary": "fixture", "next_steps": [], "known_issues": []},
        "repos": ["WorkpackManager"],
        "execution": {"model": "gpt-5-codex", "tokens_in": 0, "tokens_out": 0, "duration_ms": 0},
        "change_details": [
            {"repo": "WorkpackManager", "file": item, "action": "modified"}
            for item in (change_files or [])
        ],
    }
    if include_artifacts:
        artifacts: dict[str, object] = {"pr_url": "", "branch_verified": False}
        if commit_shas is not _MISSING:
            artifacts["commit_shas"] = commit_shas
        payload["artifacts"] = artifacts
    return payload


def _build_workpack(
    root: Path,
    *,
    workpack_id: str = "01_verify_fixture",
    protocol_version: str = "2.2.0",
    prompt_status: dict[str, str] | None = None,
) -> Path:
    prompt_status = prompt_status or {}
    wp = root / workpack_id
    (wp / "outputs").mkdir(parents=True, exist_ok=True)
    (wp / "prompts").mkdir(parents=True, exist_ok=True)
    _write_text(wp / "00_request.md", f"# Request\n\nWorkpack Protocol Version: {protocol_version}\n")
    _write_json(
        wp / "workpack.meta.json",
        {
            "id": workpack_id,
            "title": "Fixture",
            "summary": "Fixture for verify_commits tests.",
            "protocol_version": protocol_version,
            "workpack_version": "1.0.0",
            "category": "feature",
            "created_at": "2026-02-24",
            "requires_workpack": [],
            "tags": [],
            "owners": [],
            "repos": ["WorkpackManager"],
            "delivery_mode": "pr",
            "target_branch": "main",
            "prompts": [],
        },
    )
    _write_json(
        wp / "workpack.state.json",
        {
            "workpack_id": workpack_id,
            "overall_status": "in_progress",
            "last_updated": "2026-02-24T00:00:00Z",
            "prompt_status": {stem: {"status": status} for stem, status in prompt_status.items()},
            "agent_assignments": {},
            "blocked_by": [],
            "execution_log": [],
        },
    )
    return wp


class VerifyCommitsTests(unittest.TestCase):
    def test_parse_helpers(self) -> None:
        self.assertEqual(vc._parse_semver("2.2"), (2, 2, 0))
        self.assertEqual(vc._parse_semver("2.2.1"), (2, 2, 1))
        self.assertIsNone(vc._parse_semver("abc"))
        self.assertIsNone(vc._parse_semver(None))

        parsed = vc._parse_changed_files_from_stat(
            " a.py | 1 +\n src/b.py | 3 ++-\n 2 files changed, 4 insertions(+)\n"
        )
        self.assertEqual(parsed, {"a.py", "src/b.py"})
        self.assertEqual(vc._parse_changed_files_from_stat(" | 2 ++\n"), set())

    def test_load_json_handles_os_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory_path = Path(tmp)
            _, error = vc._load_json(directory_path)
            self.assertIsNone(_)
            self.assertIsNotNone(error)

    def test_supports_commit_checks_handles_missing_and_non_object_meta(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = Path(tmp) / "wp"
            wp.mkdir(parents=True, exist_ok=True)

            supported, findings = vc._supports_commit_checks(wp)
            self.assertFalse(supported)
            self.assertEqual(findings[0]["check_id"], "INFO_PROTOCOL_NOT_APPLICABLE")

            _write_text(wp / "workpack.meta.json", "[]")
            supported, findings = vc._supports_commit_checks(wp)
            self.assertFalse(supported)
            self.assertEqual(findings[0]["check_id"], "INFO_PROTOCOL_NOT_APPLICABLE")

    def test_collect_completed_stems_branch_cases(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = Path(tmp) / "wp"
            wp.mkdir(parents=True, exist_ok=True)

            self.assertIsNone(vc._collect_completed_stems(wp))

            _write_text(wp / "workpack.state.json", "{ bad")
            self.assertIsNone(vc._collect_completed_stems(wp))

            _write_text(wp / "workpack.state.json", "[]")
            self.assertIsNone(vc._collect_completed_stems(wp))

            _write_json(wp / "workpack.state.json", {"prompt_status": []})
            self.assertEqual(vc._collect_completed_stems(wp), set())

            _write_json(
                wp / "workpack.state.json",
                {"prompt_status": {"A1": {"status": "complete"}, "A2": "ignored"}},
            )
            self.assertEqual(vc._collect_completed_stems(wp), {"A1"})

    def test_collect_completed_outputs_handles_missing_outputs_and_non_object_payload(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = Path(tmp) / "wp"
            wp.mkdir(parents=True, exist_ok=True)

            loaded, findings = vc._collect_completed_outputs(wp)
            self.assertEqual(loaded, [])
            self.assertTrue(any(item["check_id"] == "INFO_OUTPUTS_MISSING" for item in findings))

            _write_json(
                wp / "workpack.state.json",
                {"prompt_status": {"A1_task": {"status": "complete"}}},
            )
            _write_text(wp / "outputs" / "A1_task.json", "[]")
            loaded, findings = vc._collect_completed_outputs(wp)
            self.assertEqual(loaded, [])
            self.assertTrue(any(item["check_id"] == "ERR_OUTPUT_JSON_INVALID" for item in findings))
            self.assertTrue(any(item["check_id"] == "INFO_NO_COMPLETED_OUTPUTS" for item in findings))

    def test_extract_helpers_filter_invalid_values(self) -> None:
        payload = {
            "artifacts": {"commit_shas": ["abc", "ABC", "", None, " def "]},
            "change_details": [{"file": "src\\a.py"}, {"file": ""}, {}, "bad"],
        }
        self.assertEqual(vc._extract_commit_shas(payload), ["abc", "def"])
        self.assertEqual(vc._extract_declared_files(payload), {"src/a.py"})
        self.assertEqual(vc._extract_commit_shas({"artifacts": {}}), [])
        self.assertEqual(vc._extract_commit_shas({}), [])
        self.assertEqual(vc._extract_declared_files({"change_details": "bad"}), set())

    def test_sha_and_branch_helpers(self) -> None:
        shas = vc._parse_branch_shas("deadbee first\nxyz notsha\n\n")
        self.assertEqual(shas, {"deadbee"})
        self.assertTrue(vc._sha_exists_on_branch("deadbeef", {"deadbee"}))
        self.assertFalse(vc._sha_exists_on_branch("", {"deadbee"}))

    def test_check_commit_shas_exist_skips_when_protocol_below_2_2(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), protocol_version="2.1.0")
            findings = vc.check_commit_shas_exist(wp, "feature/test")
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "INFO_PROTOCOL_NOT_APPLICABLE")
            self.assertEqual(findings[0]["severity"], "info")

    def test_check_commit_shas_exist_skips_without_git(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), prompt_status={"A1_task": "complete"})
            _write_json(
                wp / "outputs" / "A1_task.json",
                _output_payload("01_verify_fixture", "A1_task", commit_shas=["deadbeef"]),
            )

            findings = vc.check_commit_shas_exist(wp, "feature/test")
            self.assertTrue(any(item["check_id"] == "INFO_GIT_UNAVAILABLE" for item in findings))

    def test_collect_completed_outputs_filters_by_state_and_reports_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(
                Path(tmp),
                prompt_status={"A1_task": "complete", "A2_task": "pending", "A3_task": "complete"},
            )
            _write_json(
                wp / "outputs" / "A1_task.json",
                _output_payload("01_verify_fixture", "A1_task", commit_shas=["deadbeef"]),
            )
            _write_json(
                wp / "outputs" / "A2_task.json",
                _output_payload("01_verify_fixture", "A2_task", commit_shas=["deadbeef"]),
            )
            _write_text(wp / "outputs" / "A3_task.json", "{ invalid ")

            loaded, findings = vc._collect_completed_outputs(wp)
            self.assertEqual([item.prompt_stem for item in loaded], ["A1_task"])
            self.assertTrue(any(item["check_id"] == "ERR_OUTPUT_JSON_INVALID" for item in findings))

    def test_check_commit_shas_exist_reports_missing_shas(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(
                Path(tmp),
                prompt_status={"A1_task": "complete", "A2_task": "complete", "A3_task": "complete"},
            )
            (wp / ".git").mkdir(parents=True, exist_ok=True)
            _write_json(
                wp / "outputs" / "A1_task.json",
                _output_payload("01_verify_fixture", "A1_task", commit_shas=["deadbeef", "cafebabe"]),
            )
            _write_json(
                wp / "outputs" / "A2_task.json",
                _output_payload("01_verify_fixture", "A2_task", commit_shas=[]),
            )
            _write_json(
                wp / "outputs" / "A3_task.json",
                _output_payload("01_verify_fixture", "A3_task"),
            )

            with patch.object(vc, "_run_git", return_value=_cp(stdout="deadbee Commit one\n1111111 Commit two\n")):
                findings = vc.check_commit_shas_exist(wp, "feature/test")

            self.assertTrue(any(item["check_id"] == "ERR_SHA_NOT_ON_BRANCH" for item in findings))
            warning_ids = {item["check_id"] for item in findings if item["severity"] == "warning"}
            self.assertIn("WARN_MISSING_COMMIT_SHAS", warning_ids)

    def test_check_commit_shas_exist_reports_git_log_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), prompt_status={"A1_task": "complete"})
            (wp / ".git").mkdir(parents=True, exist_ok=True)
            _write_json(
                wp / "outputs" / "A1_task.json",
                _output_payload("01_verify_fixture", "A1_task", commit_shas=["deadbeef"]),
            )

            with patch.object(vc, "_run_git", return_value=_cp(returncode=1, stderr="unknown revision")):
                findings = vc.check_commit_shas_exist(wp, "feature/test")

            self.assertTrue(any(item["check_id"] == "ERR_GIT_LOG_FAILED" for item in findings))

    def test_check_commit_shas_exist_returns_when_no_completed_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), prompt_status={})
            (wp / ".git").mkdir(parents=True, exist_ok=True)

            with patch.object(vc, "_run_git") as run_git:
                findings = vc.check_commit_shas_exist(wp, "feature/test")

            self.assertTrue(any(item["check_id"] == "INFO_NO_COMPLETED_OUTPUTS" for item in findings))
            run_git.assert_not_called()

    def test_cross_reference_change_details_reports_both_mismatch_types(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), prompt_status={"A1_task": "complete"})
            (wp / ".git").mkdir(parents=True, exist_ok=True)
            _write_json(
                wp / "outputs" / "A1_task.json",
                _output_payload(
                    "01_verify_fixture",
                    "A1_task",
                    commit_shas=["deadbeef"],
                    change_files=["tracked.py", "missing.py"],
                ),
            )

            with patch.object(
                vc,
                "_run_git",
                return_value=_cp(
                    stdout=(
                        "commit deadbeef\n"
                        " tracked.py | 1 +\n"
                        " undeclared.py | 2 ++\n"
                        " 2 files changed, 3 insertions(+)\n"
                    )
                ),
            ):
                findings = vc.cross_reference_change_details(wp)

            check_ids = {item["check_id"] for item in findings}
            self.assertIn("WARN_COMMIT_FILES_NOT_DECLARED", check_ids)
            self.assertIn("WARN_DECLARED_FILES_NOT_IN_COMMITS", check_ids)

    def test_cross_reference_change_details_skips_without_git_and_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), prompt_status={"A1_task": "complete"})
            _write_json(
                wp / "outputs" / "A1_task.json",
                _output_payload("01_verify_fixture", "A1_task", commit_shas=["deadbeef"]),
            )

            findings = vc.cross_reference_change_details(wp)
            self.assertTrue(any(item["check_id"] == "INFO_GIT_UNAVAILABLE" for item in findings))

            (wp / ".git").mkdir(parents=True, exist_ok=True)
            (wp / "outputs" / "A1_task.json").unlink()
            findings = vc.cross_reference_change_details(wp)
            self.assertTrue(any(item["check_id"] == "INFO_NO_COMPLETED_OUTPUTS" for item in findings))

    def test_cross_reference_change_details_warns_when_commit_shas_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), prompt_status={"A1_task": "complete"})
            (wp / ".git").mkdir(parents=True, exist_ok=True)
            _write_json(wp / "outputs" / "A1_task.json", _output_payload("01_verify_fixture", "A1_task"))

            findings = vc.cross_reference_change_details(wp)
            self.assertTrue(any(item["check_id"] == "WARN_MISSING_COMMIT_SHAS" for item in findings))

    def test_cross_reference_change_details_no_discrepancy(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), prompt_status={"A1_task": "complete"})
            (wp / ".git").mkdir(parents=True, exist_ok=True)
            _write_json(
                wp / "outputs" / "A1_task.json",
                _output_payload(
                    "01_verify_fixture",
                    "A1_task",
                    commit_shas=["deadbeef"],
                    change_files=["tracked.py"],
                ),
            )

            with patch.object(vc, "_run_git", return_value=_cp(stdout=" tracked.py | 1 +\n")):
                findings = vc.cross_reference_change_details(wp)

            self.assertEqual(findings, [])

    def test_cross_reference_change_details_reports_git_show_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), prompt_status={"A1_task": "complete"})
            (wp / ".git").mkdir(parents=True, exist_ok=True)
            _write_json(
                wp / "outputs" / "A1_task.json",
                _output_payload(
                    "01_verify_fixture",
                    "A1_task",
                    commit_shas=["badsha"],
                    change_files=["tracked.py"],
                ),
            )

            with patch.object(vc, "_run_git", return_value=_cp(returncode=128, stderr="bad object")):
                findings = vc.cross_reference_change_details(wp)

            self.assertTrue(any(item["check_id"] == "ERR_GIT_SHOW_FAILED" for item in findings))

    def test_detect_current_branch_paths(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp))
            self.assertIsNone(vc._detect_current_branch(wp))

            (wp / ".git").mkdir(parents=True, exist_ok=True)
            with patch.object(vc, "_run_git", return_value=_cp(returncode=1, stderr="bad")):
                self.assertIsNone(vc._detect_current_branch(wp))

            with patch.object(vc, "_run_git", return_value=_cp(stdout="feature/work\n")):
                self.assertEqual(vc._detect_current_branch(wp), "feature/work")

    def test_discover_workpacks_variants(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = _build_workpack(root, workpack_id="01_wp")
            request_file = wp / "00_request.md"

            self.assertEqual(vc._discover_workpacks(request_file), [wp.resolve()])
            self.assertEqual(vc._discover_workpacks(wp), [wp.resolve()])
            self.assertEqual(vc._discover_workpacks(root / "missing-path"), [])

    def test_default_scan_target_prefers_cwd_shapes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            request = cwd / "00_request.md"
            _write_text(request, "# Request")
            with patch.object(vc.Path, "cwd", return_value=cwd):
                self.assertEqual(vc._default_scan_target(), cwd.resolve())

            request.unlink()
            (cwd / "workpacks" / "instances").mkdir(parents=True, exist_ok=True)
            with patch.object(vc.Path, "cwd", return_value=cwd):
                self.assertEqual(vc._default_scan_target(), (cwd / "workpacks" / "instances").resolve())

    def test_main_text_output_and_no_workpacks_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = StringIO()
            with (
                patch.object(sys, "argv", ["verify_commits.py", str(Path(tmp) / "missing")]),
                redirect_stdout(output),
            ):
                exit_code = vc.main()
            self.assertEqual(exit_code, 1)
            self.assertIn("No workpacks discovered", output.getvalue())

    def test_main_text_output_and_error_exit(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), protocol_version="2.2.0")
            output = StringIO()
            fake_finding = [
                {"check_id": "ERR_X", "severity": "error", "message": "boom", "details": {}}
            ]
            with (
                patch.object(vc, "verify_workpack", return_value=fake_finding),
                patch.object(sys, "argv", ["verify_commits.py", str(wp)]),
                redirect_stdout(output),
            ):
                exit_code = vc.main()
            self.assertEqual(exit_code, 1)
            self.assertIn("ERROR ERR_X: boom", output.getvalue())

    def test_verify_workpack_dedupes_shared_info_findings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), protocol_version="2.1.0")
            findings = vc.verify_workpack(wp, work_branch="feature/test")
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "INFO_PROTOCOL_NOT_APPLICABLE")

    def test_main_emits_json_report(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wp = _build_workpack(Path(tmp), protocol_version="2.1.0")
            output = StringIO()
            with (
                patch.object(sys, "argv", ["verify_commits.py", str(wp), "--json"]),
                redirect_stdout(output),
            ):
                exit_code = vc.main()

            self.assertEqual(exit_code, 0)
            payload = json.loads(output.getvalue())
            self.assertEqual(len(payload), 1)
            self.assertEqual(payload[0]["workpack_dir"], str(wp.resolve()))


if __name__ == "__main__":
    unittest.main()
