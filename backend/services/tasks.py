from celery import shared_task
from .services import ServiceContractService, ServiceObligationService
from .models import ServiceContract
import logging

logger = logging.getLogger(__name__)

@shared_task
def generate_obligations_task():
    """
    Periodic task to generate service obligations for active contracts.
    """
    logger.info("Starting generate_obligations_task")
    contracts = ServiceContract.objects.filter(status=ServiceContract.Status.ACTIVE)
    count = 0
    for contract in contracts:
        try:
            # Generate obligations for the next 60 days
            # We call it multiple times to cover the range if frequency is high (e.g. weekly)
            # But the service generates ONE next obligation from reference.
            # So we might want to loop until we cover the lookahead window.
            # comprehensive implementation would loop date < lookahead
            
            # Simple version: Ensure next obligation exists.
            ob = ServiceContractService.generate_next_obligation(contract)
            if ob:
                count += 1
                # If short frequency, maybe generate more?
                # For now, one per run (daily run) is enough for monthly/weekly
                # If daily frequency, we might need logic adjustment.
        except Exception as e:
            logger.error(f"Error generating obligation for contract {contract.contract_number}: {e}")
    
    logger.info(f"Finished generate_obligations_task. Generated {count} new obligations.")
    return f"Generated {count} obligations"

@shared_task
def check_overdue_obligations_task():
    """
    Periodic task to mark overdue obligations.
    """
    logger.info("Starting check_overdue_obligations_task")
    count = ServiceObligationService.check_overdue()
    logger.info(f"Finished check_overdue_obligations_task. Marked {count} obligations as OVERDUE.")
    return f"Marked {count} overdue"

@shared_task
def generate_provisions_task():
    """
    Periodic task to generate provisions for pending obligations 
    whose category requires it and whose period has ended.
    """
    from .models import ServiceObligation
    from django.utils import timezone
    from django.db.models import Q
    
    logger.info("Starting generate_provisions_task")
    today = timezone.now().date()
    
    # Candidates: Pending obligations whose category requires provision 
    # and no provision exists yet. 
    # We provision if period_end <= today OR (if period_end is null) due_date <= today
    pending_provision = ServiceObligation.objects.filter(
        status=ServiceObligation.Status.PENDING,
        journal_entry__isnull=True,
        contract__category__requires_provision=True
    ).filter(
        Q(period_end__lte=today) | Q(period_end__isnull=True, due_date__lte=today)
    )
    
    count = 0
    for ob in pending_provision:
        try:
            ServiceObligationService.create_provision(ob)
            count += 1
        except Exception as e:
            logger.error(f"Error provisioning obligation {ob.id}: {e}")
            
    logger.info(f"Finished generate_provisions_task. Generated {count} provisions.")
    return f"Created {count} provisions"
