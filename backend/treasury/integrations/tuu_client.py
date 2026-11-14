"""Cliente HTTP de los reportes de TUU (Haulmer).

Tres llamadas: sucursal tarjeta (A), sucursal efectivo (B) y reporte general (C).
Recorre todas las páginas y clasifica los errores; ningún mensaje de error
incluye la API key.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

import requests

BASE_URL = "https://integrations.payment.haulmer.com"
BRANCH_PATH = "/BranchReport/branch-report"
GENERAL_PATH = "/Report/get-report"
PAGE_SIZE = 20
MAX_PAGES = 500

REPORT_BRANCH_CARD = "BRANCH_CARD"
REPORT_BRANCH_CASH = "BRANCH_CASH"
REPORT_GENERAL = "GENERAL"

_OK_CODE = "BR-00"
_NO_DATA_CODE = "BR-27"
_AUTH_CODES = {"KEY-003"}
_PLAN_CODES = {"BR-25", "BR-30"}
_TRANSIENT_CODES = {"BR-01", "BR-13", "BR-18", "BR-19"}


class TuuError(Exception):
    """Error genérico de la API de TUU (no reintentable)."""

    def __init__(self, message: str, http_status: int = 0, code: str | None = None):
        super().__init__(message)
        self.http_status = http_status
        self.code = code


class TuuTransientError(TuuError):
    """Error temporal (timeout, red, 5xx, códigos transitorios): reintentar."""


class TuuAuthError(TuuError):
    """API key inválida o sin permiso."""


class TuuPlanError(TuuError):
    """El plan del comercio no permite el reporte."""


@dataclass(frozen=True)
class TuuPage:
    report: str
    page: int
    total_pages: int
    http_status: int
    request_body: dict
    response_body: dict
    rows: list[dict]


def _safe_json(response: Any) -> dict:
    try:
        body = response.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def _extract_code(body: dict, general: bool) -> str | None:
    if general:
        code = body.get("code")
    else:
        metadata = body.get("metadata")
        code = metadata.get("code") if isinstance(metadata, dict) else body.get("code")
    return str(code) if code not in (None, "") else None


def _extract_message(body: dict, general: bool) -> str:
    if general:
        message = body.get("message")
    else:
        metadata = body.get("metadata")
        message = metadata.get("message") if isinstance(metadata, dict) else body.get("message")
    return str(message) if message else ""


class TuuClient:
    def __init__(self, api_key: str, timeout: int = 60):
        self._api_key = api_key
        self._timeout = timeout

    # ── API pública ────────────────────────────────────────────────────

    def fetch_branch(self, start: date, end: date, cash: bool) -> list[TuuPage]:
        report = REPORT_BRANCH_CASH if cash else REPORT_BRANCH_CARD

        def build(page: int) -> dict:
            body: dict = {
                "startDate": start.isoformat(),
                "endDate": end.isoformat(),
                "page": page,
                "pageSize": PAGE_SIZE,
            }
            if cash:
                body["typeTransaction"] = "CASH"
            return body

        return self._fetch_all(report, BRANCH_PATH, build, general=False)

    def fetch_general(self, start: date, end: date) -> list[TuuPage]:
        def build(page: int) -> dict:
            return {
                "Filters": {"StartDate": start.isoformat(), "EndDate": end.isoformat()},
                "page": page,
                "pageSize": PAGE_SIZE,
            }

        return self._fetch_all(REPORT_GENERAL, GENERAL_PATH, build, general=True)

    # ── Internos ───────────────────────────────────────────────────────

    def _fetch_all(self, report: str, path: str, build, general: bool) -> list[TuuPage]:
        pages: list[TuuPage] = []
        page = 1
        total_pages = 1
        while page <= total_pages:
            result = self._fetch_page(report, path, build(page), page, general)
            pages.append(result)
            total_pages = max(result.total_pages, 1)
            if total_pages > MAX_PAGES:
                raise TuuError("Paginación inesperada de TUU")
            page += 1
        return pages

    def _fetch_page(self, report: str, path: str, body: dict, page: int, general: bool) -> TuuPage:
        try:
            response = requests.post(
                f"{BASE_URL}{path}",
                json=body,
                headers={"X-API-Key": self._api_key, "Content-Type": "application/json"},
                timeout=self._timeout,
            )
        except requests.RequestException as exc:
            # No se propaga el texto original: podría contener datos de la petición.
            raise TuuTransientError(f"TUU {report}: {type(exc).__name__}") from None

        status = response.status_code
        data = _safe_json(response)
        code = _extract_code(data, general)
        detail = _extract_message(data, general)
        label = f"TUU {report} HTTP {status}" + (f" [{code}]" if code else "")
        if detail:
            label += f": {detail}"
        if self._api_key:
            label = label.replace(self._api_key, "***")

        if status == 401 or code in _AUTH_CODES:
            raise TuuAuthError(label, status, code)
        if code in _PLAN_CODES:
            raise TuuPlanError(label, status, code)
        if status >= 500 or status in (408, 429) or code in _TRANSIENT_CODES:
            raise TuuTransientError(label, status, code)

        if (general and status == 404) or code == _NO_DATA_CODE:
            return TuuPage(report, page, 1, status, body, data, [])

        if status != 200:
            raise TuuError(label, status, code)
        if not general and code != _OK_CODE:
            raise TuuError(label, status, code)
        if general and code not in (None, "200"):
            raise TuuError(label, status, code)

        try:
            if general:
                content = data.get("content") or {}
                rows = content.get("reports") or []
                total_pages = int(content.get("totalPages") or 1)
            else:
                rows = (data.get("data") or {}).get("transactions") or []
                total_pages = int((data.get("pagination") or {}).get("totalPages") or 1)
        except (TypeError, ValueError, AttributeError):
            raise TuuError(f"TUU {report}: respuesta con formato inesperado", status, code) from None
        return TuuPage(report, page, total_pages, status, body, data, list(rows))
