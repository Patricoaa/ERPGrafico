"""
Implementación real del gateway TUU/Haulmer Pago Remoto v2. Ver ADR 002.

API:
- POST /RemotePayment/v2/Create
- GET  /RemotePayment/v2/GetPaymentRequest/:idempotencyKey

Auth: header `X-API-Key`. Rate limit: 1 create/min/terminal (se enforzaba fuera
del gateway vía ratelimit.py). Timeouts: 10s connect/read.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import requests
from django.conf import settings

from .base import GatewayError, GatewayResponse, PaymentGateway

if TYPE_CHECKING:
    from treasury.models import PaymentRequest, PaymentTerminalProvider

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://integrations.payment.haulmer.com"
DEFAULT_TIMEOUT = 10


class TuuGateway(PaymentGateway):
    def __init__(self, provider: "PaymentTerminalProvider", *, base_url: str | None = None,
                 timeout: int | None = None, session: requests.Session | None = None):
        self.provider = provider
        self.base_url = (base_url or getattr(settings, "TUU_BASE_URL", DEFAULT_BASE_URL)).rstrip("/")
        self.timeout = timeout or getattr(settings, "TUU_HTTP_TIMEOUT", DEFAULT_TIMEOUT)
        self._session = session or requests.Session()

    def _headers(self) -> dict:
        api_key = self.provider.get_api_key()
        if not api_key:
            raise GatewayError(
                "Proveedor sin API Key configurada", code="KEY-MISSING"
            )
        return {
            "X-API-Key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _request(self, method: str, path: str, json_body: dict | None = None) -> dict:
        url = f"{self.base_url}{path}"
        try:
            resp = self._session.request(
                method, url, headers=self._headers(),
                json=json_body, timeout=self.timeout,
            )
        except requests.Timeout as exc:
            raise GatewayError("Timeout hacia TUU", code="NETWORK-TIMEOUT") from exc
        except requests.RequestException as exc:
            raise GatewayError(f"Error de red: {exc}", code="NETWORK") from exc

        try:
            payload = resp.json() if resp.content else {}
        except ValueError:
            payload = {"_raw": resp.text}

        if resp.status_code == 429:
            raise GatewayError(
                "Rate limit excedido en TUU", code="RATE-LIMIT", http_status=429
            )
        if resp.status_code == 401:
            raise GatewayError("API Key inválida", code="KEY-003", http_status=401)
        if resp.status_code >= 400:
            err_code = (payload.get("error") or payload.get("code") or "").strip() or f"HTTP-{resp.status_code}"
            raise GatewayError(
                payload.get("message", f"TUU devolvió {resp.status_code}"),
                code=err_code, http_status=resp.status_code,
            )
        return payload

    def create(self, payment_request: "PaymentRequest") -> GatewayResponse:
        body = {
            "idempotencyKey": payment_request.idempotency_key,
            "amount": int(payment_request.amount),
            "device": payment_request.device.serial_number,
            "paymentMethod": int(payment_request.payment_method_code),
            "dteType": int(payment_request.dte_type),
        }
        if payment_request.description:
            body["description"] = payment_request.description[:28]

        payload = self._request("POST", "/RemotePayment/v2/Create", json_body=body)
        return self._normalize(payment_request.idempotency_key, payload)

    def fetch_status(self, idempotency_key: str) -> GatewayResponse:
        payload = self._request(
            "GET", f"/RemotePayment/v2/GetPaymentRequest/{idempotency_key}"
        )
        return self._normalize(idempotency_key, payload)

    @staticmethod
    def _normalize(key: str, payload: dict) -> GatewayResponse:
        status = str(payload.get("status", "Pending"))
        return GatewayResponse(
            status=status,
            sequence_number=str(payload.get("sequenceNumber", "")),
            transaction_reference=str(payload.get("transactionReference", "")),
            acquirer_id=str(payload.get("acquirerId", "")),
            raw=payload if isinstance(payload, dict) else {"_raw": payload},
        )
