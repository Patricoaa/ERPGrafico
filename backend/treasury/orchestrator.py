"""
PaymentOrchestrator — capa de orquestación entre billing/sales y la infraestructura de cobro.

Responsable de:
- Resolver cuenta de liquidación correcta según PaymentMethod.effective_settlement_account.
- Mapear method_type (nuevo) → TreasuryMovement.Method (legacy).
- Crear TreasuryMovement con cuentas correctas.
- Detectar CHECK y derivar a CheckService.receive() / CheckService.issue().
"""
from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError

from .models import TreasuryMovement

if TYPE_CHECKING:
    from .models import PaymentMethod, POSSession, Check
    from billing.models import Invoice
    from sales.models import SaleOrder


# Mapa de conversión desde PaymentMethod.Type → TreasuryMovement.Method (legacy enum).
# CHECK → se maneja por separado (CheckService), fallback a OTHER
_LEGACY_METHOD_MAP: dict[str, str] = {
    "CARD_TERMINAL": TreasuryMovement.Method.CARD_TERMINAL,
    "DEBIT_CARD": TreasuryMovement.Method.DEBIT_CARD,
    "CREDIT_CARD": TreasuryMovement.Method.CREDIT_CARD,
    "CHECK": TreasuryMovement.Method.CHECK,
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
        payment_method_obj: "PaymentMethod | None" = None,
        method_type: str | None = None,
        amount: Decimal | int | str,
        movement_type: str = TreasuryMovement.Type.INBOUND,
        sale_order: "SaleOrder | None" = None,
        purchase_order: "PurchaseOrder | None" = None,
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
        # Check-specific params (only used when method_type == 'CHECK')
        check_bank_id: int | None = None,
        check_number: str | None = None,
        check_issue_date=None,
        check_due_date=None,
        checkbook_id: int | None = None,
    ) -> TreasuryMovement | "Check":
        """
        Crea TreasuryMovement usando la cuenta de liquidación correcta del PaymentMethod.

        Cuando method_type == 'CHECK', deriva a CheckService.receive() (INBOUND)
        o CheckService.issue() (OUTBOUND) en vez de crear un movimiento genérico.

        Dos modos de entrada:
        - payment_method_obj: PaymentMethod DB (vía M2M en POSTerminal).
        - method_type='CHECK' sin payment_method_obj: ruta legacy (no usada por el POS normal).

        Resolución de cuenta:
          INBOUND → to_account = payment_method_obj.effective_settlement_account
          OUTBOUND → from_account = payment_method_obj.effective_settlement_account

        Retorna Check cuando method_type == 'CHECK', TreasuryMovement en otro caso.
        """
        from .services import TreasuryService

        amount = Decimal(str(amount))

        # ── Resolver method_type ──────────────────────────────────────────
        pm_method_type = method_type
        settlement = None

        if payment_method_obj is not None:
            pm_method_type = payment_method_obj.method_type
            settlement = payment_method_obj.effective_settlement_account
            if settlement is None:
                raise ValidationError(
                    f"El método de pago '{payment_method_obj.name}' no tiene cuenta de liquidación configurada."
                )

        # ── CHECK: derivar a CheckService ────────────────────────────────
        if pm_method_type == 'CHECK':
            return PaymentOrchestrator._handle_check(
                settlement=settlement,
                amount=amount,
                movement_type=movement_type,
                date=date,
                partner=partner,
                invoice=invoice,
                sale_order=sale_order,
                created_by=created_by,
                notes=notes,
                check_bank_id=check_bank_id,
                check_number=check_number,
                check_issue_date=check_issue_date,
                check_due_date=check_due_date,
                checkbook_id=checkbook_id,
            )

        # ── Non-CHECK: flujo estándar ────────────────────────────────────
        if payment_method_obj is None:
            raise ValidationError(
                "Para métodos de pago no-CHECK se requiere un PaymentMethod (payment_method_obj)."
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
            purchase_order=purchase_order,
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
    def _handle_check(
        *,
        settlement,
        amount: Decimal,
        movement_type: str,
        date,
        partner,
        invoice,
        sale_order,
        created_by,
        notes: str,
        check_bank_id: int | None,
        check_number: str | None,
        check_issue_date,
        check_due_date,
        checkbook_id: int | None,
    ) -> "Check":
        """
        Maneja pagos con método CHECK: crea Check + TreasuryMovement via CheckService.
        
        Cuando el método es hardcodeado (sin PaymentMethod DB), settlement es None
        y el banco se resuelve exclusivamente de check_bank_id.
        """
        from .check_service import CheckService
        from .models import Checkbook

        # Resolver banco: del settlement (CHECKING) o del check_bank_id explícito
        bank_id = check_bank_id
        if bank_id is None and settlement is not None and settlement.bank_id is not None:
            bank_id = settlement.bank_id
        # Para método hardcodeado: bank_id es opcional (se asigna null, el usuario lo completa después)

        # Fechas por defecto
        from django.utils import timezone
        today = timezone.now().date()
        issue_date = check_issue_date or today
        due_date = check_due_date or today

        # Resolver checkbook si se proporciona
        checkbook = None
        if checkbook_id:
            checkbook = Checkbook.objects.filter(id=checkbook_id).first()

        # Extraer counterparty_id del partner
        counterparty_id = None
        if partner is not None:
            counterparty_id = partner.id if hasattr(partner, 'id') else partner

        if movement_type == TreasuryMovement.Type.INBOUND:
            # Venta: cliente paga con cheque → receive
            check = CheckService.receive(
                bank_id=bank_id,
                check_number=check_number or '',
                amount=amount,
                issue_date=issue_date,
                due_date=due_date,
                counterparty_id=counterparty_id,
                invoice_id=invoice.id if invoice else None,
                sale_order_id=sale_order.id if sale_order else None,
                created_by=created_by,
                notes=notes,
            )
        else:
            # Compra: empresa paga con cheque propio → issue
            # La cuenta de liquidación (CHECKING) es el payment_account
            check = CheckService.issue(
                bank_id=bank_id,
                check_number=check_number,
                amount=amount,
                issue_date=issue_date,
                due_date=due_date,
                counterparty_id=counterparty_id,
                payment_account=settlement,
                checkbook=checkbook,
                created_by=created_by,
                notes=notes,
            )

        return check
