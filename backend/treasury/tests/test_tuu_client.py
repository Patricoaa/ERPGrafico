"""Tests del cliente HTTP de reportes TUU (requests.post mockeado)."""

import json
from datetime import date
from pathlib import Path

import pytest
import requests

from treasury.integrations.tuu_client import (
    TuuAuthError,
    TuuClient,
    TuuError,
    TuuPlanError,
    TuuTransientError,
)

FIXTURES = Path(__file__).parent / "fixtures" / "tuu"
API_KEY = "secret-key-123"
DAY = date(2026, 10, 26)


def load(name: str) -> dict:
    return json.loads((FIXTURES / f"{name}.json").read_text())


class FakeResponse:
    def __init__(self, status_code: int, body):
        self.status_code = status_code
        self._body = body

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


@pytest.fixture
def calls(monkeypatch):
    """Registra las llamadas a requests.post; las respuestas se encolan en `queue`."""
    log = {"calls": [], "queue": []}

    def fake_post(url, json=None, headers=None, timeout=None):  # noqa: A002
        log["calls"].append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        item = log["queue"].pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    monkeypatch.setattr(requests, "post", fake_post)
    return log


def test_branch_paginates_all_pages(calls):
    calls["queue"] += [
        FakeResponse(200, load("branch_card_p1")),
        FakeResponse(200, load("branch_card_p2")),
    ]
    pages = TuuClient(API_KEY).fetch_branch(DAY, DAY, cash=False)
    assert [p.page for p in pages] == [1, 2]
    assert all(p.report == "BRANCH_CARD" and p.total_pages == 2 for p in pages)
    assert [len(p.rows) for p in pages] == [20, 3]
    assert calls["calls"][1]["json"]["page"] == 2
    assert calls["calls"][0]["json"] == {
        "startDate": "2026-10-26",
        "endDate": "2026-10-26",
        "page": 1,
        "pageSize": 20,
    }
    assert pages[0].http_status == 200
    assert pages[0].request_body == calls["calls"][0]["json"]
    assert pages[0].response_body == load("branch_card_p1")


def test_branch_cash_sends_type_filter(calls):
    calls["queue"] += [
        FakeResponse(200, load("branch_cash_p1")),
        FakeResponse(200, load("branch_cash_p2")),
    ]
    pages = TuuClient(API_KEY).fetch_branch(DAY, DAY, cash=True)
    assert all(p.report == "BRANCH_CASH" for p in pages)
    assert all(c["json"]["typeTransaction"] == "CASH" for c in calls["calls"])

    calls["calls"].clear()
    calls["queue"] += [
        FakeResponse(200, load("branch_card_p1")),
        FakeResponse(200, load("branch_card_p2")),
    ]
    TuuClient(API_KEY).fetch_branch(DAY, DAY, cash=False)
    assert all("typeTransaction" not in c["json"] for c in calls["calls"])


def test_general_body_shape_and_pagination(calls):
    calls["queue"] += [FakeResponse(200, load(f"general_p{i}")) for i in (1, 2, 3)]
    pages = TuuClient(API_KEY).fetch_general(DAY, DAY)
    assert calls["calls"][0]["json"] == {
        "Filters": {"StartDate": "2026-10-26", "EndDate": "2026-10-26"},
        "page": 1,
        "pageSize": 20,
    }
    assert [p.page for p in pages] == [1, 2, 3]
    assert [len(p.rows) for p in pages] == [20, 20, 7]
    assert pages[0].report == "GENERAL"
    assert calls["calls"][0]["url"].endswith("/Report/get-report")


def test_no_data_is_empty_ok(calls):
    calls["queue"].append(
        FakeResponse(
            200,
            {"metadata": {"code": "BR-27", "message": "No data"}, "data": None, "pagination": None},
        )
    )
    pages = TuuClient(API_KEY).fetch_branch(DAY, DAY, cash=False)
    assert len(pages) == 1 and pages[0].rows == []

    calls["queue"].append(FakeResponse(404, {"code": "404", "message": "No transactions found"}))
    pages = TuuClient(API_KEY).fetch_general(DAY, DAY)
    assert len(pages) == 1 and pages[0].rows == [] and pages[0].http_status == 404


@pytest.mark.parametrize(
    ("item", "exc", "code"),
    [
        (
            FakeResponse(
                401,
                {"error": True, "code": "KEY-003", "message": "Invalid API Key", "content": None},
            ),
            TuuAuthError,
            "KEY-003",
        ),
        (
            FakeResponse(200, {"metadata": {"code": "BR-25", "message": "plan"}}),
            TuuPlanError,
            "BR-25",
        ),
        (
            FakeResponse(200, {"metadata": {"code": "BR-30", "message": "plan"}}),
            TuuPlanError,
            "BR-30",
        ),
        (FakeResponse(503, None), TuuTransientError, None),
        (
            FakeResponse(200, {"metadata": {"code": "BR-13", "message": "x"}}),
            TuuTransientError,
            "BR-13",
        ),
        (FakeResponse(400, {"metadata": {"code": "BR-99", "message": "bad"}}), TuuError, "BR-99"),
        (requests.Timeout("boom"), TuuTransientError, None),
        (requests.ConnectionError("down"), TuuTransientError, None),
    ],
)
def test_error_classification(calls, item, exc, code):
    calls["queue"].append(item)
    with pytest.raises(exc) as info:
        TuuClient(API_KEY).fetch_branch(DAY, DAY, cash=False)
    assert info.value.code == code
    assert type(info.value) is exc


def test_general_error_envelope_classification(calls):
    calls["queue"].append(
        FakeResponse(401, {"error": True, "code": "KEY-003", "message": "Invalid API Key"})
    )
    with pytest.raises(TuuAuthError):
        TuuClient(API_KEY).fetch_general(DAY, DAY)


def test_header_and_no_key_in_messages(calls):
    single = load("branch_card_p2")
    single["pagination"]["totalPages"] = 1
    calls["queue"].append(FakeResponse(200, single))
    TuuClient(API_KEY, timeout=15).fetch_branch(DAY, DAY, cash=False)
    assert calls["calls"][0]["headers"]["X-API-Key"] == API_KEY
    assert calls["calls"][0]["timeout"] == 15

    for item in (
        FakeResponse(401, {"code": "KEY-003", "message": f"Invalid API Key {API_KEY}"}),
        FakeResponse(503, None),
        requests.Timeout(f"timeout with {API_KEY}"),
        requests.ConnectionError(f"conn {API_KEY}"),
    ):
        calls["queue"].append(item)
        with pytest.raises(TuuError) as info:
            TuuClient(API_KEY).fetch_branch(DAY, DAY, cash=False)
        assert API_KEY not in str(info.value)


@pytest.mark.parametrize("status", [408, 429])
def test_throttle_and_timeout_statuses_are_transient(calls, status):
    calls["queue"].append(FakeResponse(status, None))
    with pytest.raises(TuuTransientError):
        TuuClient(API_KEY).fetch_branch(DAY, DAY, cash=False)


def test_any_requests_exception_is_transient_and_key_free(calls):
    calls["queue"].append(requests.exceptions.ChunkedEncodingError(f"broken {API_KEY}"))
    with pytest.raises(TuuTransientError) as info:
        TuuClient(API_KEY).fetch_branch(DAY, DAY, cash=False)
    assert API_KEY not in str(info.value)


def test_malformed_total_pages_is_tuu_error(calls):
    page = load("branch_card_p2")
    page["pagination"]["totalPages"] = "abc"
    calls["queue"].append(FakeResponse(200, page))
    with pytest.raises(TuuError) as info:
        TuuClient(API_KEY).fetch_branch(DAY, DAY, cash=False)
    assert type(info.value) is TuuError


def test_pagination_capped(calls):
    page = load("branch_card_p2")
    page["pagination"]["totalPages"] = 100000
    calls["queue"] += [FakeResponse(200, page) for _ in range(501)]
    with pytest.raises(TuuError, match="Paginación inesperada de TUU"):
        TuuClient(API_KEY).fetch_branch(DAY, DAY, cash=False)


def test_empty_api_key_does_not_mangle_messages(calls):
    calls["queue"].append(FakeResponse(400, {"metadata": {"code": "BR-99", "message": "bad"}}))
    with pytest.raises(TuuError) as info:
        TuuClient("").fetch_branch(DAY, DAY, cash=False)
    assert str(info.value) == "TUU BRANCH_CARD HTTP 400 [BR-99]: bad"
