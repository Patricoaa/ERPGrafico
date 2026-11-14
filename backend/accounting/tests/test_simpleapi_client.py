"""Tests del cliente HTTP de SimpleAPI RCV (requests.Session.post mockeado)."""

import json
from datetime import datetime, timezone

import pytest
import requests

from accounting.integrations.simpleapi_client import (
    SimpleApiError,
    SimpleApiRcvClient,
    classify_error,
)
from accounting.models import RCVImportAttempt

Outcome = RCVImportAttempt.Outcome
API_KEY = "TEST-KEY-0000-0000-4472"
PASSWORD = "clave-de-prueba"


class FakeResponse:
    def __init__(self, status_code=200, body=None, text=None, headers=None):
        self.status_code = status_code
        self._body = body
        self.text = text if text is not None else json.dumps(body)
        self.headers = headers or {}

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


@pytest.fixture
def post(monkeypatch):
    log = {"calls": [], "result": FakeResponse(200, {})}

    def fake_post(self, url, **kwargs):
        log["calls"].append({"url": url, **kwargs})
        if isinstance(log["result"], Exception):
            raise log["result"]
        return log["result"]

    monkeypatch.setattr(requests.Session, "post", fake_post)
    return log


def fetch(direction="SALES"):
    client = SimpleApiRcvClient(API_KEY)
    return client.fetch(direction, 2026, 3, "11111111-1", "22222222-2", PASSWORD)


def test_fetch_builds_request(post):
    fetch()
    call = post["calls"][0]
    assert call["url"] == "https://servicios.simpleapi.cl/api/rcv-clavesii/ventas/03/2026"
    assert call["headers"] == {"Authorization": API_KEY}
    assert call["timeout"] == 180
    payload = json.loads(call["files"]["input"][1])
    assert payload["RutEmpresa"] == "11111111-1"
    assert payload["RutUsuario"] == "22222222-2"
    assert payload["PasswordSII"] == PASSWORD
    assert payload["Ambiente"] == 1
    assert payload["Detallado"] is False
    assert payload["ProcesaBoletas"] is True


def test_purchases_uses_compras(post):
    fetch("PURCHASES")
    assert "/compras/03/2026" in post["calls"][0]["url"]


def test_invalid_direction(post):
    with pytest.raises(ValueError):
        fetch("OTHER")
    assert post["calls"] == []


def test_fetch_parses_rate_limit_headers(post):
    post["result"] = FakeResponse(
        200,
        {"a": 1},
        headers={
            "x-rate-limit-remaining": "99",
            "x-rate-limit-reset": "2026-11-14T05:25:12.3869456Z",
        },
    )
    resp = fetch()
    assert resp.rate_limit_remaining == 99
    assert resp.rate_limit_reset == datetime(2026, 11, 14, 5, 25, 12, 386945, tzinfo=timezone.utc)
    assert resp.body == {"a": 1}
    assert resp.http_status == 200


def test_empty_object_200_is_ok(post):
    post["result"] = FakeResponse(200, {})
    assert fetch().body == {}


@pytest.mark.parametrize(
    "status,text,expected",
    [
        (429, "too many", Outcome.RATE_LIMITED),
        (429, "limite de plan", Outcome.RATE_LIMITED),
        (403, "Has superado el límite de consultas", Outcome.QUOTA_EXHAUSTED),
        (402, "Cupo agotado", Outcome.QUOTA_EXHAUSTED),
        (401, "quota exceeded", Outcome.QUOTA_EXHAUSTED),
        (403, "Su plan no incluye", Outcome.QUOTA_EXHAUSTED),
        (400, "Clave incorrecta en el SII", Outcome.AUTH_SII),
        (200, "Error de autenticación SII", Outcome.AUTH_SII),
        (401, "password invalida sii", Outcome.AUTH_SII),
        (401, "No autorizado", Outcome.AUTH_KEY),
        (403, "Forbidden", Outcome.AUTH_KEY),
        (500, "boom", Outcome.TRANSIENT),
        (503, "", Outcome.TRANSIENT),
        (400, "bad request", Outcome.OTHER),
        (404, "", Outcome.OTHER),
        (200, "<html>", Outcome.OTHER),
        (403, "limite de clave sii", Outcome.QUOTA_EXHAUSTED),
    ],
)
def test_classify_error(status, text, expected):
    assert classify_error(status, text) == expected


def test_error_message_hides_secrets(post):
    post["result"] = FakeResponse(500, None, text=f"fail key={API_KEY} pw={PASSWORD} " + "x" * 500)
    with pytest.raises(SimpleApiError) as exc:
        fetch()
    assert exc.value.outcome == Outcome.TRANSIENT
    assert exc.value.http_status == 500
    assert API_KEY not in str(exc.value)
    assert PASSWORD not in str(exc.value)
    assert "***" in str(exc.value)
    assert len(str(exc.value)) < 400


def test_timeout_is_transient(post):
    post["result"] = requests.Timeout("slow")
    with pytest.raises(SimpleApiError) as exc:
        fetch()
    assert exc.value.outcome == Outcome.TRANSIENT


def test_connection_error_is_transient(post):
    post["result"] = requests.ConnectionError("down")
    with pytest.raises(SimpleApiError) as exc:
        fetch()
    assert exc.value.outcome == Outcome.TRANSIENT


def test_non_json_200_is_other(post):
    post["result"] = FakeResponse(200, None, text="<html>hola</html>")
    with pytest.raises(SimpleApiError) as exc:
        fetch()
    assert exc.value.outcome == Outcome.OTHER


def test_error_keeps_rate_limit_headers(post):
    post["result"] = FakeResponse(
        429, None, text="slow down", headers={"x-rate-limit-remaining": "0"}
    )
    with pytest.raises(SimpleApiError) as exc:
        fetch()
    assert exc.value.outcome == Outcome.RATE_LIMITED
    assert exc.value.rate_limit_remaining == 0
