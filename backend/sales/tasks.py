"""
Celery tasks for the Sales module.
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True
)
def cleanup_old_draft_carts(self):
    """
    Removes POS draft carts that have not been updated in more than 1 day.
    Runs daily via Celery Beat (see settings.CELERY_BEAT_SCHEDULE).
    """
    from sales.draft_cart_service import DraftCartService
    deleted_count = DraftCartService.cleanup_old_drafts(days=1)
    logger.info(f"[Sales] Cleaned up {deleted_count} old draft cart(s).")
    return {"deleted": deleted_count}
