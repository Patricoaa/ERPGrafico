"""
ADR-0080: toda URL canónica que genera DocumentTypeRegistry debe tener ruta en el
frontend (evita repetir los 29 `detailUrlPattern` sin ruta de la auditoría documental).
Se omite si el árbol del frontend no está disponible (contenedor solo-backend).
"""

from pathlib import Path

import pytest

from core.documents.types import RESOLVER_URL, DocumentTypeRegistry

APP_DIR = Path(__file__).resolve().parents[3] / "frontend" / "app"


def _routes() -> set[str]:
    routes = set()
    for page in APP_DIR.rglob("page.tsx"):
        parts = [p for p in page.parent.relative_to(APP_DIR).parts if not (p.startswith("(") and p.endswith(")"))]
        routes.add("/" + "/".join(parts))
    return routes


def _has_route(path: str, routes: set[str]) -> bool:
    segs = [s for s in path.split("?")[0].split("/") if s]
    for route in routes:
        rsegs = [s for s in route.split("/") if s]
        if len(rsegs) == len(segs) and all(r == s or r.startswith("[") for r, s in zip(rsegs, segs)):
            return True
    return False


@pytest.mark.skipif(not APP_DIR.exists(), reason="frontend/app no disponible")
def test_registered_canonical_urls_have_frontend_routes():
    routes = _routes()
    patterns = {"resolver": RESOLVER_URL.format(label="x.y", id=1)}
    patterns.update({
        label: doc_type.canonical_url.format(id=1)
        for label, doc_type in DocumentTypeRegistry._types.items()
        if isinstance(doc_type.canonical_url, str)
    })
    missing = {label: url for label, url in patterns.items() if not _has_route(url, routes)}
    assert not missing, f"URLs canónicas sin ruta en el frontend: {missing}"


DRAWERS_FILE = APP_DIR.parent / "lib" / "entity-drawers.tsx"


@pytest.mark.skipif(not DRAWERS_FILE.exists(), reason="frontend no disponible")
def test_every_registered_type_has_canonical_url_or_drawer():
    """GAP-08: sin URL declarada, /d/{label}/{id} abre la ficha registrada; si no hay ficha, falla."""
    import re

    from core.registry import UniversalRegistry

    drawers = set(re.findall(r'^\s+"([a-z_]+\.[a-z_]+)":', DRAWERS_FILE.read_text(), re.MULTILINE))
    missing = [
        label for label in UniversalRegistry.all_labels()
        if not isinstance(DocumentTypeRegistry.get(label).canonical_url, str)
        and not callable(DocumentTypeRegistry.get(label).canonical_url)
        and label not in drawers
    ]
    assert not missing, f"Tipos sin URL canónica ni ficha (el resolvedor no podría abrirlos): {missing}"


def test_search_detail_url_uses_canonical_url():
    from core.registry import UniversalRegistry

    assert UniversalRegistry._canonical_url("sales.saledelivery", 800) == "/d/sales.saledelivery/800"
    assert UniversalRegistry._canonical_url("sales.saleorder", 5) == "/sales/orders?selected=5"
    assert UniversalRegistry._canonical_url("billing.invoice", 7) == "/d/billing.invoice/7"
