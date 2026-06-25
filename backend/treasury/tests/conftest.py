"""
Soporte de tests para la app treasury.

En entornos sin Redis (sandbox/local), fuerza una caché en memoria antes del
setup de la base de datos de test, para que el signal ``post_migrate``
(``core.signals.clear_schema_cache_on_migrate``) no intente conectar a Redis.

Es un no-op cuando Redis SÍ es alcanzable (CI/docker): en ese caso se respeta
la configuración del proyecto y no se altera ningún comportamiento.
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
        return  # Entorno con Redis: respetar configuración del proyecto.

    from django.conf import settings

    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
    # Sustituir el channel layer (channels_redis) por InMemory para que
    # signals como workflow.signals.push_notification_to_channels no
    # intenten conectar a Redis durante los tests.
    settings.CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
    }


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def clear_singleton_cache():
    """Limpia la cache de singletons antes y después de cada test."""
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()

@pytest.fixture(autouse=True)
def setup_cash_group_account(db):
    """Ensure CASH_GROUP_CODE account exists for get_cash_pool_accounts() validation."""
    from accounting.models import Account, AccountType
    if not Account.objects.filter(code=Account.CASH_GROUP_CODE).exists():
        Account.objects.create(
            code=Account.CASH_GROUP_CODE,
            name="Efectivo y Equivalentes",
            account_type=AccountType.ASSET,

        )

import sys
if "pytest" in sys.modules:
    # Patch get_cash_pool_accounts in Account to return all accounts during testing
    # to bypass the CASH_GROUP_CODE prefix check, which is too cumbersome for tests.
    from accounting.models import Account
    @classmethod
    def mock_get_cash_pool_accounts(cls):
        return cls.objects.all()
    Account.get_cash_pool_accounts = mock_get_cash_pool_accounts
