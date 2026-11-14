"""Cliente HTTP de SimpleAPI para el RCV del SII (rcv-clavesii).

POST multipart con el campo `input` (JSON). Clasifica los errores en
`RCVImportAttempt.Outcome`; ningún mensaje incluye la API key ni la clave SII.
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone

import requests

from accounting.models import RCVImportAttempt

BASE_URL = "https://servicios.simpleapi.cl"
TIMEOUT_SECONDS = 180
_MESSAGE_LIMIT = 300
_DIRECTION_PATHS = {"PURCHASES": "compras", "SALES": "ventas"}
_QUOTA_WORDS = ("limite", "cupo", "plan", "consultas", "quota")
_SII_WORDS = ("clave", "contrasena", "password", "autentic")

Outcome = RCVImportAttempt.Outcome


@dataclass(frozen=True)
class SimpleApiResponse:
    http_status: int
    body: dict
    duration_ms: int
    rate_limit_remaining: int | None
    rate_limit_reset: datetime | None


class SimpleApiError(Exception):
    def __init__(
        self,
        outcome: str,
        message: str,
        http_status: int = 0,
        duration_ms: int = 0,
        rate_limit_remaining: int | None = None,
        rate_limit_reset: datetime | None = None,
    ):
        super().__init__(message)
        self.outcome = outcome
        self.http_status = http_status
        self.duration_ms = duration_ms
        self.rate_limit_remaining = rate_limit_remaining
        self.rate_limit_reset = rate_limit_reset


def redact_secrets(text: str, secrets: Iterable[str | None]) -> str:
    """Reemplaza por ``***`` cada secreto, también en sus formas escapadas como JSON."""
    for secret in secrets:
        if not secret:
            continue
        forms = {
            secret,
            json.dumps(secret)[1:-1],
            json.dumps(secret, ensure_ascii=False)[1:-1],
        }
        # Las formas más largas primero: una puede contener a otra.
        for form in sorted(forms, key=len, reverse=True):
            text = text.replace(form, "***")
    return text


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def classify_error(http_status: int, body_text: str) -> str:
    text = _normalize(body_text or "")
    if http_status == 429:
        return Outcome.RATE_LIMITED
    if http_status in (401, 402, 403) and any(word in text for word in _QUOTA_WORDS):
        return Outcome.QUOTA_EXHAUSTED
    if "sii" in text and any(word in text for word in _SII_WORDS):
        return Outcome.AUTH_SII
    if http_status in (401, 403):
        return Outcome.AUTH_KEY
    if http_status >= 500:
        return Outcome.TRANSIENT
    return Outcome.OTHER


def _parse_int(value: str | None) -> int | None:
    try:
        return int(value) if value is not None else None
    except ValueError:
        return None


def _parse_reset(value: str | None) -> datetime | None:
    if not value:
        return None
    # .NET emite 7 decimales; fromisoformat acepta como máximo 6.
    cleaned = re.sub(r"(\.\d{6})\d+", r"\1", value.strip()).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(cleaned)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


class SimpleApiRcvClient:
    def __init__(self, api_key: str, session: requests.Session | None = None):
        self._api_key = api_key
        self._session = session or requests.Session()

    def fetch(
        self,
        direction: str,
        year: int,
        month: int,
        company_rut: str,
        user_rut: str,
        password: str,
    ) -> SimpleApiResponse:
        kind = _DIRECTION_PATHS.get(direction)
        if kind is None:
            raise ValueError(f"Dirección RCV inválida: {direction!r}")
        url = f"{BASE_URL}/api/rcv-clavesii/{kind}/{month:02d}/{year}"
        payload = {
            "RutEmpresa": company_rut,
            "RutUsuario": user_rut,
            "PasswordSII": password,
            "Ambiente": 1,
            "Detallado": False,
            "ProcesaBoletas": True,
        }
        started = time.monotonic()
        try:
            response = self._session.post(
                url,
                headers={"Authorization": self._api_key},
                files={"input": (None, json.dumps(payload))},
                timeout=TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            # No se propaga el texto original: podría contener datos de la petición.
            raise SimpleApiError(
                Outcome.TRANSIENT,
                f"SimpleAPI: {type(exc).__name__}",
                duration_ms=self._elapsed(started),
            ) from None

        duration = self._elapsed(started)
        remaining = _parse_int(response.headers.get("x-rate-limit-remaining"))
        reset = _parse_reset(response.headers.get("x-rate-limit-reset"))
        status = response.status_code

        if status == 200:
            try:
                body = response.json()
            except ValueError:
                body = None
            if isinstance(body, dict):
                return SimpleApiResponse(status, body, duration, remaining, reset)
            outcome = Outcome.OTHER
            text = "respuesta no JSON"
        else:
            text = response.text or ""
            outcome = classify_error(status, text)
        raise SimpleApiError(
            outcome,
            self._message(status, text, password),
            http_status=status,
            duration_ms=duration,
            rate_limit_remaining=remaining,
            rate_limit_reset=reset,
        )

    @staticmethod
    def _elapsed(started: float) -> int:
        return int((time.monotonic() - started) * 1000)

    def _message(self, status: int, text: str, password: str) -> str:
        text = redact_secrets(text, (self._api_key, password))
        return f"SimpleAPI HTTP {status}: {text[:_MESSAGE_LIMIT]}"
