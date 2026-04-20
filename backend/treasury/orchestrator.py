"""
PaymentOrchestrator — capa de orquestación entre billing/sales y la infraestructura de cobro.

Responsable de:
- Resolver cuenta de liquidación correcta según PaymentMethod.effective_settlement_account.
- Mapear method_type (nuevo) → TreasuryMovement.Method (legacy).
- Crear TreasuryMovement con cuentas correctas.
"""
from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError

from .models import TreasuryMovement

if TYPE_CHECKING:
    from .models import PaymentMethod, POSSession
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
    Punto de entrada único para crear movimientos de tesorería.
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

        # 2. Mapear method_type → legacy TreasuryMovement.Method
        legacy_method = _to_legacy_method(payment_method_obj.method_type)

        # 3. Delegar creación al servicio base
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
