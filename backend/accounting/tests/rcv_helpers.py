"""Utilidades de prueba para la importación RCV (solo valores ficticios)."""

from __future__ import annotations

import copy
import json
from pathlib import Path

from accounting.integrations.simpleapi_client import SimpleApiError, SimpleApiResponse
from accounting.models import RCVApiKey, RCVSettings

FIXTURES = Path(__file__).parent / "fixtures"
COMPANY_RUT = "11111111-1"
USER_RUT = "22222222-2"
SII_PASSWORD = "clave-de-prueba"


def make_rcv_settings(password: str = SII_PASSWORD, **kw) -> RCVSettings:
    settings = RCVSettings(company_rut=COMPANY_RUT, user_rut=USER_RUT, **kw)
    settings.set_sii_password(password)
    settings.save()
    return settings


def make_api_key(key: str = "TEST-KEY-1", **kw) -> RCVApiKey:
    api_key = RCVApiKey(label=kw.pop("label", key), **kw)
    api_key.set_key(key)
    api_key.save()
    return api_key


def load_fixture(name: str) -> dict:
    """``load_fixture("rcv_ventas_202610")`` → copia profunda del JSON."""
    filename = name if name.endswith(".json") else f"{name}.json"
    return copy.deepcopy(json.loads((FIXTURES / filename).read_text(encoding="utf-8")))


def ok(body: dict) -> SimpleApiResponse:
    return SimpleApiResponse(
        http_status=200, body=body, duration_ms=1200, rate_limit_remaining=4, rate_limit_reset=None
    )


def error(outcome: str, http_status: int = 400, message: str = "", **kw) -> SimpleApiError:
    return SimpleApiError(
        outcome,
        message or f"SimpleAPI HTTP {http_status}: {outcome}",
        http_status=http_status,
        **kw,
    )


class FakeClient:
    """Fábrica de clientes falsos: una secuencia de respuestas/errores por key.

    Uso: ``fake = FakeClient({"TEST-KEY-1": [error(...), ok(body)]})`` y
    ``execute_import(imp, client_factory=fake)``. ``fake.calls`` registra
    ``(key, direction, year, month, company_rut, user_rut)`` de cada llamada.
    """

    def __init__(self, responses: dict[str, list[SimpleApiResponse | SimpleApiError]]):
        self._responses = {key: list(items) for key, items in responses.items()}
        self.calls: list[tuple] = []

    def __call__(self, api_key: str) -> "_BoundFake":
        return _BoundFake(self, api_key)

    def next_for(self, api_key: str) -> SimpleApiResponse:
        queue = self._responses.get(api_key) or []
        if not queue:
            raise AssertionError(f"Llamada inesperada con la key {api_key!r}")
        item = queue.pop(0)
        if isinstance(item, SimpleApiError):
            raise item
        return item


class _BoundFake:
    def __init__(self, owner: FakeClient, api_key: str):
        self._owner = owner
        self._api_key = api_key

    def fetch(self, direction, year, month, company_rut, user_rut, password):
        self._owner.calls.append((self._api_key, direction, year, month, company_rut, user_rut))
        return self._owner.next_for(self._api_key)
