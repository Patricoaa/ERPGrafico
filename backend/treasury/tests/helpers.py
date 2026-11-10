"""Ayudas de prueba para sesiones POS con modo de caja por dispositivo."""

from treasury.models import POSSession


def make_pos_session(user, mode: str = "SINGLE", **extra) -> POSSession:
    """Sesión abierta por ``user`` que la opera en el modo de caja indicado."""
    session = POSSession.objects.create(user=user, **extra)
    session.set_device_mode(user, mode)
    return session
