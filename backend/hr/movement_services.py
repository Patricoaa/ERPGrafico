"""Servicios de movimientos con el empleado (ADR-0156).

`payroll_balance` es la ÚNICA fuente del saldo a pagar de una liquidación. Se re-exporta desde
`hr.services` para los consumidores existentes.
"""

from dataclasses import dataclass, replace
from datetime import date as date_type
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.db.models import Sum
from django.utils.translation import gettext_lazy as _

from accounting.models import AccountingSettings

from . import loans
from .models import EmployeeMovement, GlobalHRSettings, LoanInstallment, Payroll, PayrollAllocation

_ACTIVE = (EmployeeMovement.Status.POSTED, EmployeeMovement.Status.SETTLED)


@dataclass(frozen=True)
class LoanTerms:
    rate: Decimal
    rate_period: str
    installments: int
    first_year: int
    first_month: int


@dataclass(frozen=True)
class TreasuryPayload:
    treasury_account_id: int
    payment_method_id: int | None = None
    payment_method_slug: str = ""
    transaction_number: str | None = None


def payroll_balance(payroll) -> Decimal:
    """Saldo a pagar = líquido − descuentos asignados (anticipo/préstamo) − pagos de remuneración vigentes."""
    allocated = payroll.allocations.filter(movement__status__in=_ACTIVE).aggregate(total=Sum("amount"))["total"]
    return payroll.net_salary - (allocated or Decimal("0"))


def _committed_principal(movement) -> Decimal:
    return movement.allocations.aggregate(total=Sum("principal_part"))["total"] or Decimal("0")


def _monthly_rate(movement) -> Decimal:
    return loans.monthly_rate(movement.rate, movement.rate_period)


def _specs_to_rows(movement, specs) -> list[LoanInstallment]:
    return [
        LoanInstallment(
            movement=movement, number=s.number, year=s.year, month=s.month,
            principal=s.principal, interest=s.interest, amount=s.amount,
        )
        for s in specs
    ]


def _to_amount(value) -> Decimal:
    """Monto entero positivo en CLP; cualquier otra cosa es un error de validación (no un 500)."""
    try:
        amount = Decimal(str(value))
    except InvalidOperation:
        raise ValidationError(_("El monto no es un número válido.")) from None
    if not amount.is_finite() or amount != amount.to_integral_value() or amount <= 0:
        raise ValidationError(_("El monto debe ser un entero mayor a cero."))
    return amount


def _rebuild_pending(movement) -> None:
    """Recalcula las cuotas sin asignación con el capital restante y el plazo restante original."""
    pending = list(movement.installments.filter(allocations__isnull=True).order_by("number"))
    capital = int(movement.amount - _committed_principal(movement))
    if not pending:
        if capital > 0:
            raise ValidationError(_("La última cuota debe liquidar el saldo del préstamo."))
        return
    first = pending[0]
    movement.installments.filter(pk__in=[p.pk for p in pending]).delete()
    if capital > 0:
        specs = loans.reschedule(capital, _monthly_rate(movement), len(pending), (first.year, first.month), first.number)
        # Cada cuota nueva ocupa el lugar (número y período) de la cuota pendiente que reemplaza: puede haber
        # cuotas asignadas entre medio y sus números no se reutilizan.
        slots = [replace(spec, number=slot.number, year=slot.year, month=slot.month) for spec, slot in zip(specs, pending)]
        LoanInstallment.objects.bulk_create(_specs_to_rows(movement, slots))


def _next_free_installment(movement):
    return movement.installments.filter(allocations__isnull=True).order_by("number").first()


class EmployeeMovementService:
    @staticmethod
    def preview_schedule(amount: int, rate: Decimal, rate_period: str, installments: int, first: tuple[int, int]):
        principal = _to_amount(amount)
        try:
            rate_value = Decimal(str(rate))
        except InvalidOperation:
            raise ValidationError(_("La tasa no es un número válido.")) from None
        if rate_value < 0 or installments < 1 or not 1 <= first[1] <= 12:
            raise ValidationError(_("Tasa, cuotas o mes de primera cuota inválidos."))
        return loans.build_schedule(int(principal), loans.monthly_rate(rate_value, rate_period), installments, first)

    @staticmethod
    def create_from_request(validated: dict, raw: dict, user) -> EmployeeMovement:
        """Traduce el cuerpo validado de la API a `create` (términos de préstamo y datos de tesorería)."""
        loan = None
        if validated["kind"] == EmployeeMovement.Kind.LOAN:
            loan = LoanTerms(
                rate=validated["rate"], rate_period=validated["rate_period"], installments=validated["installments_count"],
                first_year=validated["first_installment_year"], first_month=validated["first_installment_month"],
            )
        treasury = None
        if raw.get("treasury_account_id"):
            treasury = TreasuryPayload(
                treasury_account_id=int(raw["treasury_account_id"]),
                payment_method_id=raw.get("payment_method_new"),
                payment_method_slug=raw.get("paymentMethod", ""),
                transaction_number=raw.get("transaction_number"),
            )
        return EmployeeMovementService.create(
            validated["employee"], validated["kind"], validated["date"], validated["amount"],
            notes=validated.get("notes", ""), loan=loan, treasury=treasury, user=user,
        )

    @staticmethod
    @transaction.atomic
    def sync_schedule(movement) -> None:
        """Regenera el plan de un préstamo en borrador tras editar monto, tasa, plazo o primera cuota."""
        if movement.kind != EmployeeMovement.Kind.LOAN or movement.status != EmployeeMovement.Status.DRAFT:
            return
        movement.installments.all().delete()
        specs = loans.build_schedule(
            int(movement.amount), loans.monthly_rate(movement.rate, movement.rate_period), movement.installments_count,
            (movement.first_installment_year, movement.first_installment_month),
        )
        LoanInstallment.objects.bulk_create(_specs_to_rows(movement, specs))

    @staticmethod
    @transaction.atomic
    def create(employee, kind, date, amount, *, notes="", loan: LoanTerms | None = None,
               treasury: TreasuryPayload | None = None, user=None) -> EmployeeMovement:
        if not employee.is_active:
            raise ValidationError(_("El empleado está archivado y no puede recibir movimientos nuevos."))
        if kind not in (EmployeeMovement.Kind.ADVANCE, EmployeeMovement.Kind.LOAN):
            raise ValidationError(_("Los pagos de remuneración se registran desde la liquidación."))
        if kind == EmployeeMovement.Kind.LOAN and loan is None:
            raise ValidationError(_("El préstamo requiere tasa, cuotas y primera cuota."))

        fields = {}
        if kind == EmployeeMovement.Kind.LOAN:
            fields = dict(
                rate=loan.rate, rate_period=loan.rate_period, installments_count=loan.installments,
                first_installment_year=loan.first_year, first_installment_month=loan.first_month,
            )
        movement = EmployeeMovement.objects.create(
            employee=employee, kind=kind, date=date, amount=amount, notes=notes, **fields
        )
        if kind == EmployeeMovement.Kind.LOAN:
            specs = loans.build_schedule(
                int(amount), loans.monthly_rate(loan.rate, loan.rate_period), loan.installments,
                (loan.first_year, loan.first_month),
            )
            LoanInstallment.objects.bulk_create(_specs_to_rows(movement, specs))
        if treasury is not None:
            EmployeeMovementService._disburse(movement, treasury, user)
        return movement

    @staticmethod
    def _disburse(movement, treasury: TreasuryPayload, user) -> None:
        from treasury.models import PaymentMethod, TreasuryAccount, TreasuryMovement
        from treasury.services import TreasuryService

        settings = AccountingSettings.get_solo()
        if movement.kind == EmployeeMovement.Kind.LOAN and not settings.account_prestamos_trabajadores:
            raise ValidationError(_("Configure la cuenta Préstamos a Trabajadores antes de desembolsar un préstamo."))
        if movement.kind == EmployeeMovement.Kind.ADVANCE and not settings.account_anticipos:
            raise ValidationError(_("Configure la cuenta Anticipos de Remuneraciones antes de desembolsar un anticipo."))
        account = TreasuryAccount.objects.filter(pk=treasury.treasury_account_id).first()
        if account is None:
            raise ValidationError(_("La cuenta de tesorería no existe."))
        method = PaymentMethod.objects.filter(pk=treasury.payment_method_id).first() if treasury.payment_method_id else None
        is_loan = movement.kind == EmployeeMovement.Kind.LOAN
        label = "Préstamo" if is_loan else "Anticipo de sueldo"
        result = TreasuryService.create_movement(
            amount=movement.amount,
            movement_type=TreasuryMovement.Type.OUTBOUND,
            from_account=account,
            payment_method=treasury.payment_method_slug or TreasuryMovement.Method.CASH,
            payment_method_new=method,
            transaction_number=treasury.transaction_number,
            reference=f"{label}: {movement.employee.contact.name} - {movement.date}",
            date=movement.date,
            partner=movement.employee.contact,
            payroll_payment_type=(
                TreasuryMovement.PayrollPaymentType.LOAN if is_loan else TreasuryMovement.PayrollPaymentType.ADVANCE
            ),
            created_by=user,
        )
        if result and result.journal_entry:
            movement.journal_entry = result.journal_entry
            movement.status = EmployeeMovement.Status.POSTED
            movement.save(update_fields=["journal_entry", "status"])

    @staticmethod
    @transaction.atomic
    def allocate(movement, payroll, amount: int | Decimal | None = None) -> PayrollAllocation:
        from core.services.document import lock_document

        lock_document(movement)
        lock_document(payroll)
        if movement.kind == EmployeeMovement.Kind.PAYMENT:
            raise ValidationError(_("Los pagos de remuneración no se asignan manualmente."))
        if movement.status != EmployeeMovement.Status.POSTED:
            raise ValidationError(_("Solo se pueden asignar movimientos contabilizados con saldo."))
        if payroll.status != Payroll.Status.DRAFT:
            raise ValidationError(_("La liquidación está contabilizada; no se pueden cambiar sus asignaciones."))
        if payroll.employee_id != movement.employee_id:
            raise ValidationError(_("La liquidación pertenece a otro empleado."))

        free = movement.amount - _committed_principal(movement)
        installment = None
        if movement.kind == EmployeeMovement.Kind.ADVANCE:
            value = _to_amount(amount) if amount is not None else free
            if value <= 0 or value > free:
                raise ValidationError(_("El monto debe ser mayor a cero y no exceder el saldo del anticipo."))
            principal_part, interest_part = value, Decimal("0")
        else:
            installment = _next_free_installment(movement)
            if installment is None:
                raise ValidationError(_("El préstamo no tiene cuotas pendientes."))
            value = _to_amount(amount) if amount is not None else installment.amount
            principal_part, interest_part = EmployeeMovementService._split_loan(movement, free, value)

        assigned = payroll.allocations.aggregate(total=Sum("amount"))["total"] or Decimal("0")
        if assigned + value > payroll.net_salary:
            raise ValidationError(_("Las asignaciones no pueden exceder el sueldo líquido de la liquidación."))

        if installment is not None:
            installment.principal, installment.interest, installment.amount = principal_part, interest_part, value
            installment.save(update_fields=["principal", "interest", "amount"])
        allocation = PayrollAllocation.objects.create(
            movement=movement, payroll=payroll, amount=value,
            principal_part=principal_part, interest_part=interest_part, installment=installment,
        )
        if installment is not None:
            _rebuild_pending(movement)
        return allocation

    @staticmethod
    def _split_loan(movement, free_capital: Decimal, value: Decimal) -> tuple[Decimal, Decimal]:
        r = _monthly_rate(movement)
        try:
            principal, interest = loans.split_installment(int(free_capital), r, int(value))
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        if principal > free_capital:
            raise ValidationError(_("La cuota excede el saldo del préstamo más su interés."))
        return Decimal(principal), Decimal(interest)

    @staticmethod
    @transaction.atomic
    def deallocate(allocation) -> None:
        from core.services.document import lock_document

        movement = lock_document(allocation.movement)
        payroll = lock_document(allocation.payroll)
        if payroll.status != Payroll.Status.DRAFT:
            raise ValidationError(_("La liquidación está contabilizada; no se pueden cambiar sus asignaciones."))
        allocation.delete()  # el post_delete reconstruye las cuotas pendientes

    @staticmethod
    @transaction.atomic
    def annul(movement, *, reason: str = "", user=None):
        from core.services.document import lock_document
        from treasury.services import TreasuryService

        lock_document(movement)
        if movement.status == EmployeeMovement.Status.CANCELLED:
            return movement
        if movement.status != EmployeeMovement.Status.POSTED:
            raise ValidationError(_("Solo se pueden anular movimientos contabilizados."))
        if movement.kind != EmployeeMovement.Kind.PAYMENT and movement.allocations.exists():
            raise ValidationError(_("Quite las asignaciones a liquidaciones antes de anular el movimiento."))
        treasury_movement = getattr(movement.journal_entry, "treasury_movement", None)
        if treasury_movement is None:
            raise ValidationError(_("El movimiento no tiene un pago de tesorería asociado."))
        TreasuryService.annul_movement(treasury_movement, user=user, reason=reason, from_owner=True)
        movement.status = EmployeeMovement.Status.CANCELLED
        movement.save(update_fields=["status"])
        return movement

    @staticmethod
    def cap_warning(payroll) -> str | None:
        configured = GlobalHRSettings.objects.filter(pk=1).first()  # un GET no escribe: sin fila rige el valor por defecto
        cap = configured.loan_deduction_cap_percent if configured else GlobalHRSettings._meta.get_field("loan_deduction_cap_percent").default
        deductions = payroll.allocations.exclude(movement__kind=EmployeeMovement.Kind.PAYMENT).aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0")
        if payroll.total_haberes and deductions > payroll.total_haberes * cap / Decimal("100"):
            return str(_("Los descuentos por anticipos y préstamos superan el %(cap)s %% de la remuneración total.") % {"cap": cap.normalize()})
        return None

    @staticmethod
    @transaction.atomic
    def pay_payroll(
        payroll,
        *,
        treasury_account_id: int,
        payment_date: date_type,
        payment_method: str = "TRANSFER",
        payment_method_id: int | None = None,
        notes: str = "",
        transaction_number: str | None = None,
        is_pending_registration: bool = False,
        created_by=None,
        amount: Decimal | None = None,
    ) -> EmployeeMovement:
        """Pago de remuneración: movimiento PAYMENT con su asignación a la liquidación (mismo asiento de siempre)."""
        from accounting.models import AccountingSettings
        from core.services.document import lock_document
        from treasury.models import PaymentMethod, TreasuryAccount, TreasuryMovement
        from treasury.services import TreasuryService

        lock_document(payroll)
        if payroll.status != Payroll.Status.POSTED:
            raise ValidationError(_("Solo se puede registrar pago de liquidaciones contabilizadas."))
        settings = AccountingSettings.get_solo()
        if not settings or not settings.account_remuneraciones_por_pagar:
            raise ValidationError(_("Falta configurar la cuenta Remuneraciones por Pagar en ajustes globales."))

        remaining = payroll_balance(payroll)
        if remaining <= 0:
            raise ValidationError(_("El sueldo líquido ya ha sido pagado en su totalidad (incluyendo anticipos)."))
        payment_amount = amount if amount is not None else remaining
        if payment_amount <= 0:
            raise ValidationError(_("El monto a pagar debe ser mayor a cero."))
        if payment_amount > remaining:
            raise ValidationError(
                _("El monto a pagar (%(a)s) excede el saldo pendiente (%(r)s).") % {"a": payment_amount, "r": remaining}
            )

        account = TreasuryAccount.objects.get(pk=treasury_account_id)
        method = PaymentMethod.objects.filter(pk=payment_method_id).first() if payment_method_id else None
        treasury_movement = TreasuryService.create_movement(
            amount=payment_amount,
            movement_type=TreasuryMovement.Type.OUTBOUND,
            payment_method=payment_method,
            payment_method_new=method,
            from_account=account,
            date=payment_date,
            partner=payroll.employee.contact,
            payroll=payroll,
            payroll_payment_type=TreasuryMovement.PayrollPaymentType.SALARY,
            reference=f"Pago Sueldo {payroll.display_id} - {payroll.period_label}",
            notes=notes,
            transaction_number=transaction_number,
            is_pending_registration=is_pending_registration,
            created_by=created_by,
        )
        movement = EmployeeMovement.objects.create(
            employee=payroll.employee, kind=EmployeeMovement.Kind.PAYMENT, date=payment_date, amount=payment_amount,
            notes=notes, status=EmployeeMovement.Status.POSTED, journal_entry=treasury_movement.journal_entry,
        )
        PayrollAllocation.objects.create(
            movement=movement, payroll=payroll, amount=payment_amount, principal_part=payment_amount, interest_part=0
        )
        return movement


@receiver(post_delete, sender=PayrollAllocation)
def rebuild_installments_after_allocation_removed(sender, instance, **kwargs):
    """Al quitar una asignación (o borrar su liquidación borrador) la cuota vuelve al plan recalculado."""
    if not instance.installment_id:
        return
    movement = EmployeeMovement.objects.filter(pk=instance.movement_id, status__in=_ACTIVE).first()
    if movement is not None:
        _rebuild_pending(movement)
