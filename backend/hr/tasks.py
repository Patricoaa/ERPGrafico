"""
Celery tasks for the HR module.
"""

import logging

from celery import shared_task
from django.db import transaction

logger = logging.getLogger(__name__)


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_kwargs={"max_retries": 3}, retry_backoff=True
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

    from core.utils import chunked

    from .models import Employee, Payroll, PayrollConcept
    from .services import PayrollService

    today = timezone.localdate()
    year = today.year
    month = today.month

    try:
        existing_employee_ids = set(
            Payroll.objects.filter(period_year=year, period_month=month).values_list(
                "employee_id", flat=True
            )
        )
        concepts = list(PayrollConcept.objects.all())
        created_count = 0
        skipped_count = 0

        employees = Employee.objects.filter(status=Employee.Status.ACTIVE).iterator(
            chunk_size=500
        )
        for chunk in chunked(employees, 500):
            with transaction.atomic():
                for employee in chunk:
                    if employee.pk in existing_employee_ids:
                        skipped_count += 1
                        continue

                    payroll = Payroll.objects.create(
                        employee=employee,
                        period_year=year,
                        period_month=month,
                        status=Payroll.Status.DRAFT,
                        agreed_days=employee.dias_pactados or 30,
                    )
                    existing_employee_ids.add(employee.pk)
                    created_count += 1

                    # Auto-generate proforma initially
                    try:
                        PayrollService.generate_proforma_payroll(
                            payroll=payroll, concepts=concepts
                        )
                    except Exception as e:
                        logger.error(
                            f"[HR] Error auto-generating proforma for payroll {payroll.id}: {e}"
                        )

        logger.info(
            f"[HR] Monthly draft payrolls: created={created_count}, skipped={skipped_count} "
            f"(period {year}-{month:02d})"
        )
        return {
            "period": f"{year}-{month:02d}",
            "created": created_count,
            "skipped": skipped_count,
        }

    except Exception as exc:
        logger.error(f"[HR] Error in create_monthly_draft_payrolls: {exc}", exc_info=True)
        raise exc
