"""Celery tasks para treasury. Ver ADR 002."""
from __future__ import annotations

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

# Intervalo de polling hacia TUU (GET status). Create tiene su propio rate
# limit de 1/min; el GET de estado lo poleamos más frecuente para UX del POS.
POLL_INTERVAL_SECONDS = 5
# Ventana máxima desde initiated_at antes de marcar TIMEOUT.
POLL_TIMEOUT_SECONDS = 180

# Estados que TUU devuelve (strings) y su mapeo a PaymentRequest.Status.
_TUU_TO_LOCAL = {
    "Pending": "PENDING",
    "Sent": "SENT",
    "Processing": "PROCESSING",
    "Completed": "COMPLETED",
    "Failed": "FAILED",
    "Canceled": "CANCELED",
}


@shared_task(
    bind=True,
    name="treasury.poll_payment_request",
    max_retries=None,
)
def poll_payment_request(self, payment_request_id: int):
    """
    Polea el estado contra el gateway hasta llegar a estado terminal o agotar
    el timeout. Se re-agenda con self.retry(countdown=POLL_INTERVAL_SECONDS).
    """
    from treasury.gateways import GatewayError, get_gateway
    from treasury.models import PaymentRequest

    try:
        pr = PaymentRequest.objects.select_related("device", "provider").get(
            pk=payment_request_id
        )
    except PaymentRequest.DoesNotExist:
        logger.warning("[treasury] poll: PaymentRequest %s no existe", payment_request_id)
        return {"ok": False, "reason": "not_found"}

    if pr.is_terminal:
        return {"ok": True, "id": pr.pk, "status": pr.status, "final": True}

    elapsed = (timezone.now() - pr.initiated_at).total_seconds()
    if elapsed >= POLL_TIMEOUT_SECONDS:
        _mark_timeout(pr)
        logger.warning("[treasury] poll: timeout en PaymentRequest %s", pr.pk)
        return {"ok": False, "id": pr.pk, "status": pr.status, "reason": "timeout"}

    gateway = get_gateway(pr.provider)
    try:
        response = gateway.fetch_status(pr.idempotency_key)
    except GatewayError as exc:
        logger.warning(
            "[treasury] poll: GatewayError id=%s code=%s msg=%s",
            pr.pk, exc.code, exc,
        )
        # Errores transitorios (rate-limit, red) → reintentar; fatales → Failed.
        if exc.code in ("RATE-LIMIT", "NETWORK", "NETWORK-TIMEOUT"):
            raise self.retry(countdown=POLL_INTERVAL_SECONDS)
        _mark_failed(pr, reason=exc.code or "GATEWAY")
        return {"ok": False, "id": pr.pk, "status": pr.status, "reason": exc.code}

    new_status = _TUU_TO_LOCAL.get(response.status, pr.status)
    _apply_response(pr, new_status, response)

    if pr.is_terminal:
        logger.info("[treasury] poll: PaymentRequest %s → %s", pr.pk, pr.status)
        return {"ok": True, "id": pr.pk, "status": pr.status, "final": True}

    raise self.retry(countdown=POLL_INTERVAL_SECONDS)


def _apply_response(pr, new_status, response):
    pr.status = new_status
    pr.raw_last_response = response.raw or {}
    if response.sequence_number:
        pr.sequence_number = response.sequence_number
    if response.transaction_reference:
        pr.transaction_reference = response.transaction_reference
    if response.acquirer_id:
        pr.acquirer_id = response.acquirer_id
    if response.failure_reason and new_status == "FAILED":
        pr.failure_reason = response.failure_reason
    if new_status in ("COMPLETED", "FAILED", "CANCELED"):
        pr.completed_at = timezone.now()
    pr.save()
    _sync_sale_order(pr)


def _mark_timeout(pr):
    pr.status = "FAILED"
    pr.failure_reason = "TIMEOUT"
    pr.completed_at = timezone.now()
    pr.save(update_fields=["status", "failure_reason", "completed_at"])
    _sync_sale_order(pr)


def _mark_failed(pr, reason: str):
    pr.status = "FAILED"
    pr.failure_reason = reason[:64]
    pr.completed_at = timezone.now()
    pr.save(update_fields=["status", "failure_reason", "completed_at"])
    _sync_sale_order(pr)


def _sync_sale_order(pr):
    from treasury.payment_request_service import sync_sale_order_from_payment_request
    sync_sale_order_from_payment_request(pr)
