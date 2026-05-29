"""
Doc-link integrity — architectural invariant.

Validates that every relative doc->doc markdown link in the LIVE documentation
layers resolves to an existing file. Catches the most common doc-rot: a contract
or ADR pointing at a renamed/deleted sibling doc (e.g. the kind that left stale
references to removed components/files in the 2026-05 documentation review).

Scope (deliberate):
- Source files: live layers only. The ``50-audit/`` and ``99-walkthroughs/`` trees
  are point-in-time snapshots and are excluded.
- Links checked: relative markdown links whose target is a ``.md`` file (doc -> doc).
  External URLs, ``#`` anchors, ``mailto:``/``file:`` and source-file links are out of
  scope here. (Source-file link checking is future work — there is pre-existing rot
  in the historical audit docs that would make a strict source check noisy.)
"""
import re
import urllib.parse
from pathlib import Path

from django.conf import settings

REPO_ROOT = Path(settings.BASE_DIR).parent
DOCS = REPO_ROOT / "docs"
EXCLUDED_TOP_DIRS = {"50-audit", "99-walkthroughs"}
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def _live_markdown_files():
    for md in DOCS.rglob("*.md"):
        rel = md.relative_to(DOCS)
        if rel.parts and rel.parts[0] in EXCLUDED_TOP_DIRS:
            continue
        yield md


def test_live_docs_have_no_broken_doc_links():
    violations = []
    for md in _live_markdown_files():
        text = md.read_text(encoding="utf-8", errors="ignore")
        for match in LINK_RE.finditer(text):
            target = match.group(1).strip()
            if target.startswith(("http://", "https://", "mailto:", "file:", "#")):
                continue
            path = urllib.parse.unquote(target.split("#")[0].split("?")[0])
            if not path or not path.endswith(".md"):
                continue  # doc -> doc only
            if not (md.parent / path).resolve().exists():
                violations.append(f"{md.relative_to(REPO_ROOT)} -> {target}")

    assert not violations, (
        "Broken doc->doc markdown links in live documentation layers. "
        "Fix the link or restore the target:\n  " + "\n  ".join(sorted(violations))
    )
