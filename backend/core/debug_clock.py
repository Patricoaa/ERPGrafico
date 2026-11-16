"""Reloj de depuración (ADR-0139 D4) — solo desarrollo.

Un desfase en segundos, guardado en la caché por defecto, mueve ``timezone.now()``
mediante ``time_machine.travel(tick=True)`` en cada proceso (web y Celery) que
llama a :func:`apply_debug_clock`. Actúa únicamente si ``settings.DEBUG`` y la
variable de entorno ``DEBUG_CLOCK_ENABLED == "1"``; en otro caso es un no-op y
``time_machine`` nunca se importa.
"""

from __future__ import annotations

import os
import threading
import time
from datetime import datetime
from typing import TYPE_CHECKING

from django.conf import settings
from django.core.cache import cache

if TYPE_CHECKING:
    import time_machine

CACHE_KEY = "debug_clock:offset_seconds"
DISABLED_MESSAGE = "El reloj de depuración solo funciona con DEBUG=True y DEBUG_CLOCK_ENABLED=1."
# Diferencias menores a esta tolerancia no reinician el viaje (evita reinicios por request).
_OFFSET_TOLERANCE_SECONDS = 0.5

_lock = threading.Lock()
_traveller: time_machine.travel | None = None  # viaje activo en este proceso
_applied_offset: float | None = None


def is_enabled() -> bool:
    return bool(settings.DEBUG) and os.environ.get("DEBUG_CLOCK_ENABLED") == "1"


def _real_timestamp() -> float:
    """Timestamp real, sin el parche de time-machine."""
    if _traveller is not None:
        import time_machine

        return time_machine.escape_hatch.time.time()
    return time.time()


def set_clock(target: datetime) -> None:
    """Guarda el desfase ``target - ahora_real`` (segundos). ``target`` debe ser aware."""
    cache.set(CACHE_KEY, target.timestamp() - _real_timestamp(), None)


def reset_clock() -> None:
    cache.delete(CACHE_KEY)


def current_offset() -> float | None:
    value = cache.get(CACHE_KEY)
    return float(value) if value is not None else None


def is_active() -> bool:
    return _traveller is not None


def _stop_locked() -> None:
    global _traveller, _applied_offset
    if _traveller is not None:
        _traveller.stop()
    _traveller = None
    _applied_offset = None


def stop_travel() -> None:
    with _lock:
        _stop_locked()


def apply_debug_clock() -> None:
    """Sincroniza el viaje de este proceso con el desfase de la caché.

    Global al proceso: no se detiene al terminar la request. Si el reloj está
    deshabilitado o no hay desfase, detiene el viaje activo.
    """
    global _traveller, _applied_offset
    offset = current_offset() if is_enabled() else None
    with _lock:
        if offset is None:
            _stop_locked()
            return
        if _applied_offset is not None and abs(offset - _applied_offset) <= _OFFSET_TOLERANCE_SECONDS:
            return
        import time_machine

        destination = _real_timestamp() + offset
        _stop_locked()
        traveller = time_machine.travel(destination, tick=True)
        traveller.start()
        _traveller = traveller
        _applied_offset = offset


class DebugClockMiddleware:
    """Aplica el reloj de depuración antes de cada request (no-op si está deshabilitado)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if is_enabled() or _traveller is not None:
            apply_debug_clock()
        return self.get_response(request)


def parse_local_datetime(value: str) -> datetime:
    """Parsea ``AAAA-MM-DD HH:MM`` o ``AAAA-MM-DDTHH:MM`` como hora local (TIME_ZONE)."""
    from django.utils import timezone

    parsed = datetime.fromisoformat(value.strip())
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_default_timezone())
    return parsed


def debug_now() -> datetime:
    """Hora que ve el reloj de depuración (real + desfase), en hora local."""
    from django.utils import timezone

    offset = current_offset() or 0.0
    return datetime.fromtimestamp(_real_timestamp() + offset, tz=timezone.get_default_timezone())


def state() -> dict[str, object]:
    from django.utils import timezone

    return {
        "active": is_active(),
        "now": timezone.localtime().isoformat(),
        "offset_seconds": current_offset(),
    }


def audit_change(event: str, user, request=None, target: datetime | None = None) -> None:
    """Registra ``debug_clock.set`` / ``debug_clock.reset`` en el ActionLog de core."""
    from core.models import ActionLog
    from core.services import ActionLoggingService

    target_iso = target.isoformat() if target else None
    ActionLoggingService.log_action(
        user=user,
        action_type=ActionLog.Type.TECHNICAL,
        description=f"Reloj de depuración: {event}" + (f" → {target_iso}" if target_iso else ""),
        request=request,
        metadata={"event": event, "target": target_iso, "offset_seconds": current_offset()},
    )
