"""
Fábrica de gateways por proveedor. Ver ADR 002 §D5.

Modo (settings.TUU_GATEWAY_MODE):
- 'fake' (default)  → FakeTuuGateway compartido in-memory (dev/test)
- 'live'            → dispatch por provider_type (TUU, MERCADOPAGO, etc.)

Agregar nuevo proveedor:
1. Implementar PaymentGateway en gateways/<provider>.py
2. Registrar en GATEWAY_REGISTRY.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from django.conf import settings

from .base import GatewayError, PaymentGateway
from .fake import FakeTuuGateway

if TYPE_CHECKING:
    from treasury.models import PaymentTerminalProvider

# Singleton compartido por proceso para 'fake'.
_fake_singleton: FakeTuuGateway | None = None


def _build_registry() -> dict[str, type[PaymentGateway]]:
    """Construye registry lazy para evitar imports circulares en boot."""
    from .tuu import TuuGateway
    return {
        "TUU": TuuGateway,
        # "MERCADOPAGO": MercadoPagoGateway,   # próxima integración
        # "TRANSBANK": TransbankGateway,
    }


def get_gateway(provider: "PaymentTerminalProvider | None" = None) -> PaymentGateway:
    """
    Retorna instancia gateway según configuración y proveedor.

    En modo 'fake': siempre FakeTuuGateway (sin red).
    En modo 'live': dispatch por provider.provider_type.
    """
    mode = getattr(settings, "TUU_GATEWAY_MODE", "fake").lower()

    if mode == "fake":
        global _fake_singleton
        if _fake_singleton is None:
            _fake_singleton = FakeTuuGateway()
        return _fake_singleton

    if mode == "live":
        if provider is None:
            raise ValueError("get_gateway en modo 'live' requiere provider")
        registry = _build_registry()
        adapter_cls = registry.get(provider.provider_type)
        if adapter_cls is None:
            raise GatewayError(
                f"Sin adapter para provider_type={provider.provider_type!r}. "
                f"Tipos soportados: {list(registry.keys())}",
                code="UNSUPPORTED_PROVIDER",
            )
        return adapter_cls(provider)

    raise ValueError(f"TUU_GATEWAY_MODE desconocido: {mode!r}")
