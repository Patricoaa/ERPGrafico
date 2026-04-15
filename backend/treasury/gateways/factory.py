"""
Fábrica de gateways según settings.TUU_GATEWAY_MODE. Ver ADR 002 §D5.

- 'fake' (default)  → FakeTuuGateway compartido in-memory
- 'live'            → TuuGateway real (Fase 1 — aún no implementado)
"""
from __future__ import annotations

from django.conf import settings

from .base import PaymentGateway
from .fake import FakeTuuGateway

# Singleton compartido por proceso para 'fake' — permite reusar estado entre
# create() y fetch_status() dentro del mismo runtime.
_fake_singleton: FakeTuuGateway | None = None


def get_gateway(provider=None) -> PaymentGateway:
    mode = getattr(settings, "TUU_GATEWAY_MODE", "fake").lower()

    if mode == "fake":
        global _fake_singleton
        if _fake_singleton is None:
            _fake_singleton = FakeTuuGateway()
        return _fake_singleton

    if mode == "live":
        if provider is None:
            raise ValueError("TuuGateway live requiere provider")
        from .tuu import TuuGateway
        return TuuGateway(provider)

    raise ValueError(f"TUU_GATEWAY_MODE desconocido: {mode!r}")
