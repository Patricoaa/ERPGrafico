import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_kwargs={"max_retries": 3}, retry_backoff=True
)
def evaluate_credit_portfolio(self):
    """
    Evaluates the credit risk of all contacts that have credit enabled or active debt.
    Runs daily via Celery Beat.

    Logic:
    1. Checks AccountingSettings.credit_risk_classification_enabled and credit_auto_block_days.
    2. Computes the maximum overdue days for each contact based on their pending credit_ledger items.
    3. Blocks the contact if max days > credit_auto_block_days.
    4. Unblocks if they paid and are now below the threshold.
    5. Classifies RiskLevel based on the oldest aging bucket with balance.
    """
    from decimal import Decimal

    from django.db import models

    from accounting.models import AccountingSettings
    from contacts.models import Contact, RiskLevel

    settings = AccountingSettings.get_solo()
    auto_block_days_threshold = settings.credit_auto_block_days if settings else 60

    # We evaluate contacts that have active debt OR non-default risk levels
    # OR are currently auto-blocked (to allow unblocking if they paid).
    contacts = list(
        Contact.objects.filter(
            models.Q(sale_orders__status__in=["CONFIRMED", "INVOICED", "PARTIAL"])
            | ~models.Q(credit_risk_level=RiskLevel.LOW)
            | models.Q(credit_auto_blocked=True)
        )
        .distinct()
        .prefetch_related("sale_orders__payments", "sale_orders__invoices")
    )

    evaluated_count = 0
    blocked_count = 0
    unblocked_count = 0
    now = timezone.now()

    updates = []

    for contact in contacts:
        old_risk = contact.credit_risk_level
        payment_term = contact.credit_days or 30

        aging = {
            "current": Decimal("0"),
            "overdue_30": Decimal("0"),
            "overdue_60": Decimal("0"),
            "overdue_90": Decimal("0"),
            "overdue_90plus": Decimal("0"),
        }
        max_overdue_days = 0

        for order in contact.sale_orders.all():
            if order.status in ("DRAFT", "CANCELLED"):
                continue
            payments = [p for p in order.payments.all() if not p.is_pending_registration]
            paid_in = sum(
                (p.amount for p in payments if p.movement_type in ["INBOUND", "ADJUSTMENT"]),
                Decimal("0"),
            )
            paid_out = sum(
                (p.amount for p in payments if p.movement_type == "OUTBOUND"), Decimal("0")
            )
            balance = order.effective_total - (paid_in - paid_out)

            if balance <= 0:
                continue

            order_date = order.date
            if hasattr(order_date, "date"):
                order_date = order_date.date()
            due_date = order_date + timedelta(days=payment_term)
            days_overdue = (now.date() - due_date).days

            if days_overdue <= 0:
                aging["current"] += balance
            elif days_overdue <= 30:
                aging["overdue_30"] += balance
            elif days_overdue <= 60:
                aging["overdue_60"] += balance
            elif days_overdue <= 90:
                aging["overdue_90"] += balance
            else:
                aging["overdue_90plus"] += balance

            if order.status not in ("DRAFT", "CANCELLED", "PAID") and days_overdue > max_overdue_days:
                max_overdue_days = days_overdue

        # 1. Determine Risk Level
        new_risk = RiskLevel.LOW

        # Risk logic: If they have any debt in 90+, it's critical.
        if aging.get("overdue_90plus", 0) > 0:
            new_risk = RiskLevel.CRITICAL
        elif aging.get("overdue_90", 0) > 0:
            new_risk = RiskLevel.HIGH
        elif aging.get("overdue_60", 0) > 0:
            new_risk = RiskLevel.MEDIUM
        elif aging.get("overdue_30", 0) > 0:
            new_risk = RiskLevel.LOW  # Up to 30 days is common, keep low

        # 2. Notification logic for risk escalation
        significant_risk = new_risk in [RiskLevel.HIGH, RiskLevel.CRITICAL]
        risk_changed = new_risk != old_risk

        if significant_risk and risk_changed:
            from workflow.services import WorkflowService

            WorkflowService.send_notification(
                notification_type="CREDIT_RISK_ALERT",
                title=f"Riesgo Elevado: {contact.name}",
                message=f"El cliente ha sido clasificado como {new_risk}. Deuda actual: ${contact.credit_balance_used:,.0f}",
                link=f"/credits/portfolio?search={contact.tax_id}",
                content_object=contact,
                level="WARNING" if new_risk == RiskLevel.HIGH else "ERROR",
            )

        # 3. Evaluate Auto-Blocking
        if auto_block_days_threshold is not None and auto_block_days_threshold > 0:
            should_be_blocked = max_overdue_days > auto_block_days_threshold

            if should_be_blocked and not contact.credit_auto_blocked:
                contact.credit_auto_blocked = True
                blocked_count += 1
                logger.info(
                    f"Auto-blocked contact {contact.id} ({contact.name}): {max_overdue_days} days overdue (Threshold: {auto_block_days_threshold})"
                )

                from workflow.services import WorkflowService

                WorkflowService.send_notification(
                    notification_type="CREDIT_AUTO_BLOCK",
                    title=f"Bloqueo Automático: {contact.name}",
                    message=f"Crédito restringido por mora excesiva ({max_overdue_days} días).",
                    link=f"/credits/portfolio?search={contact.tax_id}",
                    content_object=contact,
                    level="ERROR",
                )

            elif not should_be_blocked and contact.credit_auto_blocked:
                # They paid! We can unblock them.
                contact.credit_auto_blocked = False
                unblocked_count += 1
                logger.info(
                    f"Auto-unblocked contact {contact.id} ({contact.name}): No longer exceeds threshold."
                )

                from workflow.services import WorkflowService

                WorkflowService.send_notification(
                    notification_type="CREDIT_AUTO_BLOCK",
                    title=f"Desbloqueo Automático: {contact.name}",
                    message="Crédito rehabilitado automáticamente tras regularización de deuda.",
                    link=f"/credits/portfolio?search={contact.tax_id}",
                    content_object=contact,
                    level="SUCCESS",
                )

        contact.credit_risk_level = new_risk
        contact.credit_last_evaluated = now
        updates.append(contact)
        evaluated_count += 1

    if updates:
        Contact.objects.bulk_update(
            updates,
            ["credit_risk_level", "credit_auto_blocked", "credit_last_evaluated"],
        )

    logger.info(
        f"Credit portfolio evaluation complete. Evaluated: {evaluated_count}. Blocked: {blocked_count}. Unblocked: {unblocked_count}."
    )
    return {"evaluated": evaluated_count, "blocked": blocked_count, "unblocked": unblocked_count}
