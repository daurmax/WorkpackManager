#!/usr/bin/env python3
"""
workpack_memory.py — Workpack Knowledge-Base Manager

Extracts lessons-learned from completed workpack retrospectives and manages
the append-only memory store at ``workpacks/memory/entries.jsonl``.

Sub-commands
~~~~~~~~~~~~
  extract <workpack-id>   Scan a completed workpack and generate memory entries.
  report                  Print a human-readable summary of all memory entries.
  validate                Validate entries.jsonl against WORKPACK_MEMORY_SCHEMA.
  search <query>          Search entries by free-text match on summary/detail/tags.

Exit codes:
  0 - success
  1 - validation or runtime error
  2 - workpack not in terminal state (extract)
"""

from __future__ import annotations

import argparse
import datetime
import json
import re
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
TOOLS_DIR = Path(__file__).resolve().parent
WORKPACKS_DIR = TOOLS_DIR.parent
INSTANCES_DIR = WORKPACKS_DIR / "instances"
MEMORY_DIR = WORKPACKS_DIR / "memory"
ENTRIES_FILE = MEMORY_DIR / "entries.jsonl"
SCHEMA_FILE = WORKPACKS_DIR / "WORKPACK_MEMORY_SCHEMA.json"

TERMINAL_STATUSES = {"complete", "abandoned"}

CATEGORIES = [
    "pattern",
    "anti-pattern",
    "tooling",
    "estimation",
    "dependency",
    "process",
    "architecture",
    "testing",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _load_json(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _next_entry_id() -> str:
    """Return next MEM-NNN id based on existing entries."""
    max_id = 0
    if ENTRIES_FILE.exists():
        for line in ENTRIES_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                m = re.match(r"^MEM-(\d+)$", entry.get("entry_id", ""))
                if m:
                    max_id = max(max_id, int(m.group(1)))
            except json.JSONDecodeError:
                continue
    return f"MEM-{max_id + 1:03d}"


def _append_entry(entry: dict[str, Any]) -> None:
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    with open(ENTRIES_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _load_entries() -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    if not ENTRIES_FILE.exists():
        return entries
    for line in ENTRIES_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return entries


def _find_workpack(workpack_id: str) -> Path | None:
    """Locate a workpack instance directory by ID."""
    # Direct match
    direct = INSTANCES_DIR / workpack_id
    if direct.is_dir():
        return direct
    # Scan groups
    for group_dir in INSTANCES_DIR.iterdir():
        if not group_dir.is_dir():
            continue
        candidate = group_dir / workpack_id
        if candidate.is_dir():
            return candidate
        # Slug-suffix match
        for child in group_dir.iterdir():
            if child.is_dir() and child.name.endswith(workpack_id):
                return child
    return None


# ---------------------------------------------------------------------------
# Extract
# ---------------------------------------------------------------------------
def _extract_from_status_md(status_path: Path) -> list[str]:
    """Pull lesson-like lines from 99_status.md retrospective sections."""
    lessons: list[str] = []
    if not status_path.exists():
        return lessons
    text = status_path.read_text(encoding="utf-8")
    # Look for sections like "## Lessons", "## Retrospective", "## Notes"
    in_section = False
    for line in text.splitlines():
        if re.match(r"^##\s+(lessons|retrospective|notes|takeaway)", line, re.I):
            in_section = True
            continue
        if in_section and line.startswith("## "):
            in_section = False
            continue
        if in_section and line.strip().startswith("- "):
            lessons.append(line.strip().lstrip("- ").strip())
    return lessons


def _extract_from_execution_log(
    log_entries: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Extract notable events from execution_log."""
    notable: list[dict[str, str]] = []
    for entry in log_entries:
        notes = entry.get("notes", "")
        if any(
            kw in notes.lower()
            for kw in ["lesson", "blocker", "workaround", "retry", "unexpected"]
        ):
            notable.append(
                {
                    "prompt": entry.get("prompt_stem", "unknown"),
                    "notes": notes,
                }
            )
    return notable


def cmd_extract(args: argparse.Namespace) -> int:
    wp_dir = _find_workpack(args.workpack_id)
    if wp_dir is None:
        print(f"Error: workpack '{args.workpack_id}' not found.", file=sys.stderr)
        return 1

    state_path = wp_dir / "workpack.state.json"
    if not state_path.exists():
        print(f"Error: no workpack.state.json in {wp_dir}.", file=sys.stderr)
        return 1

    state = _load_json(state_path)
    status = state.get("overall_status", "")
    if status not in TERMINAL_STATUSES:
        print(
            f"Error: workpack status is '{status}', expected one of {TERMINAL_STATUSES}.",
            file=sys.stderr,
        )
        return 2

    # Collect raw lessons
    status_lessons = _extract_from_status_md(wp_dir / "99_status.md")
    log_notable = _extract_from_execution_log(state.get("execution_log", []))

    if not status_lessons and not log_notable:
        print(f"No extractable lessons found in {args.workpack_id}.")
        return 0

    created = datetime.datetime.now(datetime.timezone.utc).isoformat()
    count = 0

    for lesson_text in status_lessons:
        entry = {
            "entry_id": _next_entry_id(),
            "source_workpack": args.workpack_id,
            "created_at": created,
            "category": "process",
            "summary": lesson_text[:200],
        }
        if args.dry_run:
            print(json.dumps(entry, indent=2))
        else:
            _append_entry(entry)
        count += 1

    for notable in log_notable:
        entry = {
            "entry_id": _next_entry_id(),
            "source_workpack": args.workpack_id,
            "created_at": created,
            "category": "process",
            "summary": f"[{notable['prompt']}] {notable['notes']}"[:200],
            "related_prompts": [notable["prompt"]],
        }
        if args.dry_run:
            print(json.dumps(entry, indent=2))
        else:
            _append_entry(entry)
        count += 1

    action = "would create" if args.dry_run else "created"
    print(f"{action} {count} memory entries from {args.workpack_id}.")
    return 0


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
def cmd_report(_args: argparse.Namespace) -> int:
    entries = _load_entries()
    if not entries:
        print("No memory entries found.")
        return 0

    by_cat: dict[str, list[dict[str, Any]]] = {}
    for e in entries:
        cat = e.get("category", "unknown")
        by_cat.setdefault(cat, []).append(e)

    print(f"=== Workpack Memory Report ({len(entries)} entries) ===\n")
    for cat in sorted(by_cat):
        print(f"## {cat} ({len(by_cat[cat])})")
        for e in by_cat[cat]:
            eid = e.get("entry_id", "?")
            src = e.get("source_workpack", "?")
            summary = e.get("summary", "")
            print(f"  [{eid}] ({src}) {summary}")
        print()
    return 0


# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------
def cmd_validate(_args: argparse.Namespace) -> int:
    try:
        import jsonschema  # type: ignore
    except ImportError:
        print(
            "Error: jsonschema package required. Install with: pip install jsonschema",
            file=sys.stderr,
        )
        return 1

    if not SCHEMA_FILE.exists():
        print(f"Error: schema not found at {SCHEMA_FILE}", file=sys.stderr)
        return 1

    schema = _load_json(SCHEMA_FILE)
    entries = _load_entries()

    if not entries:
        print("No entries to validate.")
        return 0

    errors = 0
    for i, entry in enumerate(entries, 1):
        try:
            jsonschema.validate(entry, schema)
        except jsonschema.ValidationError as exc:
            print(f"Entry {i} ({entry.get('entry_id', '?')}): {exc.message}")
            errors += 1

    if errors:
        print(f"\n{errors} validation error(s) found.")
        return 1

    print(f"All {len(entries)} entries valid.")
    return 0


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------
def cmd_search(args: argparse.Namespace) -> int:
    entries = _load_entries()
    query = args.query.lower()
    matches = []
    for e in entries:
        searchable = " ".join(
            [
                e.get("summary", ""),
                e.get("detail", ""),
                " ".join(e.get("tags", [])),
                e.get("category", ""),
                e.get("source_workpack", ""),
            ]
        ).lower()
        if query in searchable:
            matches.append(e)

    if not matches:
        print(f'No entries matching "{args.query}".')
        return 0

    print(f'Found {len(matches)} entries matching "{args.query}":\n')
    for e in matches:
        eid = e.get("entry_id", "?")
        cat = e.get("category", "?")
        src = e.get("source_workpack", "?")
        summary = e.get("summary", "")
        print(f"  [{eid}] [{cat}] ({src}) {summary}")
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Workpack knowledge-base manager."
    )
    sub = parser.add_subparsers(dest="command")

    p_extract = sub.add_parser("extract", help="Extract lessons from a completed workpack.")
    p_extract.add_argument("workpack_id", help="Workpack ID to extract from.")
    p_extract.add_argument(
        "--dry-run",
        action="store_true",
        help="Print entries without writing to entries.jsonl.",
    )

    sub.add_parser("report", help="Print summary of all memory entries.")
    sub.add_parser("validate", help="Validate entries.jsonl against schema.")

    p_search = sub.add_parser("search", help="Search entries by text.")
    p_search.add_argument("query", help="Search query string.")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return 0

    handlers = {
        "extract": cmd_extract,
        "report": cmd_report,
        "validate": cmd_validate,
        "search": cmd_search,
    }
    return handlers[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
