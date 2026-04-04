"""
Redis-backed cache utilities for ERPGrafico.

Provides helpers for caching singleton settings models and
a distributed lock implementation for critical sections.

Uses Django's cache framework (Redis DB 2) configured in settings.py.
"""

from django.core.cache import cache
from typing import TypeVar, Type
import logging

logger = logging.getLogger(__name__)

T = TypeVar('T')


def cached_singleton(
    model_class: Type[T],
    cache_key: str,
    timeout: int = 3600,
) -> T:
    """
    Retrieve a singleton settings model with Redis caching.

    Checks Redis first; on miss, fetches from DB and populates the cache.
    Call `invalidate_singleton(cache_key)` after saving the model to
    ensure fresh data on next access.

    Args:
        model_class: The Django model class (must have .objects.first() or get_or_create).
        cache_key: Unique cache key, e.g. 'settings:accounting'.
        timeout: Cache TTL in seconds (default 1 hour).

    Returns:
        The singleton model instance.
    """
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # Fetch from DB
    instance = model_class.objects.first()
    if instance is None:
        # Auto-create if the model supports it (settings singletons)
        instance = model_class.objects.create()

    cache.set(cache_key, instance, timeout=timeout)
    return instance


def invalidate_singleton(cache_key: str) -> None:
    """
    Remove a cached singleton from Redis.

    Call this in the model's save() and delete() methods to ensure
    subsequent reads fetch fresh data from the database.
    """
    cache.delete(cache_key)
    logger.debug(f"Cache invalidated: {cache_key}")


# ── Cache Key Constants ──────────────────────────────────────────────────────
# Centralized key names prevent typos and make grep-ability easy.

CACHE_KEY_ACCOUNTING_SETTINGS = 'settings:accounting'
CACHE_KEY_SALES_SETTINGS = 'settings:sales'
CACHE_KEY_WORKFLOW_SETTINGS = 'settings:workflow'
CACHE_KEY_COMPANY_SETTINGS = 'settings:company'
CACHE_KEY_HR_SETTINGS = 'settings:hr'

# ── Report Cache Keys ────────────────────────────────────────────────────────
# Format: report:{module}:{endpoint}:{params_hash}
# These are invalidated by module when underlying data changes.

REPORT_PREFIX = 'report'


def _build_report_key(module: str, endpoint: str, params: dict | None = None) -> str:
    """
    Build a deterministic cache key for a report endpoint.

    Args:
        module: Module name (e.g. 'inventory', 'contacts', 'treasury')
        endpoint: Endpoint name (e.g. 'stock_report', 'credit_portfolio')
        params: Optional query parameters dict for parameterized reports

    Returns:
        Cache key string like 'report:inventory:stock_report' or
        'report:treasury:dashboard:a1b2c3'
    """
    key = f"{REPORT_PREFIX}:{module}:{endpoint}"
    if params:
        # Create a stable hash from sorted params
        import hashlib
        import json
        filtered = {k: v for k, v in sorted(params.items()) if v is not None}
        if filtered:
            params_str = json.dumps(filtered, sort_keys=True, default=str)
            params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
            key = f"{key}:{params_hash}"
    return key


def cache_report(
    module: str,
    endpoint: str,
    params: dict | None = None,
    timeout: int = 120,
    generator: callable = None,
):
    """
    Get or set a cached report result.

    On cache hit, returns the cached data immediately.
    On cache miss, calls `generator()`, caches the result, and returns it.

    Args:
        module: Module name for key namespacing
        endpoint: Endpoint identifier
        params: Query params dict (for parameterized reports)
        timeout: Cache TTL in seconds (default 2 minutes)
        generator: Callable that produces the report data

    Returns:
        The report data (from cache or freshly generated)
    """
    key = _build_report_key(module, endpoint, params)
    cached = cache.get(key)
    if cached is not None:
        logger.debug(f"Cache HIT: {key}")
        return cached

    logger.debug(f"Cache MISS: {key}")
    data = generator()
    cache.set(key, data, timeout=timeout)
    return data


def invalidate_report_cache(module: str, endpoint: str | None = None) -> None:
    """
    Invalidate cached reports for a module.

    Uses Redis key deletion. Since Django's cache backend prefixes keys,
    we delete specific known keys rather than using pattern matching.

    Args:
        module: Module to invalidate (e.g. 'inventory')
        endpoint: If provided, invalidate only this endpoint.
                  If None, invalidate all endpoints for the module.
    """
    if endpoint:
        # Delete the base key (non-parameterized)
        key = f"{REPORT_PREFIX}:{module}:{endpoint}"
        cache.delete(key)
        logger.debug(f"Report cache invalidated: {key}")
    else:
        # For module-wide invalidation, delete known report keys
        keys_to_delete = []
        for known_endpoint in _MODULE_REPORTS.get(module, []):
            keys_to_delete.append(f"{REPORT_PREFIX}:{module}:{known_endpoint}")
        if keys_to_delete:
            cache.delete_many(keys_to_delete)
            logger.debug(f"Report cache invalidated for module '{module}': {keys_to_delete}")


# Registry of known report endpoints per module (for module-wide invalidation)
_MODULE_REPORTS = {
    'inventory': ['stock_report', 'insights'],
    'contacts': ['credit_portfolio', 'insights'],
    'treasury': ['recon_dashboard', 'recon_pending', 'recon_history'],
    'finances': ['balance_sheet', 'income_statement', 'cash_flow', 'analysis', 'bi_analytics'],
}


class DistributedLock:
    """
    A simple Redis-based distributed lock for Django using the cache backend.
    Relies on `cache.add` which sets the value only if it does not exist.
    """
    @staticmethod
    def acquire(resource: str, ttl: int = 30) -> bool:
        """Attempt to acquire a lock for a given resource. Returns True if successful."""
        return cache.add(f"lock:{resource}", "1", timeout=ttl)

    @staticmethod
    def release(resource: str) -> None:
        """Release the lock for the given resource."""
        cache.delete(f"lock:{resource}")


from contextlib import contextmanager
from django.core.exceptions import ValidationError

@contextmanager
def acquire_locks(resources, timeout=30):
    """
    Context manager to acquire multiple DistributedLocks securely.
    Acquires them sequentially. If any fails, it immediately raises a ValidationError
    (friendly for API consumption) to avoid double-charging/overdrawing, and cleanly
    releases anything acquired so far.
    """
    from core.cache import DistributedLock
    acquired = []
    try:
        # Sort resources to prevent deadlocks when concurrently trying
        # to acquire identical interweaved locks
        for res in sorted(list(set(resources))):
            if DistributedLock.acquire(res, timeout):
                acquired.append(res)
            else:
                raise ValidationError(
                    "Operación bloqueada por seguridad. Existe otra transacción "
                    "procesándose sobre los mismos recursos simultáneamente. "
                    "Por favor, reintente en unos segundos."
                )
        yield
    finally:
        for res in acquired:
            DistributedLock.release(res)
