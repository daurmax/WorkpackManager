import json
import os
import sys
import tempfile
import unittest
from contextlib import contextmanager, redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch


os.environ["WORKPACK_VALIDATE_FILES_SKIP_VENV_BOOTSTRAP"] = "1"
TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import validate_workpack_files as vwf  # noqa: E402


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


class ValidateWorkpackFilesTests(unittest.TestCase):
    """Tests for the workpack file completeness validator."""

    @contextmanager
    def _chdir(self, path: Path):
        previous = Path.cwd()
        os.chdir(path)
        try:
            yield
        finally:
            os.chdir(previous)

    def _run_main(self, cwd: Path, args: list[str]) -> tuple[int, str]:
        output = StringIO()
        with self._chdir(cwd), patch.object(sys, "argv", ["validate_workpack_files.py", *args]), redirect_stdout(output):
            return vwf.main(), output.getvalue()

    def _write_config_schema(self, workpacks_dir: Path) -> None:
        _write_json(
            workpacks_dir / "WORKPACK_CONFIG_SCHEMA.json",
            {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "object",
                "properties": {
                    "workpackDir": {"type": "string"},
                    "strictMode": {"type": "boolean"},
                    "protocolVersion": {"type": "string"},
                },
                "additionalProperties": True,
            },
        )

    def _build_complete_workpack(
        self,
        root: Path,
        name: str = "test-workpack",
        version: str = "2.1.0",
        *,
        skip_files: list[str] | None = None,
        skip_dirs: list[str] | None = None,
    ) -> Path:
        """Build a fully-complete workpack, optionally skipping files/dirs."""
        skip_files = skip_files or []
        skip_dirs = skip_dirs or []
        wp = root / name

        if "prompts" not in skip_dirs:
            (wp / "prompts").mkdir(parents=True, exist_ok=True)
            _write_text(
                wp / "prompts" / "A0_bootstrap.md",
                "---\ndepends_on: []\nrepos: [Repo]\n---\n# Bootstrap\n",
            )
            _write_text(
                wp / "prompts" / "R1_retrospective.md",
                "---\ndepends_on: [A0_bootstrap]\nrepos: [Repo]\n---\n# Retrospective\n",
            )
        if "outputs" not in skip_dirs:
            (wp / "outputs").mkdir(parents=True, exist_ok=True)
        wp.mkdir(parents=True, exist_ok=True)

        if "00_request.md" not in skip_files:
            _write_text(
                wp / "00_request.md",
                f"# Request\n\nWorkpack Protocol Version: {version}\n",
            )
        if "01_plan.md" not in skip_files:
            _write_text(wp / "01_plan.md", "# Plan\n\n## Prompts\n")
        if "99_status.md" not in skip_files:
            _write_text(wp / "99_status.md", "# Status\n")
        if "workpack.meta.json" not in skip_files:
            _write_json(wp / "workpack.meta.json", {
                "id": name,
                "title": "Test",
                "summary": "Test workpack.",
                "protocol_version": version,
                "workpack_version": "1.0.0",
                "category": "feature",
                "created_at": "2026-02-23",
                "requires_workpack": [],
                "tags": [],
                "owners": [],
                "repos": ["Repo"],
                "delivery_mode": "pr",
                "target_branch": "main",
                "prompts": [],
            })
        if "workpack.state.json" not in skip_files:
            _write_json(wp / "workpack.state.json", {
                "workpack_id": name,
                "overall_status": "in_progress",
                "last_updated": "2026-02-23T00:00:00Z",
                "prompt_status": {},
                "agent_assignments": {},
                "blocked_by": [],
                "execution_log": [],
            })

        return wp

    def test_complete_workpack_has_no_errors(self):
        """A fully complete 2.1.0 workpack should produce zero errors."""
        with tempfile.TemporaryDirectory() as tmp:
            wp = self._build_complete_workpack(Path(tmp))
            version = vwf.get_workpack_version(wp)
            errors, warnings = vwf.validate_workpack_files(wp, version)
            self.assertEqual(errors, [])
            self.assertEqual(warnings, [])

    def test_missing_plan_is_error(self):
        """Missing 01_plan.md should be an error."""
        with tempfile.TemporaryDirectory() as tmp:
            wp = self._build_complete_workpack(Path(tmp), skip_files=["01_plan.md"])
            version = vwf.get_workpack_version(wp)
            errors, warnings = vwf.validate_workpack_files(wp, version)
            self.assertTrue(any("01_plan.md" in e for e in errors))

    def test_missing_prompts_dir_is_error(self):
        """Missing prompts/ directory should be an error."""
        with tempfile.TemporaryDirectory() as tmp:
            wp = self._build_complete_workpack(Path(tmp), skip_dirs=["prompts"])
            version = vwf.get_workpack_version(wp)
            errors, warnings = vwf.validate_workpack_files(wp, version)
            self.assertTrue(any("prompts" in e for e in errors))

    def test_missing_outputs_dir_is_error_for_v2(self):
        """Missing outputs/ is an error for protocol 1.1.0+ (internal version 2+)."""
        with tempfile.TemporaryDirectory() as tmp:
            wp = self._build_complete_workpack(Path(tmp), skip_dirs=["outputs"])
            version = vwf.get_workpack_version(wp)
            errors, warnings = vwf.validate_workpack_files(wp, version)
            self.assertTrue(any("outputs" in e for e in errors))

    def test_missing_meta_is_error_for_v6(self):
        """Missing workpack.meta.json is an error for protocol 2.0.0+ (internal >= 6)."""
        with tempfile.TemporaryDirectory() as tmp:
            wp = self._build_complete_workpack(Path(tmp), skip_files=["workpack.meta.json"])
            version = vwf.get_workpack_version(wp)
            errors, warnings = vwf.validate_workpack_files(wp, version)
            self.assertTrue(any("workpack.meta.json" in e for e in errors))

    def test_missing_state_is_error_for_v6(self):
        """Missing workpack.state.json is an error for 2.0.0+."""
        with tempfile.TemporaryDirectory() as tmp:
            wp = self._build_complete_workpack(Path(tmp), skip_files=["workpack.state.json"])
            version = vwf.get_workpack_version(wp)
            errors, warnings = vwf.validate_workpack_files(wp, version)
            self.assertTrue(any("workpack.state.json" in e for e in errors))

    def test_missing_status_is_warning(self):
        """Missing 99_status.md should be a warning, not an error."""
        with tempfile.TemporaryDirectory() as tmp:
            wp = self._build_complete_workpack(Path(tmp), skip_files=["99_status.md"])
            version = vwf.get_workpack_version(wp)
            errors, warnings = vwf.validate_workpack_files(wp, version)
            self.assertEqual(errors, [])
            self.assertTrue(any("99_status.md" in w for w in warnings))

    def test_empty_prompts_dir_warns(self):
        """An empty prompts/ directory should produce a warning."""
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = self._build_complete_workpack(root)
            # Remove all .md files from prompts/
            for f in (wp / "prompts").glob("*.md"):
                f.unlink()
            version = vwf.get_workpack_version(wp)
            errors, warnings = vwf.validate_workpack_files(wp, version)
            self.assertEqual(errors, [])
            self.assertTrue(any("WARN_EMPTY_PROMPTS" in w for w in warnings))

    def test_missing_output_for_completed_prompt_warns(self):
        """If a prompt is marked complete but has no output JSON, warn."""
        with tempfile.TemporaryDirectory() as tmp:
            wp = self._build_complete_workpack(Path(tmp))
            # Add a completed prompt to state without a corresponding output
            state_path = wp / "workpack.state.json"
            state = json.loads(state_path.read_text(encoding="utf-8"))
            state["prompt_status"]["A0_bootstrap"] = {
                "status": "complete",
            }
            state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
            version = vwf.get_workpack_version(wp)
            errors, warnings = vwf.validate_workpack_files(wp, version)
            self.assertTrue(any("WARN_MISSING_OUTPUT" in w for w in warnings))

    def test_missing_retrospective_warns(self):
        """A workpack with prompts but no R-series should produce a warning."""
        with tempfile.TemporaryDirectory() as tmp:
            wp = self._build_complete_workpack(Path(tmp))
            # Remove the R1_retrospective.md to trigger warning
            r1 = wp / "prompts" / "R1_retrospective.md"
            if r1.exists():
                r1.unlink()
            version = vwf.get_workpack_version(wp)
            errors, warnings = vwf.validate_workpack_files(wp, version)
            self.assertEqual(errors, [])
            self.assertTrue(any("WARN_MISSING_RETROSPECTIVE" in w for w in warnings))

    def test_meta_not_required_for_old_protocol(self):
        """workpack.meta.json should not be required for protocol < 2.0.0."""
        with tempfile.TemporaryDirectory() as tmp:
            wp = self._build_complete_workpack(
                Path(tmp),
                version="1.4.0",
                skip_files=["workpack.meta.json", "workpack.state.json"],
            )
            version = vwf.get_workpack_version(wp)
            errors, warnings = vwf.validate_workpack_files(wp, version)
            # No errors about meta/state for older protocol
            self.assertFalse(any("workpack.meta.json" in e for e in errors))
            self.assertFalse(any("workpack.state.json" in e for e in errors))

    def test_main_uses_configured_workpack_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            default_workpacks_dir = repo_root / "workpacks"
            configured_workpacks_dir = repo_root / "custompacks"
            self._write_config_schema(default_workpacks_dir)
            _write_json(repo_root / "workpack.config.json", {"workpackDir": "custompacks"})
            self._build_complete_workpack(configured_workpacks_dir, name="01_cfg_target")

            with (
                patch.object(vwf, "SCRIPT_WORKPACKS_DIR", default_workpacks_dir),
                patch.object(vwf, "WORKSPACE_ROOT", repo_root),
            ):
                exit_code, output = self._run_main(repo_root, [])

            self.assertEqual(exit_code, 0)
            self.assertIn("Config found:", output)
            self.assertIn("workpackDir='custompacks'", output)
            self.assertIn(f"Detected workpacks dir: {configured_workpacks_dir.resolve()}", output)

    def test_main_reports_default_fallback_when_config_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            workpacks_dir = repo_root / "workpacks"
            self._build_complete_workpack(workpacks_dir, name="01_default_target")

            with (
                patch.object(vwf, "SCRIPT_WORKPACKS_DIR", workpacks_dir),
                patch.object(vwf, "WORKSPACE_ROOT", repo_root),
            ):
                exit_code, output = self._run_main(repo_root, [])

            self.assertEqual(exit_code, 0)
            self.assertIn("Config not found: workpack.config.json; using defaults", output)
            self.assertIn(f"Detected workpacks dir: {workpacks_dir.resolve()}", output)

    def test_main_uses_strict_mode_from_config_when_flag_omitted(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            workpacks_dir = repo_root / "workpacks"
            self._write_config_schema(workpacks_dir)
            _write_json(
                repo_root / "workpack.config.json",
                {"workpackDir": "workpacks", "strictMode": True},
            )
            self._build_complete_workpack(workpacks_dir, name="01_strict_cfg", skip_files=["99_status.md"])

            with (
                patch.object(vwf, "SCRIPT_WORKPACKS_DIR", workpacks_dir),
                patch.object(vwf, "WORKSPACE_ROOT", repo_root),
            ):
                exit_code, output = self._run_main(repo_root, [])

            self.assertEqual(exit_code, 2)
            self.assertIn("Mode: strictMode=true from workpack.config.json", output)
            self.assertIn("Warnings found and strictMode=true from workpack.config.json.", output)


if __name__ == "__main__":
    unittest.main()
