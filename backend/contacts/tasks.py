from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

@shared_task
def evaluate_credit_portfolio():
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
    from contacts.models import Contact, RiskLevel
    from accounting.models import AccountingSettings
    
    settings = AccountingSettings.objects.first()
    if not settings or not settings.credit_risk_classification_enabled:
        logger.info("Credit risk classification is disabled in AccountingSettings. Skipping evaluation.")
        return
        
    auto_block_days_threshold = settings.credit_auto_block_days

    # We evaluate contacts that either have credit enabled or have outstanding balance
    # (Checking debt is slightly heavier but we can't easily filter by property. We iterate all that MIGHT have debt).
    # To optimize, we query contacts that have sales orders not DRAFT/CANCELLED.
    contacts = Contact.objects.filter(sale_orders__status__in=['CONFIRMED', 'INVOICED', 'PARTIAL']).distinct()
    
    evaluated_count = 0
    blocked_count = 0
    unblocked_count = 0
    now = timezone.now()

    for contact in contacts:
        # Re-fetch or calculate aging
        aging = contact.credit_aging
        
        # 1. Determine Risk Level
        new_risk = RiskLevel.LOW
        
        # Risk logic: If they have any debt in 90+, it's critical.
        if aging.get('overdue_90plus', 0) > 0:
            new_risk = RiskLevel.CRITICAL
        elif aging.get('overdue_90', 0) > 0:
            new_risk = RiskLevel.HIGH
        elif aging.get('overdue_60', 0) > 0:
            new_risk = RiskLevel.MEDIUM
        elif aging.get('overdue_30', 0) > 0:
            new_risk = RiskLevel.LOW  # Up to 30 days is common, keep low
        
        contact.credit_risk_level = new_risk

        # 2. Notification logic for risk escalation
        significant_risk = new_risk in [RiskLevel.HIGH, RiskLevel.CRITICAL]
        risk_changed = new_risk != contact.credit_risk_level
        
        if significant_risk and risk_changed:
            from workflow.services import WorkflowService
            WorkflowService.send_notification(
                notification_type='CREDIT_RISK_ALERT',
                title=f"Riesgo Elevado: {contact.name}",
                message=f"El cliente ha sido clasificado como {new_risk}. Deuda actual: ${contact.credit_balance_used:,.0f}",
                link=f"/credits/portfolio?search={contact.tax_id}",
                content_object=contact,
                level='WARNING' if new_risk == RiskLevel.HIGH else 'ERROR'
            )

        # 3. Evaluate Auto-Blocking
        if auto_block_days_threshold is not None and auto_block_days_threshold > 0:
            # We need to find the exact MAX overdue days for this contact
            # The aging dict doesn't give us exact days, just buckets.
            # We iterate their valid unpaid orders:
            orders = contact.sale_orders.exclude(status__in=['DRAFT', 'CANCELLED', 'PAID'])
            
            max_overdue_days = 0
            for order in orders:
                # Same logic as in views.py credit_ledger
                payments = order.payments.filter(is_pending_registration=False)
                paid_in = sum((p.amount for p in payments if p.movement_type == 'INBOUND'), 0)
                paid_out = sum((p.amount for p in payments if p.movement_type == 'OUTBOUND'), 0)
                payments_net = paid_in - paid_out
                
                balance = order.effective_total - payments_net
                
                if balance > 0:
                    base_date = order.date
                    credit_days = contact.credit_days or 30
                    due_date = base_date + timedelta(days=credit_days)
                    days_overdue = (now.date() - due_date).days
                    
                    if days_overdue > max_overdue_days:
                        max_overdue_days = days_overdue
            
            # Determine if they should be blocked
            should_be_blocked = max_overdue_days > auto_block_days_threshold
            
            if should_be_blocked and not contact.credit_auto_blocked:
                contact.credit_auto_blocked = True
                blocked_count += 1
                logger.info(f"Auto-blocked contact {contact.id} ({contact.name}): {max_overdue_days} days overdue (Threshold: {auto_block_days_threshold})")
                
                from workflow.services import WorkflowService
                WorkflowService.send_notification(
                    notification_type='CREDIT_AUTO_BLOCK',
                    title=f"Bloqueo Automático: {contact.name}",
                    message=f"Crédito restringido por mora excesiva ({max_overdue_days} días).",
                    link=f"/credits/portfolio?search={contact.tax_id}",
                    content_object=contact,
                    level='ERROR'
                )
            
            elif not should_be_blocked and contact.credit_auto_blocked:
                # They paid! We can unblock them.
                contact.credit_auto_blocked = False
                unblocked_count += 1
                logger.info(f"Auto-unblocked contact {contact.id} ({contact.name}): No longer exceeds threshold.")
                
                from workflow.services import WorkflowService
                WorkflowService.send_notification(
                    notification_type='CREDIT_AUTO_BLOCK',
                    title=f"Desbloqueo Automático: {contact.name}",
                    message=f"Crédito rehabilitado automáticamente tras regularización de deuda.",
                    link=f"/credits/portfolio?search={contact.tax_id}",
                    content_object=contact,
                    level='SUCCESS'
                )

        contact.credit_risk_level = new_risk
        contact.credit_last_evaluated = now
        # Update fields specifically to avoid triggering the whole save() lifecycle if not needed
        contact.save(update_fields=['credit_risk_level', 'credit_auto_blocked', 'credit_last_evaluated'])
        evaluated_count += 1

    logger.info(f"Credit portfolio evaluation complete. Evaluated: {evaluated_count}. Blocked: {blocked_count}. Unblocked: {unblocked_count}.")
    return {"evaluated": evaluated_count, "blocked": blocked_count, "unblocked": unblocked_count}
