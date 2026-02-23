#!/usr/bin/env python3
"""
workpack_scaffold.py - Workpack Scaffolder (Protocol 2.0.0)

Scaffolds prompt files from `01_plan.md` and generates:
- workpack.meta.json
- workpack.state.json

The prompt DAG (stems, dependencies, repos, effort) is parsed from plan tables.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Virtual-environment bootstrap (same pattern as legacy scaffold tooling)
# ---------------------------------------------------------------------------
def _ensure_venv() -> None:
    if sys.prefix != sys.base_prefix:
        return
    venv_dir = Path(__file__).resolve().parent / ".venv"
    if not venv_dir.exists():
        import venv as _venv

        print(f"[scaffold] Creating virtual environment at {venv_dir} ...")
        _venv.create(str(venv_dir), with_pip=True)
    if os.name == "nt":
        python = venv_dir / "Scripts" / "python.exe"
    else:
        python = venv_dir / "bin" / "python"
    if not python.exists():
        print(f"ERROR: venv Python not found at {python}", file=sys.stderr)
        sys.exit(1)
    print(f"[scaffold] Re-running inside venv: {venv_dir}")
    os.execv(str(python), [str(python)] + sys.argv)


_ensure_venv()

# ---------------------------------------------------------------------------
import argparse
import datetime as dt
import json
import re
import textwrap
from dataclasses import dataclass
from typing import Any

from validate_workpack_files import validate_workpack_files, get_workpack_version, display_version


CATEGORY_VALUES = {
    "feature",
    "refactor",
    "bugfix",
    "hotfix",
    "debug",
    "docs",
    "perf",
    "security",
}

STEM_RE = re.compile(r"^[A-Z][A-Za-z0-9]*(?:_[a-z0-9][a-z0-9_]*)+$")
STEM_IN_TEXT_RE = re.compile(r"[A-Z][A-Za-z0-9]*(?:_[a-z0-9][a-z0-9_]*)+")

LEGACY_WORKPACK_RE = re.compile(
    r"^(?P<created_at>\d{4}-\d{2}-\d{2})_"
    r"(?P<category>feature|refactor|bugfix|hotfix|debug|docs|perf|security)_"
    r"(?P<slug>[a-z0-9][a-z0-9_-]*)$"
)

GROUPED_WORKPACK_RE = re.compile(
    r"^(?P<phase>\d{2})_(?P<group>[a-z0-9-]+)_(?P<slug>[a-z0-9][a-z0-9_-]*)$"
)

WBS_ROW_RE = re.compile(
    r"^\|\s*(?P<index>\d+)\s*\|\s*(?P<task>.*?)\s*\|"
    r"\s*(?P<stem>[A-Z][A-Za-z0-9]*(?:_[a-z0-9][a-z0-9_]*)+)\s*\|"
    r"\s*(?P<depends>.*?)\s*\|\s*(?P<effort>XS|S|M|L|XL)\s*\|$",
    re.MULTILINE,
)

DAG_ROW_RE = re.compile(
    r"^\|\s*(?P<stem>[A-Z][A-Za-z0-9]*(?:_[a-z0-9][a-z0-9_]*)+)\s*\|"
    r"\s*(?P<depends>\[[^\]]*\]|[^|]*)\|\s*(?P<repos>\[[^\]]*\]|[^|]*)\|$",
    re.MULTILINE,
)

PROMPT_PATH_RE = re.compile(
    r"`?prompts/(?P<file>[A-Z][A-Za-z0-9_]*\.md)`?",
    re.IGNORECASE,
)

SUMMARY_SECTION_RE = re.compile(
    r"(?ms)^##\s+Summary\s*(?P<body>.*?)(?=^##\s+|\Z)"
)

REQUIRES_WORKPACK_RE = re.compile(
    r"(?mi)^requires_workpack\s*:\s*(?P<value>\[[^\]]*\]|[^\r\n]+)\s*$"
)

FRONT_MATTER_RE = re.compile(r"^(---\r?\n)(?P<body>.*?)(\r?\n---\r?\n)", re.DOTALL)

TEMPLATE_MAP = {
    "A0": "A0_bootstrap.md",
    "B": "B_template.md",
    "V": "V_bugfix_verify.md",
    "R": "R_retrospective.md",
}


@dataclass
class PromptSpec:
    stem: str
    agent_role: str
    depends_on: list[str]
    repos: list[str]
    estimated_effort: str


@dataclass
class PlanParseResult:
    prompts: list[PromptSpec]
    summary: str | None
    requires_workpack: list[str]


@dataclass
class WorkpackIdentity:
    workpack_id: str
    group: str | None
    category: str
    created_at: str
    slug: str


def _workpacks_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def _template_dir() -> Path:
    return _workpacks_dir() / "_template"


def _templates_prompt_dir() -> Path:
    return _template_dir() / "prompts"


def _resolve_template(stem: str) -> Path | None:
    prompt_dir = _templates_prompt_dir()
    exact = prompt_dir / f"{stem}.md"
    if exact.exists():
        return exact

    for prefix, file_name in TEMPLATE_MAP.items():
        if stem.startswith(prefix):
            candidate = prompt_dir / file_name
            if candidate.exists():
                return candidate

    if stem.endswith("_integration_meta"):
        candidate = prompt_dir / "V1_integration_meta.md"
        if candidate.exists():
            return candidate
    return None


def _today_date_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).date().isoformat()


def _now_utc_timestamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_inline_list(raw: str) -> list[str]:
    text = raw.strip()
    if not text or text == "-":
        return []
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1].strip()
    if not text:
        return []

    parts: list[str] = []
    for item in text.replace(" and ", ",").split(","):
        value = item.strip().strip("`").strip("'").strip('"')
        if value:
            parts.append(value)
    return parts


def _dedupe_keep_order(items: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in items:
        if item in seen:
            continue
        out.append(item)
        seen.add(item)
    return out


def _parse_depends_from_wbs(raw: str, index_to_stem: dict[str, str]) -> list[str]:
    text = raw.strip()
    if not text or text == "-":
        return []

    depends: list[str] = []
    for token in _parse_inline_list(text):
        if token in index_to_stem:
            depends.append(index_to_stem[token])

    for number in re.findall(r"\b\d+\b", text):
        stem = index_to_stem.get(number)
        if stem:
            depends.append(stem)

    for stem in STEM_IN_TEXT_RE.findall(text):
        if STEM_RE.fullmatch(stem):
            depends.append(stem)

    return _dedupe_keep_order(depends)


def _extract_summary(plan_text: str) -> str | None:
    match = SUMMARY_SECTION_RE.search(plan_text)
    if not match:
        return None

    lines = []
    for line in match.group("body").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("<!--") and stripped.endswith("-->"):
            continue
        lines.append(stripped)

    if not lines:
        return None
    summary = " ".join(lines).strip()
    return summary if summary else None


def _extract_requires_workpack(plan_text: str) -> list[str]:
    match = REQUIRES_WORKPACK_RE.search(plan_text)
    if not match:
        return []
    values = _parse_inline_list(match.group("value"))
    return [value for value in values if value]


def _default_agent_role(stem: str) -> str:
    text = stem.split("_", 1)[1] if "_" in stem else stem
    label = " ".join(part.capitalize() for part in text.split("_"))
    if len(label) < 3:
        label = f"Implement {stem}"
    return label


def parse_plan(plan_path: Path) -> PlanParseResult:
    if not plan_path.exists():
        raise FileNotFoundError(f"Plan file not found: {plan_path}")
    plan_text = plan_path.read_text(encoding="utf-8")

    wbs_rows: list[dict[str, str]] = []
    index_to_stem: dict[str, str] = {}
    for match in WBS_ROW_RE.finditer(plan_text):
        row = match.groupdict()
        wbs_rows.append(row)
        index_to_stem[row["index"]] = row["stem"]

    wbs_by_stem: dict[str, dict[str, str]] = {row["stem"]: row for row in wbs_rows}

    dag_by_stem: dict[str, dict[str, list[str]]] = {}
    for match in DAG_ROW_RE.finditer(plan_text):
        row = match.groupdict()
        stem = row["stem"]
        dag_by_stem[stem] = {
            "depends_on": [
                value for value in _parse_inline_list(row["depends"]) if STEM_RE.fullmatch(value)
            ],
            "repos": _parse_inline_list(row["repos"]),
        }

    ordered_stems: list[str] = []
    ordered_stems.extend(row["stem"] for row in wbs_rows)
    ordered_stems.extend(dag_by_stem.keys())

    for match in PROMPT_PATH_RE.finditer(plan_text):
        stem = match.group("file").removesuffix(".md")
        if STEM_RE.fullmatch(stem):
            ordered_stems.append(stem)

    ordered_stems = _dedupe_keep_order(ordered_stems)

    prompts: list[PromptSpec] = []
    for stem in ordered_stems:
        wbs_row = wbs_by_stem.get(stem)
        dag_row = dag_by_stem.get(stem, {})

        agent_role = _default_agent_role(stem)
        effort = "M"
        depends_on: list[str] = []
        repos: list[str] = []

        if wbs_row:
            agent_role = wbs_row["task"].strip() or agent_role
            effort = wbs_row["effort"].strip() or effort
            depends_on = _parse_depends_from_wbs(
                wbs_row["depends"], index_to_stem
            )

        if dag_row:
            depends_on = dag_row.get("depends_on", depends_on)
            repos = dag_row.get("repos", repos)

        prompts.append(
            PromptSpec(
                stem=stem,
                agent_role=agent_role,
                depends_on=_dedupe_keep_order(depends_on),
                repos=_dedupe_keep_order(repos),
                estimated_effort=effort if effort in {"XS", "S", "M", "L", "XL"} else "M",
            )
        )

    return PlanParseResult(
        prompts=prompts,
        summary=_extract_summary(plan_text),
        requires_workpack=_extract_requires_workpack(plan_text),
    )


def derive_workpack_identity(workpack_path: Path) -> WorkpackIdentity:
    folder_name = workpack_path.name
    group: str | None = None

    if workpack_path.parent.name != "instances":
        group = workpack_path.parent.name

    category = "feature"
    created_at = _today_date_utc()
    slug = folder_name

    legacy = LEGACY_WORKPACK_RE.match(folder_name)
    if legacy:
        category = legacy.group("category")
        created_at = legacy.group("created_at")
        slug = legacy.group("slug")
    else:
        grouped = GROUPED_WORKPACK_RE.match(folder_name)
        if grouped:
            slug = grouped.group("slug")
        category_match = re.search(
            r"(feature|refactor|bugfix|hotfix|debug|docs|perf|security)", folder_name
        )
        if category_match:
            category = category_match.group(1)

        date_match = re.search(r"\d{4}-\d{2}-\d{2}", folder_name)
        if date_match:
            created_at = date_match.group(0)

    return WorkpackIdentity(
        workpack_id=folder_name,
        group=group,
        category=category if category in CATEGORY_VALUES else "feature",
        created_at=created_at,
        slug=slug,
    )


def _humanize_slug(slug: str) -> str:
    words = [w for w in re.split(r"[_-]+", slug) if w]
    if not words:
        return "Workpack"
    out_words: list[str] = []
    for word in words:
        if re.fullmatch(r"v\d+", word, re.IGNORECASE):
            out_words.append(word.upper())
        elif word.isupper():
            out_words.append(word)
        else:
            out_words.append(word.capitalize())
    return " ".join(out_words)


def _infer_repo_name(workpack_path: Path) -> str:
    for parent in [workpack_path, *workpack_path.parents]:
        if parent.name == "workpacks":
            candidate = parent.parent.name
            if candidate:
                return candidate
    return Path.cwd().name or "Repository"


def _format_yaml_inline_list(values: list[str]) -> str:
    if not values:
        return "[]"
    return "[" + ", ".join(values) + "]"


def _inject_front_matter(content: str, depends_on: list[str], repos: list[str]) -> str:
    match = FRONT_MATTER_RE.match(content)
    if not match:
        return content

    body = match.group("body")

    def _set_field(text: str, field: str, value: str) -> str:
        pattern = re.compile(rf"(?m)^{re.escape(field)}\s*:\s*.*$")
        line = f"{field}: {value}"
        if pattern.search(text):
            return pattern.sub(line, text, count=1)
        text = text.strip()
        if text:
            return f"{text}\n{line}\n"
        return f"{line}\n"

    body = _set_field(body, "depends_on", _format_yaml_inline_list(depends_on))
    body = _set_field(body, "repos", _format_yaml_inline_list(repos))

    prefix = match.group(1)
    suffix = match.group(3)
    return f"{prefix}{body.rstrip()}{suffix}{content[match.end():]}"


def _default_skeleton(stem: str, workpack_ref: str) -> str:
    series = stem[0] if stem else "A"
    agent_type = {
        "A": "Feature Implementation",
        "B": "Bug Fix",
        "V": "Verification",
        "R": "Retrospective",
    }.get(series, "Agent")

    return textwrap.dedent(
        f"""\
        ---
        depends_on: []
        repos: []
        ---
        # {agent_type} Agent Prompt - {stem}

        > <!-- One-line objective summary -->

        ---

        ## READ FIRST

        1. `workpacks/instances/{workpack_ref}/00_request.md`
        2. `workpacks/instances/{workpack_ref}/01_plan.md`
        3. `workpacks/instances/{workpack_ref}/workpack.meta.json`
        4. `workpacks/instances/{workpack_ref}/workpack.state.json`

        ## Context

        Workpack: `{workpack_ref}`

        ## Delivery Mode

        - PR-based

        ## Objective

        <!-- Describe what to accomplish -->

        ## Reference Points

        <!-- Add semantic references -->

        ## Implementation Requirements

        <!-- Add behavioral requirements -->

        ## Scope

        ### In Scope
        - <!-- Item -->

        ### Out of Scope
        - <!-- Item -->

        ## Acceptance Criteria

        - [ ] <!-- Criterion -->

        ## Verification

        ```bash
        # Build / test commands
        ```

        ## Deliverables

        - [ ] `outputs/{stem}.json` written
        """
    )


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def _write_if_allowed(path: Path, data: Any, force: bool, label: str) -> str:
    if path.exists():
        if not force:
            print(f"WARN: {label} already exists at {path}. Skipping (use --force to overwrite).")
            return "skipped"
        _write_json(path, data)
        print(f"[overwrite] {path.name}")
        return "overwritten"

    _write_json(path, data)
    print(f"[create] {path.name}")
    return "created"


def _sanitize_summary(summary: str, fallback_title: str) -> str:
    clean = " ".join(summary.split())
    if len(clean) > 600:
        clean = clean[:597].rstrip() + "..."
    if len(clean) < 10:
        clean = f"Scaffolded workpack for {fallback_title}. Update summary during planning."
    return clean


def build_meta_payload(
    template_path: Path,
    identity: WorkpackIdentity,
    plan: PlanParseResult,
    default_repo: str,
) -> dict[str, Any]:
    meta = _load_json(template_path)

    prompt_repos: list[str] = []
    for prompt in plan.prompts:
        prompt_repos.extend(prompt.repos)
    prompt_repos = _dedupe_keep_order(prompt_repos)
    if not prompt_repos:
        prompt_repos = [default_repo]

    prompts_payload: list[dict[str, Any]] = []
    for prompt in plan.prompts:
        repos = prompt.repos or prompt_repos
        prompts_payload.append(
            {
                "stem": prompt.stem,
                "agent_role": prompt.agent_role,
                "depends_on": prompt.depends_on,
                "repos": repos,
                "estimated_effort": prompt.estimated_effort,
            }
        )

    title_base = _humanize_slug(identity.slug)
    title = title_base if len(title_base) >= 5 else f"Workpack {identity.workpack_id}"
    summary_seed = plan.summary or f"Scaffolded workpack for {title}."
    summary = _sanitize_summary(summary_seed, title)

    meta["id"] = identity.workpack_id
    if identity.group:
        meta["group"] = identity.group
    else:
        meta.pop("group", None)
    meta["title"] = title
    meta["summary"] = summary
    meta["protocol_version"] = "2.2.1"
    meta["workpack_version"] = meta.get("workpack_version", "1.0.0")
    meta["category"] = identity.category
    meta["created_at"] = identity.created_at
    meta["requires_workpack"] = plan.requires_workpack
    meta["tags"] = meta.get("tags", [])
    meta["owners"] = meta.get("owners", [])
    meta["repos"] = prompt_repos
    meta["delivery_mode"] = meta.get("delivery_mode", "pr")
    meta["target_branch"] = meta.get("target_branch", "main")
    meta["prompts"] = prompts_payload

    return meta


def build_state_payload(
    template_path: Path,
    identity: WorkpackIdentity,
    plan: PlanParseResult,
) -> dict[str, Any]:
    state = _load_json(template_path)
    now = _now_utc_timestamp()

    state["workpack_id"] = identity.workpack_id
    state["overall_status"] = "not_started"
    state["last_updated"] = now
    state["prompt_status"] = {
        prompt.stem: {"status": "pending"} for prompt in plan.prompts
    }
    state["agent_assignments"] = {}
    state["blocked_by"] = []
    state["execution_log"] = [
        {
            "timestamp": now,
            "event": "created",
            "prompt_stem": None,
            "agent": None,
            "notes": "Workpack scaffold created",
        }
    ]
    state["notes"] = None
    return state


def scaffold_prompts(
    workpack_path: Path,
    workpack_ref: str,
    prompts: list[PromptSpec],
    force: bool,
) -> tuple[int, int, int]:
    prompts_dir = workpack_path / "prompts"
    prompts_dir.mkdir(parents=True, exist_ok=True)

    created = 0
    overwritten = 0
    skipped = 0

    for prompt in prompts:
        target = prompts_dir / f"{prompt.stem}.md"
        existed_before = target.exists()
        if existed_before and not force:
            print(f"SKIP prompt: {target.name} already exists")
            skipped += 1
            continue

        template = _resolve_template(prompt.stem)
        if template:
            content = template.read_text(encoding="utf-8")
        else:
            content = _default_skeleton(prompt.stem, workpack_ref)

        content = _inject_front_matter(content, prompt.depends_on, prompt.repos)
        target.write_text(content, encoding="utf-8")

        if existed_before:
            overwritten += 1
            print(f"OVERWRITE prompt: {target.name}")
        else:
            created += 1
            print(f"CREATE prompt: {target.name}")

    return created, overwritten, skipped


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scaffold prompts + metadata/state from 01_plan.md.",
    )
    parser.add_argument(
        "workpack",
        help="Path to the workpack folder (for example: workpacks/instances/<id>)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing prompt/meta/state files.",
    )
    args = parser.parse_args()

    workpack_path = Path(args.workpack).resolve()
    if not workpack_path.is_dir():
        print(f"ERROR: Workpack folder not found: {workpack_path}", file=sys.stderr)
        sys.exit(1)

    plan_path = workpack_path / "01_plan.md"
    try:
        plan = parse_plan(plan_path)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

    if not plan.prompts:
        print(f"ERROR: No prompt stems found in {plan_path}", file=sys.stderr)
        sys.exit(1)

    identity = derive_workpack_identity(workpack_path)
    default_repo = _infer_repo_name(workpack_path)

    workpacks_dir = _workpacks_dir()
    meta_template_path = workpacks_dir / "_template" / "workpack.meta.json"
    state_template_path = workpacks_dir / "_template" / "workpack.state.json"
    if not meta_template_path.exists():
        print(f"ERROR: Missing template: {meta_template_path}", file=sys.stderr)
        sys.exit(1)
    if not state_template_path.exists():
        print(f"ERROR: Missing template: {state_template_path}", file=sys.stderr)
        sys.exit(1)

    meta_payload = build_meta_payload(
        meta_template_path,
        identity,
        plan,
        default_repo,
    )
    state_payload = build_state_payload(
        state_template_path,
        identity,
        plan,
    )

    if identity.group:
        workpack_ref = f"{identity.group}/{identity.workpack_id}"
    else:
        workpack_ref = identity.workpack_id

    print(f"Workpack: {workpack_ref}")
    print(f"Prompt count: {len(plan.prompts)}")
    print(f"Category: {identity.category}")
    print(f"Created at: {identity.created_at}")
    print()

    prompts_created, prompts_overwritten, prompts_skipped = scaffold_prompts(
        workpack_path=workpack_path,
        workpack_ref=workpack_ref,
        prompts=plan.prompts,
        force=args.force,
    )

    meta_status = _write_if_allowed(
        workpack_path / "workpack.meta.json", meta_payload, args.force, "workpack.meta.json"
    )
    state_status = _write_if_allowed(
        workpack_path / "workpack.state.json", state_payload, args.force, "workpack.state.json"
    )

    print()
    print(
        "Done: "
        f"prompts(created={prompts_created}, overwritten={prompts_overwritten}, skipped={prompts_skipped}), "
        f"meta={meta_status}, state={state_status}"
    )

    # ------------------------------------------------------------------
    # Post-scaffold file completeness check
    # ------------------------------------------------------------------
    print()
    print("Running file completeness validation ...")
    version = get_workpack_version(workpack_path)
    if version < 1:
        version = 6  # fallback: assume 2.0.0 for freshly scaffolded workpacks
    errors, warnings = validate_workpack_files(workpack_path, version)

    if warnings:
        for w in warnings:
            print(f"  ! {w}")
    if errors:
        for e in errors:
            print(f"  ✗ {e}")
        print(
            f"File completeness check FAILED ({len(errors)} error(s)). "
            "Fix missing files before committing."
        )
        sys.exit(1)

    print(
        f"  ✓ [{display_version(version)}] {workpack_path.name} — "
        f"all required files present"
        + (f" ({len(warnings)} warning(s))" if warnings else "")
    )


if __name__ == "__main__":
    main()
