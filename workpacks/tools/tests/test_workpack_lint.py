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
        with_meta: bool = True,
        with_state: bool = True,
    ) -> Path:
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
            _write_text(
                prompts / f"{stem}.md",
                "---\ndepends_on: []\nrepos: [WorkpackManager]\n---\n# Prompt\n",
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
                            "depends_on": [],
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


if __name__ == "__main__":
    unittest.main()
