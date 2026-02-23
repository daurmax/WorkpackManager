import json
import os
import sys
import tempfile
import unittest
from pathlib import Path


os.environ["WORKPACK_LINT_SKIP_VENV_BOOTSTRAP"] = "1"
TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import workpack_lint as lint  # noqa: E402


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


class WorkpackLintTests(unittest.TestCase):
    def _build_workpack(
        self,
        root: Path,
        name: str,
        version: int,
        prompt_stems: list[str],
        front_matter_depends: dict[str, list[str]] | None = None,
        meta_depends: dict[str, list[str]] | None = None,
        with_meta: bool = True,
        with_state: bool = True,
    ) -> Path:
        front_matter_depends = front_matter_depends or {}
        meta_depends = meta_depends or {}
        wp = root / name
        prompts = wp / "prompts"
        outputs = wp / "outputs"
        prompts.mkdir(parents=True)
        outputs.mkdir(parents=True)

        _write_text(
            wp / "00_request.md",
            f"# Request\n\nWorkpack Protocol Version: {version}\n",
        )
        _write_text(wp / "99_status.md", "# Status\n\nNo completions yet.\n")

        for stem in prompt_stems:
            depends_on = front_matter_depends.get(stem, [])
            depends_on_text = ", ".join(depends_on)
            _write_text(
                prompts / f"{stem}.md",
                f"---\ndepends_on: [{depends_on_text}]\nrepos: [WorkpackManager]\n---\n# Prompt\n",
            )

        if with_meta:
            _write_json(
                wp / "workpack.meta.json",
                {
                    "id": name,
                    "title": "Test Workpack",
                    "summary": "A synthetic fixture for linter tests.",
                    "protocol_version": "2.0.0",
                    "workpack_version": "1.0.0",
                    "category": "feature",
                    "created_at": "2026-02-23",
                    "requires_workpack": [],
                    "tags": [],
                    "owners": [],
                    "repos": ["WorkpackManager"],
                    "delivery_mode": "pr",
                    "target_branch": "main",
                    "prompts": [
                        {
                            "stem": stem,
                            "agent_role": "test",
                            "depends_on": meta_depends.get(stem, []),
                            "repos": ["WorkpackManager"],
                            "estimated_effort": "S",
                        }
                        for stem in prompt_stems
                    ],
                },
            )

        if with_state:
            _write_json(
                wp / "workpack.state.json",
                {
                    "workpack_id": name,
                    "overall_status": "not_started",
                    "last_updated": "2026-02-23T00:00:00Z",
                    "prompt_status": {stem: {"status": "pending"} for stem in prompt_stems},
                    "agent_assignments": {},
                    "blocked_by": [],
                    "execution_log": [
                        {
                            "timestamp": "2026-02-23T00:00:00Z",
                            "event": "created",
                            "prompt_stem": None,
                            "agent": None,
                            "notes": "fixture",
                        }
                    ],
                },
            )

        return wp

    def _mark_prompt_complete(self, workpack_path: Path, prompt_stem: str) -> None:
        _write_text(workpack_path / "99_status.md", f"# Status\n\n{prompt_stem} 🟢 Complete\n")

    def _build_output_payload(
        self,
        workpack_name: str,
        prompt_stem: str,
        schema_version: str = "1.2",
        include_artifacts: bool = True,
        commit_shas: list[str] | None = None,
        branch_work: str = "feature/test-branch",
    ) -> dict:
        payload = {
            "schema_version": schema_version,
            "workpack": workpack_name,
            "prompt": prompt_stem,
            "component": "tests",
            "delivery_mode": "pr",
            "branch": {
                "base": "main",
                "work": branch_work,
                "merge_target": "main",
            },
            "changes": {
                "files_modified": [],
                "files_created": [],
                "contracts_changed": [],
                "breaking_change": False,
            },
            "verification": {
                "commands": [],
                "regression_added": False,
            },
            "handoff": {
                "summary": "fixture",
                "next_steps": [],
                "known_issues": [],
            },
            "repos": ["WorkpackManager"],
            "execution": {
                "model": "gpt-5-codex",
                "tokens_in": 0,
                "tokens_out": 0,
                "duration_ms": 0,
            },
            "change_details": [],
        }
        if include_artifacts:
            payload["artifacts"] = {
                "pr_url": "",
                "commit_shas": commit_shas if commit_shas is not None else ["abc123"],
                "branch_verified": False,
            }
        return payload

    def test_parse_protocol_version(self) -> None:
        content = "Workpack Protocol Version: 6\n"
        self.assertEqual(lint.parse_protocol_version(content), 6)

    def test_parse_protocol_version_semver(self) -> None:
        content = "Workpack Protocol Version: 2.0.0\n"
        self.assertEqual(lint.parse_protocol_version(content), 6)

    def test_parse_protocol_version_semver_2_1(self) -> None:
        content = "Workpack Protocol Version: 2.1.0\n"
        self.assertEqual(lint.parse_protocol_version(content), 7)

    def test_discover_workpack_paths_in_group(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            group = root / "instances" / "example-group"
            wp = self._build_workpack(group, "01_example", 6, ["A1_task"])
            discovered = lint.discover_workpack_paths([root / "instances"])
            self.assertIn(wp.resolve(), discovered)

    def test_v6_missing_meta_is_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(root, "01_missing_meta", 6, ["A1_task"], with_meta=False)
            errors, warnings = lint.validate_v6_checks(wp, lint.SchemaBundle(output=None, meta=None, state=None))
            self.assertTrue(any("ERR_MISSING_META" in err for err in errors))
            self.assertEqual(warnings, [])

    def test_v6_meta_id_mismatch_warning(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(root, "01_meta_id", 6, ["A1_task"])
            meta_path = wp / "workpack.meta.json"
            payload = json.loads(meta_path.read_text(encoding="utf-8"))
            payload["id"] = "different-id"
            _write_json(meta_path, payload)

            errors, warnings = lint.validate_v6_checks(wp, lint.SchemaBundle(output=None, meta=None, state=None))
            self.assertEqual(errors, [])
            self.assertTrue(any("WARN_META_ID_MISMATCH" in warn for warn in warnings))

    def test_v6_prompt_drift_warning(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(root, "01_prompt_drift", 6, ["A1_task", "A2_task"])
            meta_path = wp / "workpack.meta.json"
            payload = json.loads(meta_path.read_text(encoding="utf-8"))
            payload["prompts"] = payload["prompts"][:-1]
            _write_json(meta_path, payload)

            errors, warnings = lint.validate_v6_checks(wp, lint.SchemaBundle(output=None, meta=None, state=None))
            self.assertEqual(errors, [])
            self.assertTrue(any("WARN_META_PROMPTS_DRIFT" in warn for warn in warnings))

    def test_v6_state_drift_warning(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(root, "01_state_drift", 6, ["A1_task"])
            state_path = wp / "workpack.state.json"
            payload = json.loads(state_path.read_text(encoding="utf-8"))
            payload["overall_status"] = "complete"
            payload["prompt_status"]["A1_task"]["status"] = "pending"
            _write_json(state_path, payload)

            errors, warnings = lint.validate_v6_checks(wp, lint.SchemaBundle(output=None, meta=None, state=None))
            self.assertEqual(errors, [])
            self.assertTrue(any("WARN_STATE_DRIFT" in warn for warn in warnings))

    def test_v5_fixture_does_not_require_meta(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(root, "01_v5_legacy", 5, ["A1_task"], with_meta=False, with_state=False)
            version = lint.get_workpack_version(wp)
            self.assertEqual(version, 5)
            errors = lint.validate_workpack(wp, root / "WORKPACK_OUTPUT_SCHEMA.json")
            self.assertEqual(errors, [f"[01_v5_legacy] Schema file not found: {root / 'WORKPACK_OUTPUT_SCHEMA.json'}"])

    def test_v5_b_series_depends_on_valid(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(
                root,
                "01_b_valid_dag",
                5,
                ["B1_fix_base", "B2_fix_followup"],
                front_matter_depends={"B2_fix_followup": ["B1_fix_base"]},
                with_meta=False,
                with_state=False,
            )
            errors, warnings = lint.validate_v5_checks(wp, 5)
            self.assertEqual(errors, [])
            self.assertFalse(any("WARN_DAG_UNKNOWN_DEP" in warning for warning in warnings))

    def test_v5_b_series_cycle_is_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(
                root,
                "01_b_cycle",
                5,
                ["B1_fix_one", "B2_fix_two"],
                front_matter_depends={
                    "B1_fix_one": ["B2_fix_two"],
                    "B2_fix_two": ["B1_fix_one"],
                },
                with_meta=False,
                with_state=False,
            )
            errors, warnings = lint.validate_v5_checks(wp, 5)
            self.assertEqual(warnings, [])
            self.assertTrue(any("ERR_DAG_CYCLE" in error for error in errors))

    def test_v5_b_series_unknown_dependency_warns(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(
                root,
                "01_b_unknown_dep",
                5,
                ["B1_fix_only"],
                front_matter_depends={"B1_fix_only": ["B9_missing_fix"]},
                with_meta=False,
                with_state=False,
            )
            errors, warnings = lint.validate_v5_checks(wp, 5)
            self.assertEqual(errors, [])
            self.assertTrue(any("WARN_DAG_UNKNOWN_DEP" in warning for warning in warnings))

    def test_v8_commit_tracking_valid_commit_shas_has_no_warning(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(root, "01_commit_ok", 8, ["A1_task"], with_meta=False, with_state=False)
            self._mark_prompt_complete(wp, "A1_task")
            _write_json(
                wp / "outputs" / "A1_task.json",
                self._build_output_payload("01_commit_ok", "A1_task", commit_shas=["deadbeef"]),
            )

            errors, warnings = lint.validate_v5_checks(wp, 8)
            self.assertEqual(errors, [])
            self.assertFalse(any("WARN_MISSING_COMMIT_SHAS" in warning for warning in warnings))
            self.assertFalse(any("WARN_MISSING_ARTIFACTS" in warning for warning in warnings))

    def test_v8_commit_tracking_empty_commit_shas_warns(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(root, "01_commit_empty", 8, ["A1_task"], with_meta=False, with_state=False)
            self._mark_prompt_complete(wp, "A1_task")
            _write_json(
                wp / "outputs" / "A1_task.json",
                self._build_output_payload("01_commit_empty", "A1_task", commit_shas=[]),
            )

            errors, warnings = lint.validate_v5_checks(wp, 8)
            self.assertEqual(errors, [])
            self.assertTrue(any("WARN_MISSING_COMMIT_SHAS" in warning for warning in warnings))

    def test_v8_commit_tracking_missing_artifacts_warns(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(root, "01_commit_no_artifacts", 8, ["A1_task"], with_meta=False, with_state=False)
            self._mark_prompt_complete(wp, "A1_task")
            _write_json(
                wp / "outputs" / "A1_task.json",
                self._build_output_payload("01_commit_no_artifacts", "A1_task", include_artifacts=False),
            )

            errors, warnings = lint.validate_v5_checks(wp, 8)
            self.assertEqual(errors, [])
            self.assertTrue(any("WARN_MISSING_ARTIFACTS" in warning for warning in warnings))

    def test_v6_b_series_depends_on_meta_drift_warning(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_workpack(
                root,
                "01_b_dep_drift",
                6,
                ["B1_fix_base", "B2_fix_followup"],
                front_matter_depends={"B2_fix_followup": ["B1_fix_base"]},
                meta_depends={"B1_fix_base": [], "B2_fix_followup": []},
            )
            errors, warnings = lint.validate_v6_checks(wp, lint.SchemaBundle(output=None, meta=None, state=None))
            self.assertEqual(errors, [])
            self.assertTrue(
                any(
                    "WARN_META_PROMPTS_DRIFT" in warning and "B-series depends_on mismatch" in warning
                    for warning in warnings
                )
            )


if __name__ == "__main__":
    unittest.main()
