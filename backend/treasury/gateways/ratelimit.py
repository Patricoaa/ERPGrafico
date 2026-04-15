"""
Rate limit para creación de PaymentRequest contra TUU. Ver ADR 002 §D6.

TUU impone 1 create/minuto/terminal y máx 5 pendientes. El lock se implementa
con Django cache (Redis DB 2) usando cache.add() que es atómico.
"""
from __future__ import annotations

from django.core.cache import cache

from .base import GatewayError

CREATE_WINDOW_SECONDS = 60
MAX_PENDING_PER_DEVICE = 5


def _create_key(device_id: int) -> str:
    return f"tuu:create:{device_id}"


def acquire_create_slot(device_id: int) -> None:
    """Adquiere el slot de create para el device; lanza GatewayError si excedido."""
    if not cache.add(_create_key(device_id), "1", timeout=CREATE_WINDOW_SECONDS):
        raise GatewayError(
            "Límite de 1 cobro por minuto alcanzado para este terminal",
            code="RATE-LIMIT-LOCAL", http_status=429,
        )


def release_create_slot(device_id: int) -> None:
    """Libera manualmente el slot (ej. si el create falló antes de enviar)."""
    cache.delete(_create_key(device_id))


def check_pending_limit(device, exclude_id: int | None = None) -> None:
    """Valida que no haya más de MAX_PENDING_PER_DEVICE PaymentRequest no-terminales."""
    from treasury.models import PaymentRequest

    qs = PaymentRequest.objects.filter(
        device=device,
    ).exclude(status__in=list(PaymentRequest.TERMINAL_STATUSES))
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    if qs.count() >= MAX_PENDING_PER_DEVICE:
        raise GatewayError(
            f"Máximo {MAX_PENDING_PER_DEVICE} cobros pendientes por terminal",
            code="PENDING-LIMIT", http_status=429,
        )
