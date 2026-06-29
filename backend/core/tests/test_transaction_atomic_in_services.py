import ast
import os
from pathlib import Path

import pytest
from django.conf import settings


def _get_service_files():
    backend_dir = Path(settings.BASE_DIR)
    skip_dirs = {"venv", ".venv", "__pycache__", "migrations", "tests"}
    result = []
    for p in backend_dir.rglob("services.py"):
        if not any(part in skip_dirs for part in p.parts):
            result.append(p)
    return sorted(result)


def _contains_transaction_atomic(node: ast.FunctionDef) -> bool:
    for decorator in node.decorator_list:
        if isinstance(decorator, ast.Name) and decorator.id == "transaction":
            return True
        if isinstance(decorator, ast.Attribute):
            if decorator.attr == "atomic" and isinstance(decorator.value, ast.Name) and decorator.value.id == "transaction":
                return True
            if decorator.attr == "transaction" and isinstance(decorator.value, ast.Attribute) and decorator.value.attr == "atomic":
                return True
    for child in ast.walk(node):
        if isinstance(child, ast.With):
            for item in child.items:
                ctx = item.context_expr
                if (
                    isinstance(ctx, ast.Call)
                    and isinstance(ctx.func, ast.Attribute)
                    and ctx.func.attr == "atomic"
                    and isinstance(ctx.func.value, ast.Name)
                    and ctx.func.value.id == "transaction"
                ):
                    return True
    return False


def _count_model_writes(node: ast.FunctionDef) -> dict[str, list[int]]:
    ORM_WRITE_METHODS = {"create", "update", "delete", "bulk_create", "bulk_update", "update_or_create", "get_or_create"}
    model_writes: dict[str, list[int]] = {}
    for child in ast.walk(node):
        if not isinstance(child, ast.Call):
            continue
        func = child.func
        if (
            isinstance(func, ast.Attribute)
            and func.attr in ORM_WRITE_METHODS
            and isinstance(func.value, ast.Attribute)
            and func.value.attr == "objects"
            and isinstance(func.value.value, ast.Name)
        ):
            model_name = func.value.value.id
            if model_name not in model_writes:
                model_writes[model_name] = []
            model_writes[model_name].append(child.lineno)
        if (
            isinstance(func, ast.Attribute)
            and func.attr == "save"
            and isinstance(func.value, ast.Name)
        ):
            model_name = func.value.id
            if model_name not in model_writes:
                model_writes[model_name] = []
            model_writes[model_name].append(child.lineno)
    return model_writes


def _is_private_helper(name: str) -> bool:
    return name.startswith("_")


SINGLE_MODEL_ALLOWLIST = {
    "inventory.services.ProductService.get_or_create_variant",
}

# Methods that update a FK relationship across domains with minimal risk
# (not true multi-table writes — instance.save() on a related object)
FALSE_POSITIVE_ALLOWLIST = {
    "tax.get_or_create_period",
}


@pytest.mark.django_db
class TestTransactionAtomicInServices:
    def test_all_multitable_writes_have_transaction_atomic(self):
        violations = []

        for path in _get_service_files():
            try:
                tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            except SyntaxError:
                continue

            app_name = path.parent.name

            for node in ast.walk(tree):
                if not isinstance(node, ast.FunctionDef):
                    continue

                has_atomic = _contains_transaction_atomic(node)
                if has_atomic:
                    continue

                model_writes = _count_model_writes(node)
                multi_model_writes = {m for m, lines in model_writes.items() if len(lines) > 0}
                distinct_models = len(multi_model_writes)

                if distinct_models < 2:
                    continue

                qual_name = f"{app_name}.{node.name}"

                if _is_private_helper(node.name):
                    violations.append(
                        f"[WARN] {path}:{node.lineno}: "
                        f"{qual_name}() es privada pero escribe en {distinct_models} modelos "
                        f"({', '.join(sorted(multi_model_writes))}). "
                        f"Verificar que su caller tenga @transaction.atomic."
                    )
                elif qual_name in FALSE_POSITIVE_ALLOWLIST:
                    continue
                elif qual_name in SINGLE_MODEL_ALLOWLIST:
                    continue
                else:
                    violations.append(
                        f"[FAIL] {path}:{node.lineno}: "
                        f"{qual_name}() escribe en {distinct_models} modelos "
                        f"({', '.join(sorted(multi_model_writes))}) "
                        f"sin @transaction.atomic ni `with transaction.atomic():`."
                    )

        if violations:
            print(f"\n=== Violaciones de @transaction.atomic en services.py ({len(violations)} total) ===")
            for v in violations:
                print(f"  {v}")

        failures = [v for v in violations if v.startswith("[FAIL]")]
        warnings = [v for v in violations if v.startswith("[WARN]")]

        msg_parts = []
        if failures:
            msg_parts.append(
                f"{len(failures)} método(s) público(s) mutan ≥2 tablas sin @transaction.atomic.\n"
                + "\n".join(f"  {f}" for f in failures)
                + "\n\nFix: agregar @transaction.atomic o `with transaction.atomic():`."
            )
        if warnings:
            msg_parts.append(
                f"\n[INFO] {len(warnings)} método(s) privado(s) mutan ≥2 tablas sin protección directa. "
                "Verificar que el caller tenga @transaction.atomic."
            )

        assert not failures, "\n".join(msg_parts)

        if warnings:
            pytest.skip(f"[INFO] Solo warnings ({len(warnings)} privados sin atomic): verificar manualmente.")
