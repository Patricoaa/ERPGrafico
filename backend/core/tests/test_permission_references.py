"""Ningún código referencia un permiso que no existe (F2, F3, F4)."""

import re
from pathlib import Path

from django.apps import apps
from django.conf import settings

from core.rbac.catalog import permission_catalog

BACKEND_DIR = Path(settings.BASE_DIR)
FRONTEND_DIR = Path(settings.BASE_DIR).parent / "frontend"
EXCLUDED_PARTS = {"venv", ".venv", "migrations", "tests", "scripts", "node_modules", "__pycache__"}


def _backend_py_files(names=None):
    for path in BACKEND_DIR.rglob("*.py"):
        rel = path.relative_to(BACKEND_DIR)
        if EXCLUDED_PARTS & set(rel.parts):
            continue
        if path.name.startswith("test_") or path.name == "conftest.py":
            continue
        if names and path.name not in names:
            continue
        yield path


def _scan(pattern: str, files) -> set[str]:
    regex = re.compile(pattern)
    found: set[str] = set()
    for path in files:
        found.update(regex.findall(path.read_text(encoding="utf-8", errors="ignore")))
    return found


def test_backend_has_perm_literals_exist():
    used = _scan(r"""has_perm\(\s*["']([\w]+\.[\w]+)["']""", _backend_py_files())
    missing = used - permission_catalog()
    assert not missing, f"has_perm() referencia permisos inexistentes: {sorted(missing)}"


def test_registry_permission_literals_exist():
    used = _scan(r"""\bpermission\s*=\s*["']([\w]+\.[\w]+)["']""", _backend_py_files())
    missing = used - permission_catalog()
    assert not missing, f"permission= referencia permisos inexistentes: {sorted(missing)}"



FRONTEND_PERM_RE = (
    r"""['"]([a-z_]+\.(?:view|add|change|delete|approve|override|can|annul|confirm|purge|"""
    r"""cancel|close|reopen|post|pay|export|write_off|dispatch|receive)_[a-z_]+)['"]"""
)


def test_frontend_permission_literals_exist():
    files = []
    for sub in ("app", "features", "components", "lib", "hooks", "contexts"):
        base = FRONTEND_DIR / sub
        if not base.exists():
            continue
        for ext in ("ts", "tsx"):
            files.extend(p for p in base.rglob(f"*.{ext}") if "node_modules" not in p.parts)
    used = _scan(FRONTEND_PERM_RE, files)
    # Solo cadenas cuyo app_label es una app instalada (descarta p. ej. nombres de campos).
    labels = {c.label for c in apps.get_app_configs()}
    used = {u for u in used if u.split(".", 1)[0] in labels}
    missing = used - permission_catalog()
    assert not missing, f"El frontend referencia permisos inexistentes: {sorted(missing)}"


def test_no_is_staff_access_checks():
    offenders = [
        str(p.relative_to(BACKEND_DIR))
        for p in _backend_py_files(names={"views.py", "services.py"})
        if "is_staff" in p.read_text(encoding="utf-8", errors="ignore")
    ]
    assert not offenders, f"is_staff usado para control de acceso en: {offenders}"
