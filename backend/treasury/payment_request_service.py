"""
Servicio de orquestación de PaymentRequest contra TUU Pago Remoto. Ver ADR 002.

Responsable de:
- Validar rate limit y pendientes por terminal.
- Crear la PaymentRequest en estado PENDING dentro de la tx local.
- Llamar al gateway (create) y transicionar a SENT/FAILED.
- Encolar la task Celery de polling.
- Cancelar PaymentRequests que aún no fueron enviadas al terminal.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from .gateways import GatewayError, get_gateway
from .gateways.ratelimit import (
    acquire_create_slot,
    check_pending_limit,
    release_create_slot,
)
from .models import (
    PaymentRequest,
    PaymentTerminalDevice,
    POSSession,
)
from .tasks import poll_payment_request


@dataclass
class InitiateResult:
    payment_request: PaymentRequest
    created: bool


class PaymentRequestService:
    @staticmethod
    def initiate(
        *,
        device: PaymentTerminalDevice,
        amount: int,
        payment_method_code: int = PaymentRequest.PaymentMethodCode.CREDIT,
        dte_type: int = 48,
        description: str = "",
        sale_order=None,
        pos_session: POSSession | None = None,
        idempotency_key: str | None = None,
    ) -> InitiateResult:
        """
        Crea una PaymentRequest, la envía al gateway y encola polling.
        Si `idempotency_key` se reutiliza y ya existe una PR, retorna la existente.
        """
        key = idempotency_key or str(uuid.uuid4())

        existing = PaymentRequest.objects.filter(idempotency_key=key).first()
        if existing:
            return InitiateResult(payment_request=existing, created=False)

        check_pending_limit(device)
        acquire_create_slot(device.id)

        try:
            with transaction.atomic():
                pr = PaymentRequest.objects.create(
                    idempotency_key=key,
                    amount=amount,
                    device=device,
                    provider=device.provider,
                    dte_type=dte_type,
                    payment_method_code=payment_method_code,
                    description=description[:28],
                    sale_order=sale_order,
                    pos_session=pos_session,
                    status=PaymentRequest.Status.PENDING,
                )

                gateway = get_gateway(pr.provider)
                try:
                    response = gateway.create(pr)
                except GatewayError as exc:
                    pr.status = PaymentRequest.Status.FAILED
                    pr.failure_reason = (exc.code or "GATEWAY")[:64]
                    pr.completed_at = timezone.now()
                    pr.raw_last_response = {"error": str(exc), "code": exc.code}
                    pr.save()
                    release_create_slot(device.id)
                    return InitiateResult(payment_request=pr, created=True)

                pr.status = PaymentRequest.Status.SENT
                pr.raw_last_response = response.raw or {}
                pr.save(update_fields=["status", "raw_last_response"])
        except Exception:
            release_create_slot(device.id)
            raise

        task = poll_payment_request.apply_async(
            args=[pr.pk], countdown=3
        )
        pr.celery_task_id = task.id or ""
        pr.save(update_fields=["celery_task_id"])

        return InitiateResult(payment_request=pr, created=True)

    @staticmethod
    def cancel(idempotency_key: str) -> PaymentRequest:
        """
        Cancela localmente una PaymentRequest que aún esté en PENDING.
        Una vez SENT, la cancelación debe hacerla el cajero en el terminal físico.
        """
        pr = PaymentRequest.objects.select_for_update().get(
            idempotency_key=idempotency_key
        )
        if pr.status != PaymentRequest.Status.PENDING:
            raise GatewayError(
                f"No se puede cancelar PaymentRequest en estado {pr.status}",
                code="CANCEL-INVALID-STATE",
            )
        pr.status = PaymentRequest.Status.CANCELED
        pr.failure_reason = "USER-CANCELED"
        pr.completed_at = timezone.now()
        pr.save(update_fields=["status", "failure_reason", "completed_at"])
        return pr

    @staticmethod
    def get_by_key(idempotency_key: str) -> PaymentRequest:
        return PaymentRequest.objects.select_related("device", "provider").get(
            idempotency_key=idempotency_key
        )
