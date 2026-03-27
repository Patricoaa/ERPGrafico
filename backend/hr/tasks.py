"""
Celery tasks for the HR module.
"""
import logging
from celery import shared_task
from django.db import transaction

logger = logging.getLogger(__name__)


@shared_task(
    bind=True, 
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True
)
def create_monthly_draft_payrolls(self):
    """
    Runs on the 1st of each month.
    Creates a DRAFT payroll (without items or calculated amounts) for every
    active employee who doesn't already have a payroll for the current period.

    This ensures salary advances and payments can always be linked to a payroll
    document, even before the formal liquidation is calculated.
    """
    from django.utils import timezone
    from .models import Employee, Payroll

    today = timezone.localdate()
    year = today.year
    month = today.month

    try:
        active_employees = Employee.objects.filter(status=Employee.Status.ACTIVE)
        created_count = 0
        skipped_count = 0

        with transaction.atomic():
            for employee in active_employees:
                # Only create if no payroll exists for this period/employee combo
                exists = Payroll.objects.filter(
                    employee=employee,
                    period_year=year,
                    period_month=month,
                ).exists()

                if exists:
                    skipped_count += 1
                    continue

                from .services import PayrollService
                payroll = Payroll.objects.create(
                    employee=employee,
                    period_year=year,
                    period_month=month,
                    status=Payroll.Status.DRAFT,
                    agreed_days=employee.dias_pactados or 30,
                )
                
                # Auto-generate proforma initially
                try:
                    PayrollService.generate_proforma_payroll(payroll=payroll)
                except Exception as e:
                    logger.error(f"[HR] Error auto-generating proforma for payroll {payroll.id}: {e}")

                created_count += 1

        logger.info(
            f"[HR] Monthly draft payrolls: created={created_count}, skipped={skipped_count} "
            f"(period {year}-{month:02d})"
        )
        return {
            'period': f'{year}-{month:02d}',
            'created': created_count,
            'skipped': skipped_count,
        }

    except Exception as exc:
        logger.error(f"[HR] Error in create_monthly_draft_payrolls: {exc}", exc_info=True)
        raise exc
