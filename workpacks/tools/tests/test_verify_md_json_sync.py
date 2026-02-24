import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import verify_md_json_sync as sync  # noqa: E402


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _plan_md(rows: list[tuple[int, str, str]]) -> str:
    lines = [
        "# Execution Plan",
        "",
        "## Work Breakdown Structure (WBS)",
        "",
        "| # | Task | Agent Prompt | Depends On | Estimated Effort |",
        "|---|------|--------------|------------|------------------|",
    ]
    for row_number, stem, depends in rows:
        lines.append(f"| {row_number} | Task | {stem} | {depends} | S |")
    lines.append("")
    return "\n".join(lines)


class VerifyMdJsonSyncTests(unittest.TestCase):
    def test_helper_normalization_and_cells(self) -> None:
        self.assertEqual(sync._normalize_stem(""), "")
        self.assertEqual(sync._normalize_stem("`prompts/A1_task.md`"), "A1_task")
        self.assertEqual(sync._parse_table_cells("not-a-table"), [])
        self.assertFalse(sync._is_separator_row([]))
        self.assertTrue(sync._is_separator_row(["---", ":---:", "---"]))

    def test_read_text_and_load_json_read_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory_path = Path(tmp)
            text_value, text_issue = sync._read_text(directory_path)
            self.assertIsNone(text_value)
            self.assertEqual(text_issue["check_id"], "file.read_error")

            json_value, json_issue = sync._load_json(directory_path)
            self.assertIsNone(json_value)
            self.assertEqual(json_issue["check_id"], "file.read_error")

    def test_parse_wbs_rows_missing_and_incomplete_headers(self) -> None:
        rows, findings = sync._parse_wbs_rows("# Plan\nNo table\n")
        self.assertEqual(rows, [])
        self.assertTrue(any(item["check_id"] == "plan_meta.wbs_table_missing" for item in findings))

        rows, findings = sync._parse_wbs_rows(
            "\n".join(
                [
                    "| # | Task | Agent Prompt | Estimated Effort |",
                    "|---|------|--------------|------------------|",
                    "| 1 | Task | A0_bootstrap | XS |",
                ]
            )
        )
        self.assertEqual(rows, [])
        self.assertTrue(any(item["check_id"] == "plan_meta.wbs_table_missing" for item in findings))

    def test_parse_wbs_rows_malformed_invalid_number_empty_stem_and_rows_missing(self) -> None:
        malformed_markdown = "\n".join(
            [
                "| # | Task | Agent Prompt | Depends On | Estimated Effort |",
                "|---|------|--------------|------------|------------------|",
                "| 1 | only-three-cells | nope |",
                "| X | Task | A1_task | - | S |",
                "| 2 | Task |    | - | S |",
                "",
            ]
        )
        rows, findings = sync._parse_wbs_rows(malformed_markdown)
        self.assertEqual(rows, [])
        check_ids = {item["check_id"] for item in findings}
        self.assertIn("plan_meta.wbs_row_malformed", check_ids)
        self.assertIn("plan_meta.wbs_row_number_invalid", check_ids)
        self.assertIn("plan_meta.wbs_stem_missing", check_ids)
        self.assertIn("plan_meta.wbs_rows_missing", check_ids)

    def test_parse_meta_prompts_validation_branches(self) -> None:
        stems, depends_map, findings = sync._parse_meta_prompts([])
        self.assertEqual(stems, [])
        self.assertEqual(depends_map, {})
        self.assertTrue(any(item["check_id"] == "plan_meta.meta_invalid_shape" for item in findings))

        stems, depends_map, findings = sync._parse_meta_prompts({"prompts": {}})
        self.assertEqual(stems, [])
        self.assertEqual(depends_map, {})
        self.assertTrue(any(item["check_id"] == "plan_meta.meta_prompts_missing" for item in findings))

        stems, depends_map, findings = sync._parse_meta_prompts(
            {
                "prompts": [
                    "bad",
                    {"stem": 123, "depends_on": []},
                    {"stem": "A0_bootstrap", "depends_on": ["A1_dep", 9, ""]},
                    {"stem": "A0_bootstrap", "depends_on": "not-a-list"},
                ]
            }
        )
        self.assertEqual(stems.count("A0_bootstrap"), 2)
        self.assertEqual(depends_map["A0_bootstrap"], [])
        check_ids = {item["check_id"] for item in findings}
        self.assertIn("plan_meta.meta_prompt_invalid", check_ids)
        self.assertIn("plan_meta.meta_prompt_stem_invalid", check_ids)
        self.assertIn("plan_meta.meta_duplicate_stems", check_ids)

    def test_resolve_plan_dependencies_stem_refs_missing_rows_and_duplicates(self) -> None:
        rows = [
            sync.PlanRow(row_number=1, stem="A0_bootstrap", depends_raw="-", line_number=3),
            sync.PlanRow(row_number=2, stem="A0_bootstrap", depends_raw="A_dep", line_number=4),
            sync.PlanRow(row_number=3, stem="A2_sync", depends_raw="9", line_number=5),
            sync.PlanRow(row_number=4, stem="A3_sync", depends_raw="mystery", line_number=6),
        ]
        depends_map, findings = sync._resolve_plan_dependencies(rows)
        self.assertEqual(depends_map["A0_bootstrap"], ["A_dep"])
        self.assertEqual(depends_map["A2_sync"], [])
        check_ids = {item["check_id"] for item in findings}
        self.assertIn("plan_meta.plan_duplicate_stems", check_ids)
        self.assertIn("plan_meta.plan_depends_row_missing", check_ids)
        self.assertIn("plan_meta.plan_depends_unparseable", check_ids)

    def test_plan_meta_no_drift(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(
                root / "01_plan.md",
                _plan_md(
                    [
                        (1, "A0_bootstrap", "-"),
                        (2, "A1_state", "1"),
                        (3, "A2_sync", "1, 2"),
                    ]
                ),
            )
            _write_json(
                root / "workpack.meta.json",
                {
                    "prompts": [
                        {"stem": "A0_bootstrap", "depends_on": []},
                        {"stem": "A1_state", "depends_on": ["A0_bootstrap"]},
                        {"stem": "A2_sync", "depends_on": ["A0_bootstrap", "A1_state"]},
                    ]
                },
            )

            findings = sync.check_plan_meta_sync(root / "01_plan.md", root / "workpack.meta.json")
            self.assertEqual(findings, [])

    def test_plan_meta_missing_files_are_warnings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            findings = sync.check_plan_meta_sync(root / "01_plan.md", root / "workpack.meta.json")
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "plan_meta.plan_missing")
            self.assertEqual(findings[0]["severity"], "warning")

    def test_plan_meta_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(root / "01_plan.md", _plan_md([(1, "A0_bootstrap", "-")]))
            _write_text(root / "workpack.meta.json", "{not-json")

            findings = sync.check_plan_meta_sync(root / "01_plan.md", root / "workpack.meta.json")
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "plan_meta.meta_invalid_json")
            self.assertEqual(findings[0]["severity"], "error")

    def test_plan_meta_meta_file_missing_and_read_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(root / "01_plan.md", _plan_md([(1, "A0_bootstrap", "-")]))

            findings = sync.check_plan_meta_sync(root / "01_plan.md", root / "missing.meta.json")
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "plan_meta.meta_missing")
            self.assertEqual(findings[0]["severity"], "warning")

            bad_meta_dir = root / "meta_dir"
            bad_meta_dir.mkdir(parents=True, exist_ok=True)
            findings = sync.check_plan_meta_sync(root / "01_plan.md", bad_meta_dir)
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "plan_meta.meta_read_error")
            self.assertEqual(findings[0]["severity"], "error")

    def test_plan_meta_detects_extra_stems_and_order_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(
                root / "01_plan.md",
                _plan_md([(1, "A0_bootstrap", "-"), (2, "A1_state", "1")]),
            )
            _write_json(
                root / "workpack.meta.json",
                {
                    "prompts": [
                        {"stem": "A1_state", "depends_on": ["A0_bootstrap"]},
                        {"stem": "A0_bootstrap", "depends_on": []},
                        {"stem": "A2_extra", "depends_on": ["A1_state"]},
                    ]
                },
            )

            findings = sync.check_plan_meta_sync(root / "01_plan.md", root / "workpack.meta.json")
            check_ids = {item["check_id"] for item in findings}
            self.assertIn("plan_meta.extra_in_meta", check_ids)
            self.assertIn("plan_meta.order_mismatch", check_ids)

    def test_plan_meta_detects_missing_stems(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(
                root / "01_plan.md",
                _plan_md([(1, "A0_bootstrap", "-"), (2, "A1_state", "1")]),
            )
            _write_json(
                root / "workpack.meta.json",
                {"prompts": [{"stem": "A0_bootstrap", "depends_on": []}]},
            )

            findings = sync.check_plan_meta_sync(root / "01_plan.md", root / "workpack.meta.json")
            self.assertTrue(any(item["check_id"] == "plan_meta.missing_in_meta" for item in findings))

    def test_plan_meta_depends_mismatch_and_bad_order(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(
                root / "01_plan.md",
                _plan_md(
                    [
                        (1, "A0_bootstrap", "-"),
                        (2, "A1_state", "3"),
                        (3, "A2_sync", "1"),
                    ]
                ),
            )
            _write_json(
                root / "workpack.meta.json",
                {
                    "prompts": [
                        {"stem": "A0_bootstrap", "depends_on": []},
                        {"stem": "A1_state", "depends_on": ["A0_bootstrap"]},
                        {"stem": "A2_sync", "depends_on": ["A0_bootstrap"]},
                    ]
                },
            )

            findings = sync.check_plan_meta_sync(root / "01_plan.md", root / "workpack.meta.json")
            check_ids = {item["check_id"] for item in findings}
            self.assertIn("plan_meta.plan_dependency_order", check_ids)
            self.assertIn("plan_meta.depends_on_mismatch", check_ids)

    def test_plan_meta_unparseable_depends(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(root / "01_plan.md", _plan_md([(1, "A0_bootstrap", "later maybe")]))
            _write_json(
                root / "workpack.meta.json",
                {"prompts": [{"stem": "A0_bootstrap", "depends_on": []}]},
            )

            findings = sync.check_plan_meta_sync(root / "01_plan.md", root / "workpack.meta.json")
            self.assertTrue(any(item["check_id"] == "plan_meta.plan_depends_unparseable" for item in findings))

    def test_status_state_no_drift(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(
                root / "99_status.md",
                "\n".join(
                    [
                        "# Status",
                        "- [x] A0_bootstrap completed",
                        "- [ ] A1_state completed",
                    ]
                ),
            )
            _write_json(
                root / "workpack.state.json",
                {
                    "prompt_status": {
                        "A0_bootstrap": {"status": "complete"},
                        "A1_state": {"status": "in_progress"},
                    }
                },
            )

            findings = sync.check_status_state_sync(root / "99_status.md", root / "workpack.state.json")
            self.assertEqual(findings, [])

    def test_status_state_missing_status_file_warning(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            findings = sync.check_status_state_sync(root / "99_status.md", root / "workpack.state.json")
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "status_state.status_missing")
            self.assertEqual(findings[0]["severity"], "warning")

    def test_status_state_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(root / "99_status.md", "- [x] A0_bootstrap completed\n")
            _write_text(root / "workpack.state.json", "{broken")

            findings = sync.check_status_state_sync(root / "99_status.md", root / "workpack.state.json")
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "status_state.state_invalid_json")
            self.assertEqual(findings[0]["severity"], "error")

    def test_status_state_missing_and_read_error_for_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(root / "99_status.md", "- [x] A0_bootstrap completed\n")

            findings = sync.check_status_state_sync(root / "99_status.md", root / "missing.state.json")
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "status_state.state_missing")
            self.assertEqual(findings[0]["severity"], "warning")

            state_dir = root / "state_dir"
            state_dir.mkdir(parents=True, exist_ok=True)
            findings = sync.check_status_state_sync(root / "99_status.md", state_dir)
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "status_state.state_read_error")
            self.assertEqual(findings[0]["severity"], "error")

    def test_status_state_detects_bidirectional_drift_and_missing_markers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(
                root / "99_status.md",
                "\n".join(
                    [
                        "# Status",
                        "- [x] A0_bootstrap completed",
                        "- [ ] A1_state completed",
                        "- [x] A3_manual completed",
                    ]
                ),
            )
            _write_json(
                root / "workpack.state.json",
                {
                    "prompt_status": {
                        "A0_bootstrap": {"status": "pending"},
                        "A1_state": {"status": "complete"},
                        "A2_sync": {"status": "complete"},
                        "A3_manual": {"status": "complete"},
                    }
                },
            )

            findings = sync.check_status_state_sync(root / "99_status.md", root / "workpack.state.json")
            check_ids = {item["check_id"] for item in findings}
            self.assertIn("status_state.markdown_complete_state_incomplete", check_ids)
            self.assertIn("status_state.markdown_incomplete_state_complete", check_ids)
            self.assertIn("status_state.missing_in_markdown", check_ids)

    def test_status_state_conflicting_duplicate_markers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(
                root / "99_status.md",
                "\n".join(
                    [
                        "- [ ] A1_state completed",
                        "- [x] A1_state completed",
                    ]
                ),
            )
            _write_json(
                root / "workpack.state.json",
                {"prompt_status": {"A1_state": {"status": "complete"}}},
            )

            findings = sync.check_status_state_sync(root / "99_status.md", root / "workpack.state.json")
            self.assertTrue(any(item["check_id"] == "status_state.status_duplicate_marker" for item in findings))

    def test_status_state_prompt_status_shape_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(root / "99_status.md", "- [x] A0_bootstrap completed\n")
            _write_json(root / "workpack.state.json", {"prompt_status": []})

            findings = sync.check_status_state_sync(root / "99_status.md", root / "workpack.state.json")
            self.assertTrue(any(item["check_id"] == "status_state.prompt_status_missing" for item in findings))

    def test_parse_status_markers_and_parse_state_statuses_edge_cases(self) -> None:
        markers, marker_findings = sync._parse_status_markers(
            "\n".join(
                [
                    "- [x] Completed without prompt stem",
                    "- [ ] A1_state task",
                    "- [x] A1_state task",
                    "- [ ] V2_bugfix_verify created if B-series appears",
                ]
            )
        )
        self.assertEqual(markers["A1_state"], True)
        self.assertNotIn("V2_bugfix_verify", markers)
        self.assertTrue(any(item["check_id"] == "status_state.status_duplicate_marker" for item in marker_findings))

        statuses, findings = sync._parse_state_statuses("bad")
        self.assertEqual(statuses, {})
        self.assertTrue(any(item["check_id"] == "status_state.state_invalid_shape" for item in findings))

        statuses, findings = sync._parse_state_statuses(
            {
                "prompt_status": {
                    1: {"status": "complete"},
                    "A1_state": "bad",
                    "A2_sync": {"status": 9},
                    "A3_sync": {"status": "skipped"},
                }
            }
        )
        self.assertEqual(statuses, {"A3_sync": "skipped"})
        check_ids = {item["check_id"] for item in findings}
        self.assertIn("status_state.prompt_status_entry_invalid", check_ids)
        self.assertIn("status_state.prompt_status_value_invalid", check_ids)

    def test_run_sync_checks_combines_both_groups(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(root / "01_plan.md", _plan_md([(1, "A0_bootstrap", "-")]))
            _write_json(root / "workpack.meta.json", {"prompts": [{"stem": "A1_other", "depends_on": []}]})
            _write_text(root / "99_status.md", "- [ ] A0_bootstrap completed\n")
            _write_json(root / "workpack.state.json", {"prompt_status": {"A0_bootstrap": {"status": "complete"}}})

            findings = sync.run_sync_checks(
                root / "01_plan.md",
                root / "workpack.meta.json",
                root / "99_status.md",
                root / "workpack.state.json",
            )
            check_ids = {item["check_id"] for item in findings}
            self.assertIn("plan_meta.missing_in_meta", check_ids)
            self.assertIn("status_state.markdown_incomplete_state_complete", check_ids)

    def test_main_json_output_and_exit_code(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(root / "01_plan.md", _plan_md([(1, "A0_bootstrap", "-")]))
            _write_json(root / "workpack.meta.json", {"prompts": [{"stem": "A0_bootstrap", "depends_on": []}]})
            _write_text(root / "99_status.md", "- [x] A0_bootstrap completed\n")
            _write_json(root / "workpack.state.json", {"prompt_status": {"A0_bootstrap": {"status": "complete"}}})

            output = StringIO()
            with redirect_stdout(output):
                exit_code = sync.main(
                    [
                        "--plan-md",
                        str(root / "01_plan.md"),
                        "--meta-json",
                        str(root / "workpack.meta.json"),
                        "--status-md",
                        str(root / "99_status.md"),
                        "--state-json",
                        str(root / "workpack.state.json"),
                        "--json",
                    ]
                )
            self.assertEqual(exit_code, 0)
            self.assertEqual(json.loads(output.getvalue()), [])

    def test_main_human_output_and_error_exit(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_text(root / "01_plan.md", _plan_md([(1, "A0_bootstrap", "-")]))
            _write_json(root / "workpack.meta.json", {"prompts": [{"stem": "A1_other", "depends_on": []}]})
            _write_text(root / "99_status.md", "- [ ] A0_bootstrap completed\n")
            _write_json(root / "workpack.state.json", {"prompt_status": {"A0_bootstrap": {"status": "complete"}}})

            output = StringIO()
            with redirect_stdout(output):
                exit_code = sync.main(
                    [
                        "--plan-md",
                        str(root / "01_plan.md"),
                        "--meta-json",
                        str(root / "workpack.meta.json"),
                        "--status-md",
                        str(root / "99_status.md"),
                        "--state-json",
                        str(root / "workpack.state.json"),
                    ]
                )

            self.assertEqual(exit_code, 1)
            rendered = output.getvalue()
            self.assertIn("plan_meta.missing_in_meta", rendered)
            self.assertIn("status_state.markdown_incomplete_state_complete", rendered)

    def test_render_human_empty_and_without_details(self) -> None:
        self.assertEqual(sync._render_human([]), "No markdown-json synchronization drift detected.")
        rendered = sync._render_human(
            [{"check_id": "x", "severity": "warning", "message": "m", "details": {}}]
        )
        self.assertIn("[warning] x: m", rendered)


if __name__ == "__main__":
    unittest.main()
