"""Tests for workpack MCP server discovery and DAG resolution."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from workpack_mcp.discovery import (
    WorkpackInstance,
    WorkpackMeta,
    WorkpackState,
    PromptMeta,
    PromptState,
    discover_workpacks,
    get_instance_by_id,
    resolve_next_prompts,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def workpacks_dir(tmp_path: Path) -> Path:
    """Create a temporary workpacks directory with sample instances."""
    instances = tmp_path / "instances"
    instances.mkdir()

    # -- wp-alpha: two prompts, linear DAG, first complete -------------------
    alpha = instances / "wp-alpha"
    alpha.mkdir()
    (alpha / "00_request.md").write_text("# Request\nalpha request", encoding="utf-8")
    (alpha / "workpack.meta.json").write_text(
        json.dumps({
            "id": "wp-alpha",
            "title": "Alpha Workpack",
            "summary": "Test workpack alpha for unit tests.",
            "protocol_version": "2.2.0",
            "workpack_version": "1.0.0",
            "category": "feature",
            "created_at": "2026-01-01",
            "requires_workpack": [],
            "tags": ["test"],
            "owners": ["tester"],
            "repos": ["TestRepo"],
            "delivery_mode": "pr",
            "target_branch": "main",
            "prompts": [
                {
                    "stem": "A0_bootstrap",
                    "agent_role": "Prepare branch",
                    "depends_on": [],
                    "repos": ["TestRepo"],
                    "estimated_effort": "XS",
                },
                {
                    "stem": "A1_implement",
                    "agent_role": "Main implementation",
                    "depends_on": ["A0_bootstrap"],
                    "repos": ["TestRepo"],
                    "estimated_effort": "M",
                },
            ],
        }),
        encoding="utf-8",
    )
    (alpha / "workpack.state.json").write_text(
        json.dumps({
            "workpack_id": "wp-alpha",
            "overall_status": "in_progress",
            "last_updated": "2026-01-02T10:00:00Z",
            "prompt_status": {
                "A0_bootstrap": {"status": "complete", "completed_at": "2026-01-02T09:00:00Z"},
                "A1_implement": {"status": "pending"},
            },
            "agent_assignments": {},
            "blocked_by": [],
            "execution_log": [],
        }),
        encoding="utf-8",
    )

    # -- wp-beta: no state file (legacy / not-started) ----------------------
    beta = instances / "wp-beta"
    beta.mkdir()
    (beta / "00_request.md").write_text("# Request\nbeta request", encoding="utf-8")
    (beta / "workpack.meta.json").write_text(
        json.dumps({
            "id": "wp-beta",
            "title": "Beta Workpack",
            "summary": "Test workpack beta with no state file.",
            "protocol_version": "2.2.0",
            "workpack_version": "1.0.0",
            "category": "docs",
            "created_at": "2026-01-05",
            "requires_workpack": [],
            "tags": [],
            "owners": [],
            "repos": [],
            "delivery_mode": "pr",
            "target_branch": "main",
            "prompts": [
                {
                    "stem": "A0_bootstrap",
                    "agent_role": "Setup",
                    "depends_on": [],
                    "repos": [],
                    "estimated_effort": "XS",
                },
            ],
        }),
        encoding="utf-8",
    )

    return tmp_path


# ---------------------------------------------------------------------------
# Discovery tests
# ---------------------------------------------------------------------------


class TestDiscovery:
    def test_discovers_all_instances(self, workpacks_dir: Path) -> None:
        instances = discover_workpacks(workpacks_dir)
        ids = [inst.meta.id for inst in instances if inst.meta]
        assert "wp-alpha" in ids
        assert "wp-beta" in ids

    def test_skips_hidden_and_template_dirs(self, workpacks_dir: Path) -> None:
        hidden = workpacks_dir / "instances" / ".hidden-wp"
        hidden.mkdir()
        (hidden / "00_request.md").write_text("hidden", encoding="utf-8")

        template = workpacks_dir / "instances" / "_template"
        template.mkdir()
        (template / "00_request.md").write_text("template", encoding="utf-8")

        instances = discover_workpacks(workpacks_dir)
        names = {inst.path.name for inst in instances}
        assert ".hidden-wp" not in names
        assert "_template" not in names

    def test_loads_meta_and_state(self, workpacks_dir: Path) -> None:
        instances = discover_workpacks(workpacks_dir)
        alpha = get_instance_by_id(instances, "wp-alpha")
        assert alpha is not None
        assert alpha.meta is not None
        assert alpha.meta.title == "Alpha Workpack"
        assert alpha.state is not None
        assert alpha.state.overall_status == "in_progress"

    def test_handles_missing_state(self, workpacks_dir: Path) -> None:
        instances = discover_workpacks(workpacks_dir)
        beta = get_instance_by_id(instances, "wp-beta")
        assert beta is not None
        assert beta.meta is not None
        assert beta.state is None

    def test_empty_dir_returns_empty(self, tmp_path: Path) -> None:
        assert discover_workpacks(tmp_path) == []

    def test_nonexistent_dir_returns_empty(self, tmp_path: Path) -> None:
        assert discover_workpacks(tmp_path / "nonexistent") == []


# ---------------------------------------------------------------------------
# Lookup tests
# ---------------------------------------------------------------------------


class TestGetInstanceById:
    def test_find_by_meta_id(self, workpacks_dir: Path) -> None:
        instances = discover_workpacks(workpacks_dir)
        assert get_instance_by_id(instances, "wp-alpha") is not None

    def test_find_by_folder_name(self, workpacks_dir: Path) -> None:
        instances = discover_workpacks(workpacks_dir)
        assert get_instance_by_id(instances, "wp-alpha") is not None

    def test_not_found_returns_none(self, workpacks_dir: Path) -> None:
        instances = discover_workpacks(workpacks_dir)
        assert get_instance_by_id(instances, "nonexistent") is None


# ---------------------------------------------------------------------------
# DAG resolution tests
# ---------------------------------------------------------------------------


class TestResolveNextPrompts:
    def test_returns_prompts_with_satisfied_deps(self, workpacks_dir: Path) -> None:
        instances = discover_workpacks(workpacks_dir)
        alpha = get_instance_by_id(instances, "wp-alpha")
        assert alpha is not None
        next_prompts = resolve_next_prompts(alpha)
        stems = [p["stem"] for p in next_prompts]
        # A0 is complete, A1 depends on A0 → A1 should be executable
        assert "A1_implement" in stems
        assert "A0_bootstrap" not in stems

    def test_all_pending_no_deps_are_executable(self, workpacks_dir: Path) -> None:
        instances = discover_workpacks(workpacks_dir)
        beta = get_instance_by_id(instances, "wp-beta")
        assert beta is not None
        next_prompts = resolve_next_prompts(beta)
        stems = [p["stem"] for p in next_prompts]
        assert "A0_bootstrap" in stems

    def test_blocked_prompt_not_executable(self) -> None:
        inst = WorkpackInstance(
            path=Path("/fake"),
            meta=WorkpackMeta(
                id="test",
                title="Test",
                summary="Test workpack",
                protocol_version="2.2.0",
                workpack_version="1.0.0",
                category="feature",
                created_at="2026-01-01",
                prompts=[
                    PromptMeta(stem="A0_init", agent_role="Init", depends_on=[]),
                ],
            ),
            state=WorkpackState(
                workpack_id="test",
                overall_status="blocked",
                last_updated="2026-01-01T00:00:00Z",
                prompt_status={
                    "A0_init": PromptState(status="blocked", blocked_reason="waiting"),
                },
            ),
        )
        assert resolve_next_prompts(inst) == []

    def test_no_meta_returns_empty(self) -> None:
        inst = WorkpackInstance(path=Path("/fake"), meta=None, state=None)
        assert resolve_next_prompts(inst) == []

    def test_unsatisfied_deps_not_executable(self) -> None:
        inst = WorkpackInstance(
            path=Path("/fake"),
            meta=WorkpackMeta(
                id="test",
                title="Test",
                summary="Test workpack",
                protocol_version="2.2.0",
                workpack_version="1.0.0",
                category="feature",
                created_at="2026-01-01",
                prompts=[
                    PromptMeta(stem="A0_init", agent_role="Init", depends_on=[]),
                    PromptMeta(stem="A1_build", agent_role="Build", depends_on=["A0_init"]),
                ],
            ),
            state=WorkpackState(
                workpack_id="test",
                overall_status="in_progress",
                last_updated="2026-01-01T00:00:00Z",
                prompt_status={
                    "A0_init": PromptState(status="in_progress"),
                    "A1_build": PromptState(status="pending"),
                },
            ),
        )
        next_prompts = resolve_next_prompts(inst)
        stems = [p["stem"] for p in next_prompts]
        # A0 is in_progress (not complete) → A1 should NOT be executable
        assert "A1_build" not in stems
        # A0 itself is in_progress, not pending → also not executable
        assert "A0_init" not in stems

    def test_skipped_dep_satisfies_downstream(self) -> None:
        inst = WorkpackInstance(
            path=Path("/fake"),
            meta=WorkpackMeta(
                id="test",
                title="Test",
                summary="Test workpack",
                protocol_version="2.2.0",
                workpack_version="1.0.0",
                category="feature",
                created_at="2026-01-01",
                prompts=[
                    PromptMeta(stem="A0_init", agent_role="Init", depends_on=[]),
                    PromptMeta(stem="A1_build", agent_role="Build", depends_on=["A0_init"]),
                ],
            ),
            state=WorkpackState(
                workpack_id="test",
                overall_status="in_progress",
                last_updated="2026-01-01T00:00:00Z",
                prompt_status={
                    "A0_init": PromptState(status="skipped"),
                    "A1_build": PromptState(status="pending"),
                },
            ),
        )
        next_prompts = resolve_next_prompts(inst)
        stems = [p["stem"] for p in next_prompts]
        assert "A1_build" in stems


# ---------------------------------------------------------------------------
# Group discovery tests
# ---------------------------------------------------------------------------


class TestGroupDiscovery:
    def test_discovers_grouped_workpacks(self, tmp_path: Path) -> None:
        """Workpacks inside a group directory should be discovered."""
        instances = tmp_path / "instances"
        group = instances / "my-group"
        wp = group / "01_my-group_task"
        wp.mkdir(parents=True)
        (wp / "00_request.md").write_text("# Request", encoding="utf-8")
        (wp / "workpack.meta.json").write_text(
            json.dumps({
                "id": "01_my-group_task",
                "group": "my-group",
                "title": "Grouped Task",
                "summary": "A workpack inside a group directory.",
                "protocol_version": "2.1.0",
                "workpack_version": "1.0.0",
                "category": "feature",
                "created_at": "2026-02-01",
                "requires_workpack": [],
                "tags": [],
                "owners": [],
                "repos": [],
                "delivery_mode": "pr",
                "target_branch": "main",
                "prompts": [],
            }),
            encoding="utf-8",
        )

        found = discover_workpacks(tmp_path)
        assert len(found) == 1
        assert found[0].meta is not None
        assert found[0].meta.id == "01_my-group_task"
        assert found[0].meta.group == "my-group"
