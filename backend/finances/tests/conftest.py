"""
Soporte de tests para la app finances.

Misma lógica que `treasury/tests/conftest.py`: si Redis no es alcanzable
fuerza caché en memoria para que el setup de la DB de test no intente
conectar a Redis. No-op cuando Redis SÍ está disponible.
"""
import socket
import urllib.parse


def _redis_reachable() -> bool:
    from django.conf import settings
    raw = getattr(settings, "REDIS_URL", "") or ""
    if "://" not in raw:
        raw = f"redis://{raw}"
    try:
        parsed = urllib.parse.urlparse(raw)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except OSError:
        return False


def pytest_configure(config):  # noqa: ARG001 — firma de hook pytest
    if _redis_reachable():
        return

    from django.conf import settings
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def clear_singleton_cache():
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()
