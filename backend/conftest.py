import os

# Set environment variables for test execution BEFORE django loads settings
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest


@pytest.fixture(autouse=True)
def _test_env(settings):
    """
    Ensure tests use local memory for caches, channels, and celery to avoid
    hanging or failing when Redis/external services are not available in CI/local testing.
    """
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "test-cache",
        }
    }
    settings.CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    }
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True


@pytest.fixture(autouse=True)
def _clear_cache_between_tests(_test_env):
    """
    La caché locmem sobrevive entre tests mientras la BD se revierte: singletons cacheados
    (p. ej. AccountingSettings.get_solo) quedaban obsoletos y, al guardarse, regeneraban
    códigos de cuentas raíz → UNIQUE accounting_account.code intermitente según el orden.
    """
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()
