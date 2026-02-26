import json
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

import workpack_verify as wv  # noqa: E402


def _make_workpack(instances_root: Path, group: str, stem: str) -> Path:
    workpack = instances_root / group / stem
    workpack.mkdir(parents=True, exist_ok=True)
    (workpack / "00_request.md").write_text("# Request\n", encoding="utf-8")
    return workpack


def _reports_from_payload(payload: dict) -> list[dict]:
    if "workpacks" in payload:
        return payload["workpacks"]
    return [payload]


class WorkpackVerifyCliTests(unittest.TestCase):
    def test_category_filter_runs_only_selected_category(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            instances_root = repo_root / "workpacks" / "instances"
            _make_workpack(instances_root, "group-a", "01_alpha")

            called: list[str] = []

            def _runner(name: str):
                def _inner(workpack_dir: Path, repo_root_path: Path):  # noqa: ARG001
                    self.assertTrue(workpack_dir.is_dir())
                    called.append(name)
                    return []

                return _inner

            fake_runners = {
                "state": _runner("state"),
                "sync": _runner("sync"),
                "output": _runner("output"),
                "commits": _runner("commits"),
                "style": _runner("style"),
            }

            output = StringIO()
            with (
                patch.object(wv, "CATEGORY_RUNNERS", fake_runners),
                redirect_stdout(output),
            ):
                exit_code = wv.main(
                    [
                        "--instances-root",
                        str(instances_root),
                        "--category",
                        "state",
                        "--json",
                    ]
                )

            self.assertEqual(exit_code, 0)
            payload = json.loads(output.getvalue())
            self.assertEqual(called, ["state"])
            reports = _reports_from_payload(payload)
            self.assertEqual(reports[0]["categories_run"], ["state"])
            self.assertEqual(reports[0]["summary"]["passed"], 1)
            self.assertEqual(reports[0]["summary"]["warnings"], 0)
            self.assertEqual(reports[0]["summary"]["errors"], 0)

    def test_json_output_contains_expected_structure_for_all_categories(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            instances_root = repo_root / "workpacks" / "instances"
            _make_workpack(instances_root, "group-a", "01_alpha")

            output = StringIO()
            with (
                patch.object(
                    wv,
                    "CATEGORY_RUNNERS",
                    {
                        "state": lambda _a, _b: [],
                        "sync": lambda _a, _b: [],
                        "output": lambda _a, _b: [],
                        "commits": lambda _a, _b: [],
                        "style": lambda _a, _b: [],
                    },
                ),
                redirect_stdout(output),
            ):
                exit_code = wv.main(
                    [
                        "--instances-root",
                        str(instances_root),
                        "--json",
                    ]
                )

            self.assertEqual(exit_code, 0)
            payload = json.loads(output.getvalue())
            reports = _reports_from_payload(payload)
            self.assertEqual(len(reports), 1)
            report = reports[0]
            self.assertIn("workpack_id", report)
            self.assertEqual(report["categories_run"], wv.CATEGORY_ORDER)
            self.assertIn("results", report)
            self.assertIn("summary", report)
            self.assertEqual(report["summary"]["passed"], 5)
            self.assertEqual(report["summary"]["warnings"], 0)
            self.assertEqual(report["summary"]["errors"], 0)

            for entry in report["results"]:
                self.assertIn("check_id", entry)
                self.assertIn("severity", entry)
                self.assertIn("message", entry)
                self.assertIn("details", entry)

    def test_strict_returns_two_when_only_warnings_exist(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            instances_root = repo_root / "workpacks" / "instances"
            _make_workpack(instances_root, "group-a", "01_alpha")

            output = StringIO()
            with (
                patch.object(
                    wv,
                    "CATEGORY_RUNNERS",
                    {
                        "state": lambda _a, _b: [
                            {
                                "check_id": "WARN_FIXTURE",
                                "severity": "warning",
                                "message": "warning fixture",
                                "details": {},
                            }
                        ],
                        "sync": lambda _a, _b: [],
                        "output": lambda _a, _b: [],
                        "commits": lambda _a, _b: [],
                        "style": lambda _a, _b: [],
                    },
                ),
                redirect_stdout(output),
            ):
                exit_code = wv.main(
                    [
                        "--instances-root",
                        str(instances_root),
                        "--category",
                        "state",
                        "--strict",
                    ]
                )

            self.assertEqual(exit_code, 2)

    def test_workpack_filter_limits_discovered_targets(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            instances_root = repo_root / "workpacks" / "instances"
            _make_workpack(instances_root, "group-a", "01_alpha")
            _make_workpack(instances_root, "group-b", "02_beta")

            seen_ids: list[str] = []

            def state_runner(workpack_dir: Path, _repo_root: Path) -> list[dict]:
                seen_ids.append(workpack_dir.name)
                return []

            output = StringIO()
            with (
                patch.object(
                    wv,
                    "CATEGORY_RUNNERS",
                    {
                        "state": state_runner,
                        "sync": lambda _a, _b: [],
                        "output": lambda _a, _b: [],
                        "commits": lambda _a, _b: [],
                        "style": lambda _a, _b: [],
                    },
                ),
                redirect_stdout(output),
            ):
                exit_code = wv.main(
                    [
                        "--instances-root",
                        str(instances_root),
                        "--category",
                        "state",
                        "--workpack",
                        "group-b/02_beta",
                        "--json",
                    ]
                )

            self.assertEqual(exit_code, 0)
            self.assertEqual(seen_ids, ["02_beta"])
            payload = json.loads(output.getvalue())
            reports = _reports_from_payload(payload)
            self.assertEqual(len(reports), 1)
            self.assertEqual(reports[0]["workpack_id"], "group-b/02_beta")


if __name__ == "__main__":
    unittest.main()
