"""
check_service.py — Lógica de negocio para cheques (recibidos + propios girados).

Flujo recibido (direction=RECEIVED):
  receive()  → Check IN_PORTFOLIO + TreasuryMovement INBOUND a la cuenta puente.
  deposit()  → TreasuryMovement TRANSFER puente→banco; DEPOSITED.
  clear()    → CLEARED (cobrado definitivamente).
  bounce()   → Revierte movimientos (reversa contable); BOUNCED.
  void()     → VOIDED (solo desde IN_PORTFOLIO).
  endorse()  → OUTBOUND desde cartera + salda proveedor; ENDORSED.

Flujo propio (direction=ISSUED):
  issue()    → Check ISSUED + OUTBOUND desde pasivo "Cheques Girados" salda proveedor.
  mark_cashed() → TRANSFER pasivo "Cheques Girados" → banco; CLEARED.
  void()     → Revierte el issue; VOIDED.

Reutiliza TreasuryService.create_movement para todos los movimientos de tesorería,
garantizando que se genere el asiento contable correcto sin código duplicado.
"""
from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _t

from .models import Check, Checkbook, TreasuryAccount, TreasuryMovement

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser


# Transiciones de estado permitidas.
_VALID_TRANSITIONS: dict[str, set[str]] = {
    Check.Status.IN_PORTFOLIO: {Check.Status.DEPOSITED, Check.Status.VOIDED, Check.Status.ENDORSED},
    Check.Status.DEPOSITED:    {Check.Status.CLEARED, Check.Status.BOUNCED},
    Check.Status.CLEARED:      set(),
    Check.Status.BOUNCED:      set(),
    Check.Status.VOIDED:       set(),
    Check.Status.ISSUED:       {Check.Status.CLEARED, Check.Status.VOIDED},
    Check.Status.ENDORSED:     set(),
}


class CheckService:
    """Operaciones sobre cheques recibidos."""

    # ── Recepción ─────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def receive(
        *,
        bank_id: int,
        check_number: str,
        amount: Decimal,
        issue_date,
        due_date,
        counterparty_id: int | None = None,
        drawer_name: str = "",
        notes: str = "",
        invoice_id: int | None = None,
        sale_order_id: int | None = None,
        created_by: "AbstractUser | None" = None,
        portfolio_account: "TreasuryAccount | None" = None,
    ) -> Check:
        """
        Registra un cheque recibido y genera el movimiento INBOUND a la
        cuenta puente "Cheques en Cartera".

        portfolio_account: si se omite, se resuelve desde AccountingSettings.
        """
        portfolio_account = portfolio_account or CheckService._get_portfolio_account()

        from .services import TreasuryService

        movement = TreasuryService.create_movement(
            amount=amount,
            movement_type=TreasuryMovement.Type.INBOUND,
            payment_method=TreasuryMovement.Method.OTHER,
            to_account=portfolio_account,
            date=due_date,
            created_by=created_by,
            notes=f"Cheque {check_number} recibido",
            invoice=_obj_or_none('billing.Invoice', invoice_id),
            sale_order=_obj_or_none('sales.SaleOrder', sale_order_id),
            partner=_obj_or_none('contacts.Contact', counterparty_id),
        )

        check = Check.objects.create(
            direction=Check.Direction.RECEIVED,
            status=Check.Status.IN_PORTFOLIO,
            bank_id=bank_id,
            check_number=check_number,
            amount=amount,
            issue_date=issue_date,
            due_date=due_date,
            counterparty_id=counterparty_id,
            drawer_name=drawer_name,
            portfolio_account=portfolio_account,
            receipt_movement=movement,
            invoice_id=invoice_id,
            sale_order_id=sale_order_id,
            notes=notes,
            created_by=created_by,
        )
        return check

    # ── Depósito ──────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def deposit(
        check: Check,
        deposit_account: TreasuryAccount,
        *,
        date=None,
        created_by: "AbstractUser | None" = None,
    ) -> Check:
        """Transfiere el cheque de cartera al banco; pasa a DEPOSITED."""
        CheckService._assert_transition(check, Check.Status.DEPOSITED)

        from .services import TreasuryService

        movement = TreasuryService.create_movement(
            amount=check.amount,
            movement_type=TreasuryMovement.Type.TRANSFER,
            payment_method=TreasuryMovement.Method.OTHER,
            from_account=check.portfolio_account,
            to_account=deposit_account,
            date=date or timezone.now().date(),
            created_by=created_by,
            notes=f"Depósito {check.display_id}",
        )

        check.status = Check.Status.DEPOSITED
        check.deposit_account = deposit_account
        check.settlement_movement = movement
        check.deposited_at = timezone.now()
        check.save()
        return check

    # ── Cobro definitivo ─────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def clear(check: Check) -> Check:
        """Marca el cheque como cobrado definitivamente (CLEARED)."""
        CheckService._assert_transition(check, Check.Status.CLEARED)
        check.status = Check.Status.CLEARED
        check.cleared_at = timezone.now()
        check.save()
        return check

    # ── Protesto ──────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def bounce(
        check: Check,
        *,
        notes: str = "",
        created_by: "AbstractUser | None" = None,
    ) -> Check:
        """
        Protesta el cheque: genera movimientos de reversa y reinstala el
        documento original como no pagado.
        """
        CheckService._assert_transition(check, Check.Status.BOUNCED)

        from .services import TreasuryService

        # 1) Reversa del depósito (banco → cartera)
        if check.settlement_movement:
            TreasuryService.create_movement(
                amount=check.amount,
                movement_type=TreasuryMovement.Type.TRANSFER,
                payment_method=TreasuryMovement.Method.OTHER,
                from_account=check.deposit_account,
                to_account=check.portfolio_account,
                date=timezone.now().date(),
                created_by=created_by,
                notes=f"Reversa depósito {check.display_id} (protesto)",
            )

        # 2) Reversa de la recepción (cartera → externo): OUTBOUND
        if check.receipt_movement:
            TreasuryService.create_movement(
                amount=check.amount,
                movement_type=TreasuryMovement.Type.OUTBOUND,
                payment_method=TreasuryMovement.Method.OTHER,
                from_account=check.portfolio_account,
                date=timezone.now().date(),
                created_by=created_by,
                invoice=_obj_or_none('billing.Invoice', check.invoice_id),
                sale_order=_obj_or_none('sales.SaleOrder', check.sale_order_id),
                partner=check.counterparty,
                notes=f"Reversa recepción {check.display_id} (protesto)",
            )

        check.status = Check.Status.BOUNCED
        check.bounced_at = timezone.now()
        if notes:
            check.notes = (check.notes + "\n" + notes).strip()
        check.save()
        return check

    # ── Anulación ─────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def void(check: Check, *, notes: str = "") -> Check:
        """Anula el cheque (solo desde IN_PORTFOLIO o ISSUED). Genera reversa."""
        CheckService._assert_transition(check, Check.Status.VOIDED)

        from .services import TreasuryService

        if check.direction == Check.Direction.RECEIVED and check.receipt_movement:
            # Reversa de recepción (cartera → externo): OUTBOUND
            TreasuryService.create_movement(
                amount=check.amount,
                movement_type=TreasuryMovement.Type.OUTBOUND,
                payment_method=TreasuryMovement.Method.OTHER,
                from_account=check.portfolio_account,
                date=timezone.now().date(),
                invoice=_obj_or_none('billing.Invoice', check.invoice_id),
                sale_order=_obj_or_none('sales.SaleOrder', check.sale_order_id),
                partner=check.counterparty,
                notes=f"Anulación {check.display_id}",
            )
        elif check.direction == Check.Direction.ISSUED and check.issued_check_account:
            # Reversa de emisión: INBOUND pasivo "Cheques Girados" → cancela el débito.
            TreasuryService.create_movement(
                amount=check.amount,
                movement_type=TreasuryMovement.Type.INBOUND,
                payment_method=TreasuryMovement.Method.OTHER,
                to_account=check.issued_check_account,
                date=timezone.now().date(),
                partner=check.counterparty,
                notes=f"Reversa emisión {check.display_id} (anulación)",
            )

        check.status = Check.Status.VOIDED
        if notes:
            check.notes = (check.notes + "\n" + notes).strip()
        check.save()
        return check

    # ── Cheques propios girados (direction=ISSUED) ───────────────────────

    @staticmethod
    @transaction.atomic
    def issue(
        *,
        bank_id: int,
        check_number: str | None = None,
        amount: Decimal,
        issue_date,
        due_date,
        counterparty_id: int | None = None,
        drawer_name: str = "",
        payment_account: "TreasuryAccount | None" = None,
        issued_check_account: "TreasuryAccount | None" = None,
        checkbook: "Checkbook | None" = None,
        notes: str = "",
        created_by: "AbstractUser | None" = None,
    ) -> Check:
        """
        Emite un cheque propio para pagar a un proveedor.

        El OUTBOUND no toca el banco directamente: acredita la cuenta
        puente LIABILITY "Cheques Girados por Pagar" y salda al proveedor.
        Cuando el proveedor cobre (mark_cashed), la TRANSFER pasivo→banco
        cierra el ciclo.

        Si se proporciona checkbook, toma el siguiente folio automáticamente
        si check_number es None. Valida unicidad por banco.
        """
        if payment_account is None:
            raise ValidationError(
                _t("Para cheques propios, payment_account (banco) es obligatorio.")
            )
        if issued_check_account is None:
            issued_check_account = CheckService.ensure_issued_checks_account()

        # Folio: automático desde chequera o manual
        if checkbook is not None and check_number is None:
            if checkbook.is_exhausted():
                raise ValidationError(
                    _t(f"La chequera {checkbook} no tiene folios disponibles.")
                )
            check_number = str(checkbook.next_folio)
            checkbook.next_folio += 1
            if checkbook.is_exhausted():
                checkbook.status = Checkbook.Status.EXHAUSTED
            checkbook.save(update_fields=['next_folio', 'status'])
        elif check_number is None:
            raise ValidationError(
                _t("check_number es obligatorio si no se proporciona checkbook.")
            )

        # Validar que el número no exista para este banco
        if Check.objects.filter(
            bank_id=bank_id, check_number=check_number
        ).exists():
            raise ValidationError(
                _t(f"El cheque {check_number} ya existe para este banco.")
            )

        from .services import TreasuryService

        movement = TreasuryService.create_movement(
            amount=amount,
            movement_type=TreasuryMovement.Type.OUTBOUND,
            payment_method=TreasuryMovement.Method.OTHER,
            from_account=issued_check_account,
            date=due_date,
            created_by=created_by,
            partner=_obj_or_none('contacts.Contact', counterparty_id),
            notes=f"Cheque propio {check_number} girado",
        )

        check = Check.objects.create(
            direction=Check.Direction.ISSUED,
            status=Check.Status.ISSUED,
            bank_id=bank_id,
            check_number=check_number,
            amount=amount,
            issue_date=issue_date,
            due_date=due_date,
            counterparty_id=counterparty_id,
            drawer_name=drawer_name,
            portfolio_account=issued_check_account,
            payment_account=payment_account,
            issued_check_account=issued_check_account,
            checkbook=checkbook,
            receipt_movement=movement,
            notes=notes,
            created_by=created_by,
        )
        return check

    @staticmethod
    @transaction.atomic
    def mark_cashed(
        check: Check,
        *,
        date=None,
        created_by: "AbstractUser | None" = None,
    ) -> Check:
        """
        Marca un cheque propio como cobrado por el proveedor.

        TRANSFER pasivo "Cheques Girados" → banco: debita el pasivo,
        acredita el banco. El ciclo queda cerrado.
        """
        if check.direction != Check.Direction.ISSUED:
            raise ValidationError(
                _t("mark_cashed solo aplica a cheques propios (direction=ISSUED).")
            )
        CheckService._assert_transition(check, Check.Status.CLEARED)

        from .services import TreasuryService

        if check.payment_account:
            TreasuryService.create_movement(
                amount=check.amount,
                movement_type=TreasuryMovement.Type.TRANSFER,
                payment_method=TreasuryMovement.Method.OTHER,
                from_account=check.issued_check_account,
                to_account=check.payment_account,
                date=date or timezone.now().date(),
                created_by=created_by,
                notes=f"Cobro cheque propio {check.display_id}",
            )

        check.status = Check.Status.CLEARED
        check.cleared_at = timezone.now()
        check.save()
        return check

    # ── Endoso de cheques recibidos ──────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def endorse(
        check: Check,
        *,
        endorsed_to_id: int,
        date=None,
        created_by: "AbstractUser | None" = None,
    ) -> Check:
        """
        Endosa un cheque recibido a un proveedor.

        OUTBOUND desde cartera salda la cuenta del proveedor.
        El cheque pasa a ENDORSED y queda fuera de la cartera.
        """
        if check.direction != Check.Direction.RECEIVED:
            raise ValidationError(
                _t("El endoso solo aplica a cheques recibidos (direction=RECEIVED).")
            )
        CheckService._assert_transition(check, Check.Status.ENDORSED)

        from .services import TreasuryService

        movement = TreasuryService.create_movement(
            amount=check.amount,
            movement_type=TreasuryMovement.Type.OUTBOUND,
            payment_method=TreasuryMovement.Method.OTHER,
            from_account=check.portfolio_account,
            date=date or timezone.now().date(),
            created_by=created_by,
            partner=_obj_or_none('contacts.Contact', endorsed_to_id),
            notes=f"Endoso {check.display_id}",
        )

        check.status = Check.Status.ENDORSED
        check.endorsed_to_id = endorsed_to_id
        check.endorsement_movement = movement
        check.save()
        return check

    # ── Reportería ────────────────────────────────────────────────────────

    @staticmethod
    def get_portfolio_summary(bank_id=None) -> dict:
        """Cheques IN_PORTFOLIO: total y lista ordenada por vencimiento."""
        from django.db.models import Sum
        filters = {
            'direction': Check.Direction.RECEIVED,
            'status': Check.Status.IN_PORTFOLIO,
        }
        if bank_id is not None:
            filters['bank_id'] = bank_id
        qs = Check.objects.filter(
            **filters,
        ).select_related('bank', 'counterparty', 'portfolio_account')
        total = qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        return {'checks': list(qs), 'total': total}

    @staticmethod
    def get_in_transit_summary(bank_id=None) -> dict:
        """Cheques DEPOSITED pendientes de confirmación bancaria."""
        from django.db.models import Sum
        filters = {
            'direction': Check.Direction.RECEIVED,
            'status': Check.Status.DEPOSITED,
        }
        if bank_id is not None:
            filters['bank_id'] = bank_id
        qs = Check.objects.filter(
            **filters,
        ).select_related('bank', 'counterparty', 'deposit_account')
        total = qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        return {'checks': list(qs), 'total': total}

    # ── Helpers privados ─────────────────────────────────────────────────

    @staticmethod
    def ensure_portfolio_account(account=None) -> TreasuryAccount:
        """
        Garantiza que exista la TreasuryAccount puente 'Cheques en Cartera'
        vinculada a la cuenta contable configurada en AccountingSettings.

        Idempotente: si ya existe, la retorna sin tocar nada; si la cuenta
        contable cambió, actualiza el vínculo (cambio raro pero soportado).

        account: opcional accounting.Account; si se omite, se lee de
                 AccountingSettings.check_portfolio_account.

        Llamado tanto desde CheckService.receive (lazy) como desde el signal
        post_save de AccountingSettings (proactivo, ver treasury/signals.py).
        """
        from accounting.models import AccountingSettings

        if account is None:
            s = AccountingSettings.get_solo()
            if not s or not s.check_portfolio_account_id:
                raise ValidationError(
                    _t("No hay cuenta 'Cheques en Cartera' configurada. "
                      "Configúrela en Ajustes Contables antes de registrar cheques.")
                )
            account = s.check_portfolio_account

        portfolio, created = TreasuryAccount.objects.get_or_create(
            account_type=TreasuryAccount.Type.CHECK_PORTFOLIO,
            defaults={
                'name': 'Cheques en Cartera',
                'account': account,
                'currency': 'CLP',
            },
        )
        # Si ya existe pero la cuenta contable cambió, re-vincular.
        if not created and portfolio.account_id != account.id:
            portfolio.account = account
            portfolio.save(update_fields=['account'])

        CheckService._ensure_check_portfolio_payment_method(portfolio)
        return portfolio

    @staticmethod
    def _ensure_check_portfolio_payment_method(portfolio: TreasuryAccount):
        """
        Garantiza que exista un PaymentMethod CHECK vinculado a la cuenta puente
        CHECK_PORTFOLIO con allow_for_sales=True.

        Idempotente: get_or_create por (method_type, treasury_account).
        """
        from .models import PaymentMethod
        PaymentMethod.objects.get_or_create(
            method_type=PaymentMethod.Type.CHECK,
            treasury_account=portfolio,
            defaults={
                'name': 'Cheque en Cartera',
                'allow_for_sales': True,
                'allow_for_purchases': False,
                'is_active': True,
            },
        )

    @staticmethod
    def ensure_issued_checks_account() -> TreasuryAccount:
        """
        Garantiza que exista la TreasuryAccount puente 'Cheques Girados por Pagar'
        vinculada a una cuenta contable LIABILITY.

        Idempotente: si ya existe, la retorna; si no, la crea con AccountingSettings.
        """
        from accounting.models import AccountingSettings

        s = AccountingSettings.get_solo()
        account = None
        if s and s.issued_checks_account_id:
            account = s.issued_checks_account

        if account is None:
            # Fallback: buscar una existente o crear una cuenta contable básica.
            existing = TreasuryAccount.objects.filter(
                account_type=TreasuryAccount.Type.ISSUED_CHECKS,
            ).first()
            if existing:
                return existing

            from accounting.models import Account, AccountType
            account, _ = Account.objects.get_or_create(
                code='2.1.05.001',
                defaults={
                    'name': 'Cheques Girados por Pagar',
                    'account_type': AccountType.LIABILITY,
                },
            )

        ta, created = TreasuryAccount.objects.get_or_create(
            account_type=TreasuryAccount.Type.ISSUED_CHECKS,
            defaults={
                'name': 'Cheques Girados por Pagar',
                'account': account,
                'currency': 'CLP',
            },
        )
        if not created and ta.account_id != account.id:
            ta.account = account
            ta.save(update_fields=['account'])
        return ta

    @staticmethod
    def _get_portfolio_account() -> TreasuryAccount:
        """Alias interno legado — preferir ensure_portfolio_account()."""
        return CheckService.ensure_portfolio_account()

    @staticmethod
    def _assert_transition(check: Check, target: str) -> None:
        allowed = _VALID_TRANSITIONS.get(check.status, set())
        if target not in allowed:
            raise ValidationError(
                _t("No se puede pasar de '%(from)s' a '%(to)s'.")
                % {
                    'from': check.get_status_display(),
                    'to': dict(Check.Status.choices)[target],
                }
            )


def _obj_or_none(model_label: str, pk: int | None):
    """Carga un objeto por PK o retorna None. Evita imports circulares."""
    if pk is None:
        return None
    from django.apps import apps
    Model = apps.get_model(model_label)
    try:
        return Model.objects.get(pk=pk)
    except Model.DoesNotExist:
        return None
