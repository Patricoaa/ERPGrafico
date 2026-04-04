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


class DistributedLock:
    """
    Redis-based distributed lock using Django's cache ADD (atomic SETNX).

    Usage:
        if not DistributedLock.acquire(f"sale:confirm:{order.id}"):
            raise ValidationError("Operación en curso, intente nuevamente.")
        try:
            # ... critical section ...
        finally:
            DistributedLock.release(f"sale:confirm:{order.id}")
    """

    @staticmethod
    def acquire(resource: str, ttl: int = 30) -> bool:
        """
        Try to acquire a lock. Returns True if acquired, False if already held.

        Uses cache.add() which is atomic (Redis SETNX under the hood).
        The lock auto-expires after `ttl` seconds as a safety net.
        """
        return cache.add(f"lock:{resource}", "1", timeout=ttl)

    @staticmethod
    def release(resource: str) -> None:
        """Release a previously acquired lock."""
        cache.delete(f"lock:{resource}")
