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

import verify_state_transitions as vst  # noqa: E402


def _event(timestamp: str, event: str, prompt_stem: str | None = None) -> dict[str, object]:
    return {
        "timestamp": timestamp,
        "event": event,
        "prompt_stem": prompt_stem,
        "agent": None,
        "notes": "fixture",
    }


def _base_state() -> dict[str, object]:
    return {
        "workpack_id": "01_fixture",
        "overall_status": "not_started",
        "last_updated": "2026-02-24T00:00:00Z",
        "prompt_status": {
            "A1_task": {"status": "pending"},
            "B1_task": {"status": "pending"},
        },
        "agent_assignments": {},
        "blocked_by": [],
        "execution_log": [_event("2026-02-24T00:00:00Z", "created")],
    }


class VerifyStateTransitionsTests(unittest.TestCase):
    def test_workpack_detects_illegal_direct_complete_jump(self) -> None:
        state = _base_state()
        state["overall_status"] = "complete"
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "completed"),
        ]

        findings = vst.validate_workpack_transitions(state)
        self.assertTrue(any(item["check_id"] == "WP_TRANSITION_INVALID" for item in findings))

    def test_workpack_accepts_standard_flow(self) -> None:
        state = _base_state()
        state["overall_status"] = "complete"
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "started"),
            _event("2026-02-24T00:02:00Z", "review"),
            _event("2026-02-24T00:03:00Z", "completed"),
        ]

        findings = vst.validate_workpack_transitions(state)
        self.assertEqual([], [item for item in findings if item["severity"] == "error"])

    def test_workpack_status_log_gap_is_warning(self) -> None:
        state = _base_state()
        state["overall_status"] = "review"
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "started"),
        ]

        findings = vst.validate_workpack_transitions(state)
        self.assertTrue(any(item["check_id"] == "WP_STATUS_LOG_GAP" for item in findings))

    def test_workpack_status_mismatch_is_error(self) -> None:
        state = _base_state()
        state["overall_status"] = "complete"
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "blocked"),
        ]

        findings = vst.validate_workpack_transitions(state)
        self.assertTrue(any(item["check_id"] == "WP_STATUS_MISMATCH" for item in findings))

    def test_workpack_invalid_execution_log_and_entry_types(self) -> None:
        state = _base_state()
        state["execution_log"] = "bad"
        findings = vst.validate_workpack_transitions(state)
        self.assertTrue(any(item["check_id"] == "WP_EXEC_LOG_INVALID" for item in findings))

        state = _base_state()
        state["overall_status"] = "abandoned"
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            "junk",
            _event("2026-02-24T00:01:00Z", "unblocked"),
            _event("2026-02-24T00:02:00Z", "abandoned"),
            _event("2026-02-24T00:03:00Z", "noop"),
        ]
        findings = vst.validate_workpack_transitions(state)
        self.assertTrue(any(item["check_id"] == "WP_EXEC_LOG_ENTRY_INVALID" for item in findings))

    def test_prompt_detects_illegal_pending_to_complete_jump_when_modern_history_exists(self) -> None:
        state = _base_state()
        state["prompt_status"] = {
            "A1_task": {"status": "complete"},
            "B1_task": {"status": "in_progress"},
        }
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "prompt_started", "B1_task"),
            _event("2026-02-24T00:02:00Z", "prompt_completed", "A1_task"),
        ]

        findings = vst.validate_prompt_transitions(state)
        self.assertTrue(any(item["check_id"] == "PROMPT_TRANSITION_INVALID" for item in findings))

    def test_prompt_allows_legacy_complete_without_started_event_as_warning(self) -> None:
        state = _base_state()
        state["prompt_status"] = {"A1_task": {"status": "complete"}}
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "prompt_completed", "A1_task"),
        ]

        findings = vst.validate_prompt_transitions(state)
        self.assertTrue(any(item["check_id"] == "PROMPT_TRANSITION_LEGACY_GAP" for item in findings))
        self.assertFalse(any(item["check_id"] == "PROMPT_TRANSITION_INVALID" for item in findings))

    def test_prompt_status_mismatch_is_error(self) -> None:
        state = _base_state()
        state["prompt_status"] = {"A1_task": {"status": "in_progress"}}
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "prompt_started", "A1_task"),
            _event("2026-02-24T00:02:00Z", "prompt_completed", "A1_task"),
        ]

        findings = vst.validate_prompt_transitions(state)
        self.assertTrue(any(item["check_id"] == "PROMPT_STATUS_MISMATCH" for item in findings))

    def test_prompt_validation_invalid_types_and_status_gap_paths(self) -> None:
        state = _base_state()
        state["execution_log"] = "bad"
        findings = vst.validate_prompt_transitions(state)
        self.assertTrue(any(item["check_id"] == "PROMPT_EXEC_LOG_INVALID" for item in findings))

        state = _base_state()
        state["prompt_status"] = {
            "A1_task": {"status": "weird"},
            "B1_task": {"status": "in_progress"},
        }
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "review", "B1_task"),
            "junk",
        ]
        findings = vst.validate_prompt_transitions(state)
        self.assertTrue(any(item["check_id"] == "PROMPT_STATUS_VALUE_INVALID" for item in findings))
        self.assertTrue(any(item["check_id"] == "PROMPT_STATUS_LOG_GAP" for item in findings))

    def test_prompt_complete_with_no_events_warns_legacy_gap(self) -> None:
        state = _base_state()
        state["prompt_status"] = {"A1_task": {"status": "complete"}}
        state["execution_log"] = [_event("2026-02-24T00:00:00Z", "created")]

        findings = vst.validate_prompt_transitions(state)
        self.assertTrue(any(item["check_id"] == "PROMPT_TRANSITION_LEGACY_GAP" for item in findings))

    def test_prompt_unknown_stem_event_warns(self) -> None:
        state = _base_state()
        state["prompt_status"] = {"A1_task": {"status": "pending"}}
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "prompt_started", "B9_unknown"),
        ]

        findings = vst.validate_prompt_transitions(state)
        self.assertTrue(any(item["check_id"] == "PROMPT_EVENT_UNKNOWN_STEM" for item in findings))

    def test_execution_log_detects_missing_created_and_non_monotonic_timestamps(self) -> None:
        state = _base_state()
        state["execution_log"] = [
            _event("2026-02-24T00:02:00Z", "started"),
            _event("2026-02-24T00:01:00Z", "blocked"),
        ]

        findings = vst.validate_execution_log(state)
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_MISSING_CREATED" for item in findings))
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_NON_MONOTONIC" for item in findings))

    def test_execution_log_detects_created_position_and_duplicates(self) -> None:
        state = _base_state()
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "started"),
            _event("2026-02-24T00:01:00Z", "created"),
            _event("2026-02-24T00:02:00Z", "created"),
        ]

        findings = vst.validate_execution_log(state)
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_CREATED_NOT_FIRST" for item in findings))
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_CREATED_DUPLICATE" for item in findings))

    def test_execution_log_detects_append_only_violations(self) -> None:
        state = _base_state()
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "completed"),
            _event("2026-02-24T00:02:00Z", "prompt_started", "A1_task"),
        ]

        findings = vst.validate_execution_log(state)
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_APPEND_ONLY_TERMINAL" for item in findings))

    def test_execution_log_detects_unblocked_without_block(self) -> None:
        state = _base_state()
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "unblocked"),
        ]

        findings = vst.validate_execution_log(state)
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_UNBLOCKED_WITHOUT_BLOCK" for item in findings))

    def test_execution_log_empty_and_non_string_timestamp(self) -> None:
        state = _base_state()
        state["execution_log"] = []
        findings = vst.validate_execution_log(state)
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_EMPTY" for item in findings))

        state = _base_state()
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            {"timestamp": 123, "event": "started", "prompt_stem": None, "agent": None, "notes": None},
        ]
        findings = vst.validate_execution_log(state)
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_BAD_TIMESTAMP" for item in findings))

    def test_execution_log_prompt_complete_without_start_is_error_in_modern_logs(self) -> None:
        state = _base_state()
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "prompt_started", "B1_task"),
            _event("2026-02-24T00:02:00Z", "prompt_completed", "A1_task"),
        ]

        findings = vst.validate_execution_log(state)
        self.assertTrue(
            any(
                item["check_id"] == "EXEC_LOG_PROMPT_COMPLETE_WITHOUT_START"
                and item["severity"] == "error"
                for item in findings
            )
        )

    def test_execution_log_prompt_complete_without_start_is_warning_in_legacy_logs(self) -> None:
        state = _base_state()
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "prompt_completed", "A1_task"),
        ]

        findings = vst.validate_execution_log(state)
        self.assertTrue(
            any(
                item["check_id"] == "EXEC_LOG_PROMPT_COMPLETE_WITHOUT_START"
                and item["severity"] == "warning"
                for item in findings
            )
        )

    def test_execution_log_prompt_block_unblock_happy_path(self) -> None:
        state = _base_state()
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "blocked", "A1_task"),
            _event("2026-02-24T00:02:00Z", "unblocked", "A1_task"),
            _event("2026-02-24T00:03:00Z", "prompt_started", "A1_task"),
            _event("2026-02-24T00:04:00Z", "prompt_completed", "A1_task"),
            _event("2026-02-24T00:05:00Z", "blocked"),
            _event("2026-02-24T00:06:00Z", "unblocked"),
        ]

        findings = vst.validate_execution_log(state)
        self.assertFalse(any(item["check_id"] == "EXEC_LOG_PROMPT_UNBLOCKED_WITHOUT_BLOCK" for item in findings))
        self.assertFalse(any(item["check_id"] == "EXEC_LOG_UNBLOCKED_WITHOUT_BLOCK" for item in findings))
        self.assertFalse(any(item["check_id"] == "EXEC_LOG_PROMPT_COMPLETE_WITHOUT_START" for item in findings))

    def test_execution_log_detects_prompt_block_state_errors(self) -> None:
        state = _base_state()
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            _event("2026-02-24T00:01:00Z", "prompt_started", "A1_task"),
            _event("2026-02-24T00:02:00Z", "prompt_started", "A1_task"),
            _event("2026-02-24T00:03:00Z", "unblocked", "A1_task"),
        ]

        findings = vst.validate_execution_log(state)
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_PROMPT_DOUBLE_START" for item in findings))
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_PROMPT_UNBLOCKED_WITHOUT_BLOCK" for item in findings))

    def test_execution_log_bad_timestamp_and_invalid_entry(self) -> None:
        state = _base_state()
        state["execution_log"] = [
            _event("2026-02-24T00:00:00Z", "created"),
            {"timestamp": "not-a-date", "event": "started"},
            "not-an-object",
        ]

        findings = vst.validate_execution_log(state)
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_BAD_TIMESTAMP" for item in findings))
        self.assertTrue(any(item["check_id"] == "EXEC_LOG_ENTRY_INVALID" for item in findings))

    def test_validate_state_payload_aggregates_all_checks(self) -> None:
        state = _base_state()
        state["overall_status"] = "unknown"
        state["prompt_status"] = []
        state["execution_log"] = "oops"

        findings = vst.validate_state_payload(state)
        check_ids = {item["check_id"] for item in findings}
        self.assertIn("WP_STATUS_INVALID", check_ids)
        self.assertIn("PROMPT_STATUS_INVALID", check_ids)
        self.assertIn("EXEC_LOG_INVALID", check_ids)

    def test_discover_state_files_supports_direct_file_and_missing_paths(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wp = root / "wp"
            wp.mkdir(parents=True, exist_ok=True)
            state_path = wp / "workpack.state.json"
            state_path.write_text("{}", encoding="utf-8")

            discovered = vst._discover_state_files([str(state_path), str(root / "missing")])
            self.assertEqual([state_path.resolve()], discovered)

    def test_cli_main_success_and_failure_exit_codes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            valid_dir = root / "valid_wp"
            invalid_dir = root / "invalid_wp"
            valid_dir.mkdir(parents=True, exist_ok=True)
            invalid_dir.mkdir(parents=True, exist_ok=True)

            valid_state = _base_state()
            valid_state["overall_status"] = "in_progress"
            valid_state["execution_log"] = [
                _event("2026-02-24T00:00:00Z", "created"),
                _event("2026-02-24T00:01:00Z", "started"),
            ]

            invalid_state = _base_state()
            invalid_state["overall_status"] = "complete"
            invalid_state["execution_log"] = [
                _event("2026-02-24T00:00:00Z", "created"),
                _event("2026-02-24T00:01:00Z", "completed"),
            ]

            (valid_dir / "workpack.state.json").write_text(
                json.dumps(valid_state, indent=2),
                encoding="utf-8",
            )
            (invalid_dir / "workpack.state.json").write_text(
                json.dumps(invalid_state, indent=2),
                encoding="utf-8",
            )

            with redirect_stdout(StringIO()) as output:
                ok_code = vst.main([str(valid_dir)])
                fail_code = vst.main([str(invalid_dir)])

            rendered = output.getvalue()
            self.assertEqual(0, ok_code)
            self.assertEqual(1, fail_code)
            self.assertIn("Summary: files=1", rendered)
            self.assertIn("WP_TRANSITION_INVALID", rendered)

    def test_cli_main_counts_warnings_and_handles_invalid_json_payloads(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            warning_dir = root / "warning_wp"
            bad_json_dir = root / "bad_json_wp"
            non_object_dir = root / "non_object_wp"
            warning_dir.mkdir(parents=True, exist_ok=True)
            bad_json_dir.mkdir(parents=True, exist_ok=True)
            non_object_dir.mkdir(parents=True, exist_ok=True)

            warning_state = _base_state()
            warning_state["overall_status"] = "in_progress"
            warning_state["execution_log"] = [
                _event("2026-02-24T00:00:00Z", "created"),
                _event("2026-02-24T00:01:00Z", "started"),
                _event("2026-02-24T00:02:00Z", "prompt_completed", "A1_task"),
            ]
            (warning_dir / "workpack.state.json").write_text(
                json.dumps(warning_state, indent=2),
                encoding="utf-8",
            )
            (bad_json_dir / "workpack.state.json").write_text("{invalid", encoding="utf-8")
            (non_object_dir / "workpack.state.json").write_text(json.dumps([]), encoding="utf-8")

            with redirect_stdout(StringIO()) as output:
                code = vst.main([str(root)])

            rendered = output.getvalue()
            self.assertEqual(1, code)
            self.assertIn("STATE_JSON_INVALID", rendered)
            self.assertIn("warnings=2", rendered)

    def test_cli_main_handles_missing_state_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            code = vst.main([tmp])
            self.assertEqual(1, code)


if __name__ == "__main__":
    unittest.main()
