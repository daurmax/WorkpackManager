import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path
from typing import Any


TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import agent_context as ac  # noqa: E402


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _prompt(stem: str, depends_on: list[str] | None = None) -> dict[str, Any]:
    return {
        "stem": stem,
        "agent_role": "fixture",
        "depends_on": depends_on or [],
        "repos": ["WorkpackManager"],
        "estimated_effort": "S",
    }


def _make_workpack(
    root: Path,
    prompts: list[dict[str, Any]],
    statuses: dict[str, str],
    *,
    workpack_id: str = "01_fixture",
    overall_status: str = "in_progress",
) -> Path:
    workpack_dir = root / workpack_id
    workpack_dir.mkdir(parents=True, exist_ok=True)

    _write_json(
        workpack_dir / "workpack.meta.json",
        {
            "id": workpack_id,
            "prompts": prompts,
        },
    )

    _write_json(
        workpack_dir / "workpack.state.json",
        {
            "workpack_id": workpack_id,
            "overall_status": overall_status,
            "last_updated": "2026-02-24T00:00:00Z",
            "prompt_status": {stem: {"status": status} for stem, status in statuses.items()},
            "agent_assignments": {},
            "blocked_by": [],
            "execution_log": [
                {
                    "timestamp": "2026-02-24T00:00:00Z",
                    "event": "created",
                    "prompt_stem": None,
                    "agent": None,
                    "notes": "fixture",
                }
            ],
        },
    )

    return workpack_dir


class AgentContextTests(unittest.TestCase):
    def test_classifies_prompts_with_dag_and_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            workpack_dir = _make_workpack(
                root,
                [
                    _prompt("A0_bootstrap"),
                    _prompt("A1_agent_rules", ["A0_bootstrap"]),
                    _prompt("A2_agent_state_machine", ["A0_bootstrap"]),
                    _prompt("A3_agent_context_tool", ["A1_agent_rules", "A2_agent_state_machine"]),
                    _prompt("V1_integration_meta", ["A3_agent_context_tool"]),
                ],
                {
                    "A0_bootstrap": "complete",
                    "A1_agent_rules": "pending",
                    "A2_agent_state_machine": "in_progress",
                    "A3_agent_context_tool": "pending",
                    "V1_integration_meta": "pending",
                },
            )

            context = ac.generate_agent_context(workpack_dir)

            self.assertEqual(context["workpack_id"], "01_fixture")
            self.assertEqual(context["overall_status"], "in_progress")
            self.assertEqual(context["completed_prompts"], ["A0_bootstrap"])
            self.assertEqual(context["in_progress_prompts"], ["A2_agent_state_machine"])
            self.assertEqual(context["available_prompts"], ["A1_agent_rules"])
            self.assertEqual(context["next_actions"], ["A1_agent_rules"])
            self.assertEqual(
                context["blocked_prompts"],
                [
                    {
                        "prompt": "A3_agent_context_tool",
                        "waiting_on": ["A1_agent_rules", "A2_agent_state_machine"],
                    },
                    {
                        "prompt": "V1_integration_meta",
                        "waiting_on": ["A3_agent_context_tool"],
                    },
                ],
            )
            self.assertEqual(
                context["blockers"],
                [
                    "A3_agent_context_tool waiting on A1_agent_rules, A2_agent_state_machine",
                    "V1_integration_meta waiting on A3_agent_context_tool",
                ],
            )
            self.assertEqual(
                set(context.keys()),
                {
                    "workpack_id",
                    "overall_status",
                    "available_prompts",
                    "blocked_prompts",
                    "completed_prompts",
                    "in_progress_prompts",
                    "blockers",
                    "next_actions",
                },
            )

    def test_available_prompts_follow_topological_order(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            workpack_dir = _make_workpack(
                root,
                [
                    _prompt("A1_foundation"),
                    _prompt("A3_depends_on_a2", ["A2_parallel"]),
                    _prompt("A4_parallel", ["A1_foundation"]),
                    _prompt("A2_parallel", ["A1_foundation"]),
                ],
                {
                    "A1_foundation": "complete",
                    "A2_parallel": "pending",
                    "A3_depends_on_a2": "pending",
                    "A4_parallel": "pending",
                },
            )

            context = ac.generate_agent_context(workpack_dir)
            self.assertEqual(context["available_prompts"], ["A4_parallel", "A2_parallel"])
            self.assertEqual(context["next_actions"], ["A4_parallel", "A2_parallel"])

    def test_all_complete_has_no_available_or_blockers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            workpack_dir = _make_workpack(
                root,
                [
                    _prompt("A1_one"),
                    _prompt("A2_two", ["A1_one"]),
                ],
                {
                    "A1_one": "complete",
                    "A2_two": "complete",
                },
                overall_status="complete",
            )

            context = ac.generate_agent_context(workpack_dir)
            self.assertEqual(context["available_prompts"], [])
            self.assertEqual(context["blocked_prompts"], [])
            self.assertEqual(context["blockers"], [])
            self.assertEqual(context["completed_prompts"], ["A1_one", "A2_two"])

    def test_circular_dependency_is_detected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            workpack_dir = _make_workpack(
                root,
                [
                    _prompt("A1_loop", ["A2_loop"]),
                    _prompt("A2_loop", ["A1_loop"]),
                ],
                {
                    "A1_loop": "pending",
                    "A2_loop": "pending",
                },
            )

            with self.assertRaises(ac.AgentContextError):
                ac.generate_agent_context(workpack_dir)

    def test_main_returns_one_when_required_file_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workpack_dir = Path(tmp) / "01_missing"
            workpack_dir.mkdir(parents=True, exist_ok=True)
            _write_json(
                workpack_dir / "workpack.meta.json",
                {
                    "id": "01_missing",
                    "prompts": [_prompt("A1_task")],
                },
            )

            stderr = StringIO()
            with redirect_stderr(stderr):
                exit_code = ac.main(["--workpack", str(workpack_dir)])

            self.assertEqual(exit_code, 1)
            self.assertIn("Missing required file", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
