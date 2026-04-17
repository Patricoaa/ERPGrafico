"""
PaymentOrchestrator — capa de orquestación entre billing/sales y la infraestructura de cobro.

billing.services NO debe importar PaymentRequest, gateways, ni lógica de terminal directamente.
Toda esa lógica vive aquí. Ver ADR 002 + ADR 003 (pendiente).

Responsable de:
- Resolver cuenta de liquidación correcta según PaymentMethod.effective_settlement_account.
- Mapear method_type (nuevo) → TreasuryMovement.Method (legacy).
- Crear TreasuryMovement con cuentas correctas.
- Iniciar cobros remotos vía gateway (solo si method.is_integrated).
- Resolver PaymentRequest existente y extraer sequence_number para reconciliación.
"""
from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError

from .models import TreasuryMovement

if TYPE_CHECKING:
    from .models import PaymentMethod, PaymentRequest, POSSession, TreasuryAccount
    from billing.models import Invoice
    from sales.models import SaleOrder


# Mapa de conversión desde PaymentMethod.Type → TreasuryMovement.Method (legacy enum).
# CARD_TERMINAL, DEBIT_CARD, CREDIT_CARD → CARD
# CHECK → OTHER (no existe en legacy)
_LEGACY_METHOD_MAP: dict[str, str] = {
    "CARD_TERMINAL": TreasuryMovement.Method.CARD,
    "DEBIT_CARD": TreasuryMovement.Method.CARD,
    "CREDIT_CARD": TreasuryMovement.Method.CARD,
    "CHECK": TreasuryMovement.Method.OTHER,
    "CASH": TreasuryMovement.Method.CASH,
    "CARD": TreasuryMovement.Method.CARD,
    "TRANSFER": TreasuryMovement.Method.TRANSFER,
}


def _to_legacy_method(method_type: str) -> str:
    return _LEGACY_METHOD_MAP.get(method_type, TreasuryMovement.Method.OTHER)


class PaymentOrchestrator:
    """
    Punto de entrada único para crear movimientos de tesorería y cobros remotos.
    """

    @staticmethod
    def create_movement(
        *,
        payment_method_obj: "PaymentMethod",
        amount: Decimal | int | str,
        movement_type: str = TreasuryMovement.Type.INBOUND,
        sale_order: "SaleOrder | None" = None,
        invoice: "Invoice | None" = None,
        pos_session: "POSSession | None" = None,
        pos_session_id: int | None = None,
        date=None,
        payment_request: "PaymentRequest | None" = None,
        payment_request_idempotency_key: str | None = None,
        partner=None,
        reference: str = "",
        notes: str = "",
        transaction_number: str | None = None,
        is_pending_registration: bool = False,
        created_by=None,
    ) -> TreasuryMovement:
        """
        Crea TreasuryMovement usando la cuenta de liquidación correcta del PaymentMethod.

        Resolución de cuenta:
          INBOUND → to_account = payment_method_obj.effective_settlement_account
          OUTBOUND → from_account = payment_method_obj.effective_settlement_account

        Resolución de transaction_number:
          Si no se provee, intenta desde PaymentRequest.sequence_number.
        """
        from .services import TreasuryService

        amount = Decimal(str(amount))

        # 1. Resolver cuenta destino/origen real
        settlement = payment_method_obj.effective_settlement_account
        if settlement is None:
            raise ValidationError(
                f"El método de pago '{payment_method_obj.name}' no tiene cuenta de liquidación configurada."
            )

        from_acc = None
        to_acc = None
        if movement_type == TreasuryMovement.Type.INBOUND:
            to_acc = settlement
        else:
            from_acc = settlement

        # 2. Resolver PaymentRequest si solo se tiene la key
        pr = payment_request
        if pr is None and payment_request_idempotency_key:
            pr = PaymentOrchestrator._resolve_payment_request(payment_request_idempotency_key)

        # 3. Extraer sequence_number de PR para reconciliación (Fase 3)
        if pr and not transaction_number and pr.sequence_number:
            transaction_number = pr.sequence_number

        # 4. Mapear method_type → legacy TreasuryMovement.Method
        legacy_method = _to_legacy_method(payment_method_obj.method_type)

        # 5. Delegar creación al servicio base
        movement = TreasuryService.create_movement(
            amount=amount,
            movement_type=movement_type,
            payment_method=legacy_method,
            date=date,
            created_by=created_by,
            from_account=from_acc,
            to_account=to_acc,
            partner=partner,
            invoice=invoice,
            sale_order=sale_order,
            pos_session=pos_session,
            pos_session_id=pos_session_id,
            reference=reference,
            notes=notes,
            transaction_number=transaction_number,
            is_pending_registration=is_pending_registration,
            payment_method_new=payment_method_obj,
        )

        return movement

    @staticmethod
    def initiate_remote_payment(
        *,
        payment_method_obj: "PaymentMethod",
        amount: int,
        sale_order: "SaleOrder | None" = None,
        pos_session: "POSSession | None" = None,
        idempotency_key: str | None = None,
    ):
        """
        Inicia cobro remoto en terminal físico.
        Solo funciona si payment_method_obj.is_integrated == True.
        Retorna InitiateResult (ver payment_request_service.py).
        """
        if not payment_method_obj.is_integrated:
            raise ValidationError(
                f"El método '{payment_method_obj.name}' no tiene terminal integrado configurado."
            )

        device = payment_method_obj.linked_terminal_device
        from .payment_request_service import PaymentRequestService

        return PaymentRequestService.initiate(
            device=device,
            amount=int(amount),
            sale_order=sale_order,
            pos_session=pos_session,
            idempotency_key=idempotency_key,
        )

    @staticmethod
    def _resolve_payment_request(idempotency_key: str) -> "PaymentRequest | None":
        from .models import PaymentRequest
        return PaymentRequest.objects.filter(idempotency_key=idempotency_key).first()
