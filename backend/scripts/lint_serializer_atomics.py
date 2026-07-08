#!/usr/bin/env python3
"""
lint_serializer_atomics.py
==========================
Detect the antipattern: transaction.atomic used inside a Serializer class.

The architecture contract mandates that all atomic transaction boundaries live
in the service layer (services.py), never inside DRF Serializer classes.

Usage
-----
    python backend/scripts/lint_serializer_atomics.py            # scan all serializers.py
    python backend/scripts/lint_serializer_atomics.py path/to/   # scan a specific dir

Exit codes
----------
    0  No violations found.
    1  One or more violations found (CI should block on this).

Detection rules
---------------
Rule A — Import of `transaction` inside a Serializer class method:
    `from django.db import transaction`  inside a def that is a method of a
    class inheriting from *Serializer.

Rule B — `transaction.atomic` call / decorator anywhere inside a Serializer class
    (whether inline import or module-level import).

Rule C — Any direct ORM call (`Model.objects.create`, `.filter`, `.get`,
    `.update_or_create`, etc.) inside a `create()` or `update()` method of a
    Serializer class.  These belong in services.py.
"""

import ast
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SERIALIZER_BASE_SUFFIXES = ("Serializer",)
WATCHED_METHODS = {"create", "update"}
ORM_MANAGER_ATTRS = {"objects"}
ORM_CALL_NAMES = {
    "create",
    "get",
    "filter",
    "all",
    "update",
    "delete",
    "update_or_create",
    "get_or_create",
    "bulk_create",
    "bulk_update",
    "select_related",
    "prefetch_related",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_serializer_class(node: ast.ClassDef) -> bool:
    """Return True if the class name ends with 'Serializer'."""
    return any(node.name.endswith(suffix) for suffix in SERIALIZER_BASE_SUFFIXES)


def _class_method_nodes(class_node: ast.ClassDef):
    """Yield FunctionDef for direct methods of a class."""
    for item in class_node.body:
        if isinstance(item, ast.FunctionDef):
            yield item


def _contains_transaction_atomic(func_node: ast.FunctionDef) -> list:
    """Return list of line numbers where transaction.atomic is used in the function."""
    hits = []
    for node in ast.walk(func_node):
        # Pattern: with transaction.atomic(): ...
        if isinstance(node, ast.With):
            for item in node.items:
                ctx = item.context_expr
                if (
                    isinstance(ctx, ast.Call)
                    and isinstance(ctx.func, ast.Attribute)
                    and ctx.func.attr == "atomic"
                    and isinstance(ctx.func.value, ast.Name)
                    and ctx.func.value.id == "transaction"
                ):
                    hits.append(node.lineno)
        # Pattern: @transaction.atomic decorator
        if isinstance(node, ast.FunctionDef):
            for dec in node.decorator_list:
                if (
                    isinstance(dec, ast.Attribute)
                    and dec.attr == "atomic"
                    and isinstance(dec.value, ast.Name)
                    and dec.value.id == "transaction"
                ):
                    hits.append(dec.lineno)
        # Pattern: from django.db import transaction (inline import inside method)
        if isinstance(node, ast.ImportFrom):
            if (
                node.module in ("django.db", "django.db.transaction")
                and any(alias.name == "transaction" for alias in node.names)
            ):
                hits.append(node.lineno)
    return hits


def _contains_orm_call_in_watched_method(func_node: ast.FunctionDef) -> list:
    """
    Return line numbers of direct ORM calls inside a create() or update() method.
    Service delegation calls are NOT flagged.
    """
    if func_node.name not in WATCHED_METHODS:
        return []

    hits = []
    for node in ast.walk(func_node):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        # Pattern: something.objects.method(...)  -> two levels of Attribute
        if (
            isinstance(func, ast.Attribute)
            and func.attr in ORM_CALL_NAMES
            and isinstance(func.value, ast.Attribute)
            and func.value.attr in ORM_MANAGER_ATTRS
        ):
            hits.append(node.lineno)
    return hits


# ---------------------------------------------------------------------------
# Main scanner
# ---------------------------------------------------------------------------


def scan_file(path: Path) -> list:
    """Scan a single Python file for serializer antipatterns. Returns violation messages."""
    violations = []
    source = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(source, filename=str(path))
    except SyntaxError as exc:
        violations.append(f"{path}:?: SyntaxError - {exc}")
        return violations

    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        if not _is_serializer_class(node):
            continue

        for method_node in _class_method_nodes(node):
            # Rule A + B - transaction.atomic anywhere inside the serializer method
            tx_lines = _contains_transaction_atomic(method_node)
            for lineno in tx_lines:
                violations.append(
                    f"{path}:{lineno}: [RULE-A/B] `transaction.atomic` in "
                    f"{node.name}.{method_node.name}() -- move to services.py"
                )

            # Rule C - direct ORM call inside create() / update()
            orm_lines = _contains_orm_call_in_watched_method(method_node)
            for lineno in orm_lines:
                violations.append(
                    f"{path}:{lineno}: [RULE-C] Direct ORM call in "
                    f"{node.name}.{method_node.name}() -- delegate to a service"
                )

    return violations


def collect_serializer_files(root: Path) -> list:
    """Recursively find all serializers.py under root, skipping venv and migrations."""
    skip_dirs = {"venv", ".venv", "migrations", "__pycache__", "node_modules"}
    results = []
    for p in root.rglob("serializers.py"):
        if not any(part in skip_dirs for part in p.parts):
            results.append(p)
    return results


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent
    files = collect_serializer_files(root)

    all_violations = []
    for f in sorted(files):
        all_violations.extend(scan_file(f))

    if all_violations:
        print(f"\n{'=' * 70}")
        print("  FAIL  Serializer antipattern violations found:")
        print(f"{'=' * 70}\n")
        for v in all_violations:
            print(f"  {v}")
        print(f"\n{len(all_violations)} violation(s) in {len(files)} file(s) scanned.")
        print(
            "\n  Fix: move transaction.atomic + ORM calls to services.py and"
            "\n  have the serializer's create()/update() delegate to the service.\n"
        )
        return 1

    print(f"OK  No serializer antipatterns found ({len(files)} file(s) scanned).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
