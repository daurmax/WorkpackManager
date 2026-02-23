#!/usr/bin/env python3
"""Validate Workpack Protocol schemas and template scaffold."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

import jsonschema

from workpack_config import WorkpackConfigError, load_tool_config, render_config_message


WORKPACKS_DIR = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = WORKPACKS_DIR / "_template"

SCHEMA_FILES = {
    "meta": WORKPACKS_DIR / "WORKPACK_META_SCHEMA.json",
    "state": WORKPACKS_DIR / "WORKPACK_STATE_SCHEMA.json",
    "output": WORKPACKS_DIR / "WORKPACK_OUTPUT_SCHEMA.json",
    "config": WORKPACKS_DIR / "WORKPACK_CONFIG_SCHEMA.json",
}

PROMPT_TEMPLATE_FILES = [
    TEMPLATE_DIR / "prompts" / "A0_bootstrap.md",
    TEMPLATE_DIR / "prompts" / "V1_integration_meta.md",
    TEMPLATE_DIR / "prompts" / "B_template.md",
    TEMPLATE_DIR / "prompts" / "V_bugfix_verify.md",
    TEMPLATE_DIR / "prompts" / "R_retrospective.md",
]

PLACEHOLDER_VALUES = {
    "__WORKPACK_ID__": "01_example-group_example-workpack",
    "__WORKPACK_TITLE__": "Example Workpack Title",
    "__WORKPACK_SUMMARY__": "Example summary describing the workpack objective and scope.",
    "__CREATED_AT__": "2026-02-23",
    "__LAST_UPDATED__": "2026-02-23T00:00:00Z",
    "__REPO_NAME__": "ExampleRepo",
}

BANNED_TEMPLATE_TERMS = [
    "furlanpronunciationservice",
    "pytest",
    "mypy",
    "ruff",
    "fastapi",
    "npx tsc",
    "npm test",
]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def substitute_placeholders(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: substitute_placeholders(subvalue) for key, subvalue in value.items()}
    if isinstance(value, list):
        return [substitute_placeholders(item) for item in value]
    if isinstance(value, str):
        result = value
        for placeholder, replacement in PLACEHOLDER_VALUES.items():
            result = result.replace(placeholder, replacement)
        return result
    return value


def validate_schemas(errors: list[str]) -> dict[str, Any]:
    schemas: dict[str, Any] = {}
    for name, path in SCHEMA_FILES.items():
        try:
            schema = load_json(path)
            jsonschema.Draft202012Validator.check_schema(schema)
            schemas[name] = schema
            print(f"PASS schema: {path}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Schema invalid ({path}): {exc}")
    return schemas


def validate_json_templates(schemas: dict[str, Any], errors: list[str]) -> None:
    meta_template = TEMPLATE_DIR / "workpack.meta.json"
    state_template = TEMPLATE_DIR / "workpack.state.json"

    try:
        meta_data = substitute_placeholders(load_json(meta_template))
        jsonschema.validate(meta_data, schemas["meta"])
        print(f"PASS template: {meta_template}")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Template invalid ({meta_template}): {exc}")

    try:
        state_data = substitute_placeholders(load_json(state_template))
        jsonschema.validate(state_data, schemas["state"])
        print(f"PASS template: {state_template}")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Template invalid ({state_template}): {exc}")


def validate_project_config(errors: list[str]) -> None:
    try:
        config = load_tool_config(
            start_dir=Path.cwd(),
            workspace_root=WORKPACKS_DIR.parent,
            script_workpacks_dir=WORKPACKS_DIR,
            schema_path=SCHEMA_FILES["config"],
        )
    except (FileNotFoundError, WorkpackConfigError) as exc:
        errors.append(str(exc))
        return

    print(render_config_message(config))
    if config.config_path is not None:
        print(f"PASS config: {config.config_path}")


def validate_prompt_front_matter(errors: list[str]) -> None:
    front_matter_pattern = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n", re.DOTALL)

    for path in PROMPT_TEMPLATE_FILES:
        text = path.read_text(encoding="utf-8")
        match = front_matter_pattern.match(text)
        if not match:
            errors.append(f"Missing YAML front-matter in {path}")
            continue

        front_matter = match.group(1)
        if not re.search(r"(?m)^depends_on\s*:\s*\[.*\]\s*$", front_matter):
            errors.append(f"Missing or invalid depends_on front-matter in {path}")
        if not re.search(r"(?m)^repos\s*:\s*\[.*\]\s*$", front_matter):
            errors.append(f"Missing or invalid repos front-matter in {path}")

    if not errors:
        print("PASS prompt front-matter checks")


def scan_for_domain_leaks(errors: list[str]) -> None:
    for path in TEMPLATE_DIR.rglob("*"):
        if path.suffix.lower() not in {".md", ".json"}:
            continue
        content = path.read_text(encoding="utf-8").lower()
        for term in BANNED_TEMPLATE_TERMS:
            if term in content:
                errors.append(f"Domain-specific term '{term}' found in {path}")

    if not errors:
        print("PASS domain-leak scan")


def main() -> int:
    errors: list[str] = []

    schemas = validate_schemas(errors)
    if len(schemas) == len(SCHEMA_FILES):
        validate_json_templates(schemas, errors)
        validate_project_config(errors)

    validate_prompt_front_matter(errors)
    scan_for_domain_leaks(errors)

    if errors:
        print("\nValidation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nAll schema and template checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
