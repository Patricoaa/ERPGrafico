from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import TaxPeriod, AccountingPeriod


@receiver(post_save, sender=TaxPeriod)
def mark_invoices_as_closed(sender, instance, **kwargs):
    """
    When a tax period is closed, mark all invoices from that period
    as tax_period_closed=True to prevent modifications.
    """
    if instance.status == TaxPeriod.Status.CLOSED:
        from billing.models import Invoice
        from datetime import date
        
        # Calculate date range for the period
        start_date = date(instance.year, instance.month, 1)
        if instance.month == 12:
            end_date = date(instance.year + 1, 1, 1)
        else:
            end_date = date(instance.year, instance.month + 1, 1)
        
        # Mark all invoices in this period as closed
        Invoice.objects.filter(
            date__gte=start_date,
            date__lt=end_date,
            status=Invoice.Status.POSTED
        ).update(tax_period_closed=True)
    
    elif instance.status == TaxPeriod.Status.OPEN:
        # If reopened, unlock the invoices
        from billing.models import Invoice
        from datetime import date
        
        start_date = date(instance.year, instance.month, 1)
        if instance.month == 12:
            end_date = date(instance.year + 1, 1, 1)
        else:
            end_date = date(instance.year, instance.month + 1, 1)
        
        Invoice.objects.filter(
            date__gte=start_date,
            date__lt=end_date
        ).update(tax_period_closed=False)




@receiver(post_save, sender=AccountingPeriod)
def mark_journal_entries_as_closed(sender, instance, **kwargs):
    """
    When an accounting period is closed, mark all journal entries
    as period_closed=True to prevent modifications.
    When reopened, unlock the entries.
    """
    from accounting.models import JournalEntry
    from datetime import date
    
    # Calculate date range for the period
    start_date = date(instance.year, instance.month, 1)
    if instance.month == 12:
        end_date = date(instance.year + 1, 1, 1)
    else:
        end_date = date(instance.year, instance.month + 1, 1)
    
    if instance.status == AccountingPeriod.Status.CLOSED:
        # Mark all entries in this period as closed
        JournalEntry.objects.filter(
            date__gte=start_date,
            date__lt=end_date
        ).update(period_closed=True)
    
    elif instance.status == AccountingPeriod.Status.OPEN:
        # If reopened, unlock entries
        JournalEntry.objects.filter(
            date__gte=start_date,
            date__lt=end_date
        ).update(period_closed=False)

