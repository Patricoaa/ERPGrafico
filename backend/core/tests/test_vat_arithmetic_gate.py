"""Guardia ADR-0151: la aritmética de IVA vive solo en accounting/vat.py y frontend/lib/vat.ts."""

import re
from pathlib import Path

import pytest

pytestmark = pytest.mark.ci_gate

REPO_ROOT = Path(__file__).resolve().parents[3]

BACKEND_PATTERNS = (
    re.compile(r"get_vat_multiplier\(\)\s*[*/]"),
    re.compile(r"[*/]\s*get_vat_multiplier\(\)"),
    re.compile(r"[*/]\s*vat(_mult|_rate)?\b"),
)
FRONTEND_PATTERNS = (
    re.compile(r"\b1\.19\b"),
    re.compile(r"[*/]\s*vatMultiplier\b"),
)
FRONTEND_CONVERSION = re.compile(r"netToGross|grossToNet")  # permitido solo bajo lib/

BACKEND_EXCLUDED_PARTS = {"tests", "migrations", "venv", "node_modules", "__pycache__", ".venv"}
BACKEND_EXCLUDED_FILES = {"backend/accounting/vat.py"}
FRONTEND_DIRS = ("features", "components", "hooks", "app", "lib")
FRONTEND_EXCLUDED_FILES = {"frontend/lib/vat.ts"}
FRONTEND_TEST_MARKERS = (".test.", ".stories.", "/__tests__/")

# ruta relativa a la raíz del repo -> motivo
ALLOWED = {
    "backend/treasury/card_transaction_service.py": "IVA sobre comisión, no es precio de venta",
    "frontend/hooks/useVatRate.ts": "único valor de respaldo de la tasa mientras carga la configuración",
    "frontend/features/purchasing/components/checkout/PurchaseOrderSummaryCard.tsx": (
        "total de documento: delega en PricingUtils (vat.ts) con la tasa explícita"
    ),
    "frontend/features/sales/components/checkout/OrderSummaryCard.tsx": (
        "total de documento: delega en PricingUtils (vat.ts) con la tasa explícita"
    ),
}


def _rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def scan_backend(root: Path) -> dict[str, list[int]]:
    found: dict[str, list[int]] = {}
    base = root / "backend"
    if not base.is_dir():
        return found
    for path in base.rglob("*.py"):
        rel = _rel(path, root)
        if (
            BACKEND_EXCLUDED_PARTS & set(path.relative_to(base).parts)
            or rel in BACKEND_EXCLUDED_FILES
        ):
            continue
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        hits = [
            n for n, line in enumerate(lines, 1) if any(p.search(line) for p in BACKEND_PATTERNS)
        ]
        if hits:
            found[rel] = hits
    return found


def scan_frontend(root: Path) -> dict[str, list[int]]:
    found: dict[str, list[int]] = {}
    for directory in FRONTEND_DIRS:
        base = root / "frontend" / directory
        if not base.is_dir():
            continue
        for path in [*base.rglob("*.ts"), *base.rglob("*.tsx")]:
            rel = _rel(path, root)
            if "node_modules" in path.parts or rel in FRONTEND_EXCLUDED_FILES:
                continue
            if any(marker in f"/{rel}" for marker in FRONTEND_TEST_MARKERS):
                continue
            in_lib = directory == "lib"
            lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
            hits = [
                n
                for n, line in enumerate(lines, 1)
                if any(p.search(line) for p in FRONTEND_PATTERNS)
                or (not in_lib and FRONTEND_CONVERSION.search(line))
            ]
            if hits:
                found[rel] = hits
    return found


def _scan_repo() -> dict[str, list[int]]:
    if not (REPO_ROOT / "frontend").is_dir():
        pytest.skip(
            "frontend/ ausente (checkout solo backend): la mitad frontend de la guardia no se puede verificar"
        )
    return {**scan_backend(REPO_ROOT), **scan_frontend(REPO_ROOT)}


def test_scanner_detects_forbidden_lines(tmp_path):
    (tmp_path / "backend" / "sales" / "tests").mkdir(parents=True)
    (tmp_path / "backend" / "sales" / "bad.py").write_text("gross = net * get_vat_multiplier()\n")
    (tmp_path / "backend" / "sales" / "bad2.py").write_text("net = gross / vat_mult\n")
    (tmp_path / "backend" / "sales" / "tests" / "test_x.py").write_text("x = a * vat\n")
    (tmp_path / "frontend" / "features" / "x").mkdir(parents=True)
    (tmp_path / "frontend" / "features" / "x" / "a.ts").write_text("const g = n * 1.19;\n")
    (tmp_path / "frontend" / "features" / "x" / "b.tsx").write_text("netToGross(n, m)\n")
    (tmp_path / "frontend" / "features" / "x" / "a.test.ts").write_text("const g = n * 1.19;\n")
    (tmp_path / "frontend" / "lib").mkdir()
    (tmp_path / "frontend" / "lib" / "pricing.ts").write_text("grossToNet(g, m)\n")
    (tmp_path / "frontend" / "lib" / "other.ts").write_text("x * vatMultiplier\n")

    assert set(scan_backend(tmp_path)) == {"backend/sales/bad.py", "backend/sales/bad2.py"}
    assert set(scan_frontend(tmp_path)) == {
        "frontend/features/x/a.ts",
        "frontend/features/x/b.tsx",
        "frontend/lib/other.ts",
    }


def test_no_vat_arithmetic_outside_blessed_modules():
    found = _scan_repo()
    violations = [
        f"{rel}:{','.join(map(str, n))}" for rel, n in sorted(found.items()) if rel not in ALLOWED
    ]
    assert not violations, (
        "Aritmética de IVA fuera de accounting/vat.py y lib/vat.ts (ADR-0151):\n"
        + "\n".join(violations)
    )


def test_allowed_entries_still_match():
    found = _scan_repo()
    stale = sorted(rel for rel in ALLOWED if rel not in found)
    assert not stale, f"Entradas de ALLOWED que ya no coinciden (elimínalas): {stale}"
