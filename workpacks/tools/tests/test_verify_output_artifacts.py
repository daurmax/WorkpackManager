import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import verify_output_artifacts as verify  # noqa: E402


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _output_schema() -> dict:
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "required": ["prompt", "changes"],
        "properties": {
            "prompt": {"type": "string"},
            "changes": {
                "type": "object",
                "required": ["files_created", "files_modified"],
                "properties": {
                    "files_created": {"type": "array", "items": {"type": "string"}},
                    "files_modified": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    }


class VerifyOutputArtifactsTests(unittest.TestCase):
    def _build_repo(self, root: Path, write_schema: bool = True) -> tuple[Path, Path]:
        workpack = root / "workpacks" / "instances" / "example-group" / "01_verify_fixture"
        (workpack / "outputs").mkdir(parents=True, exist_ok=True)
        if write_schema:
            _write_json(root / "workpacks" / "WORKPACK_OUTPUT_SCHEMA.json", _output_schema())
        return root, workpack

    def test_check_output_existence_reports_missing_state_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp))
            del root

            results = verify.check_output_existence(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_STATE_FILE_MISSING")

    def test_check_output_existence_reports_invalid_state_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))
            _write_text(workpack / "workpack.state.json", "{ invalid")

            results = verify.check_output_existence(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_STATE_JSON_INVALID")

    def test_check_output_existence_reports_non_object_state_payload(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))
            _write_text(workpack / "workpack.state.json", "[]")

            results = verify.check_output_existence(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_STATE_JSON_INVALID")

    def test_check_output_existence_handles_state_file_oserror(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))
            (workpack / "workpack.state.json").mkdir()

            results = verify.check_output_existence(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_STATE_JSON_INVALID")
            self.assertIn("could not be read", results[0]["message"])

    def test_check_output_existence_requires_prompt_status_object(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))
            _write_json(workpack / "workpack.state.json", {"prompt_status": []})

            results = verify.check_output_existence(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_STATE_PROMPT_STATUS_INVALID")

    def test_check_output_existence_reports_missing_outputs_for_complete_prompts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))
            _write_json(
                workpack / "workpack.state.json",
                {
                    "prompt_status": {
                        "A1_task": {"status": "complete"},
                        "A2_task": {"status": "pending"},
                        "A3_task": {"status": "complete"},
                    }
                },
            )
            (workpack / "outputs").rmdir()

            results = verify.check_output_existence(workpack)
            check_ids = [entry["check_id"] for entry in results]
            self.assertIn("ERR_OUTPUTS_DIR_MISSING", check_ids)
            self.assertEqual(check_ids.count("ERR_OUTPUT_MISSING"), 2)

    def test_check_output_existence_passes_when_complete_outputs_exist(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))
            _write_json(
                workpack / "workpack.state.json",
                {
                    "prompt_status": {
                        "A1_task": {"status": "complete"},
                        "A2_task": {"status": "pending"},
                        "A3_task": "invalid-entry-ignored",
                    }
                },
            )
            _write_json(
                workpack / "outputs" / "A1_task.json",
                {"prompt": "A1_task", "changes": {"files_created": [], "files_modified": []}},
            )

            results = verify.check_output_existence(workpack)
            self.assertEqual(results, [])

    def test_check_output_existence_ignores_blank_prompt_stem_keys(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))
            _write_json(workpack / "workpack.state.json", {"prompt_status": {"": {"status": "complete"}}})

            results = verify.check_output_existence(workpack)
            self.assertEqual(results, [])

    def test_check_output_schema_reports_repo_discovery_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workpack = Path(tmp) / "wp"
            (workpack / "outputs").mkdir(parents=True, exist_ok=True)

            results = verify.check_output_schema(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_SCHEMA_FILE_MISSING")

    def test_check_output_schema_reports_schema_json_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp), write_schema=False)
            _write_text(root / "workpacks" / "WORKPACK_OUTPUT_SCHEMA.json", "{ bad")

            results = verify.check_output_schema(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_SCHEMA_JSON_INVALID")

    def test_check_output_schema_reports_non_object_schema(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp), write_schema=False)
            _write_text(root / "workpacks" / "WORKPACK_OUTPUT_SCHEMA.json", "[]")

            results = verify.check_output_schema(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_SCHEMA_JSON_INVALID")

    def test_check_output_schema_reports_invalid_schema_definition(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp), write_schema=False)
            _write_json(root / "workpacks" / "WORKPACK_OUTPUT_SCHEMA.json", {"type": 123})

            results = verify.check_output_schema(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_SCHEMA_INVALID")

    def test_check_output_schema_reports_missing_outputs_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))
            (workpack / "outputs").rmdir()

            results = verify.check_output_schema(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_OUTPUTS_DIR_MISSING")

    def test_check_output_schema_reports_schema_file_missing_after_repo_resolution(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp), write_schema=False)
            with patch.object(verify, "_find_repo_root", return_value=root):
                results = verify.check_output_schema(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_SCHEMA_FILE_MISSING")

    def test_check_output_schema_reports_invalid_and_non_object_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))
            _write_text(workpack / "outputs" / "A1_task.json", "{ bad")
            _write_text(workpack / "outputs" / "A2_task.json", "[]")

            results = verify.check_output_schema(workpack)
            check_ids = [entry["check_id"] for entry in results]
            self.assertIn("ERR_OUTPUT_JSON_INVALID", check_ids)
            self.assertIn("ERR_OUTPUT_NOT_OBJECT", check_ids)

    def test_check_output_schema_reports_schema_mismatch_as_warning(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))
            _write_json(
                workpack / "outputs" / "A1_task.json",
                {
                    "prompt": "A1_task",
                    "changes": {"files_created": "not-a-list", "files_modified": []},
                },
            )

            results = verify.check_output_schema(workpack)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "WARN_SCHEMA_MISMATCH")
            self.assertEqual(results[0]["severity"], "warning")

    def test_check_output_schema_passes_for_valid_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))
            _write_json(
                workpack / "outputs" / "A1_task.json",
                {
                    "prompt": "A1_task",
                    "changes": {"files_created": [], "files_modified": []},
                },
            )

            results = verify.check_output_schema(workpack)
            self.assertEqual(results, [])

    def test_check_declared_files_reports_invalid_repo_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            _, workpack = self._build_repo(Path(tmp))

            results = verify.check_declared_files(workpack, Path(tmp) / "missing-root")
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_REPO_ROOT_INVALID")

    def test_check_declared_files_reports_missing_outputs_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp))
            (workpack / "outputs").rmdir()

            results = verify.check_declared_files(workpack, root)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["check_id"], "ERR_OUTPUTS_DIR_MISSING")

    def test_check_declared_files_handles_invalid_and_non_object_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp))
            _write_text(workpack / "outputs" / "A1_task.json", "{ bad")
            _write_text(workpack / "outputs" / "A2_task.json", "[]")

            results = verify.check_declared_files(workpack, root)
            check_ids = [entry["check_id"] for entry in results]
            self.assertIn("ERR_OUTPUT_JSON_INVALID", check_ids)
            self.assertIn("ERR_OUTPUT_NOT_OBJECT", check_ids)

    def test_check_declared_files_reports_missing_and_outside_paths(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp))
            existing_file = root / "present.txt"
            _write_text(existing_file, "ok")
            _write_json(
                workpack / "outputs" / "A1_task.json",
                {
                    "prompt": "A1_task",
                    "changes": {
                        "files_created": ["present.txt", "missing.txt", "../outside.txt"],
                        "files_modified": ["also-missing.txt"],
                    },
                },
            )

            results = verify.check_declared_files(workpack, root)
            check_ids = [entry["check_id"] for entry in results]
            self.assertIn("ERR_DECLARED_FILE_MISSING", check_ids)
            self.assertIn("ERR_DECLARED_FILE_OUTSIDE_REPO", check_ids)
            self.assertEqual(check_ids.count("ERR_DECLARED_FILE_MISSING"), 2)

    def test_check_declared_files_ignores_missing_or_invalid_changes_blocks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp))
            _write_json(workpack / "outputs" / "A1_task.json", {"prompt": "A1_task"})
            _write_json(
                workpack / "outputs" / "A2_task.json",
                {"prompt": "A2_task", "changes": {"files_created": "bad", "files_modified": [None, ""]}},
            )

            results = verify.check_declared_files(workpack, root)
            self.assertEqual(results, [])

    def test_run_all_checks_reports_repo_root_not_found_when_not_discoverable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workpack = Path(tmp) / "wp"
            (workpack / "outputs").mkdir(parents=True, exist_ok=True)
            _write_json(workpack / "workpack.state.json", {"prompt_status": {}})

            results = verify.run_all_checks(workpack, repo_root=None)
            check_ids = [entry["check_id"] for entry in results]
            self.assertIn("ERR_SCHEMA_FILE_MISSING", check_ids)
            self.assertIn("ERR_REPO_ROOT_NOT_FOUND", check_ids)

    def test_iter_output_files_returns_empty_when_outputs_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workpack = Path(tmp) / "wp"
            workpack.mkdir(parents=True, exist_ok=True)

            files = verify._iter_output_files(workpack)
            self.assertEqual(files, [])

    def test_main_returns_one_when_no_workpacks_discovered(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            exit_code = verify.main(["--repo-root", str(root), "--json"])
            self.assertEqual(exit_code, 1)

    def test_main_returns_one_when_no_workpacks_discovered_text_mode(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            exit_code = verify.main(["--repo-root", str(root)])
            self.assertEqual(exit_code, 1)

    def test_main_strict_returns_two_on_warnings_without_errors(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp))
            _write_json(
                workpack / "workpack.state.json",
                {"prompt_status": {"A1_task": {"status": "complete"}}},
            )
            _write_json(
                workpack / "outputs" / "A1_task.json",
                {
                    "prompt": "A1_task",
                    "changes": {"files_created": "bad-type", "files_modified": []},
                },
            )

            exit_code = verify.main([str(workpack), "--repo-root", str(root), "--strict", "--json"])
            self.assertEqual(exit_code, 2)

    def test_main_returns_zero_when_all_checks_pass(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp))
            _write_json(
                workpack / "workpack.state.json",
                {"prompt_status": {"A1_task": {"status": "complete"}}},
            )
            _write_json(
                workpack / "outputs" / "A1_task.json",
                {
                    "prompt": "A1_task",
                    "changes": {"files_created": [], "files_modified": []},
                },
            )

            exit_code = verify.main([str(workpack), "--repo-root", str(root), "--json"])
            self.assertEqual(exit_code, 0)

    def test_main_returns_one_when_errors_found(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp))
            _write_json(
                workpack / "workpack.state.json",
                {"prompt_status": {"A1_task": {"status": "complete"}}},
            )
            exit_code = verify.main([str(workpack), "--repo-root", str(root), "--json"])
            self.assertEqual(exit_code, 1)

    def test_main_text_mode_via_discovery_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root, workpack = self._build_repo(Path(tmp))
            _write_json(
                workpack / "workpack.state.json",
                {"prompt_status": {"A1_task": {"status": "complete"}}},
            )
            _write_json(
                workpack / "outputs" / "A1_task.json",
                {
                    "prompt": "A1_task",
                    "changes": {"files_created": [], "files_modified": []},
                },
            )

            exit_code = verify.main(["--repo-root", str(root)])
            self.assertEqual(exit_code, 0)


if __name__ == "__main__":
    unittest.main()
