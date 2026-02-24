import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


os.environ["WORKPACK_VERIFY_PROMPT_STYLE_SKIP_VENV_BOOTSTRAP"] = "1"
TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import verify_prompt_style as vps  # noqa: E402


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


VALID_PROMPT = """---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Prompt Style Linter Agent Prompt

> One-line objective.

## READ FIRST
- Item

## Objective
Text

## Implementation Requirements
Text

## Verification
Text

## Handoff Output (JSON)
Text

## Deliverables
Text
"""


class VerifyPromptStyleTests(unittest.TestCase):
    def test_check_required_sections_passes_for_valid_prompt(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A5_prompt_style_lint.md"
            _write_text(prompt, VALID_PROMPT)

            findings = vps.check_required_sections(prompt)
            self.assertEqual(findings, [])

    def test_check_required_sections_reports_missing_sections(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_bad_prompt.md"
            _write_text(
                prompt,
                """---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Bad Prompt
> Objective line.

## Objective
Text
""",
            )

            findings = vps.check_required_sections(prompt)
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "PROMPT_REQUIRED_SECTIONS")
            self.assertEqual(findings[0]["severity"], "error")
            self.assertIn("READ FIRST", findings[0]["details"]["missing_sections"])

    def test_check_required_sections_downgrades_template_missing_sections(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "B_template.md"
            _write_text(
                prompt,
                """---
depends_on: []
repos: [<REPO_NAME>]
---
# Bug Fix Agent Prompt
> Fill this placeholder objective.

## Objective
Template content.
""",
            )

            findings = vps.check_required_sections(prompt)
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "PROMPT_REQUIRED_SECTIONS")
            self.assertEqual(findings[0]["severity"], "warning")

    def test_check_required_sections_reports_missing_title_objective(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A2_no_title.md"
            _write_text(
                prompt,
                """---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
No heading here
""",
            )

            findings = vps.check_required_sections(prompt)
            ids = {finding["check_id"] for finding in findings}
            self.assertIn("PROMPT_TITLE_OBJECTIVE", ids)

    def test_check_required_sections_handles_read_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            missing_prompt = Path(tmp) / "missing.md"
            findings = vps.check_required_sections(missing_prompt)
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "PROMPT_READ_ERROR")

    def test_check_yaml_frontmatter_accepts_inline_lists(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_ok.md"
            _write_text(prompt, VALID_PROMPT)

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertEqual(findings, [])

    def test_check_yaml_frontmatter_accepts_block_lists(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_block.md"
            _write_text(
                prompt,
                """---
depends_on:
  - A0_bootstrap
repos:
  - WorkpackManager
---
# Title
> Objective
""",
            )

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertEqual(findings, [])

    def test_check_yaml_frontmatter_reports_missing_block(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_missing_frontmatter.md"
            _write_text(prompt, "# Title\n")

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "PROMPT_FRONTMATTER_MISSING")

    def test_check_yaml_frontmatter_reports_unterminated_block(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_unterminated.md"
            _write_text(
                prompt,
                """---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
# missing closing delimiter
""",
            )

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "PROMPT_FRONTMATTER_PARSE")

    def test_check_yaml_frontmatter_reports_parse_error_line(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_parse_bad.md"
            _write_text(
                prompt,
                """---
depends_on:
  - A0_bootstrap
orphan-list-item
repos:
  - WorkpackManager
---
# Title
> Objective
""",
            )

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertTrue(any(f["check_id"] == "PROMPT_FRONTMATTER_PARSE" for f in findings))

    def test_check_yaml_frontmatter_reports_invalid_depends_on_type(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_depends_scalar.md"
            _write_text(
                prompt,
                """---
depends_on: A0_bootstrap
repos: [WorkpackManager]
---
# Title
> Objective
""",
            )

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertTrue(any(f["check_id"] == "PROMPT_FRONTMATTER_DEPENDS_ON" for f in findings))

    def test_check_yaml_frontmatter_reports_invalid_depends_on_suffix(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_depends_suffix.md"
            _write_text(
                prompt,
                """---
depends_on: [A0_bootstrap.md]
repos: [WorkpackManager]
---
# Title
> Objective
""",
            )

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertTrue(any(f["check_id"] == "PROMPT_FRONTMATTER_DEPENDS_ON" for f in findings))

    def test_check_yaml_frontmatter_reports_missing_repos(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_no_repos.md"
            _write_text(
                prompt,
                """---
depends_on: [A0_bootstrap]
---
# Title
> Objective
""",
            )

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertTrue(any(f["check_id"] == "PROMPT_FRONTMATTER_REPOS" for f in findings))

    def test_check_yaml_frontmatter_reports_missing_depends_on(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_no_depends.md"
            _write_text(
                prompt,
                """---
repos: [WorkpackManager]
---
# Title
> Objective
""",
            )

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertTrue(any(f["check_id"] == "PROMPT_FRONTMATTER_DEPENDS_ON" for f in findings))

    def test_check_yaml_frontmatter_reports_repos_wrong_type(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_repos_scalar.md"
            _write_text(
                prompt,
                """---
depends_on: [A0_bootstrap]
repos: WorkpackManager
---
# Title
> Objective
""",
            )

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertTrue(any(f["check_id"] == "PROMPT_FRONTMATTER_REPOS" for f in findings))

    def test_check_yaml_frontmatter_reports_invalid_empty_depends_item(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_depends_empty.md"
            _write_text(
                prompt,
                """---
depends_on:
  -
repos:
  - WorkpackManager
---
# Title
> Objective
""",
            )

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertTrue(any(f["check_id"] == "PROMPT_FRONTMATTER_DEPENDS_ON" for f in findings))

    def test_check_yaml_frontmatter_reports_empty_repo_items(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_bad_repos.md"
            _write_text(
                prompt,
                """---
depends_on: [A0_bootstrap]
repos: [WorkpackManager, ""]
---
# Title
> Objective
""",
            )

            findings = vps.check_yaml_frontmatter(prompt)
            self.assertTrue(any(f["check_id"] == "PROMPT_FRONTMATTER_REPOS" for f in findings))

    def test_check_yaml_frontmatter_handles_read_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            missing_prompt = Path(tmp) / "missing.md"
            findings = vps.check_yaml_frontmatter(missing_prompt)
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "PROMPT_READ_ERROR")

    def test_check_required_sections_ignores_code_fence_headings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_code_fence.md"
            _write_text(
                prompt,
                """---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Title
> Objective

```md
## READ FIRST
## Objective
## Implementation Requirements
## Verification
## Handoff Output (JSON)
## Deliverables
```
""",
            )

            findings = vps.check_required_sections(prompt)
            self.assertTrue(any(f["check_id"] == "PROMPT_REQUIRED_SECTIONS" for f in findings))

    def test_check_required_sections_allows_comment_and_rule_before_objective(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompt = Path(tmp) / "A1_comment_objective.md"
            _write_text(
                prompt,
                """---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Title
<!-- comment -->
---
> Objective

## READ FIRST
## Objective
## Implementation Requirements
## Verification
## Handoff Output (JSON)
## Deliverables
""",
            )

            findings = vps.check_required_sections(prompt)
            self.assertEqual(findings, [])

    def test_lint_prompt_directory_reports_missing_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "prompts"
            findings = vps.lint_prompt_directory(missing)
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["check_id"], "PROMPT_DIRECTORY_NOT_FOUND")

    def test_lint_prompt_directory_aggregates_multiple_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompts_dir = Path(tmp) / "prompts"
            _write_text(prompts_dir / "A1_ok.md", VALID_PROMPT)
            _write_text(
                prompts_dir / "A2_bad.md",
                """---
depends_on: [A0_bootstrap.md]
repos: [WorkpackManager]
---
# Bad
> Objective
## Objective
""",
            )

            findings = vps.lint_prompt_directory(prompts_dir)
            self.assertGreaterEqual(len(findings), 2)
            self.assertTrue(any(f["check_id"] == "PROMPT_REQUIRED_SECTIONS" for f in findings))
            self.assertTrue(any(f["check_id"] == "PROMPT_FRONTMATTER_DEPENDS_ON" for f in findings))

    def test_main_returns_zero_for_clean_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompts_dir = Path(tmp) / "prompts"
            _write_text(prompts_dir / "A1_ok.md", VALID_PROMPT)

            exit_code = vps.main([str(prompts_dir)])
            self.assertEqual(exit_code, 0)

    def test_main_returns_error_for_validation_errors(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompts_dir = Path(tmp) / "prompts"
            _write_text(prompts_dir / "A1_bad.md", "# Missing front matter\n")

            exit_code = vps.main([str(prompts_dir)])
            self.assertEqual(exit_code, 1)

    def test_main_returns_strict_warning_code(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompts_dir = Path(tmp) / "prompts"
            _write_text(
                prompts_dir / "B_template.md",
                """---
depends_on: []
repos: [<REPO_NAME>]
---
# Bug Fix Agent Prompt
> Placeholder objective.
## Objective
Only one section.
""",
            )

            exit_code = vps.main(["--strict", str(prompts_dir)])
            self.assertEqual(exit_code, 2)

    def test_main_json_output_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompts_dir = Path(tmp) / "prompts"
            _write_text(prompts_dir / "A1_ok.md", VALID_PROMPT)

            exit_code = vps.main(["--json", str(prompts_dir)])
            self.assertEqual(exit_code, 0)

    def test_main_without_paths_returns_error_when_discovery_empty(self) -> None:
        with patch.object(vps, "_discover_default_prompt_dirs", return_value=[]):
            exit_code = vps.main([])
            self.assertEqual(exit_code, 1)

    def test_main_without_paths_uses_discovered_directories(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prompts_dir = Path(tmp) / "prompts"
            _write_text(prompts_dir / "A1_ok.md", VALID_PROMPT)

            with patch.object(vps, "_discover_default_prompt_dirs", return_value=[prompts_dir]):
                exit_code = vps.main([])
            self.assertEqual(exit_code, 0)

    def test_main_non_json_handles_findings_without_prompt_path_detail(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            missing_prompts_dir = Path(tmp) / "missing"
            exit_code = vps.main([str(missing_prompts_dir)])
            self.assertEqual(exit_code, 1)

    def test_count_by_severity_handles_unknown_severity(self) -> None:
        counts = vps._count_by_severity([{"severity": "fatal"}, {"severity": "warning"}])
        self.assertEqual(counts["fatal"], 1)
        self.assertEqual(counts["warning"], 1)


if __name__ == "__main__":
    unittest.main()
