#!/usr/bin/env python3
"""
Splice a generated resume content fragment into resume/index.html.

Usage:
    python scripts/sync_resume.py <path-to-fragment.html>

The fragment must be a content-only HTML snippet - no <!DOCTYPE>, <html>,
<head>, <body>, <nav>, or <footer>. It should use this site's existing CSS
classes/tokens (css/style.css) where practical, so the resume page inherits
the same light/dark theming as the rest of the site rather than bringing
its own styling. See CLAUDE.md, "Resume page + cross-repo pipeline", for
the full contract.

This script only rewrites the region between the RESUME_CONTENT markers in
resume/index.html - the nav, footer, and <head> are left untouched, so the
committed file is its own template. Review the diff and commit/push as a
normal change after running this.
"""

import sys
from pathlib import Path

START_MARKER = "<!-- RESUME_CONTENT:START -->"
END_MARKER = "<!-- RESUME_CONTENT:END -->"

REPO_ROOT = Path(__file__).resolve().parent.parent
TARGET = REPO_ROOT / "resume" / "index.html"

SUSPICIOUS_TAGS = ("<!doctype", "<html", "<head", "<body", "<nav", "<footer", "<script")


def main():
    if len(sys.argv) != 2:
        print(f"Usage: python {Path(__file__).name} <path-to-fragment.html>", file=sys.stderr)
        return 1

    fragment_path = Path(sys.argv[1])
    if not fragment_path.is_file():
        print(f"Fragment not found: {fragment_path}", file=sys.stderr)
        return 1

    fragment = fragment_path.read_text(encoding="utf-8").strip()

    lowered = fragment.lower()
    hits = [tag for tag in SUSPICIOUS_TAGS if tag in lowered]
    if hits:
        print(
            "Warning: fragment contains tag(s) that suggest it's a full "
            f"document, not a content-only fragment: {', '.join(hits)}. "
            "Proceeding anyway - review the result carefully.",
            file=sys.stderr,
        )

    if not TARGET.is_file():
        print(f"Target not found: {TARGET}", file=sys.stderr)
        return 1

    page = TARGET.read_text(encoding="utf-8")

    if page.count(START_MARKER) != 1 or page.count(END_MARKER) != 1:
        print(
            f"Expected exactly one {START_MARKER} and one {END_MARKER} "
            f"in {TARGET}. Found {page.count(START_MARKER)} and "
            f"{page.count(END_MARKER)}.",
            file=sys.stderr,
        )
        return 1

    before, rest = page.split(START_MARKER, 1)
    _, after = rest.split(END_MARKER, 1)

    new_page = (
        before + START_MARKER + "\n"
        + fragment + "\n    "
        + END_MARKER + after
    )

    TARGET.write_text(new_page, encoding="utf-8", newline="\n")
    print(f"Synced {fragment_path} into {TARGET}. Review the diff, then commit.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
