from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import JournalEntry, JournalItem

@receiver(post_save, sender=JournalEntry)
@receiver(post_delete, sender=JournalEntry)
@receiver(post_save, sender=JournalItem)
@receiver(post_delete, sender=JournalItem)
def handle_accounting_cache_invalidation(sender, instance, **kwargs):
    from core.cache import invalidate_report_cache
    invalidate_report_cache('finances')
